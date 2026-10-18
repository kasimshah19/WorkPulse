import mongoose from 'mongoose';
import { OTP_PURPOSE } from '../config/constants.js';

/**
 * Otp Schema
 * Short-lived one-time passwords for mobile phone verification.
 */
const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: Object.values(OTP_PURPOSE),
      required: true,
      default: OTP_PURPOSE.LOGIN,
    },
    attempts: {
      type: Number,
      default: 0,
      max: 5,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// TTL index to automatically purge expired OTP documents
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
otpSchema.index({ phone: 1, purpose: 1, isUsed: 1 });

const Otp = mongoose.model('Otp', otpSchema);

export default Otp;
