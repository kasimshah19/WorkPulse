'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg',
];

export function useVoiceRecorder({ maxDurationSec = 20, onRecordingComplete } = {}) {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 1 for live level meter
  const [noSoundDetected, setNoSoundDetected] = useState(false);
  const [error, setError] = useState(null);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const silenceTimerRef = useRef(null);
  const mimeTypeRef = useRef('audio/webm');

  // Find first supported mime type
  const getSupportedMimeType = () => {
    if (typeof window === 'undefined' || !window.MediaRecorder) return 'audio/webm';
    for (const type of CANDIDATE_MIME_TYPES) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm';
  };

  const cleanupAudioNodes = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {
        // ignore
      }
      audioContextRef.current = null;
    }
    // ALWAYS stop all microphone tracks so browser mic indicator turns off
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    cleanupAudioNodes();
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    cleanupAudioNodes();
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setAudioLevel(0);
    setNoSoundDetected(false);
    audioChunksRef.current = [];

    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      setError('माइक्रोफ़ोन एक्सेस समर्थित नहीं है। (Microphone access not supported)');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Audio analysis for level meter & silence detection
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let maxVolumeSeen = 0;

        const checkAudioLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128);
          setAudioLevel(normalized);

          if (normalized > 0.05) {
            maxVolumeSeen = Math.max(maxVolumeSeen, normalized);
          }

          animFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };
        animFrameRef.current = requestAnimationFrame(checkAudioLevel);

        // Check for silence after 3 seconds
        silenceTimerRef.current = setTimeout(() => {
          if (maxVolumeSeen < 0.08) {
            setNoSoundDetected(true);
          }
        }, 3000);
      }

      // Recorder setup
      const chosenMime = getSupportedMimeType();
      mimeTypeRef.current = chosenMime;
      const mediaRecorder = new MediaRecorder(stream, { mimeType: chosenMime });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        cleanupAudioNodes();
        setRecording(false);
        if (onRecordingComplete) {
          onRecordingComplete(blob, mimeTypeRef.current);
        }
      };

      mediaRecorder.start(250); // Slice every 250ms
      setRecording(true);

      // Duration timer & auto-stop at maxDurationSec (default 20s)
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000);
        setDuration(elapsedSec);
        if (elapsedSec >= maxDurationSec) {
          stop();
        }
      }, 250);
    } catch (err) {
      cleanupAudioNodes();
      setRecording(false);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('माइक्रोफ़ोन की अनुमति अस्वीकार कर दी गई। (Permission denied)');
      } else {
        setError(err.message || 'माइक्रोफ़ोन शुरू करने में समस्या आई');
      }
    }
  }, [maxDurationSec, onRecordingComplete, stop]);

  useEffect(() => {
    return () => {
      cleanupAudioNodes();
    };
  }, []);

  return {
    recording,
    audioBlob,
    audioUrl,
    duration,
    maxDurationSec,
    audioLevel,
    noSoundDetected,
    error,
    start,
    stop,
    reset: () => {
      cleanupAudioNodes();
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      setAudioLevel(0);
      setNoSoundDetected(false);
      setError(null);
    },
  };
}

export default useVoiceRecorder;
