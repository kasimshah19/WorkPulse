import { sendError } from '../utils/apiResponse.js';

/**
 * Role-based access control middleware.
 * TODO Phase 1: Wire up with real user roles from JWT.
 *
 * @param  {...string} roles - Allowed roles (e.g., 'worker', 'contractor', 'admin')
 * @returns {Function} Express middleware
 */
const role = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', 'AUTH_REQUIRED');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'Insufficient permissions', 'FORBIDDEN');
    }

    next();
  };
};

export default role;
