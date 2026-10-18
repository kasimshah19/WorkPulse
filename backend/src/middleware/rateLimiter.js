import rateLimit from 'express-rate-limit';

/**
 * General-purpose API rate limiter.
 * 100 requests per 15-minute window per IP.
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
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
