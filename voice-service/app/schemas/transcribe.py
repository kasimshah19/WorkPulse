from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any

class TranscribeResponse(BaseModel):
    text: str = Field(description="Transcribed speech text")
    language: str = Field(default="hi", description="Detected or specified language")
    durationSec: float = Field(default=0.0, description="Audio duration in seconds")
    provider: str = Field(default="mock", description="STT Provider used")
    latencyMs: int = Field(default=0, description="Processing latency in milliseconds")

class SkillMatch(BaseModel):
    key: str
    confidence: float
    matchedText: str

class ExtractRequest(BaseModel):
    text: str
    language: str = "hi"
    allowedSkills: Optional[List[str]] = None

class ExtractResponse(BaseModel):
    skills: List[SkillMatch] = Field(default_factory=list)
    suggestions: List[SkillMatch] = Field(default_factory=list)
    experienceYears: Optional[int] = None
    perSkillYears: Dict[str, int] = Field(default_factory=dict)
    flags: List[str] = Field(default_factory=list)
    normalizedText: str = ""

class OnboardResponse(BaseModel):
    text: str
    language: str
    durationSec: float
    provider: str
    latencyMs: int
    skills: List[SkillMatch] = Field(default_factory=list)
    suggestions: List[SkillMatch] = Field(default_factory=list)
    experienceYears: Optional[int] = None
    perSkillYears: Dict[str, int] = Field(default_factory=dict)
    flags: List[str] = Field(default_factory=list)
    normalizedText: str = ""

class HealthResponse(BaseModel):
    status: str = "ok"
    service: str = "workpulse-voice"
    sttProvider: str = "mock"
    whisperModelLoaded: bool = False
