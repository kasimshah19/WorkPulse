import io
import wave
import json
import os
import pytest
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.services.skill_extractor import normalize, extract_skills_and_experience, LEXICON
from app.scripts.eval_extractor import run_evaluation

client = TestClient(app)

AUTH_HEADERS = {"X-Internal-Key": settings.INTERNAL_API_KEY}

def create_dummy_wav(duration_sec: float, sample_rate: int = 16000) -> bytes:
    """Generates an in-memory valid PCM WAV file with specified duration."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        num_frames = int(duration_sec * sample_rate)
        wf.writeframes(b"\x00\x00" * num_frames)
    return buf.getvalue()

# ==============================================================================
# 1. Normalization & Skill Extractor Unit Tests
# ==============================================================================

def test_normalize():
    assert normalize("Paaainter") == "painter"
    assert normalize("राजमिस्त्री!!") == "राजमिस्त्री"
    assert normalize("   5   saal   ") == "5 saal"
    assert normalize("५ साल") == "5 साल"  # Devanagari digit to ASCII
    assert normalize("") == ""
    assert normalize("फ़िटर") == "फिटर"  # Nukta removal

def test_extraction_happy_path():
    res = extract_skills_and_experience("main painter hoon, 5 saal ka experience hai")
    assert [s["key"] for s in res["skills"]] == ["painter"]
    assert res["experienceYears"] == 5

def test_negation_handling():
    res = extract_skills_and_experience("plumber nahi, painter hoon, 3 saal")
    assert [s["key"] for s in res["skills"]] == ["painter"]
    assert "NEGATED_SKILL_REMOVED" in res["flags"]
    assert res["experienceYears"] == 3

def test_compound_mistri():
    res = extract_skills_and_experience("raj mistri hoon 10 saal se")
    assert [s["key"] for s in res["skills"]] == ["mason"]
    assert "AMBIGUOUS_MISTRI" not in res["flags"]

def test_ambiguous_mistri():
    res = extract_skills_and_experience("main mistri hoon 4 saal")
    # Bare mistri goes to suggestions with confidence 0.5
    assert any(s["key"] == "mason" and s["confidence"] == 0.5 for s in res["suggestions"])
    assert "AMBIGUOUS_MISTRI" in res["flags"]

def test_golden_set_accuracy_threshold():
    results = run_evaluation()
    assert results["skillsAccuracy"] >= 90.0, f"Skills accuracy {results['skillsAccuracy']}% below 90% threshold"
    assert results["yearsAccuracy"] >= 85.0

def test_fuzz_inputs():
    fuzz_samples = [
        "",
        "😊👷🔧🎨🧱",
        "A" * 10000,
        "مرحبا بك في العمل",
        "<script>alert('xss')</script> DROP TABLE users;",
        "1234567890 !@#$%^&*()_+=-"
    ]
    for sample in fuzz_samples:
        res = extract_skills_and_experience(sample)
        assert isinstance(res["skills"], list)
        assert isinstance(res["flags"], list)

# ==============================================================================
# 2. API Endpoints & Auth Tests
# ==============================================================================

def test_health_public():
    res = client.get("/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["service"] == "workpulse-voice"
    assert "sttProvider" in data
    assert "whisperModelLoaded" in data

def test_endpoints_require_internal_key():
    # Without key
    res_extract = client.post("/extract", json={"text": "main painter hoon"})
    assert res_extract.status_code == 401

    # With wrong key
    res_wrong = client.post(
        "/extract",
        json={"text": "main painter hoon"},
        headers={"X-Internal-Key": "wrong-secret"}
    )
    assert res_wrong.status_code == 401

    # With correct key
    res_correct = client.post(
        "/extract",
        json={"text": "main painter hoon"},
        headers=AUTH_HEADERS
    )
    assert res_correct.status_code == 200
    assert any(s["key"] == "painter" for s in res_correct.json()["skills"])

# ==============================================================================
# 3. Audio Validation & Onboarding Flow
# ==============================================================================

def test_audio_invalid_magic_bytes():
    fake_audio = b"This is plain text, not an audio file"
    res = client.post(
        "/onboard",
        files={"file": ("test.webm", fake_audio, "audio/webm")},
        headers=AUTH_HEADERS
    )
    assert res.status_code == 415
    assert "AUDIO_INVALID" in res.json()["detail"]

def test_audio_too_long():
    long_wav = create_dummy_wav(duration_sec=35.0)  # > 30s limit
    res = client.post(
        "/onboard",
        files={"file": ("toolong.wav", long_wav, "audio/wav")},
        headers=AUTH_HEADERS
    )
    assert res.status_code == 422
    assert "AUDIO_TOO_LONG" in res.json()["detail"]

def test_audio_too_large():
    # Create fake oversized content (> 5MB)
    oversized = b"\x1a\x45\xdf\xa3" + (b"\x00" * (settings.MAX_AUDIO_BYTES + 10))
    res = client.post(
        "/onboard",
        files={"file": ("big.webm", oversized, "audio/webm")},
        headers=AUTH_HEADERS
    )
    assert res.status_code == 413
    assert "AUDIO_TOO_LARGE" in res.json()["detail"]

def test_onboard_mock_happy_path():
    valid_wav = create_dummy_wav(duration_sec=3.0)
    res = client.post(
        "/onboard",
        files={"file": ("audio.wav", valid_wav, "audio/wav")},
        data={"mockTranscript": "main electrician hoon, saat saal ka experience", "language": "hi"},
        headers=AUTH_HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert data["provider"] == "mock"
    assert "electrician" in [s["key"] for s in data["skills"]]
    assert data["experienceYears"] == 7

def test_no_speech_detected():
    valid_wav = create_dummy_wav(duration_sec=2.0)
    res = client.post(
        "/onboard",
        files={"file": ("audio.wav", valid_wav, "audio/wav")},
        data={"mockTranscript": "   ", "language": "hi"},
        headers=AUTH_HEADERS
    )
    assert res.status_code == 422
    assert "NO_SPEECH_DETECTED" in res.json()["detail"]

# ==============================================================================
# 4. Lexicon Completeness Check against Backend Constants
# ==============================================================================

def test_lexicon_covers_all_backend_skills():
    """Asserts that every skill key defined in backend constants.js is covered in lexicon.json."""
    constants_file = Path(__file__).parent.parent.parent / "backend" / "src" / "config" / "constants.js"
    assert constants_file.exists(), "backend constants.js file not found"

    content = constants_file.read_text(encoding="utf-8")
    # Extract strings from export const SKILLS = Object.freeze([...])
    skills_block = content.split("export const SKILLS = Object.freeze([")[1].split("]);")[0]
    skill_keys = [
        line.split("'")[1] for line in skills_block.splitlines() if "'" in line
    ]

    for key in skill_keys:
        assert key in LEXICON, f"Skill '{key}' from backend constants.js is missing in voice-service lexicon.json"

@pytest.mark.skipif(os.getenv("RUN_WHISPER_TESTS") != "1", reason="faster-whisper integration tests skipped unless RUN_WHISPER_TESTS=1")
def test_faster_whisper_transcription():
    # Only runs when explicitly requested
    valid_wav = create_dummy_wav(duration_sec=2.0)
    res = client.post(
        "/transcribe",
        files={"file": ("test.wav", valid_wav, "audio/wav")},
        headers=AUTH_HEADERS
    )
    assert res.status_code in [200, 422]
