import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import env from '../config/env.js';
import {
  getSkillsCatalog,
  getVoiceConfig,
  onboardAudio,
  extractWebSpeech,
  confirmSkills,
  abandonSession,
  getVoiceStats,
} from '../controllers/voice.controller.js';

const router = Router();

// Multer in-memory storage (audio is processed in memory and never written to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.voiceMaxAudioBytes || 5242880, // 5MB limit
  },
});

// User-keyed rate limiters (from env)
const voiceOnboardLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: () => env.voiceOnboardRatePerHour || 10,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Hourly voice onboard limit reached. Please try later.',
      },
    });
  },
});

const voiceExtractLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: () => env.voiceExtractRatePerHour || 30,
  keyGenerator: (req) => req.user?._id?.toString() || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Hourly voice extract limit reached. Please try later.',
      },
    });
  },
});

// GET /api/v1/voice/skills - Public skills catalog with multi-language labels and icons
router.get('/skills', asyncHandler(getSkillsCatalog));

// GET /api/v1/voice/config - Auth-required client configuration
router.get('/config', auth, asyncHandler(getVoiceConfig));

// POST /api/v1/voice/onboard - Worker only, multipart audio -> transcribe + extract (Server path)
router.post(
  '/onboard',
  auth,
  role('worker'),
  voiceOnboardLimiter,
  upload.single('audio'),
  asyncHandler(onboardAudio)
);

// POST /api/v1/voice/extract - Worker only, JSON transcript -> extract (WebSpeech path)
router.post(
  '/extract',
  auth,
  role('worker'),
  voiceExtractLimiter,
  asyncHandler(extractWebSpeech)
);

// POST /api/v1/voice/confirm - Worker only, saves final skills/experience to User
router.post(
  '/confirm',
  auth,
  role('worker'),
  asyncHandler(confirmSkills)
);

// POST /api/v1/voice/sessions/:id/abandon - Worker only, marks session abandoned
router.post(
  '/sessions/:id/abandon',
  auth,
  role('worker'),
  asyncHandler(abandonSession)
);

// GET /api/v1/voice/stats - Admin only stats
router.get(
  '/stats',
  auth,
  role('admin'),
  asyncHandler(getVoiceStats)
);

export { voiceOnboardLimiter, voiceExtractLimiter };
export default router;
