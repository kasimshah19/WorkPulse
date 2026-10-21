'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Maps standard Web Speech API error codes to friendly localized messages
 */
const ERROR_MESSAGES = {
  'not-allowed': 'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र सेटिंग्स में अनुमति दें। (Microphone access denied)',
  'service-not-allowed': 'स्पीच सेवा की अनुमति नहीं है। कृपया सेटिंग्स जांचें। (Speech service not allowed)',
  'no-speech': 'कोई आवाज़ सुनाई नहीं दी। कृपया माइक के पास बोलें। (No speech detected)',
  'audio-capture': 'माइक्रोफ़ोन नहीं मिल रहा है। (No microphone found)',
  'network': 'नेटवर्क कनेक्शन की समस्या है। कृपया इंटरनेट जांचें। (Network error)',
  'language-not-supported': 'यह भाषा इस ब्राउज़र में समर्थित नहीं है। (Language not supported)',
};

/**
 * Hook for Web Speech API recognition
 * Returns { supported, listening, interim, finalText, error, start, stop }
 */
export function useSpeechRecognition({ lang = 'hi-IN', onFinalTranscript } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [finalText, setFinalText] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSupported(true);
      }
    }
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // Already stopped
      }
      setListening(false);
    }
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('आपके ब्राउज़र में वेब स्पीच समर्थित नहीं है। (Web Speech not supported)');
      return;
    }

    setError(null);
    setInterim('');
    setFinalText('');

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = lang || 'hi-IN';

      recognition.onstart = () => {
        setListening(true);
      };

      recognition.onresult = (event) => {
        let interimText = '';
        let completedText = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            completedText += item[0].transcript;
          } else {
            interimText += item[0].transcript;
          }
        }

        if (interimText) {
          setInterim(interimText);
        }
        if (completedText) {
          const cleanFinal = completedText.trim();
          setFinalText(cleanFinal);
          setInterim('');
          if (onFinalTranscript) {
            onFinalTranscript(cleanFinal);
          }
        }
      };

      recognition.onerror = (event) => {
        const friendlyMsg =
          ERROR_MESSAGES[event.error] ||
          `स्पीच एरर: ${event.error} (Speech error occurred)`;
        setError(friendlyMsg);
        setListening(false);
      };

      recognition.onend = () => {
        setListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setError(err.message || 'स्पीच रिकॉग्निशन शुरू नहीं हो सका');
      setListening(false);
    }
  }, [lang, onFinalTranscript]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    supported,
    listening,
    interim,
    finalText,
    error,
    start,
    stop,
    reset: () => {
      setInterim('');
      setFinalText('');
      setError(null);
    },
  };
}

export default useSpeechRecognition;
