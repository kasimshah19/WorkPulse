import logger from '../utils/logger.js';
import env from '../config/env.js';

/**
 * Global centralized error handling middleware.
 * - Enforces standard WorkPulse error envelope.
 * - Masks internal stack traces, database queries, and system paths in production.
 * - Attaches requestId to error response for end-to-end traceability.
 * - Automatically converts MongoDB CastErrors to 400 INVALID_ID.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const requestId = req.requestId || req.headers['x-request-id'] || 'unknown_req';

  logger.error(`${err.name || 'Error'}: ${err.message}`, {
    requestId,
    userId: req.user?._id,
    route: req.originalUrl,
    stack: env.nodeEnv !== 'production' ? err.stack : undefined,
  });

  let statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  let code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR');
  let message = err.message || 'Internal server error';

  // Catch Mongoose CastError on ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ObjectId format for parameter "${err.path}"`;
  }

  // Catch Multer file size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'FILE_TOO_LARGE';
    message = 'Uploaded file exceeds the maximum allowed size limit';
  }

  // Production security masking: never leak internal system errors or DB paths
  if (env.nodeEnv === 'production' && statusCode >= 500) {
    code = 'INTERNAL_ERROR';
    message = 'An unexpected internal error occurred. Please contact support with the requestId.';
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      requestId,
      ...(env.nodeEnv !== 'production' && err.stack ? { stack: err.stack } : {}),
      ...(err.fallback ? { fallback: err.fallback } : {}),
      ...(err.details && typeof err.details === 'object' ? { details: err.details } : {}),
    },
    ...(err.fallback ? { fallback: err.fallback } : {}),
  });
};

export default errorHandler;
