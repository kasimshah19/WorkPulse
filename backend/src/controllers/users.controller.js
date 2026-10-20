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
