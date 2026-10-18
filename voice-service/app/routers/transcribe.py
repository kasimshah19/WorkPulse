from fastapi import APIRouter, UploadFile, File
from app.schemas.transcribe import TranscribeResponse
from app.services.stt_service import transcribe_audio
from app.services.skill_extractor import extract_skills

router = APIRouter(tags=["Transcription"])

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe(file: UploadFile = File(...)):
    """
    Accepts an audio file and transcribes speech to text, then extracts trade skills.
    Returns mocked response with TODO.
    """
    # Read audio bytes (stub)
    content = await file.read()
    
    # Delegate to stt service stub
    stt_result = await transcribe_audio(content, file.filename or "audio.wav")
    extracted = await extract_skills(stt_result["text"])
    
    return TranscribeResponse(
        text=stt_result["text"],
        language=stt_result["language"],
        skills=extracted,
        todo="TODO Phase 5: Integrate Whisper speech-to-text and LLM skill extractor"
    )
