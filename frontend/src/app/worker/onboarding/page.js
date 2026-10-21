'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Mic,
  MicOff,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  MapPin,
  Navigation,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Check,
  Plus,
  Minus,
  HelpCircle,
  FileAudio,
  Keyboard,
  Sliders,
  Globe,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { useTranslation } from '../../../hooks/useTranslation';
import useSpeechRecognition from '../../../hooks/useSpeechRecognition';
import useVoiceRecorder from '../../../hooks/useVoiceRecorder';
import useSpeechSynthesis from '../../../hooks/useSpeechSynthesis';
import SkillIcon from '../../../components/SkillIcon';
import {
  FRONTEND_SKILLS_CATALOG,
  FRONTEND_SKILLS_MAP,
} from '../../../config/skillsCatalog';

const GOLDEN_UTTERANCES = [
  'main painter hoon, 5 saal ka experience hai',
  'मैं पेंटर हूँ और पाँच साल का अनुभव है',
  'mi painter aahe, pach varshacha anubhav aahe',
  'मी पेंटर आहे, पाच वर्षांचा अनुभव आहे',
  'plumber nahi, painter hoon, 3 saal',
  'raj mistri hoon das saal se kaam kar raha hoon',
  'bijli ka kaam aata hai, wiring karta hoon, 2 saal',
  'painter aur plumber dono ka kaam karta hoon',
  'I am an electrician with seven years experience',
  'मजदूर हूँ, नया हूँ, अनुभव नहीं है',
];

export default function WorkerOnboardingPage() {
  const router = useRouter();
  const { user, updateUser, isAuthenticated } = useAuthStore();
  const { t, language, setLanguage } = useTranslation();
  const { speak } = useSpeechSynthesis({
    defaultLang: language === 'mr' ? 'mr-IN' : language === 'en' ? 'en-IN' : 'hi-IN',
  });

  // Step state: 1: Language, 2: Consent, 3: Voice, 4: Confirm, 5: Icon Fallback, 6: Location & UPI, 7: Done
  const [step, setStep] = useState(1);
  const [voiceMode, setVoiceMode] = useState(
    process.env.NEXT_PUBLIC_VOICE_MODE || 'auto'
  );
  const [effectivePath, setEffectivePath] = useState('webspeech'); // 'webspeech' or 'server'

  // Voice recognition and processing states
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState(null);
  const [failureCount, setFailureCount] = useState(0);

  // Draft extraction results from API
  const [sessionId, setSessionId] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [experienceYears, setExperienceYears] = useState(3);
  const [flags, setFlags] = useState([]);
  const [extractedMethod, setExtractedMethod] = useState('WEBSPEECH_TEXT');

  // Location & UPI step
  const [lat, setLat] = useState(18.5204);
  const [lng, setLng] = useState(73.8567);
  const [upiId, setUpiId] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  // Dev tools state
  const isDevMode =
    process.env.NEXT_PUBLIC_DEV_MODE === 'true' ||
    process.env.NODE_ENV !== 'production';
  const [devToolsOpen, setDevToolsOpen] = useState(false);
  const [typeInput, setTypeInput] = useState('');
  const fileInputRef = useRef(null);

  // Load saved session state from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('workpulse_onboarding_state');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.step) setStep(parsed.step);
          if (parsed.sessionId) setSessionId(parsed.sessionId);
          if (parsed.transcript) setTranscript(parsed.transcript);
          if (parsed.selectedSkills) setSelectedSkills(parsed.selectedSkills);
          if (parsed.suggestions) setSuggestions(parsed.suggestions);
          if (parsed.experienceYears !== undefined)
            setExperienceYears(parsed.experienceYears);
          if (parsed.flags) setFlags(parsed.flags);
          if (parsed.extractedMethod) setExtractedMethod(parsed.extractedMethod);
        } catch {
          // ignore parsing error
        }
      }
    }
  }, []);

  // Sync state to sessionStorage
  const saveState = (updates) => {
    if (typeof window !== 'undefined') {
      const current = {
        step,
        sessionId,
        transcript,
        selectedSkills,
        suggestions,
        experienceYears,
        flags,
        extractedMethod,
        ...updates,
      };
      sessionStorage.setItem(
        'workpulse_onboarding_state',
        JSON.stringify(current)
      );
    }
  };

  // Determine effective path (WebSpeech vs Server Audio)
  const speechLang =
    language === 'mr' ? 'mr-IN' : language === 'en' ? 'en-IN' : 'hi-IN';

  const webSpeech = useSpeechRecognition({
    lang: speechLang,
    onFinalTranscript: (text) => {
      handleWebSpeechResult(text);
    },
  });

  const recorder = useVoiceRecorder({
    maxDurationSec: 20,
    onRecordingComplete: (blob, mimeType) => {
      handleAudioRecorded(blob, mimeType);
    },
  });

  useEffect(() => {
    if (voiceMode === 'webspeech') {
      setEffectivePath('webspeech');
    } else if (voiceMode === 'server') {
      setEffectivePath('server');
    } else {
      // auto: use webspeech if browser supports it and online, else server
      if (webSpeech.supported && typeof navigator !== 'undefined' && navigator.onLine) {
        setEffectivePath('webspeech');
      } else {
        setEffectivePath('server');
      }
    }
  }, [voiceMode, webSpeech.supported]);

  // STEP 1: Handle language selection
  const handleSelectLanguage = async (lang) => {
    setLanguage(lang);
    if (isAuthenticated) {
      try {
        await api.patch('/users/me', { languagePreference: lang });
        updateUser({ languagePreference: lang });
      } catch {
        // silent fail on network glitch
      }
    }
    setStep(2);
    saveState({ step: 2 });
  };

  // STEP 2: Consent
  const handleConsentAgree = () => {
    setStep(3);
    saveState({ step: 3 });
  };

  const handleConsentDecline = () => {
    setStep(5); // Go directly to icon grid
    saveState({ step: 5 });
  };

  // STEP 3: Voice Capture Handlers
  const handleToggleMic = () => {
    setVoiceError(null);
    if (effectivePath === 'webspeech') {
      if (webSpeech.listening) {
        webSpeech.stop();
      } else {
        webSpeech.start();
      }
    } else {
      if (recorder.recording) {
        recorder.stop();
      } else {
        recorder.start();
      }
    }
  };

  // Process WebSpeech text via POST /api/v1/voice/extract
  const handleWebSpeechResult = async (recognizedText) => {
    if (!recognizedText || !recognizedText.trim()) return;
    setIsProcessing(true);
    setVoiceError(null);

    try {
      const res = await api.post('/voice/extract', {
        transcript: recognizedText.trim(),
        language,
        consent: true,
        source: 'webspeech',
      });

      const data = res.data;
      const detectedSkillKeys = (data.skills || []).map((s) => s.key);
      const suggestionKeys = (data.suggestions || []).map((s) => s.key);

      setSessionId(data.sessionId);
      setTranscript(data.transcript || recognizedText);
      setSelectedSkills(detectedSkillKeys);
      setSuggestions(suggestionKeys);
      if (data.experienceYears !== null && data.experienceYears !== undefined) {
        setExperienceYears(data.experienceYears);
      }
      setFlags(data.flags || []);
      setExtractedMethod('WEBSPEECH_TEXT');

      // If no skills detected at all, prompt user
      if (detectedSkillKeys.length === 0 && suggestionKeys.length === 0) {
        setVoiceError('कोई हुनर नहीं पहचाना गया। कृपया दोबारा बोलें या नीचे से चुनें।');
        setFailureCount((prev) => prev + 1);
        setIsProcessing(false);
        return;
      }

      setStep(4);
      saveState({
        step: 4,
        sessionId: data.sessionId,
        transcript: data.transcript,
        selectedSkills: detectedSkillKeys,
        suggestions: suggestionKeys,
        experienceYears: data.experienceYears ?? 3,
        flags: data.flags || [],
        extractedMethod: 'WEBSPEECH_TEXT',
      });
    } catch (err) {
      handleVoiceFailure(err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Process Recorded Audio via POST /api/v1/voice/onboard
  const handleAudioRecorded = async (blob, mimeType) => {
    setIsProcessing(true);
    setVoiceError(null);

    try {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('language', language);
      formData.append('consent', 'true');
      formData.append('durationMs', String((recorder.duration || 1) * 1000));

      const res = await api.post('/voice/onboard', formData);

      const data = res.data;
      const detectedSkillKeys = (data.skills || []).map((s) => s.key);
      const suggestionKeys = (data.suggestions || []).map((s) => s.key);

      setSessionId(data.sessionId);
      setTranscript(data.transcript || '');
      setSelectedSkills(detectedSkillKeys);
      setSuggestions(suggestionKeys);
      if (data.experienceYears !== null && data.experienceYears !== undefined) {
        setExperienceYears(data.experienceYears);
      }
      setFlags(data.flags || []);
      setExtractedMethod('SERVER_AUDIO');

      if (detectedSkillKeys.length === 0 && suggestionKeys.length === 0) {
        setVoiceError('कोई हुनर नहीं पहचाना गया। कृपया दोबारा बोलें या नीचे से चुनें।');
        setFailureCount((prev) => prev + 1);
        setIsProcessing(false);
        return;
      }

      setStep(4);
      saveState({
        step: 4,
        sessionId: data.sessionId,
        transcript: data.transcript,
        selectedSkills: detectedSkillKeys,
        suggestions: suggestionKeys,
        experienceYears: data.experienceYears ?? 3,
        flags: data.flags || [],
        extractedMethod: 'SERVER_AUDIO',
      });
    } catch (err) {
      handleVoiceFailure(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoiceFailure = (err) => {
    const newCount = failureCount + 1;
    setFailureCount(newCount);

    if (err.code === 'VOICE_UNAVAILABLE' || newCount >= 2) {
      // Automatic fallback to icon grid on service down or 2 consecutive failures
      setVoiceError(err.message || 'वॉइस सेवा उपलब्ध नहीं है। आइकन ग्रिड खुल रहा है...');
      setTimeout(() => {
        setStep(5);
        saveState({ step: 5 });
      }, 1200);
    } else {
      setVoiceError(err.message || 'आवाज़ समझने में समस्या हुई। कृपया पुनः प्रयास करें।');
    }
  };

  // Re-run extract after manual transcript editing on Confirm screen
  const handleReExtract = async () => {
    if (!transcript.trim()) return;
    setIsProcessing(true);
    setVoiceError(null);
    try {
      const res = await api.post('/voice/extract', {
        transcript: transcript.trim(),
        language,
        consent: true,
        source: 'manual_reparse',
      });
      const data = res.data;
      const detected = (data.skills || []).map((s) => s.key);
      const sugg = (data.suggestions || []).map((s) => s.key);
      setSelectedSkills(detected);
      setSuggestions(sugg);
      if (data.experienceYears !== null && data.experienceYears !== undefined) {
        setExperienceYears(data.experienceYears);
      }
      setFlags(data.flags || []);
      saveState({
        selectedSkills: detected,
        suggestions: sugg,
        experienceYears: data.experienceYears ?? experienceYears,
        flags: data.flags || [],
      });
    } catch (err) {
      setVoiceError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Readback confirmation text with browser SpeechSynthesis
  const handleReadback = () => {
    const skillLabels = selectedSkills
      .map((k) => FRONTEND_SKILLS_MAP[k]?.labelHi || k)
      .join(', ');
    const text = `आपने बताया: ${skillLabels || 'कोई हुनर नहीं'}, ${experienceYears} साल का अनुभव।`;
    speak(text);
  };

  // STEP 4 & 5: Confirm Skills and Save to User Profile
  const handleConfirmSkills = async () => {
    if (selectedSkills.length === 0) {
      alert(t('select_at_least_one'));
      return;
    }

    setIsProcessing(true);
    try {
      const payload = {
        sessionId: step === 5 ? undefined : sessionId || undefined,
        skills: selectedSkills,
        experienceYears,
        method: step === 5 ? 'ICON_FALLBACK' : extractedMethod,
      };

      const res = await api.post('/voice/confirm', payload);
      if (res.data?.user) {
        updateUser(res.data.user);
      }

      setStep(6);
      saveState({ step: 6 });
    } catch (err) {
      alert('Error saving skills: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // STEP 6: Location & UPI Submission
  const handleGetGPS = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setLng(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        (err) => {
          alert('GPS Error: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSaveLocation = async (skipUPI = false) => {
    setSavingLocation(true);
    try {
      // 1. Save location
      await api.patch('/users/me/location', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });

      // 2. Optional UPI
      if (!skipUPI && upiId.trim()) {
        await api.patch('/users/me/upi', { upiId: upiId.trim() });
      }

      // Fetch fresh me to update store with profileComplete: true
      const meRes = await api.get('/auth/me');
      if (meRes.data) {
        updateUser(meRes.data);
      }

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('workpulse_onboarding_state');
      }

      setStep(7); // Done screen
    } catch (err) {
      alert('Error updating location: ' + err.message);
    } finally {
      setSavingLocation(false);
    }
  };

  // Dev Tool: Run typed text
  const handleDevRunText = (textToRun) => {
    const text = textToRun || typeInput;
    if (!text.trim()) return;
    setTranscript(text);
    handleWebSpeechResult(text);
  };

  // Dev Tool: Upload audio file
  const handleDevUploadAudio = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleAudioRecorded(file, file.type || 'audio/webm');
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 min-h-[90vh] flex flex-col justify-between">
      {/* Top Header & Step Progress Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center text-white font-black text-sm">
              WP
            </div>
            <span className="text-sm font-black text-white tracking-wide">
              {t('app_name')}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 6].map((st) => (
              <div
                key={st}
                className={`h-1.5 rounded-full transition-all ${
                  step === st || (step === 5 && st === 3) || (step === 7 && st === 6)
                    ? 'w-6 bg-blue-500'
                    : step > st
                    ? 'w-2 bg-emerald-500'
                    : 'w-2 bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Global Error Banner */}
        {voiceError && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span className="flex-1">{voiceError}</span>
            <button
              onClick={() => {
                setStep(5);
                saveState({ step: 5 });
              }}
              className="text-xs font-bold text-amber-300 underline shrink-0"
            >
              आइकन से चुनें
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* STEP 1: LANGUAGE SELECTION                                     */}
      {/* ============================================================== */}
      {step === 1 && (
        <div className="space-y-6 my-auto">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Globe className="w-7 h-7" />
            </div>
            <h1 className="text-2xl font-black text-white">
              {t('choose_language')}
            </h1>
            <p className="text-xs text-slate-400">
              WorkPulse mein aapka swagat hai. Kripya apni bhasha chunein.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { code: 'hi', label: 'हिंदी (Hindi)', sub: 'दैनिक काम और हाज़िरी' },
              { code: 'mr', label: 'मराठी (Marathi)', sub: 'दैनिक काम आणि हजेरी' },
              { code: 'en', label: 'English', sub: 'Daily work & attendance' },
            ].map((l) => (
              <button
                key={l.code}
                onClick={() => handleSelectLanguage(l.code)}
                className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all min-h-[58px] ${
                  language === l.code
                    ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-900/20'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <div>
                  <h3 className="text-base font-bold">{l.label}</h3>
                  <p className="text-xs text-slate-400">{l.sub}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: CONSENT SCREEN (DPDP ACT 2023 COMPLIANCE)              */}
      {/* ============================================================== */}
      {step === 2 && (
        <div className="space-y-6 my-auto">
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">
                {t('voice_consent_title')}
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {t('voice_consent_text')}
              </p>
            </div>

            <div className="p-3 bg-slate-800/60 rounded-xl space-y-1.5 text-[11px] text-slate-400">
              <p className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ऑडियो कभी भी सर्वर पर सेव नहीं होगा (No audio stored).</span>
              </p>
              <p className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>सिर्फ आपके हुनर को समझने के लिए उपयोग होगा।</span>
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={handleConsentAgree}
              className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform"
            >
              {t('voice_consent_agree')}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={handleConsentDecline}
              className="w-full min-h-[48px] bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold rounded-2xl flex items-center justify-center gap-1.5 border border-slate-800 transition-colors"
            >
              {t('voice_consent_decline')}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3: VOICE CAPTURE SCREEN                                  */}
      {/* ============================================================== */}
      {step === 3 && (
        <div className="space-y-6 my-auto text-center">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white">
              {t('voice_screen_title')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('voice_prompt')}
            </p>
          </div>

          {/* Sample Line with Speaker Readback Button */}
          <div className="p-3 bg-blue-950/40 border border-blue-900/50 rounded-2xl flex items-center justify-between gap-3 text-left">
            <div className="min-w-0">
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                उदाहरण (Sample)
              </span>
              <p className="text-xs text-blue-200 font-medium truncate">
                {t('voice_sample_hint')}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                speak(
                  language === 'mr'
                    ? 'मी पेंटर आहे, पाच वर्षांचा अनुभव आहे'
                    : language === 'en'
                    ? 'I am a painter with five years experience'
                    : 'मैं पेंटर हूँ, पाँच साल का अनुभव है'
                )
              }
              className="p-2.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 rounded-xl shrink-0"
              title="Listen sample"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>

          {/* Large 96px Microphone Button & Animated Rings */}
          <div className="py-4 flex flex-col items-center justify-center">
            <div className="relative flex items-center justify-center">
              {/* Pulsing ring when listening */}
              {(webSpeech.listening || recorder.recording) && (
                <div
                  className="absolute w-36 h-36 rounded-full bg-rose-500/20 animate-ping"
                  style={{
                    transform: `scale(${1 + (recorder.audioLevel || 0.3) * 0.5})`,
                  }}
                />
              )}

              <button
                type="button"
                onClick={handleToggleMic}
                disabled={isProcessing}
                className={`relative w-24 h-24 min-w-[96px] min-h-[96px] rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
                  isProcessing
                    ? 'bg-amber-600 animate-pulse text-white'
                    : webSpeech.listening || recorder.recording
                    ? 'bg-rose-600 shadow-rose-600/50 text-white animate-pulse'
                    : 'bg-gradient-to-tr from-blue-700 to-indigo-500 hover:from-blue-600 hover:to-indigo-400 text-white shadow-blue-900/40'
                }`}
              >
                {isProcessing ? (
                  <RefreshCw className="w-10 h-10 animate-spin" />
                ) : webSpeech.listening || recorder.recording ? (
                  <MicOff className="w-10 h-10" />
                ) : (
                  <Mic className="w-10 h-10" />
                )}
              </button>
            </div>

            {/* Status indicator under Mic */}
            <div className="mt-4 space-y-1">
              <p className="text-sm font-bold text-white">
                {isProcessing
                  ? t('mic_processing')
                  : webSpeech.listening || recorder.recording
                  ? `${t('mic_listening')} (${20 - recorder.duration}s)`
                  : t('mic_idle')}
              </p>

              {/* Live interim transcript */}
              {webSpeech.interim && (
                <p className="text-xs text-blue-300 italic animate-fadeIn">
                  &ldquo;{webSpeech.interim}&rdquo;
                </p>
              )}

              {/* No sound warning */}
              {recorder.noSoundDetected && (
                <p className="text-[11px] text-amber-300">
                  {t('no_sound_hint')}
                </p>
              )}
            </div>
          </div>

          {/* Switch Mode & Fallback Links */}
          <div className="flex items-center justify-center gap-4 text-xs font-bold text-slate-400">
            <button
              onClick={() =>
                setVoiceMode((prev) => (prev === 'server' ? 'webspeech' : 'server'))
              }
              className="text-blue-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {effectivePath === 'webspeech'
                ? 'सर्वर ऑडियो से बोलें'
                : 'वेब स्पीच से बोलें'}
            </button>

            <span>•</span>

            <button
              onClick={() => {
                setStep(5);
                saveState({ step: 5 });
              }}
              className="text-amber-400 hover:underline"
            >
              {t('voice_consent_decline')}
            </button>
          </div>

          {/* Dev Voice Tools Panel */}
          {isDevMode && (
            <div className="text-left bg-amber-400/10 border border-amber-400/30 rounded-2xl p-3.5 space-y-3">
              <div
                onClick={() => setDevToolsOpen(!devToolsOpen)}
                className="flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded">
                    🧪 Dev Voice Tools
                  </span>
                  <span className="text-[10px] text-amber-200/70">
                    Mode: {effectivePath}
                  </span>
                </div>
                <span className="text-xs text-amber-300 font-mono">
                  {devToolsOpen ? '▲' : '▼'}
                </span>
              </div>

              {devToolsOpen && (
                <div className="space-y-3 pt-2 text-xs">
                  {/* Type instead of speak */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-amber-200">
                      Type instead of speak (बिना माइक के टेस्ट करें):
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={typeInput}
                        onChange={(e) => setTypeInput(e.target.value)}
                        placeholder="e.g. main painter hoon, 5 saal"
                        className="flex-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                      />
                      <button
                        onClick={() => handleDevRunText()}
                        disabled={isProcessing || !typeInput.trim()}
                        className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl shrink-0"
                      >
                        Run
                      </button>
                    </div>
                  </div>

                  {/* Sample 1-Tap Golden Buttons */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-amber-200">
                      1-Tap Golden Sample Utterances:
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {GOLDEN_UTTERANCES.slice(0, 5).map((ut, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleDevRunText(ut)}
                          className="px-2 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[10px] text-amber-200 text-left truncate max-w-[200px]"
                        >
                          {ut}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Upload Audio File */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-amber-200">
                      Upload audio file to test Whisper:
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleDevUploadAudio}
                      className="text-[10px] text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded-lg file:border-0 file:bg-amber-500 file:text-slate-950 file:font-bold file:text-[10px]"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 4: CONFIRM SKILLS SCREEN                                  */}
      {/* ============================================================== */}
      {step === 4 && (
        <div className="space-y-5 my-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-white">
              {t('confirm_screen_title')}
            </h2>
            <button
              onClick={handleReadback}
              className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl flex items-center gap-1 text-xs font-bold"
            >
              <Volume2 className="w-4 h-4" />
              {t('readback_btn')}
            </button>
          </div>

          {/* Ambiguous Mistri or Multiple Exp Warnings */}
          {flags.includes('AMBIGUOUS_MISTRI') && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('flag_ambiguous_mistri')}</span>
            </div>
          )}
          {flags.includes('MULTIPLE_EXPERIENCE_VALUES') && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{t('flag_multiple_exp')}</span>
            </div>
          )}

          {/* Detected Skills Chips (Pre-selected) */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">
              {t('detected_skills')}:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {selectedSkills.map((sk) => {
                const meta = FRONTEND_SKILLS_MAP[sk];
                return (
                  <button
                    key={sk}
                    type="button"
                    onClick={() =>
                      setSelectedSkills((prev) => prev.filter((s) => s !== sk))
                    }
                    className="p-3 bg-blue-600/20 border-2 border-blue-500 rounded-2xl flex items-center gap-2.5 text-left text-blue-300 shadow-md min-h-[50px]"
                  >
                    <SkillIcon name={meta?.icon} className="w-5 h-5 text-blue-400" />
                    <span className="text-xs font-bold truncate">
                      {meta?.labelHi || sk}
                    </span>
                    <CheckCircle2 className="w-4 h-4 ml-auto text-blue-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Suggestions (Not auto-selected) */}
          {suggestions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400">
                {t('suggested_skills')}:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {suggestions.map((sk) => {
                  const meta = FRONTEND_SKILLS_MAP[sk];
                  const isAdded = selectedSkills.includes(sk);
                  return (
                    <button
                      key={sk}
                      type="button"
                      onClick={() =>
                        setSelectedSkills((prev) =>
                          isAdded ? prev.filter((s) => s !== sk) : [...prev, sk]
                        )
                      }
                      className={`p-2.5 rounded-xl border flex items-center gap-2 text-xs font-bold text-left min-h-[48px] ${
                        isAdded
                          ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <SkillIcon name={meta?.icon} className="w-4 h-4" />
                      <span className="truncate">{meta?.labelHi || sk}</span>
                      <Plus className="w-3.5 h-3.5 ml-auto text-slate-500" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add more skills link / grid */}
          <div>
            <button
              onClick={() => {
                setStep(5);
                saveState({ step: 5 });
              }}
              className="text-xs font-bold text-blue-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('add_more_skills')}
            </button>
          </div>

          {/* Experience Stepper (+ / -) */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                {t('experience_years')}:
              </span>
              <span className="text-sm font-black text-blue-400">
                {experienceYears} {t('years_unit')}
              </span>
            </div>

            <div className="flex items-center justify-center gap-6 pt-1">
              <button
                type="button"
                onClick={() => setExperienceYears((y) => Math.max(0, y - 1))}
                className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-95"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="text-2xl font-black text-white w-12 text-center">
                {experienceYears}
              </span>
              <button
                type="button"
                onClick={() => setExperienceYears((y) => Math.min(50, y + 1))}
                className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center font-black active:scale-95"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Editable Transcript Box */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400">
              {t('transcript_label')}:
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200"
              />
              <button
                type="button"
                onClick={handleReExtract}
                disabled={isProcessing}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs shrink-0"
              >
                {t('re_extract')}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2.5 pt-2">
            <button
              type="button"
              onClick={handleConfirmSkills}
              disabled={isProcessing || selectedSkills.length === 0}
              className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20 active:scale-95 transition-transform"
            >
              {t('confirm_save')}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setStep(3);
                saveState({ step: 3 });
              }}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              {t('speak_again')}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 5: ICON-GRID FALLBACK SCREEN                              */}
      {/* ============================================================== */}
      {step === 5 && (
        <div className="space-y-5 my-auto">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">
              {t('icon_fallback_title')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('icon_fallback_desc')}
            </p>
          </div>

          {/* All 16 Skills Grid */}
          <div className="grid grid-cols-2 gap-2.5 max-h-[48vh] overflow-y-auto pr-1">
            {FRONTEND_SKILLS_CATALOG.map((item) => {
              const isSelected = selectedSkills.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    setSelectedSkills((prev) =>
                      isSelected
                        ? prev.filter((s) => s !== item.key)
                        : [...prev, item.key]
                    )
                  }
                  className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition-all min-h-[52px] ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <SkillIcon
                    name={item.icon}
                    className={`w-5 h-5 shrink-0 ${
                      isSelected ? 'text-blue-400' : 'text-slate-500'
                    }`}
                  />
                  <span className="text-xs font-bold truncate">
                    {language === 'mr'
                      ? item.labelMr
                      : language === 'en'
                      ? item.labelEn
                      : item.labelHi}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Experience Stepper */}
          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-bold text-slate-300">
              {t('experience_years')}:
            </span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setExperienceYears((y) => Math.max(0, y - 1))}
                className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-base font-black text-blue-400 w-8 text-center">
                {experienceYears}
              </span>
              <button
                type="button"
                onClick={() => setExperienceYears((y) => Math.min(50, y + 1))}
                className="w-9 h-9 rounded-xl bg-slate-800 text-white flex items-center justify-center font-bold"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmSkills}
            disabled={selectedSkills.length === 0}
            className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
          >
            {t('confirm_save')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 6: LOCATION & OPTIONAL UPI                                */}
      {/* ============================================================== */}
      {step === 6 && (
        <div className="space-y-5 my-auto">
          <div className="space-y-1">
            <h2 className="text-xl font-black text-white">
              {t('location_title')}
            </h2>
            <p className="text-xs text-slate-400">
              {t('location_desc')}
            </p>
          </div>

          {/* GPS Location Card */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                GPS Coordinates
              </span>
              <button
                type="button"
                onClick={handleGetGPS}
                className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-bold flex items-center gap-1"
              >
                <Navigation className="w-3.5 h-3.5" />
                {t('use_gps')}
              </button>
            </div>

            <p className="text-xs text-slate-400 font-mono">
              Lat: {lat.toFixed(4)}, Lng: {lng.toFixed(4)}
            </p>

            {/* Dev Simulator Coordinates */}
            {isDevMode && (
              <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-300">
                  DEV: Manual Coordinates
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400">Latitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lat}
                      onChange={(e) => setLat(parseFloat(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Longitude</label>
                    <input
                      type="number"
                      step="0.0001"
                      value={lng}
                      onChange={(e) => setLng(parseFloat(e.target.value))}
                      className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Optional UPI Input */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <label className="text-xs font-bold text-slate-300">
              UPI आईडी (वैकल्पिक - सीधे भुगतान के लिए):
            </label>
            <input
              type="text"
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. mobile@upi or name@okaxis"
              className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white text-xs"
            />
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => handleSaveLocation(false)}
              disabled={savingLocation}
              className="w-full min-h-[50px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
            >
              {savingLocation ? 'सेव हो रहा है...' : 'लोकेशन सेव करें (Save & Finish)'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => handleSaveLocation(true)}
              disabled={savingLocation}
              className="w-full py-2 text-xs font-bold text-slate-400 hover:text-white"
            >
              {t('skip_later')}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 7: DONE CELEBRATION                                       */}
      {/* ============================================================== */}
      {step === 7 && (
        <div className="space-y-6 my-auto text-center animate-fadeIn">
          <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-emerald-400 shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="w-10 h-10" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-white">
              {t('onboarding_complete')}
            </h1>
            <p className="text-xs text-slate-300 max-w-xs mx-auto">
              आपकी प्रोफाइल पूरी हो चुकी है। अब आप नजदीकी काम देख सकते हैं और आवेदन कर सकते हैं।
            </p>
          </div>

          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>हुनर (Skills):</span>
              <span className="font-bold text-white">
                {selectedSkills.map((k) => FRONTEND_SKILLS_MAP[k]?.labelHi || k).join(', ')}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>अनुभव (Experience):</span>
              <span className="font-bold text-white">{experienceYears} वर्ष</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push('/worker/dashboard')}
            className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-900/30 active:scale-95 transition-transform"
          >
            {t('go_to_dashboard')}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}
