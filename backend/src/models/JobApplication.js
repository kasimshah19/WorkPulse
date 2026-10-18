import mongoose from 'mongoose';
import {
  APPLICATION_STATUS,
  NOTIFICATION_CHANNEL,
} from '../config/constants.js';

/**
 * JobApplication Schema
 * Tracks matching, notification delivery, and worker acceptance/assignment.
 */
const jobApplicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(APPLICATION_STATUS),
      default: APPLICATION_STATUS.NOTIFIED,
      index: true,
    },
    notifiedAt: {
      type: Date,
      default: Date.now,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    notifiedVia: {
      type: String,
      enum: Object.values(NOTIFICATION_CHANNEL),
      default: NOTIFICATION_CHANNEL.SOCKET,
    },
  },
  {
    timestamps: true,
  },
);

// Unique compound index so a worker cannot have duplicate applications per job
jobApplicationSchema.index({ job: 1, worker: 1 }, { unique: true });
jobApplicationSchema.index({ worker: 1, status: 1 });

const JobApplication = mongoose.model('JobApplication', jobApplicationSchema);

export default JobApplication;
