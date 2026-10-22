import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import RefreshToken from '../models/RefreshToken.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const REFRESH_COOKIE_NAME = 'workpulse_refresh';
const GRACE_PERIOD_MS = 10000; // 10-second grace window for flaky networks / concurrent retries

/**
 * Hash raw refresh token using SHA-256
 * @param {string} rawToken
 * @returns {string} hex digest
 */
export const hashToken = (rawToken) => {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
};

/**
 * Generate a cryptographically secure 256-bit refresh token
 * @returns {string} 64-char hex string
 */
export const generateRawRefreshToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Issue a standard 15-minute access JWT with HS256 algorithm pinning,
 * issuer, and audience claims.
 *
 * @param {Object} user
 * @param {string} sessionId
 * @param {string} familyId
 * @returns {string}
 */
export const issueAccessToken = (user, sessionId, familyId) => {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      sessionId,
      familyId,
    },
    env.jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: `${env.accessTokenTtlMin || 15}m`,
      issuer: env.jwtIssuer || 'workpulse',
      audience: env.jwtAudience || 'workpulse-app',
    }
  );
};

/**
 * Set httpOnly secure refresh cookie on the response
 *
 * @param {import('express').Response} res
 * @param {string} rawToken
 */
export const setRefreshCookie = (res, rawToken) => {
  const ttlDays = env.refreshTokenTtlDays || 30;
  res.cookie(REFRESH_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: ttlDays * 24 * 60 * 60 * 1000,
  });
};

/**
 * Clear the refresh cookie on logout or session revocation
 *
 * @param {import('express').Response} res
 */
export const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
  });
};

/**
 * Create a new user session with Access Token and Refresh Token (family root)
 *
 * @param {Object} user
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<{ accessToken: string, user: Object, sessionId: string, familyId: string }>}
 */
export const createSession = async (user, req, res) => {
  const familyId = uuidv4();
  const sessionId = uuidv4();
  const rawToken = generateRawRefreshToken();
  const tokenHash = hashToken(rawToken);

  const ttlDays = env.refreshTokenTtlDays || 30;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash,
    familyId,
    sessionId,
    expiresAt,
    userAgent: req.headers['user-agent'] || '',
    ip: req.ip || '',
    createdAt: new Date(),
    lastUsedAt: new Date(),
  });

  const accessToken = issueAccessToken(user, sessionId, familyId);
  setRefreshCookie(res, rawToken);

  return {
    accessToken,
    user: {
      _id: user._id,
      phone: user.phone,
      name: user.name,
      role: user.role,
      skills: user.skills || [],
      location: user.location,
      upiId: user.upiId,
      isActive: user.isActive,
    },
    sessionId,
    familyId,
  };
};

/**
 * Rotate Refresh Token with Reuse Detection & Concurrency Grace Window.
 *
 * Tradeoff documentation:
 * In flaky mobile networks (2G/3G/4G in India), mobile browsers or apps may
 * retry or fire concurrent requests for /auth/refresh before receiving the first response.
 * If we strictly revoked the family immediately on the second concurrent request with the same token,
 * legitimate workers would get logged out repeatedly.
 * Thus:
 * 1. An atomic conditional update `findOneAndUpdate({ _id, revokedAt: null })` ensures only ONE thread rotates.
 * 2. If a token was already revoked within GRACE_PERIOD_MS (10s) and has a valid `replacedBy`,
 *    we re-issue an access token for the same active session without triggering a reuse alert.
 * 3. Any token presented AFTER the 10s grace window triggers full family revocation and a SECURITY_REFRESH_REUSE audit event.
 *
 * @param {string} rawToken
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<{ success: boolean, status?: number, code?: string, message?: string, accessToken?: string, user?: Object }>}
 */
export const rotateRefreshToken = async (rawToken, req, res) => {
  // Validate custom CSRF protection header
  const requestedWith = req.headers['x-requested-with'];
  if (!requestedWith || requestedWith.toLowerCase() !== 'workpulse') {
    return {
      success: false,
      status: 403,
      code: 'CSRF_VALIDATION_FAILED',
      message: 'Missing or invalid X-Requested-With header',
    };
  }

  // Validate Origin / Referer against clientUrl in production/strict environments
  const origin = req.headers['origin'] || req.headers['referer'];
  if (origin && env.nodeEnv === 'production') {
    try {
      const originHost = new URL(origin).host;
      const clientHost = new URL(env.clientUrl).host;
      if (originHost !== clientHost) {
        return {
          success: false,
          status: 403,
          code: 'ORIGIN_MISMATCH',
          message: 'Origin header does not match authorized client URL',
        };
      }
    } catch {
      return {
        success: false,
        status: 403,
        code: 'ORIGIN_INVALID',
        message: 'Malformed origin header',
      };
    }
  }

  const tokenHash = hashToken(rawToken);
  const tokenDoc = await RefreshToken.findOne({ tokenHash });

  if (!tokenDoc) {
    clearRefreshCookie(res);
    return {
      success: false,
      status: 401,
      code: 'INVALID_TOKEN',
      message: 'Invalid or unrecognized refresh token',
    };
  }

  // Check if token has already been revoked
  if (tokenDoc.revokedAt) {
    const elapsedMs = Date.now() - new Date(tokenDoc.revokedAt).getTime();
    if (elapsedMs < GRACE_PERIOD_MS && tokenDoc.replacedBy) {
      // Within 10-second grace window: concurrent retry from network flakiness.
      const user = await User.findById(tokenDoc.user).select('_id role phone name isActive skills location upiId');
      if (!user || !user.isActive) {
        clearRefreshCookie(res);
        return {
          success: false,
          status: 401,
          code: 'USER_DEACTIVATED',
          message: 'User account is inactive or suspended',
        };
      }
      const accessToken = issueAccessToken(user, tokenDoc.sessionId, tokenDoc.familyId);
      logger.info(`[Auth] Grace window refresh re-issue for user ${user._id} (family: ${tokenDoc.familyId})`);
      return {
        success: true,
        accessToken,
        user,
      };
    }

    // Outside grace window: TOKEN REUSE DETECTED! Possible theft/compromise.
    logger.warn(`[SECURITY_REFRESH_REUSE] Token reuse detected for user ${tokenDoc.user}, family ${tokenDoc.familyId}`);

    // Revoke all tokens belonging to this family
    await RefreshToken.updateMany(
      { familyId: tokenDoc.familyId, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    try {
      await AuditLog.create({
        action: 'SECURITY_REFRESH_REUSE',
        actor: tokenDoc.user,
        entityType: 'RefreshTokenFamily',
        entityId: tokenDoc.familyId,
        ip: req.ip || '',
        userAgent: req.headers['user-agent'] || '',
        details: {
          revokedTokenHash: tokenHash,
        },
      });
    } catch (auditErr) {
      logger.error('Failed to log audit entry for token reuse:', auditErr);
    }

    clearRefreshCookie(res);
    return {
      success: false,
      status: 401,
      code: 'SESSION_REVOKED',
      message: 'Session revoked due to token reuse detection',
    };
  }

  // Check expiration
  if (new Date() > new Date(tokenDoc.expiresAt)) {
    clearRefreshCookie(res);
    return {
      success: false,
      status: 401,
      code: 'TOKEN_EXPIRED',
      message: 'Refresh token has expired, please log in again',
    };
  }

  // Check active user status
  const user = await User.findById(tokenDoc.user).select('_id role phone name isActive skills location upiId');
  if (!user || !user.isActive) {
    clearRefreshCookie(res);
    return {
      success: false,
      status: 401,
      code: 'USER_DEACTIVATED',
      message: 'User account is inactive or suspended',
    };
  }

  // Atomic rotation: attempt to claim this token
  const newRawToken = generateRawRefreshToken();
  const newTokenHash = hashToken(newRawToken);

  const updatedOldToken = await RefreshToken.findOneAndUpdate(
    { _id: tokenDoc._id, revokedAt: null },
    {
      $set: {
        revokedAt: new Date(),
        replacedBy: newTokenHash,
        lastUsedAt: new Date(),
      },
    },
    { new: false }
  );

  if (!updatedOldToken) {
    // Another concurrent process won the rotation race.
    // Check grace window again
    const rechecked = await RefreshToken.findById(tokenDoc._id);
    if (rechecked && rechecked.revokedAt && (Date.now() - new Date(rechecked.revokedAt).getTime() < GRACE_PERIOD_MS)) {
      const accessToken = issueAccessToken(user, tokenDoc.sessionId, tokenDoc.familyId);
      return {
        success: true,
        accessToken,
        user,
      };
    }
    return {
      success: false,
      status: 409,
      code: 'CONCURRENT_REFRESH',
      message: 'Concurrent refresh collision, please retry',
    };
  }

  // Create successor token
  const ttlDays = env.refreshTokenTtlDays || 30;
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);

  await RefreshToken.create({
    user: user._id,
    tokenHash: newTokenHash,
    familyId: tokenDoc.familyId,
    sessionId: tokenDoc.sessionId,
    expiresAt,
    userAgent: req.headers['user-agent'] || '',
    ip: req.ip || '',
    createdAt: new Date(),
    lastUsedAt: new Date(),
  });

  const accessToken = issueAccessToken(user, tokenDoc.sessionId, tokenDoc.familyId);
  setRefreshCookie(res, newRawToken);

  return {
    success: true,
    accessToken,
    user,
  };
};

/**
 * Logout single session / token family
 *
 * @param {string} rawToken
 * @param {import('express').Response} res
 */
export const logout = async (rawToken, res) => {
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const tokenDoc = await RefreshToken.findOne({ tokenHash });
    if (tokenDoc) {
      await RefreshToken.updateMany(
        { familyId: tokenDoc.familyId, revokedAt: null },
        { $set: { revokedAt: new Date() } }
      );
    }
  }
  clearRefreshCookie(res);
  return { success: true };
};

/**
 * Logout all active sessions for a user
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {import('express').Response} res
 */
export const logoutAll = async (userId, res) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  clearRefreshCookie(res);
  return { success: true };
};

/**
 * Revoke all sessions for a user (called upon phone/role change)
 *
 * @param {string|mongoose.Types.ObjectId} userId
 */
export const revokeAllUserSessions = async (userId) => {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
};

/**
 * List distinct active sessions for a user
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} currentSessionId
 */
export const listUserSessions = async (userId, currentSessionId) => {
  const activeTokens = await RefreshToken.find({
    user: userId,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ lastUsedAt: -1 });

  // Group by sessionId
  const sessionsMap = new Map();
  for (const t of activeTokens) {
    if (!sessionsMap.has(t.sessionId)) {
      sessionsMap.set(t.sessionId, {
        id: t.sessionId,
        userAgent: t.userAgent,
        ip: t.ip,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        current: t.sessionId === currentSessionId,
      });
    }
  }

  return Array.from(sessionsMap.values());
};

/**
 * Revoke a specific session for a user
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {string} sessionId
 */
export const revokeUserSession = async (userId, sessionId) => {
  const result = await RefreshToken.updateMany(
    { user: userId, sessionId, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
  return result.modifiedCount > 0;
};

export default {
  hashToken,
  generateRawRefreshToken,
  issueAccessToken,
  setRefreshCookie,
  clearRefreshCookie,
  createSession,
  rotateRefreshToken,
  logout,
  logoutAll,
  revokeAllUserSessions,
  listUserSessions,
  revokeUserSession,
};
