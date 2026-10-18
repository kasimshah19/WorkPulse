import pytest
from fastapi.testclient import TestClient
import io
from app.main import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "workpulse-voice"

def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["service"] == "workpulse-voice"

def test_transcribe_mock():
    # Test uploading a mock wav audio file
    fake_audio = io.BytesIO(b"RIFF....WAVEfmt ....data....")
    response = client.post(
        "/transcribe",
        files={"file": ("test.wav", fake_audio, "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert "text" in data
    assert data["language"] == "hi"
    assert "skills" in data
    assert "TODO Phase 5" in data["todo"]
