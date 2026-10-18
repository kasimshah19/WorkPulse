/**
 * Simple console-based logger.
 * TODO Phase 8: Replace with winston or pino for structured logging.
 */
const logger = {
  info: (...args) => console.log(`[INFO]  ${new Date().toISOString()}`, ...args),
  warn: (...args) => console.warn(`[WARN]  ${new Date().toISOString()}`, ...args),
  error: (...args) => console.error(`[ERROR] ${new Date().toISOString()}`, ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[DEBUG] ${new Date().toISOString()}`, ...args);
    }
  },
};

export default logger;
