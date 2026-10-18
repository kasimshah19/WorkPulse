import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import User from '../models/User.js';

/**
 * JWT authentication middleware.
 * Decodes the Bearer token, verifies signature, and attaches user to req.user.
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication token required', 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return sendError(res, 401, 'Invalid authentication token', 'UNAUTHORIZED');
  }

  try {
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id).select('-__v');

    if (!user) {
      return sendError(res, 401, 'User account no longer exists', 'UNAUTHORIZED');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account is deactivated', 'ACCOUNT_DEACTIVATED');
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Authentication token has expired', 'TOKEN_EXPIRED');
    }
    return sendError(res, 401, 'Invalid authentication token', 'UNAUTHORIZED');
  }
};

export default auth;
