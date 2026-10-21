from fastapi import APIRouter
from app.schemas.transcribe import HealthResponse
from app.core.config import settings
from app.services.stt_service import is_model_loaded

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Public health check endpoint.
    Reports service status, active STT provider, and whether Whisper model is loaded in memory.
    """
    return HealthResponse(
        status="ok",
        service="workpulse-voice",
        sttProvider=settings.STT_PROVIDER,
        whisperModelLoaded=is_model_loaded()
    )
