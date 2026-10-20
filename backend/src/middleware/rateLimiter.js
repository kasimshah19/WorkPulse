import rateLimit from 'express-rate-limit';
import env from '../config/env.js';

/**
 * General-purpose API rate limiter.
 * In development, allow up to 10,000 requests per 15-minute window.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: env.nodeEnv === 'production' ? 100 : 10000,
  skip: () => env.nodeEnv === 'development',
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests, please try again later.',
    },
  },
});

export default rateLimiter;
