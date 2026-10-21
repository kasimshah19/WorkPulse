import mongoose from 'mongoose';
import { SKILLS, LANGUAGE_PREFERENCE } from '../config/constants.js';
import env from '../config/env.js';

export const VOICE_SESSION_METHOD = Object.freeze({
  WEBSPEECH_TEXT: 'WEBSPEECH_TEXT',
  SERVER_AUDIO: 'SERVER_AUDIO',
  ICON_FALLBACK: 'ICON_FALLBACK',
});

export const VOICE_SESSION_STATUS = Object.freeze({
  EXTRACTED: 'EXTRACTED',
  CONFIRMED: 'CONFIRMED',
  ABANDONED: 'ABANDONED',
});

const voiceSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    method: {
      type: String,
      enum: Object.values(VOICE_SESSION_METHOD),
      required: true,
    },
    sttProvider: {
      type: String,
      default: 'mock',
    },
    languageRequested: {
      type: String,
      enum: ['hi', 'mr', 'en', 'auto'],
      default: 'hi',
    },
    languageDetected: {
      type: String,
      default: '',
    },
    transcript: {
      type: String,
      maxlength: 500,
      default: null,
    },
    extractedSkills: [
      {
        key: {
          type: String,
          enum: SKILLS,
        },
        confidence: {
          type: Number,
          min: 0,
          max: 1,
        },
        matchedText: {
          type: String,
          default: '',
        },
      },
    ],
    extractedExperienceYears: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    finalSkills: [
      {
        type: String,
        enum: SKILLS,
      },
    ],
    finalExperienceYears: {
      type: Number,
      min: 0,
      max: 50,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(VOICE_SESSION_STATUS),
      default: VOICE_SESSION_STATUS.EXTRACTED,
    },
    latencyMs: {
      type: Number,
      default: 0,
    },
    audioDurationMs: {
      type: Number,
      default: 0,
    },
    consentAt: {
      type: Date,
      default: null,
    },
    consentVersion: {
      type: String,
      default: 'v1',
    },
    flags: [
      {
        type: String,
      },
    ],
    errorCode: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
voiceSessionSchema.index({ user: 1, createdAt: -1 });
voiceSessionSchema.index({ status: 1, method: 1 });
// TTL Index: Auto-delete voice sessions after configurable days (default 90 days)
voiceSessionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: (env.voiceSessionTtlDays || 90) * 86400 }
);

const VoiceSession = mongoose.model('VoiceSession', voiceSessionSchema);

export default VoiceSession;
