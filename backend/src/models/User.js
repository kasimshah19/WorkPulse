import mongoose from 'mongoose';
import {
  USER_ROLES,
  LANGUAGE_PREFERENCE,
  SKILLS,
  KYC_STATUS,
} from '../config/constants.js';

/**
 * User Schema
 * Represents workers, contractors, and platform administrators.
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'User name is required'],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required in E.164 format'],
      trim: true,
      match: [/^\+[1-9]\d{1,14}$/, 'Please provide a valid E.164 phone number'],
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      required: true,
      default: USER_ROLES.WORKER,
    },
    languagePreference: {
      type: String,
      enum: Object.values(LANGUAGE_PREFERENCE),
      default: LANGUAGE_PREFERENCE.HINDI,
    },
    skills: [
      {
        type: String,
        enum: SKILLS,
      },
    ],
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    profilePhotoUrl: {
      type: String,
      default: '',
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    kycStatus: {
      type: String,
      enum: Object.values(KYC_STATUS),
      default: KYC_STATUS.NONE,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    ratingSummary: {
      workerSkillAvg: { type: Number, default: 0, min: 0, max: 5 },
      workerSkillCount: { type: Number, default: 0 },
      contractorPaymentAvg: { type: Number, default: 0, min: 0, max: 5 },
      contractorSafetyAvg: { type: Number, default: 0, min: 0, max: 5 },
      contractorCount: { type: Number, default: 0 },
    },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
    },
    fcmOrPushToken: {
      type: String,
      default: '',
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
userSchema.index({ phone: 1 }, { unique: true });
userSchema.index({ location: '2dsphere' });
userSchema.index({ role: 1, skills: 1, isAvailable: 1 });

const User = mongoose.model('User', userSchema);

export default User;
