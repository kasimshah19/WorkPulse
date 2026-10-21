import User from '../models/User.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * PATCH /api/v1/users/me
 * Update user profile details.
 */
export const updateMe = async (req, res) => {
  const allowedUpdates = [
    'name',
    'skills',
    'languagePreference',
    'experienceYears',
    'address',
    'upiId',
    'emergencyContact',
  ];

  const updates = {};
  for (const field of allowedUpdates) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: updates },
    { new: true, runValidators: true }
  ).select('-__v');

  return sendSuccess(res, 200, updatedUser);
};

/**
 * PATCH /api/v1/users/me/location
 * Store GeoJSON Point as [lng, lat] (longitude FIRST).
 */
export const updateLocation = async (req, res) => {
  const { lat, lng } = req.body;

  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return sendError(res, 400, 'Latitude and longitude must be numbers', 'VALIDATION_ERROR');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return sendError(res, 400, 'Invalid coordinate range', 'INVALID_COORDINATES');
  }

  // NOTE: MongoDB GeoJSON coordinates format is strictly [longitude, latitude]
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
      },
    },
    { new: true }
  ).select('-__v');

  return sendSuccess(res, 200, updatedUser);
};

/**
 * PATCH /api/v1/users/me/availability
 * Worker-only availability toggle.
 */
export const updateAvailability = async (req, res) => {
  const { isAvailable } = req.body;

  if (typeof isAvailable !== 'boolean') {
    return sendError(res, 400, 'isAvailable must be a boolean', 'VALIDATION_ERROR');
  }

  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { isAvailable } },
    { new: true }
  ).select('-__v');

  return sendSuccess(res, 200, {
    isAvailable: updatedUser.isAvailable,
  });
};

/**
 * PATCH /api/v1/users/me/upi
 * Validate and save user's UPI ID.
 */
export const updateUPI = async (req, res) => {
  const { upiId } = req.body;
  const upiRegex = /^[\w.-]+@[\w.-]+$/;

  if (!upiId || !upiRegex.test(String(upiId).trim())) {
    return sendError(res, 400, 'Invalid UPI ID format (e.g. name@bank or 9876543210@paytm)', 'INVALID_UPI_FORMAT');
  }

  // NOTE: In production, this would call a real-time bank VPA validation API.
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { upiId: String(upiId).trim().toLowerCase() } },
    { new: true }
  ).select('-__v');

  return sendSuccess(res, 200, {
    message: 'UPI ID verified and saved successfully.',
    upiId: updatedUser.upiId,
  });
};

/**
 * PATCH /api/v1/users/me/emergency-contact
 * Set or update worker emergency contact.
 */
export const updateEmergencyContact = async (req, res) => {
  const { name, phone } = req.body;

  if (!name || name.trim().length < 2) {
    return sendError(res, 400, 'Name must be at least 2 characters', 'VALIDATION_ERROR');
  }

  // Normalize and validate E.164 phone
  let normalizedPhone = (phone || '').replace(/\s+/g, '').replace(/-/g, '');
  if (!normalizedPhone.startsWith('+')) {
    if (normalizedPhone.length === 10) normalizedPhone = `+91${normalizedPhone}`;
    else normalizedPhone = `+${normalizedPhone}`;
  }

  if (!/^\+[1-9]\d{1,14}$/.test(normalizedPhone)) {
    return sendError(res, 400, 'Invalid E.164 phone number format', 'VALIDATION_ERROR');
  }

  if (normalizedPhone === req.user.phone) {
    return sendError(res, 400, 'Emergency contact phone cannot be your own phone number', 'VALIDATION_ERROR');
  }

  // Rate limit: 3 changes per day
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const AuditLog = (await import('../models/AuditLog.js')).default;
  const recentChanges = await AuditLog.countDocuments({
    actor: req.user._id,
    action: 'EMERGENCY_CONTACT_UPDATED',
    createdAt: { $gte: startOfDay },
  });

  if (recentChanges >= 3) {
    return sendError(res, 429, 'Maximum 3 emergency contact changes allowed per day', 'RATE_LIMITED');
  }

  const now = new Date();
  const updatedUser = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        emergencyContact: {
          name: name.trim(),
          phone: normalizedPhone,
          verifiedNoticeSentAt: now,
        },
      },
    },
    { new: true }
  ).select('-__v');

  // Send Notice SMS via SMS Service
  const { sendSms } = await import('../services/sms/sms.service.js');
  sendSms(
    normalizedPhone,
    `${req.user.name || 'Aapke parichit'} ne aapko WorkPulse par emergency contact banaya hai. Agar woh SOS dabayenge toh aapko SMS aayega.`
  ).catch((err) => {
    // SMS failure must not fail the request
    console.error('[EmergencyContact] Notice SMS failed:', err.message);
  });

  await AuditLog.create({
    action: 'EMERGENCY_CONTACT_UPDATED',
    actor: req.user._id,
    target: req.user._id,
    targetModel: 'User',
    details: { name: name.trim(), phone: normalizedPhone },
  });

  return sendSuccess(res, 200, {
    message: 'Emergency contact updated successfully',
    emergencyContact: {
      name: updatedUser.emergencyContact.name,
      phone: updatedUser.emergencyContact.phone,
      verifiedNoticeSentAt: updatedUser.emergencyContact.verifiedNoticeSentAt,
    },
  });
};

/**
 * GET /api/v1/users/:id/reputation
 * Returns public reputation profile and objective performance stats.
 */
export const getUserReputation = async (req, res) => {
  const { getReputationAndObjectiveStats } = await import('../services/rating.service.js');
  const reputation = await getReputationAndObjectiveStats(req.params.id);
  return sendSuccess(res, 200, reputation);
};

