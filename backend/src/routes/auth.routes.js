import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import env from '../config/env.js';
import {
  sendOtp,
  verifyOtp,
  getMe,
  devLogin,
  getDevUsers,
} from '../controllers/auth.controller.js';

const router = Router();

const sendOtpSchema = Joi.object({
  phone: Joi.string().required().trim(),
  purpose: Joi.string().valid('login', 'register').default('login'),
});

const verifyOtpSchema = Joi.object({
  phone: Joi.string().required().trim(),
  otp: Joi.string().length(6).required(),
  name: Joi.string().min(2).max(100).optional(),
  role: Joi.string().valid('worker', 'contractor').optional(),
});

router.post('/send-otp', validate(sendOtpSchema), asyncHandler(sendOtp));
router.post('/verify-otp', validate(verifyOtpSchema), asyncHandler(verifyOtp));
router.get('/me', auth, asyncHandler(getMe));

// Dev-only quick test login routes
if (env.otpDevMode) {
  router.post(
    '/dev-login',
    validate(Joi.object({ phone: Joi.string().required() })),
    asyncHandler(devLogin)
  );
  router.get('/dev-users', asyncHandler(getDevUsers));
}

export default router;
