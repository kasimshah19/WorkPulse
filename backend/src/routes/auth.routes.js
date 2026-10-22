import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import env from '../config/env.js';
import {
  sendOtpPhoneLimiter,
  sendOtpIpLimiter,
  verifyOtpLimiter,
} from '../middleware/rateLimiter.js';
import {
  sendOtp,
  verifyOtp,
  refreshSession,
  logoutUser,
  logoutAllUser,
  getSessions,
  deleteSession,
  getMe,
  devLogin,
  getDevUsers,
} from '../controllers/auth.controller.js';

const router = Router();

const sendOtpSchema = Joi.object({
  phone: Joi.string().required().trim(),
  purpose: Joi.string().valid('login', 'register').default('login'),
}).strict();

const verifyOtpSchema = Joi.object({
  phone: Joi.string().required().trim(),
  otp: Joi.string().length(6).required(),
  name: Joi.string().min(2).max(100).optional(),
  role: Joi.string().valid('worker', 'contractor').optional(),
}).strict();

const sessionIdParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

// Public auth routes
router.post(
  '/send-otp',
  sendOtpIpLimiter,
  sendOtpPhoneLimiter,
  validate(sendOtpSchema),
  asyncHandler(sendOtp)
);

router.post(
  '/verify-otp',
  verifyOtpLimiter,
  validate(verifyOtpSchema),
  asyncHandler(verifyOtp)
);

// Token refresh endpoint (reads httpOnly cookie workpulse_refresh, requires X-Requested-With header)
router.post('/refresh', asyncHandler(refreshSession));

// Logout current session
router.post('/logout', asyncHandler(logoutUser));

const emptyBodySchema = Joi.object({}).unknown(true);

// Protected session management routes
router.post('/logout-all', auth, validate(emptyBodySchema), asyncHandler(logoutAllUser));
router.get('/sessions', auth, asyncHandler(getSessions));
router.delete('/sessions/:id', auth, validate(sessionIdParamSchema, 'params'), asyncHandler(deleteSession));

// Current user profile
router.get('/me', auth, asyncHandler(getMe));

// Dev-only quick test login routes (STRICTLY disabled in production, returns 404)
router.post(
  '/dev-login',
  (req, res, next) => {
    if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production' || !env.otpDevMode) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Cannot POST ' + req.originalUrl },
      });
    }
    next();
  },
  validate(Joi.object({ phone: Joi.string().required() }).strict()),
  asyncHandler(devLogin)
);

router.get('/dev-users', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production' || !env.otpDevMode) {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Cannot GET ' + req.originalUrl },
    });
  }
  return asyncHandler(getDevUsers)(req, res, next);
});

export default router;
