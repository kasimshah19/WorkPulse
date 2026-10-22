import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import Wallet from '../models/Wallet.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import sessionService from '../services/session.service.js';

// In-memory lockout tracking for failed OTP attempts: phone -> { lockUntil: number, failedAttempts: number }
const phoneLockouts = new Map();

/**
 * Check if a phone number is temporarily locked out due to excessive failed attempts
 */
export const checkPhoneLockout = (phone) => {
  const lockout = phoneLockouts.get(phone);
  if (!lockout) return null;

  if (Date.now() < lockout.lockUntil) {
    const remainingMinutes = Math.ceil((lockout.lockUntil - Date.now()) / (60 * 1000));
    return remainingMinutes;
  }

  // Lockout expired, clean up
  phoneLockouts.delete(phone);
  return null;
};

/**
 * Record a failed OTP attempt for lockout calculation
 */
export const recordFailedOtpAttempt = async (phone) => {
  let record = phoneLockouts.get(phone) || { failedAttempts: 0, lockUntil: 0 };
  record.failedAttempts += 1;

  const maxAttempts = env.otpMaxFailedAttempts || 5;
  const lockoutMin = env.otpLockoutMin || 15;

  if (record.failedAttempts >= maxAttempts) {
    record.lockUntil = Date.now() + lockoutMin * 60 * 1000;
    phoneLockouts.set(phone, record);

    logger.warn(`[SECURITY_OTP_LOCKOUT] Phone ${phone} locked for ${lockoutMin} minutes`);
    try {
      await AuditLog.create({
        action: 'SECURITY_OTP_LOCKOUT',
        actor: null,
        target: phone,
        metadata: {
          failedAttempts: record.failedAttempts,
          lockoutMinutes: lockoutMin,
        },
      });
    } catch (auditErr) {
      logger.error('Failed to write audit log for OTP lockout:', auditErr);
    }

    return lockoutMin;
  }

  phoneLockouts.set(phone, record);
  return null;
};

/**
 * Clear lockout record on successful verification
 */
export const clearPhoneLockout = (phone) => {
  phoneLockouts.delete(phone);
};

/**
 * Format phone to E.164 (+91 standard default for Indian numbers)
 */
export const normalizePhone = (phone) => {
  if (!phone) return '';
  let clean = phone.replace(/\s+/g, '').replace(/-/g, '');
  if (!clean.startsWith('+')) {
    if (clean.length === 10) {
      clean = `+91${clean}`;
    } else if (clean.startsWith('91') && clean.length === 12) {
      clean = `+${clean}`;
    } else {
      clean = `+${clean}`;
    }
  }
  return clean;
};

/**
 * Serializes a user object, attaching profileComplete and omitting sensitive fields
 */
export const serializeUser = (user) => {
  const isWorker = user.role === 'worker';
  const hasSkills = Array.isArray(user.skills) && user.skills.length >= 1;
  const hasLocation =
    user.location &&
    Array.isArray(user.location.coordinates) &&
    (user.location.coordinates[0] !== 0 || user.location.coordinates[1] !== 0);

  const profileComplete = isWorker ? (hasSkills && hasLocation) : true;
  const userObj = user.toObject ? user.toObject() : { ...user };
  delete userObj.__v;
  delete userObj.otpHash;
  delete userObj.password;

  const hasEmergencyContact = Boolean(user.emergencyContact?.phone);

  return {
    ...userObj,
    id: user._id || user.id,
    profileComplete,
    hasEmergencyContact,
  };
};

/**
 * POST /api/v1/auth/send-otp
 */
export const sendOtp = async (req, res) => {
  const { phone, purpose = 'login' } = req.body;
  const normalizedPhone = normalizePhone(phone);

  if (!/^\+[1-9]\d{1,14}$/.test(normalizedPhone)) {
    return sendError(res, 400, 'Please provide a valid E.164 phone number', 'VALIDATION_ERROR');
  }

  // Check lockout
  const remainingLockoutMin = checkPhoneLockout(normalizedPhone);
  if (remainingLockoutMin) {
    return sendError(
      res,
      429,
      `Account locked due to multiple failed attempts. Try again in ${remainingLockoutMin} minute(s).`,
      'RATE_LIMITED'
    );
  }

  // Rate limit: max 3 OTPs per phone per 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentOtpCount = await Otp.countDocuments({
    phone: normalizedPhone,
    createdAt: { $gte: tenMinutesAgo },
  });

  if (recentOtpCount >= 3) {
    return sendError(
      res,
      429,
      'Maximum 3 OTP requests allowed per 10 minutes. Please wait.',
      'RATE_LIMITED'
    );
  }

  // Generate 6-digit OTP
  const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpHash = await bcrypt.hash(rawOtp, 10);

  await Otp.create({
    phone: normalizedPhone,
    otpHash,
    purpose,
    attempts: 0,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min expiry
    isUsed: false,
  });

  if (env.otpDevMode) {
    console.log(`\n╔════════════════════════════════════════════╗`);
    console.log(`║ [DEV OTP] ${normalizedPhone} : ${rawOtp} ║`);
    console.log(`╚════════════════════════════════════════════╝\n`);
  }

  const responseData = {
    phone: normalizedPhone,
    expiresInSeconds: 300,
    ...(env.otpDevMode ? { devOtp: rawOtp } : {}),
  };

  return sendSuccess(res, 200, responseData);
};

/**
 * POST /api/v1/auth/verify-otp
 */
export const verifyOtp = async (req, res) => {
  const { phone, otp, name, role } = req.body;
  const normalizedPhone = normalizePhone(phone);

  const remainingLockoutMin = checkPhoneLockout(normalizedPhone);
  if (remainingLockoutMin) {
    return sendError(
      res,
      429,
      `Account temporarily locked due to excessive failed attempts. Please retry in ${remainingLockoutMin} minute(s).`,
      'RATE_LIMITED'
    );
  }

  const otpDoc = await Otp.findOne({
    phone: normalizedPhone,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    await recordFailedOtpAttempt(normalizedPhone);
    return sendError(res, 400, 'OTP is invalid or has expired', 'INVALID_OTP');
  }

  if (otpDoc.attempts >= 5) {
    await recordFailedOtpAttempt(normalizedPhone);
    return sendError(res, 400, 'Maximum OTP attempts exceeded. Request a new OTP.', 'OTP_MAX_ATTEMPTS');
  }

  const isMatch = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    const lockedMin = await recordFailedOtpAttempt(normalizedPhone);
    if (lockedMin) {
      return sendError(
        res,
        429,
        `Too many failed attempts. Account locked for ${lockedMin} minutes.`,
        'RATE_LIMITED'
      );
    }
    return sendError(res, 400, 'Invalid OTP entered', 'INVALID_OTP');
  }

  // OTP verified successfully: clear failure counter
  clearPhoneLockout(normalizedPhone);
  otpDoc.isUsed = true;
  await otpDoc.save();

  let user = await User.findOne({ phone: normalizedPhone });
  let isNewUser = false;

  if (!user) {
    if (!name || !role) {
      return sendError(
        res,
        400,
        'Name and role (worker or contractor) are required for new registration',
        'REGISTRATION_REQUIRED'
      );
    }

    if (!['worker', 'contractor'].includes(role)) {
      return sendError(res, 400, 'Role must be worker or contractor only', 'INVALID_ROLE');
    }

    user = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      role,
      languagePreference: 'hi',
      isAvailable: role === 'worker',
      isActive: true,
      kycStatus: 'simulated_verified',
    });

    // Create wallet for new user
    await Wallet.create({
      user: user._id,
      balancePaise: 0,
      lockedPaise: 0,
      currency: 'INR',
      status: 'active',
    });

    isNewUser = true;
  }

  // Issue Access Token & Rotating Refresh Token
  const session = await sessionService.createSession(user, req, res);

  return sendSuccess(res, 200, {
    token: session.accessToken,
    accessToken: session.accessToken,
    user: serializeUser(user),
    sessionId: session.sessionId,
    isNewUser,
  });
};

/**
 * POST /api/v1/auth/refresh
 * Rotates the refresh token (retrieved from httpOnly cookie) and returns a new access token
 */
export const refreshSession = async (req, res) => {
  const rawToken = req.cookies?.workpulse_refresh || req.body?.refreshToken;

  if (!rawToken) {
    return sendError(res, 401, 'Refresh token cookie required', 'UNAUTHORIZED');
  }

  const result = await sessionService.rotateRefreshToken(rawToken, req, res);

  if (!result.success) {
    return sendError(res, result.status || 401, result.message, result.code || 'UNAUTHORIZED');
  }

  return sendSuccess(res, 200, {
    accessToken: result.accessToken,
    token: result.accessToken,
    user: serializeUser(result.user),
  });
};

/**
 * POST /api/v1/auth/logout
 * Revokes current token family and clears httpOnly cookie
 */
export const logoutUser = async (req, res) => {
  const rawToken = req.cookies?.workpulse_refresh;
  await sessionService.logout(rawToken, res);
  return sendSuccess(res, 200, { message: 'Logged out successfully' });
};

/**
 * POST /api/v1/auth/logout-all
 * Revokes all sessions for authenticated user
 */
export const logoutAllUser = async (req, res) => {
  await sessionService.logoutAll(req.user._id, res);
  return sendSuccess(res, 200, { message: 'All active sessions terminated' });
};

/**
 * GET /api/v1/auth/sessions
 * List active sessions for authenticated user
 */
export const getSessions = async (req, res) => {
  const sessions = await sessionService.listUserSessions(req.user._id, req.sessionId);
  return sendSuccess(res, 200, sessions);
};

/**
 * DELETE /api/v1/auth/sessions/:id
 * Revoke specific session by sessionId
 */
export const deleteSession = async (req, res) => {
  const { id } = req.params;
  const revoked = await sessionService.revokeUserSession(req.user._id, id);
  if (!revoked) {
    return sendError(res, 404, 'Session not found or already inactive', 'NOT_FOUND');
  }
  return sendSuccess(res, 200, { message: 'Session revoked successfully' });
};

/**
 * GET /api/v1/auth/me
 */
export const getMe = async (req, res) => {
  const serialized = serializeUser(req.user);
  return sendSuccess(res, 200, {
    ...serialized,
    user: serialized,
  });
};

/**
 * POST /api/v1/auth/dev-login (Only in non-production with otpDevMode)
 */
export const devLogin = async (req, res) => {
  if (env.nodeEnv === 'production' || !env.otpDevMode) {
    return sendError(res, 404, 'Dev login is disabled in production', 'NOT_FOUND');
  }

  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const user = await User.findOne({ phone: normalizedPhone });

  if (!user) {
    return sendError(res, 404, `User with phone ${normalizedPhone} not found in database`, 'USER_NOT_FOUND');
  }

  if (!user.isActive) {
    return sendError(res, 401, 'User account is deactivated', 'USER_DEACTIVATED');
  }

  // Dev login also creates a real session with rotating refresh token
  const session = await sessionService.createSession(user, req, res);

  return sendSuccess(res, 200, {
    token: session.accessToken,
    accessToken: session.accessToken,
    user: serializeUser(user),
    sessionId: session.sessionId,
  });
};

/**
 * GET /api/v1/auth/dev-users (Only in non-production with otpDevMode)
 */
export const getDevUsers = async (req, res) => {
  if (env.nodeEnv === 'production' || !env.otpDevMode) {
    return sendError(res, 404, 'Dev users list is disabled in production', 'NOT_FOUND');
  }

  const users = await User.find({})
    .select('_id name phone role skills isAvailable location')
    .sort({ phone: 1 })
    .lean();

  return sendSuccess(res, 200, users);
};

export default {
  sendOtp,
  verifyOtp,
  refreshSession,
  logoutUser,
  logoutAllUser,
  getSessions,
  deleteSession,
  getMe,
  devLogin,
  getDevUsers,
  serializeUser,
  normalizePhone,
  checkPhoneLockout,
  recordFailedOtpAttempt,
  clearPhoneLockout,
};
