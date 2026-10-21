import logger from '../utils/logger.js';

/**
 * Global error handling middleware.
 * Catches all errors forwarded by next(err) or thrown in async handlers.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error(`${err.name || 'Error'}: ${err.message}`);

  let statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  let code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');
  let message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    code = 'AUDIO_TOO_LARGE';
    message = 'Audio exceeds maximum size limit';
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(err.fallback ? { fallback: err.fallback } : {}),
      ...(err.details && typeof err.details === 'object' ? { ...err.details, details: err.details } : (err.details ? { details: err.details } : {})),
    },
    ...(err.fallback ? { fallback: err.fallback } : {}),
  });
};

export default errorHandler;
