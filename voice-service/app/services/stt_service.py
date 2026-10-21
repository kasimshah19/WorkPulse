import io
import time
import asyncio
from typing import Dict, Any, Optional
from fastapi import HTTPException, status
import httpx

from app.core.config import settings

# Concurrency semaphore for CPU-bound STT operations
_stt_semaphore = asyncio.Semaphore(settings.STT_CONCURRENCY)

# Global lazy-loaded faster-whisper model
_whisper_model = None

# Known silence hallucination phrases common in Whisper models
HALLUCINATION_BLOCKLIST = {
    "thank you for watching", "thanks for watching", "subscribe", "subtitles by",
    "you", "thank you", "bye", "amara.org", "watching", "the end"
}

TRADE_INITIAL_PROMPT = (
    "painter, plumber, electrician, mistri, raj mistri, majdoor, beldar, badhai, "
    "rang, bijli, nal, saal, experience, वर्ष, अनुभव, काम, सुतार, गवंडी, रंगारी, नळ"
)

def _get_whisper_model():
    """Lazy-loads the faster-whisper model on first actual inference call."""
    global _whisper_model
    if _whisper_model is None:
        try:
            from faster_whisper import WhisperModel
            print(f"[STT] Loading faster-whisper model '{settings.WHISPER_MODEL}' on {settings.WHISPER_DEVICE} ({settings.WHISPER_COMPUTE_TYPE})...")
            _whisper_model = WhisperModel(
                settings.WHISPER_MODEL,
                device=settings.WHISPER_DEVICE,
                compute_type=settings.WHISPER_COMPUTE_TYPE
            )
            print("[STT] faster-whisper model loaded successfully.")
        except ImportError:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="faster-whisper is not installed. Install requirements-whisper.txt to use faster_whisper provider."
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"STT_FAILED: Failed to initialize Whisper model: {str(e)}"
            )
    return _whisper_model

def is_model_loaded() -> bool:
    """Helper for health check endpoint."""
    return _whisper_model is not None

def _run_faster_whisper(audio_bytes: bytes, language: str) -> Dict[str, Any]:
    """Runs faster-whisper transcription inside a background worker thread."""
    model = _get_whisper_model()
    audio_stream = io.BytesIO(audio_bytes)

    # Force language if user selected hi, mr, or en (Never auto-detect when chosen)
    forced_lang = language if language in ["hi", "mr", "en"] else None

    segments, info = model.transcribe(
        audio_stream,
        language=forced_lang,
        vad_filter=True,
        condition_on_previous_text=False,
        beam_size=5,
        initial_prompt=TRADE_INITIAL_PROMPT
    )

    text_parts = [segment.text.strip() for segment in segments]
    transcribed_text = " ".join(text_parts).strip()
    detected_lang = info.language or language

    # Hallucination filter for short or empty audios
    lower_text = transcribed_text.lower().strip()
    if lower_text in HALLUCINATION_BLOCKLIST or len(lower_text) < 2:
        transcribed_text = ""

    return {
        "text": transcribed_text,
        "language": detected_lang,
        "durationSec": round(info.duration, 2)
    }

async def _run_openai_stt(audio_bytes: bytes, filename: str, language: str) -> Dict[str, Any]:
    """Calls OpenAI Audio Transcription API via httpx without SDK."""
    if not settings.OPENAI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="STT_FAILED: OPENAI_API_KEY not configured on voice-service"
        )

    url = "https://api.openai.com/v1/audio/transcriptions"
    headers = {"Authorization": f"Bearer {settings.OPENAI_API_KEY}"}
    files = {"file": (filename, audio_bytes, "audio/wav")}
    data = {"model": settings.OPENAI_STT_MODEL}
    if language in ["hi", "mr", "en"]:
        data["language"] = language

    try:
        async with httpx.AsyncClient(timeout=settings.STT_TIMEOUT_SEC) as client:
            resp = await client.post(url, headers=headers, files=files, data=data)
            if resp.status_code != 200:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"STT_FAILED: OpenAI returned {resp.status_code}: {resp.text}"
                )
            result = resp.json()
            return {
                "text": result.get("text", "").strip(),
                "language": language,
                "durationSec": 0.0
            }
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="STT_TIMEOUT: OpenAI audio transcription timed out"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"STT_FAILED: {str(e)}"
        )

async def transcribe_audio_service(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    language: str = "hi",
    mock_transcript: Optional[str] = None
) -> Dict[str, Any]:
    """
    Main entry point for converting audio bytes into text.
    Handles provider selection, concurrency limits, latency measurements, and error mapping.
    """
    start_time = time.time()
    provider = settings.STT_PROVIDER.lower()

    async with _stt_semaphore:
        if provider == "mock":
            await asyncio.sleep(0.05)  # Simulate small async processing
            if mock_transcript is not None:
                text = str(mock_transcript).strip()
            else:
                # Default Hindi sample utterance
                text = "main painter hoon, 5 saal ka experience hai"
            duration_sec = 2.5
            detected_lang = language if language != "auto" else "hi"
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "text": text,
                "language": detected_lang,
                "durationSec": duration_sec,
                "provider": "mock",
                "latencyMs": latency_ms
            }

        elif provider == "faster_whisper":
            try:
                loop = asyncio.get_running_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, _run_faster_whisper, audio_bytes, language),
                    timeout=settings.STT_TIMEOUT_SEC
                )
            except asyncio.TimeoutError:
                raise HTTPException(
                    status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                    detail="STT_TIMEOUT: Audio transcription timed out"
                )
            except HTTPException:
                raise
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"STT_FAILED: {str(e)}"
                )

            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "text": result["text"],
                "language": result["language"],
                "durationSec": result["durationSec"],
                "provider": "faster_whisper",
                "latencyMs": latency_ms
            }

        elif provider == "openai":
            result = await _run_openai_stt(audio_bytes, filename, language)
            latency_ms = int((time.time() - start_time) * 1000)
            return {
                "text": result["text"],
                "language": result["language"],
                "durationSec": result["durationSec"],
                "provider": "openai",
                "latencyMs": latency_ms
            }

        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Unsupported STT provider: {provider}"
            )

# Backward-compatible wrapper
async def transcribe_audio(file_bytes: bytes, filename: str = "audio.wav") -> dict:
    return await transcribe_audio_service(file_bytes, filename)
