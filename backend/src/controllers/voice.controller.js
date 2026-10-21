import VoiceSession, {
  VOICE_SESSION_METHOD,
  VOICE_SESSION_STATUS,
} from '../models/VoiceSession.js';
import User from '../models/User.js';
import { SKILLS } from '../config/constants.js';
import { SKILLS_CATALOG } from '../config/skills.catalog.js';
import env from '../config/env.js';
import voiceClient from '../services/voice.client.js';
import { validateAudioMagicBytes } from '../utils/audioValidator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { serializeUser } from './auth.controller.js';
import logger from '../utils/logger.js';

/**
 * GET /api/v1/voice/skills (public)
 * Returns the skills catalog with multi-language labels and Lucide icon names.
 */
export const getSkillsCatalog = async (req, res) => {
  return sendSuccess(res, 200, SKILLS_CATALOG);
};

/**
 * GET /api/v1/voice/config (auth)
 * Returns client configuration for voice onboarding.
 */
export const getVoiceConfig = async (req, res) => {
  const health = await voiceClient.checkHealth();
  const isHealthy = health.status === 'ok' && !voiceClient.isDegraded();

  const config = {
    enabled: env.voiceEnabled,
    serverSttAvailable: isHealthy,
    sttProvider: health.sttProvider || 'mock',
    maxSeconds: 30,
    maxBytes: env.voiceMaxAudioBytes || 5242880,
    languages: [
      { code: 'hi', label: 'हिंदी (Hindi)', speechLang: 'hi-IN' },
      { code: 'mr', label: 'मराठी (Marathi)', speechLang: 'mr-IN' },
      { code: 'en', label: 'English', speechLang: 'en-IN' },
    ],
    consentVersion: env.voiceConsentVersion || 'v1',
  };

  return sendSuccess(res, 200, config);
};

/**
 * POST /api/v1/voice/onboard (worker only)
 * Receives multipart audio, forwards to voice-service /onboard,
 * validates extracted skills, and stores a draft VoiceSession.
 * Audio is processed strictly in-memory and never written to disk or DB.
 */
export const onboardAudio = async (req, res) => {
  const { consent, language = 'hi', durationMs } = req.body;

  if (consent !== 'true' && consent !== true) {
    return sendError(res, 400, 'DPDP consent is required for voice processing', 'CONSENT_REQUIRED');
  }

  if (!req.file || !req.file.buffer) {
    return sendError(res, 400, 'Audio file is required', 'VALIDATION_ERROR');
  }

  if (req.file.buffer.length > (env.voiceMaxAudioBytes || 5242880)) {
    return sendError(res, 413, 'Audio exceeds maximum size limit (5MB)', 'AUDIO_TOO_LARGE');
  }

  // Verify magic bytes
  const isValidAudio = validateAudioMagicBytes(req.file.buffer);
  if (!isValidAudio) {
    return sendError(
      res,
      415,
      'Invalid audio format. Supported formats: WAV, WebM, Ogg, MP4, MP3',
      'AUDIO_INVALID'
    );
  }

  const clientDuration = durationMs ? parseInt(durationMs, 10) : null;

  // Forward to voice-service /onboard
  const result = await voiceClient.onboardAudio({
    audioBuffer: req.file.buffer,
    filename: req.file.originalname || 'audio.webm',
    mimeType: req.file.mimetype || 'audio/webm',
    language,
    allowedSkills: SKILLS,
    clientDurationMs: clientDuration,
  });

  // Filter skills against constants.js SKILLS enum
  const validExtractedSkills = (result.skills || []).filter((s) => SKILLS.includes(s.key));
  const validSuggestions = (result.suggestions || []).filter((s) => SKILLS.includes(s.key));

  // Save session as draft
  const session = await VoiceSession.create({
    user: req.user._id,
    method: VOICE_SESSION_METHOD.SERVER_AUDIO,
    sttProvider: result.provider || 'mock',
    languageRequested: language,
    languageDetected: result.language || language,
    transcript: (result.text || '').slice(0, 500),
    extractedSkills: validExtractedSkills,
    extractedExperienceYears: result.experienceYears ?? null,
    status: VOICE_SESSION_STATUS.EXTRACTED,
    latencyMs: result.latencyMs || 0,
    audioDurationMs: Math.round((result.durationSec || 0) * 1000),
    consentAt: new Date(),
    consentVersion: env.voiceConsentVersion || 'v1',
    flags: result.flags || [],
  });

  return sendSuccess(res, 200, {
    sessionId: session._id,
    transcript: session.transcript,
    language: session.languageDetected,
    skills: validExtractedSkills,
    suggestions: validSuggestions,
    experienceYears: session.extractedExperienceYears,
    flags: session.flags,
  });
};

/**
 * POST /api/v1/voice/extract (worker only)
 * Receives WebSpeech transcript, forwards to voice-service /extract,
 * validates extracted skills, and stores a draft VoiceSession.
 */
export const extractWebSpeech = async (req, res) => {
  const { transcript, language = 'hi', consent } = req.body;

  if (consent !== 'true' && consent !== true) {
    return sendError(res, 400, 'DPDP consent is required for voice processing', 'CONSENT_REQUIRED');
  }

  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return sendError(res, 400, 'Transcript is required', 'VALIDATION_ERROR');
  }

  if (transcript.length > 500) {
    return sendError(res, 400, 'Transcript exceeds 500 characters', 'TRANSCRIPT_TOO_LONG');
  }

  const result = await voiceClient.extractSkills({
    text: transcript.trim(),
    language,
    allowedSkills: SKILLS,
  });

  // Filter skills against constants.js SKILLS enum
  const validExtractedSkills = (result.skills || []).filter((s) => SKILLS.includes(s.key));
  const validSuggestions = (result.suggestions || []).filter((s) => SKILLS.includes(s.key));

  const session = await VoiceSession.create({
    user: req.user._id,
    method: VOICE_SESSION_METHOD.WEBSPEECH_TEXT,
    sttProvider: 'webspeech',
    languageRequested: language,
    languageDetected: language,
    transcript: transcript.trim().slice(0, 500),
    extractedSkills: validExtractedSkills,
    extractedExperienceYears: result.experienceYears ?? null,
    status: VOICE_SESSION_STATUS.EXTRACTED,
    consentAt: new Date(),
    consentVersion: env.voiceConsentVersion || 'v1',
    flags: result.flags || [],
  });

  return sendSuccess(res, 200, {
    sessionId: session._id,
    transcript: session.transcript,
    language: session.languageRequested,
    skills: validExtractedSkills,
    suggestions: validSuggestions,
    experienceYears: session.extractedExperienceYears,
    flags: session.flags,
  });
};

/**
 * POST /api/v1/voice/confirm (worker only)
 * Finalizes onboarding skills & experience on user profile.
 * Only this endpoint writes skills/experience to User.
 * Idempotent: re-confirming same session with identical payload returns 200.
 */
export const confirmSkills = async (req, res) => {
  const { sessionId, skills, experienceYears, method } = req.body;

  // Validate skills
  if (!Array.isArray(skills) || skills.length === 0 || skills.length > 8) {
    return sendError(res, 400, 'Must provide between 1 and 8 skills', 'INVALID_SKILLS');
  }

  for (const sk of skills) {
    if (!SKILLS.includes(sk)) {
      return sendError(res, 400, `Unknown skill key '${sk}'`, 'INVALID_SKILLS');
    }
  }

  // Validate experienceYears
  if (
    experienceYears === undefined ||
    experienceYears === null ||
    typeof experienceYears !== 'number' ||
    experienceYears < 0 ||
    experienceYears > 50 ||
    !Number.isInteger(experienceYears)
  ) {
    return sendError(
      res,
      400,
      'Experience years must be an integer between 0 and 50',
      'INVALID_EXPERIENCE_YEARS'
    );
  }

  let session = null;

  if (sessionId) {
    session = await VoiceSession.findById(sessionId);
    if (!session || session.user.toString() !== req.user._id.toString()) {
      return sendError(res, 404, 'Voice session not found', 'SESSION_NOT_FOUND');
    }

    // Check idempotency if already confirmed
    if (session.status === VOICE_SESSION_STATUS.CONFIRMED) {
      const existingSkillsSet = new Set(session.finalSkills || []);
      const newSkillsSet = new Set(skills);
      const isSameSkills =
        existingSkillsSet.size === newSkillsSet.size &&
        [...existingSkillsSet].every((s) => newSkillsSet.has(s));
      const isSameYears = session.finalExperienceYears === experienceYears;

      if (isSameSkills && isSameYears) {
        const user = await User.findById(req.user._id);
        return sendSuccess(res, 200, {
          session,
          user: serializeUser(user),
        });
      }

      return sendError(
        res,
        409,
        'Voice session has already been confirmed with different parameters',
        'SESSION_ALREADY_CONFIRMED'
      );
    }

    session.status = VOICE_SESSION_STATUS.CONFIRMED;
    session.finalSkills = skills;
    session.finalExperienceYears = experienceYears;
    await session.save();
  } else {
    // Icon fallback path
    session = await VoiceSession.create({
      user: req.user._id,
      method: method === 'ICON_FALLBACK' ? VOICE_SESSION_METHOD.ICON_FALLBACK : VOICE_SESSION_METHOD.ICON_FALLBACK,
      sttProvider: 'none',
      languageRequested: req.user.languagePreference || 'hi',
      transcript: null,
      finalSkills: skills,
      finalExperienceYears: experienceYears,
      status: VOICE_SESSION_STATUS.CONFIRMED,
      consentAt: new Date(),
      consentVersion: env.voiceConsentVersion || 'v1',
    });
  }

  // Save to User
  const user = await User.findById(req.user._id);
  user.skills = skills;
  user.experienceYears = experienceYears;
  await user.save();

  logger.info(
    `[VoiceConfirm] User ${user._id} confirmed skills: [${skills.join(', ')}], exp: ${experienceYears} yrs`
  );

  return sendSuccess(res, 200, {
    session,
    user: serializeUser(user),
  });
};

/**
 * POST /api/v1/voice/sessions/:id/abandon (worker only)
 * Marks a draft session as abandoned when user moves to icon grid.
 */
export const abandonSession = async (req, res) => {
  const { id } = req.params;

  const session = await VoiceSession.findById(id);
  if (!session || session.user.toString() !== req.user._id.toString()) {
    return sendError(res, 404, 'Voice session not found', 'SESSION_NOT_FOUND');
  }

  if (session.status === VOICE_SESSION_STATUS.EXTRACTED) {
    session.status = VOICE_SESSION_STATUS.ABANDONED;
    await session.save();
  }

  return sendSuccess(res, 200, {
    sessionId: session._id,
    status: session.status,
  });
};

/**
 * GET /api/v1/admin/voice/stats (admin only)
 * Aggregates voice vs icon stats, provider latency, precision & recall over confirmed sessions.
 */
export const getVoiceStats = async (req, res) => {
  const allSessions = await VoiceSession.find({}).lean();

  const totalSessions = allSessions.length;
  let webspeechCount = 0;
  let serverAudioCount = 0;
  let iconFallbackCount = 0;
  let abandonedCount = 0;
  let noSpeechCount = 0;
  let errorCount = 0;

  const latenciesByProvider = {};
  const confirmedVoiceSessions = [];
  const languageStats = {
    hi: { total: 0, confirmed: 0, precisionSum: 0, recallSum: 0 },
    mr: { total: 0, confirmed: 0, precisionSum: 0, recallSum: 0 },
    en: { total: 0, confirmed: 0, precisionSum: 0, recallSum: 0 },
    auto: { total: 0, confirmed: 0, precisionSum: 0, recallSum: 0 },
  };

  for (const s of allSessions) {
    if (s.method === VOICE_SESSION_METHOD.WEBSPEECH_TEXT) webspeechCount++;
    if (s.method === VOICE_SESSION_METHOD.SERVER_AUDIO) serverAudioCount++;
    if (s.method === VOICE_SESSION_METHOD.ICON_FALLBACK) iconFallbackCount++;
    if (s.status === VOICE_SESSION_STATUS.ABANDONED) abandonedCount++;

    if (s.flags && s.flags.includes('NO_SPEECH_DETECTED')) noSpeechCount++;
    if (s.errorCode) errorCount++;

    const provider = s.sttProvider || 'unknown';
    if (s.latencyMs > 0) {
      if (!latenciesByProvider[provider]) {
        latenciesByProvider[provider] = { totalMs: 0, count: 0 };
      }
      latenciesByProvider[provider].totalMs += s.latencyMs;
      latenciesByProvider[provider].count += 1;
    }

    const lang = s.languageRequested || 'hi';
    if (!languageStats[lang]) {
      languageStats[lang] = { total: 0, confirmed: 0, precisionSum: 0, recallSum: 0 };
    }
    languageStats[lang].total += 1;

    // Confirmed voice sessions for precision/recall evaluation
    if (
      s.status === VOICE_SESSION_STATUS.CONFIRMED &&
      s.method !== VOICE_SESSION_METHOD.ICON_FALLBACK
    ) {
      confirmedVoiceSessions.push(s);
      languageStats[lang].confirmed += 1;

      const extractedSet = new Set((s.extractedSkills || []).map((x) => x.key));
      const finalSet = new Set(s.finalSkills || []);

      let intersectionCount = 0;
      for (const k of extractedSet) {
        if (finalSet.has(k)) intersectionCount++;
      }

      const precision = extractedSet.size > 0 ? intersectionCount / extractedSet.size : 0;
      const recall = finalSet.size > 0 ? intersectionCount / finalSet.size : 0;

      s._precision = precision;
      s._recall = recall;
      languageStats[lang].precisionSum += precision;
      languageStats[lang].recallSum += recall;
    }
  }

  const voiceSessionsCount = webspeechCount + serverAudioCount;
  const voiceSharePercent = totalSessions > 0 ? (voiceSessionsCount / totalSessions) * 100 : 0;
  const iconSharePercent = totalSessions > 0 ? (iconFallbackCount / totalSessions) * 100 : 0;
  const fallbackCount = iconFallbackCount + abandonedCount;
  const fallbackRatePercent = totalSessions > 0 ? (fallbackCount / totalSessions) * 100 : 0;

  // Average latencies
  const avgLatencyByProvider = {};
  for (const [p, val] of Object.entries(latenciesByProvider)) {
    avgLatencyByProvider[p] = {
      avgMs: Math.round(val.totalMs / val.count),
      sampleSize: val.count,
    };
  }

  // Precision and recall overall
  const evaluatedCount = confirmedVoiceSessions.length;
  let totalPrecision = 0;
  let totalRecall = 0;
  for (const s of confirmedVoiceSessions) {
    totalPrecision += s._precision;
    totalRecall += s._recall;
  }

  const avgPrecision = evaluatedCount > 0 ? totalPrecision / evaluatedCount : 0;
  const avgRecall = evaluatedCount > 0 ? totalRecall / evaluatedCount : 0;

  // Per language averages
  const languagesBreakdown = {};
  for (const [code, lData] of Object.entries(languageStats)) {
    languagesBreakdown[code] = {
      total: lData.total,
      confirmed: lData.confirmed,
      avgPrecision: lData.confirmed > 0 ? Number((lData.precisionSum / lData.confirmed).toFixed(3)) : 0,
      avgRecall: lData.confirmed > 0 ? Number((lData.recallSum / lData.confirmed).toFixed(3)) : 0,
    };
  }

  const stats = {
    totalSessions,
    methods: {
      webspeech: webspeechCount,
      serverAudio: serverAudioCount,
      iconFallback: iconFallbackCount,
      abandoned: abandonedCount,
    },
    voiceVsIcon: {
      voiceSessions: voiceSessionsCount,
      iconSessions: iconFallbackCount,
      voiceSharePercent: Number(voiceSharePercent.toFixed(1)),
      iconSharePercent: Number(iconSharePercent.toFixed(1)),
    },
    fallbackRate: {
      fallbackCount,
      totalSessions,
      fallbackRatePercent: Number(fallbackRatePercent.toFixed(1)),
    },
    quality: {
      noSpeechCount,
      errorCount,
      noSpeechRatePercent: totalSessions > 0 ? Number(((noSpeechCount / totalSessions) * 100).toFixed(1)) : 0,
      errorRatePercent: totalSessions > 0 ? Number(((errorCount / totalSessions) * 100).toFixed(1)) : 0,
    },
    latencies: avgLatencyByProvider,
    accuracy: {
      evaluatedSessions: evaluatedCount,
      precision: Number(avgPrecision.toFixed(3)),
      recall: Number(avgRecall.toFixed(3)),
    },
    languages: languagesBreakdown,
  };

  return sendSuccess(res, 200, stats);
};
