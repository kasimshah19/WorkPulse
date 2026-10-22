import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * Custom error handler for rate limit exceeded responses matching WorkPulse envelope
 */
const rateLimitHandler = (message = 'Too many requests, please slow down and try again later.') => {
  return (req, res, _next, options) => {
    res.setHeader('Retry-After', Math.ceil(options.windowMs / 1000));
    res.status(429).json({
      success: false,
      data: null,
      error: {
        code: 'RATE_LIMITED',
        message,
        retryAfterSec: Math.ceil(options.windowMs / 1000),
      },
    });
  };
};

/**
 * Key generator: prefer authenticated userId, fallback to IP
 */
const userOrIpKeyGenerator = (req) => {
  if (req.user && req.user._id) {
    return `user_${req.user._id.toString()}`;
  }
  return req.ip || req.headers['x-forwarded-for'] || 'unknown_ip';
};

/**
 * Global rate limiter: 500 requests per 15 minutes per IP
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 10000 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Exempt SOS from all rate limiting
    if (req.originalUrl?.includes('/incidents/sos')) return true;
    return false;
  },
  keyGenerator: (req) => req.ip || 'global_ip',
  handler: rateLimitHandler('Global request limit exceeded. Please wait before retrying.'),
});

/**
 * Auth rate limiter: Send OTP per phone
 * 5 attempts per 10 minutes per phone
 */
export const sendOtpPhoneLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `phone_${req.body?.phone || 'none'}`,
  handler: rateLimitHandler('Too many OTP requests for this phone number. Please wait 10 minutes.'),
});

/**
 * Auth rate limiter: Send OTP per IP
 * 15 attempts per 15 minutes per IP
 */
export const sendOtpIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'otp_ip',
  handler: rateLimitHandler('Too many OTP requests from this IP. Please wait before retrying.'),
});

/**
 * Auth rate limiter: Verify OTP per phone
 * 5 attempts per 10 minutes per phone
 */
export const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `verify_${req.body?.phone || req.ip}`,
  handler: rateLimitHandler('Too many failed OTP verification attempts. Please wait 10 minutes.'),
});

/**
 * Payment topup limiter: 10 orders per 15 minutes per user
 */
export const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('Too many payment attempts. Please wait before trying again.'),
});

/**
 * Withdrawal limiter: 5 withdrawals per hour per user
 */
export const withdrawLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('Withdrawal limit reached. Maximum 5 withdrawal requests per hour.'),
});

/**
 * Dispute creation limiter: 5 disputes per hour per user
 */
export const disputeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('Dispute filing rate limit reached. Please wait before raising another dispute.'),
});

/**
 * Incident creation limiter (non-SOS): 5 reports per hour per user
 */
export const incidentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('Incident report limit reached. Maximum 5 reports per hour.'),
});

/**
 * Rating submission limiter: 20 ratings per 10 minutes per user
 */
export const ratingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('Rating submission rate limit reached. Please wait before submitting more ratings.'),
});

/**
 * Upload limiter (selfies, evidence, audio): 15 uploads per 10 minutes per user
 */
export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: env.nodeEnv === 'test' ? 1000 : 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIpKeyGenerator,
  handler: rateLimitHandler('File upload rate limit reached. Please wait before uploading more files.'),
});

export default globalLimiter;
