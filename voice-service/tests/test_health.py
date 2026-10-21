import pytest
from fastapi.testclient import TestClient
import io
import wave
from app.main import app
from app.core.config import settings

client = TestClient(app)

def create_valid_wav() -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(16000)
        wf.writeframes(b"\x00\x00" * 16000)
    return buf.getvalue()

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "workpulse-voice"
    assert "sttProvider" in data
    assert "whisperModelLoaded" in data

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "workpulse-voice"

def test_transcribe_mock():
    # Test uploading a mock wav audio file with internal auth key
    wav_bytes = create_valid_wav()
    response = client.post(
        "/transcribe",
        files={"file": ("test.wav", wav_bytes, "audio/wav")},
        headers={"X-Internal-Key": settings.INTERNAL_API_KEY}
    )
    assert response.status_code == 200
    data = response.json()
    assert "text" in data
    assert data["language"] == "hi"
    assert "durationSec" in data
    assert data["provider"] == "mock"
