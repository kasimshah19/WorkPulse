from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import List, Union
from pydantic import field_validator

class Settings(BaseSettings):
    PORT: int = 8000
    ALLOWED_ORIGINS: Union[str, List[str]] = "http://localhost:3000,http://localhost:5000"
    INTERNAL_API_KEY: str = "workpulse-internal-voice-key-2026"

    # STT Provider
    STT_PROVIDER: str = "mock"  # mock | faster_whisper | openai
    WHISPER_MODEL: str = "base"
    WHISPER_DEVICE: str = "cpu"
    WHISPER_COMPUTE_TYPE: str = "int8"

    # OpenAI STT
    OPENAI_API_KEY: str = ""
    OPENAI_STT_MODEL: str = "whisper-1"

    # Concurrency and limits
    STT_CONCURRENCY: int = 1
    STT_TIMEOUT_SEC: int = 60
    MAX_AUDIO_BYTES: int = 5242880  # 5 MB
    MAX_AUDIO_SECONDS: int = 30
    LOG_TRANSCRIPTS: bool = False
    LOG_LEVEL: str = "info"

    @field_validator("ALLOWED_ORIGINS", mode="after")
    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
