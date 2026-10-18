from fastapi import APIRouter
from app.schemas.transcribe import HealthResponse

router = APIRouter(tags=["Health"])

@router.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(status="ok", service="workpulse-voice")
