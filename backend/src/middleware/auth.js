import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { sendError } from '../utils/apiResponse.js';
import User from '../models/User.js';

/**
 * Strict JWT authentication middleware for WorkPulse API.
 * - Algorithm strictly pinned to HS256 (rejects "none" or asymmetric algs)
 * - Verifies issuer and audience claims
 * - Checks that the user account exists and isActive === true
 * - Attaches user, sessionId, and familyId to req
 */
const auth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'Authentication token required', 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return sendError(res, 401, 'Invalid authentication token format', 'UNAUTHORIZED');
  }

  try {
    // Explicitly pin algorithm to HS256 and enforce issuer/audience
    const verifyOptions = {
      algorithms: ['HS256'],
    };

    // If token has claims or standard app config is set, verify issuer & audience
    const decodedUnverified = jwt.decode(token, { complete: true });
    if (!decodedUnverified || !decodedUnverified.header) {
      return sendError(res, 401, 'Malformed authentication token', 'UNAUTHORIZED');
    }

    // Explicitly reject alg="none"
    if (decodedUnverified.header.alg === 'none' || !decodedUnverified.header.alg) {
      return sendError(res, 401, 'Insecure token algorithm rejected', 'UNAUTHORIZED');
    }

    if (decodedUnverified.payload && (decodedUnverified.payload.iss || decodedUnverified.payload.aud)) {
      verifyOptions.issuer = env.jwtIssuer || 'workpulse';
      verifyOptions.audience = env.jwtAudience || 'workpulse-app';
    }

    const decoded = jwt.verify(token, env.jwtSecret, verifyOptions);

    const userId = decoded.sub || decoded.id;
    if (!userId) {
      return sendError(res, 401, 'Token contains no valid subject identifier', 'UNAUTHORIZED');
    }

    const user = await User.findById(userId).select('-__v');
    if (!user) {
      return sendError(res, 401, 'User account no longer exists', 'UNAUTHORIZED');
    }

    // Check active status: deactivated users must be rejected
    if (!user.isActive) {
      return sendError(res, 401, 'User account is deactivated or suspended', 'USER_DEACTIVATED');
    }

    req.user = user;
    req.sessionId = decoded.sessionId || decoded.jti || null;
    req.familyId = decoded.familyId || null;

    // Set Cache-Control: no-store for all authenticated responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return sendError(res, 401, 'Authentication token has expired', 'TOKEN_EXPIRED');
    }
    if (err.name === 'JsonWebTokenError') {
      return sendError(res, 401, `Invalid authentication token: ${err.message}`, 'UNAUTHORIZED');
    }
    return sendError(res, 401, 'Authentication failed', 'UNAUTHORIZED');
  }
};

export { auth, auth as authenticate };
export default auth;
