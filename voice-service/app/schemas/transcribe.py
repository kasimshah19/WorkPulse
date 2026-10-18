from pydantic import BaseModel, Field
from typing import List

class TranscribeResponse(BaseModel):
    text: str = Field(default="", description="Transcribed speech text")
    language: str = Field(default="hi", description="Detected or requested language code")
    skills: List[str] = Field(default_factory=list, description="Extracted worker skills")
    todo: str = Field(
        default="TODO Phase 5: Integrate Whisper STT and LLM/NLP skill extraction",
        description="Phase implementation note"
    )

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "workpulse-voice"
