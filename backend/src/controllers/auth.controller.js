import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import Wallet from '../models/Wallet.js';
import env from '../config/env.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

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
 * Serializes a user object, attaching profileComplete
 * Worker: true if skills.length >= 1 and location coordinates != [0, 0]
 * Contractor: always true
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

  return {
    ...userObj,
    id: user._id || user.id,
    profileComplete,
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
      'RATE_LIMIT_EXCEEDED'
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

  const otpDoc = await Otp.findOne({
    phone: normalizedPhone,
    isUsed: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otpDoc) {
    return sendError(res, 400, 'OTP is invalid or has expired', 'INVALID_OTP');
  }

  if (otpDoc.attempts >= 5) {
    return sendError(res, 400, 'Maximum OTP attempts exceeded. Request a new OTP.', 'OTP_MAX_ATTEMPTS');
  }

  const isMatch = await bcrypt.compare(otp, otpDoc.otpHash);
  if (!isMatch) {
    otpDoc.attempts += 1;
    await otpDoc.save();
    return sendError(res, 400, 'Invalid OTP entered', 'INVALID_OTP');
  }

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

  const token = jwt.sign(
    { id: user._id, role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return sendSuccess(res, 200, {
    token,
    user: serializeUser(user),
    isNewUser,
  });
};

/**
 * GET /api/v1/auth/me
 */
export const getMe = async (req, res) => {
  return sendSuccess(res, 200, serializeUser(req.user));
};

/**
 * POST /api/v1/auth/dev-login (Only in dev mode)
 */
export const devLogin = async (req, res) => {
  if (!env.otpDevMode) {
    return sendError(res, 404, 'Dev login is not available', 'NOT_FOUND');
  }

  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  const user = await User.findOne({ phone: normalizedPhone });

  if (!user) {
    return sendError(res, 404, `User with phone ${normalizedPhone} not found in database`, 'USER_NOT_FOUND');
  }

  const token = jwt.sign(
    { id: user._id, role: user.role, phone: user.phone },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );

  return sendSuccess(res, 200, {
    token,
    user: serializeUser(user),
  });
};

/**
 * GET /api/v1/auth/dev-users (Only in dev mode)
 */
export const getDevUsers = async (req, res) => {
  if (!env.otpDevMode) {
    return sendError(res, 404, 'Dev users list is not available', 'NOT_FOUND');
  }

  const users = await User.find({})
    .select('_id name phone role skills isAvailable location')
    .sort({ phone: 1 })
    .lean();

  return sendSuccess(res, 200, users);
};
