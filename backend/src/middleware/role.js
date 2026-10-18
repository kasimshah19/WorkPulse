import { sendError } from '../utils/apiResponse.js';

/**
 * Role-based access control middleware.
 * Verifies that the authenticated user possesses one of the permitted roles.
 *
 * @param {...string} roles - Allowed roles (e.g., 'worker', 'contractor', 'admin')
 * @returns {Function} Express middleware
 */
const role = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 401, 'Authentication required', 'UNAUTHORIZED');
    }

    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, `Access denied for role '${req.user.role}'`, 'FORBIDDEN');
    }

    next();
  };
};

export { role };
export default role;
