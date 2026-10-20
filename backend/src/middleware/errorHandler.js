import logger from '../utils/logger.js';

/**
 * Global error handling middleware.
 * Catches all errors forwarded by next(err) or thrown in async handlers.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error(`${err.name || 'Error'}: ${err.message}`);

  const statusCode = err.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500);
  const message =
    process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error';

  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : 'INTERNAL_SERVER_ERROR');

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(err.details && typeof err.details === 'object' ? { ...err.details, details: err.details } : (err.details ? { details: err.details } : {})),
    },
  });
};

export default errorHandler;
