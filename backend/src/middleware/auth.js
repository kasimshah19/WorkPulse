import { sendError } from '../utils/apiResponse.js';

/**
 * JWT authentication middleware stub.
 * TODO Phase 1: Implement real JWT verification using jsonwebtoken.
 */
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication required', 'AUTH_REQUIRED');
  }

  // TODO Phase 1: Verify token and attach user to req.user
  const token = authHeader.split(' ')[1];
  if (!token) {
    return sendError(res, 401, 'Invalid token', 'INVALID_TOKEN');
  }

  // Stub: attach a placeholder user
  req.user = { id: 'stub', role: 'worker' };
  next();
};

export default auth;
