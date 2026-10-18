"""
STT Service Stub
Handles speech-to-text conversion for Indian languages (Hindi, Marathi, Hinglish).

TODO Phase 5: Integrate OpenAI Whisper / faster-whisper or Indic-Conformer.
"""

async def transcribe_audio(file_bytes: bytes, filename: str = "audio.wav") -> dict:
    # TODO Phase 5: Run Whisper audio transcription pipeline
    return {
        "text": "",
        "language": "hi",
        "duration_seconds": 0.0,
        "note": "TODO Phase 5: Whisper STT model inference"
    }
