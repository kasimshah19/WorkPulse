'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook for speech synthesis readback
 * Silently no-ops if speech synthesis is not supported.
 */
export function useSpeechSynthesis({ defaultLang = 'hi-IN' } = {}) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef([]);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
      const updateVoices = () => {
        voicesRef.current = window.speechSynthesis.getVoices();
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  const speak = useCallback(
    (text, lang = defaultLang) => {
      if (!supported || typeof window === 'undefined' || !text) return;

      try {
        window.speechSynthesis.cancel(); // Stop any ongoing speech

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = lang;
        utterance.rate = 0.95; // Slightly slower for clarity
        utterance.pitch = 1.0;

        // Try to match voice for the language
        if (voicesRef.current && voicesRef.current.length > 0) {
          const matchingVoice = voicesRef.current.find(
            (v) => v.lang === lang || v.lang.startsWith(lang.split('-')[0])
          );
          if (matchingVoice) {
            utterance.voice = matchingVoice;
          }
        }

        utterance.onstart = () => setSpeaking(true);
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);

        window.speechSynthesis.speak(utterance);
      } catch {
        setSpeaking(false);
      }
    },
    [supported, defaultLang]
  );

  const stop = useCallback(() => {
    if (supported && typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [supported]);

  useEffect(() => {
    return () => {
      if (supported && typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
    };
  }, [supported]);

  return {
    supported,
    speaking,
    speak,
    stop,
  };
}

export default useSpeechSynthesis;
