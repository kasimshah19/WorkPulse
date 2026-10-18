/**
 * Wraps an async route handler to catch rejected promises
 * and forward them to Express error middleware.
 *
 * @param {Function} fn - Async Express handler (req, res, next) => Promise
 * @returns {Function}
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
