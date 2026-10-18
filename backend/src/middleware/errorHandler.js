import logger from '../utils/logger.js';

/**
 * Global error handling middleware.
 * Catches all errors forwarded by next(err) or thrown in async handlers.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  logger.error(`${err.name}: ${err.message}`);

  const statusCode = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
    },
    timestamp: new Date().toISOString(),
  });
};

export default errorHandler;
