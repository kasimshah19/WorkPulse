from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import health_router, transcribe_router

app = FastAPI(
    title="WorkPulse Voice Service",
    description="Microservice for speech-to-text, Indian language audio parsing, and skill extraction",
    version="0.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS if isinstance(settings.ALLOWED_ORIGINS, list) else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health_router)
app.include_router(transcribe_router)

@app.get("/")
async def root():
    return {
        "service": "workpulse-voice",
        "version": "0.0.0",
        "status": "online"
    }
