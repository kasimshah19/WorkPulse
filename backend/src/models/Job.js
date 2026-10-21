import crypto from 'crypto';
import mongoose from 'mongoose';
import {
  JOB_STATUS,
  JOB_CREATED_VIA,
  SKILLS,
} from '../config/constants.js';

/**
 * Job Schema
 * Contractor posted work opportunities with wage in Paise and geofence specifications.
 */
const jobSchema = new mongoose.Schema(
  {
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    skillRequired: {
      type: String,
      enum: SKILLS,
      required: true,
    },
    workersNeeded: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    workersAssignedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    assignedWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    wagePerDayPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value in paise',
      },
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    workingHours: {
      start: { type: String, default: '09:00' },
      end: { type: String, default: '17:00' },
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    addressText: {
      type: String,
      trim: true,
      default: '',
    },
    geofenceRadiusMeters: {
      type: Number,
      default: 100,
      min: 20,
    },
    matchRadiusKm: {
      type: Number,
      default: 5,
      min: 1,
    },
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.DRAFT,
      index: true,
    },
    requiresSelfie: {
      type: Boolean,
      default: true,
    },
    autoApprovalHours: {
      type: Number,
      default: 12,
      min: 1,
    },
    createdVia: {
      type: String,
      enum: Object.values(JOB_CREATED_VIA),
      default: JOB_CREATED_VIA.APP,
    },
    attendanceCodeSecret: {
      type: String,
      select: false,
      default: () => crypto.randomBytes(32).toString('hex'),
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
jobSchema.index({ location: '2dsphere' });
jobSchema.index({ status: 1, skillRequired: 1, startDate: 1 });
jobSchema.index({ contractor: 1, status: 1 });

const Job = mongoose.model('Job', jobSchema);

export default Job;
