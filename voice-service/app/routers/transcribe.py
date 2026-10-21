import io
import json
import wave
from typing import Optional, List
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status

from app.core.config import settings
from app.core.auth import verify_internal_key
from app.schemas.transcribe import (
    TranscribeResponse,
    ExtractRequest,
    ExtractResponse,
    OnboardResponse
)
from app.services.stt_service import transcribe_audio_service
from app.services.skill_extractor import extract_skills_and_experience

router = APIRouter(tags=["Transcription & Onboarding"])

def validate_audio_content(content: bytes, client_duration_ms: Optional[int] = None) -> str:
    """
    Validates audio file size, magic bytes format, and duration.
    Throws standard HTTP exceptions: 413, 415, 422.
    """
    # 1. Size Validation (413 AUDIO_TOO_LARGE)
    if len(content) > settings.MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"AUDIO_TOO_LARGE: Audio size ({len(content)} bytes) exceeds max {settings.MAX_AUDIO_BYTES} bytes"
        )

    if len(content) < 4:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="AUDIO_INVALID: File too small to contain valid audio header"
        )

    # 2. Magic Bytes Validation (415 AUDIO_INVALID)
    format_detected = None
    if len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WAVE":
        format_detected = "wav"
    elif content[:4] == b"\x1a\x45\xdf\xa3":
        format_detected = "webm"
    elif content[:4] == b"OggS":
        format_detected = "ogg"
    elif len(content) >= 8 and content[4:8] == b"ftyp":
        format_detected = "mp4"
    elif content[:3] == b"ID3" or (len(content) >= 2 and content[0] == 0xff and (content[1] & 0xe0) == 0xe0):
        format_detected = "mp3"

    if not format_detected:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="AUDIO_INVALID: Unsupported audio format or invalid magic bytes"
        )

    # 3. Duration Validation (422 AUDIO_TOO_LONG)
    if format_detected == "wav":
        try:
            with wave.open(io.BytesIO(content), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    duration_sec = frames / float(rate)
                    if duration_sec > settings.MAX_AUDIO_SECONDS:
                        raise HTTPException(
                            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                            detail=f"AUDIO_TOO_LONG: Audio duration ({duration_sec:.1f}s) exceeds max limit ({settings.MAX_AUDIO_SECONDS}s)"
                        )
        except wave.Error:
            pass  # Fall back to client hint if wave parsing fails
    elif client_duration_ms is not None:
        if (client_duration_ms / 1000.0) > settings.MAX_AUDIO_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"AUDIO_TOO_LONG: Audio duration ({client_duration_ms/1000:.1f}s) exceeds max limit ({settings.MAX_AUDIO_SECONDS}s)"
            )

    return format_detected

@router.post("/transcribe", response_model=TranscribeResponse, dependencies=[Depends(verify_internal_key)])
async def transcribe(
    file: UploadFile = File(...),
    language: str = Form("hi"),
    clientDurationMs: Optional[int] = Form(None),
    mockTranscript: Optional[str] = Form(None)
):
    """
    Transcribes audio into text using configured STT provider (mock, faster-whisper, or openai).
    Requires X-Internal-Key authentication header.
    """
    content = await file.read()
    validate_audio_content(content, clientDurationMs)

    result = await transcribe_audio_service(
        content,
        filename=file.filename or "audio.wav",
        language=language,
        mock_transcript=mockTranscript
    )

    if not result.get("text", "").strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="NO_SPEECH_DETECTED: No speech recognized in provided audio"
        )

    return TranscribeResponse(
        text=result["text"],
        language=result["language"],
        durationSec=result["durationSec"],
        provider=result["provider"],
        latencyMs=result["latencyMs"]
    )

@router.post("/extract", response_model=ExtractResponse, dependencies=[Depends(verify_internal_key)])
async def extract(req: ExtractRequest):
    """
    Extracts blue-collar trade skills and experience from speech transcript.
    Deterministic rule-based matching with negation handling and ambiguity tagging.
    """
    extracted = extract_skills_and_experience(
        req.text,
        language=req.language,
        allowed_skills=req.allowedSkills
    )
    return ExtractResponse(**extracted)

@router.post("/onboard", response_model=OnboardResponse, dependencies=[Depends(verify_internal_key)])
async def onboard_voice(
    file: UploadFile = File(...),
    language: str = Form("hi"),
    allowedSkills: Optional[str] = Form(None),
    clientDurationMs: Optional[int] = Form(None),
    mockTranscript: Optional[str] = Form(None)
):
    """
    One-step server audio onboarding pipeline:
    1. Validates audio magic bytes, size, and duration.
    2. Converts speech to text via STT.
    3. Extracts skills and experience.
    Never persists audio to disk or DB.
    """
    content = await file.read()
    validate_audio_content(content, clientDurationMs)

    # 1. Transcribe
    stt_res = await transcribe_audio_service(
        content,
        filename=file.filename or "audio.wav",
        language=language,
        mock_transcript=mockTranscript
    )

    transcribed_text = stt_res.get("text", "").strip()
    if not transcribed_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="NO_SPEECH_DETECTED: No intelligible speech recognized in audio"
        )

    # Parse allowedSkills if passed as JSON string
    allowed_list: Optional[List[str]] = None
    if allowedSkills:
        try:
            allowed_list = json.loads(allowedSkills)
        except Exception:
            pass

    # 2. Extract Skills and Experience
    extracted = extract_skills_and_experience(
        transcribed_text,
        language=stt_res["language"],
        allowed_skills=allowed_list
    )

    return OnboardResponse(
        text=transcribed_text,
        language=stt_res["language"],
        durationSec=stt_res["durationSec"],
        provider=stt_res["provider"],
        latencyMs=stt_res["latencyMs"],
        skills=extracted["skills"],
        suggestions=extracted["suggestions"],
        experienceYears=extracted["experienceYears"],
        perSkillYears=extracted["perSkillYears"],
        flags=extracted["flags"],
        normalizedText=extracted["normalizedText"]
    )
