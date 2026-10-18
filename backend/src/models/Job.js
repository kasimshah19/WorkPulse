import mongoose from 'mongoose';
import { JOB_STATUS } from '../config/constants.js';

/**
 * Job schema – contractor-posted work opportunities.
 * TODO Phase 2: Add validation rules, pre-save hooks, and virtual fields.
 */
const jobSchema = new mongoose.Schema(
  {
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
    },
    skillRequired: {
      type: String,
      required: [true, 'Skill requirement is required'],
      trim: true,
    },
    workersNeeded: {
      type: Number,
      required: true,
      min: 1,
    },
    wagePerDay: {
      type: Number,
      required: true,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
      },
    },
    radiusMeters: {
      type: Number,
      default: 5000,
    },
    status: {
      type: String,
      enum: Object.values(JOB_STATUS),
      default: JOB_STATUS.DRAFT,
    },
    assignedWorkers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  {
    timestamps: true,
  },
);

// 2dsphere index for geo queries
jobSchema.index({ location: '2dsphere' });

const Job = mongoose.model('Job', jobSchema);

export default Job;
