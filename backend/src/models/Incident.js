import mongoose from 'mongoose';
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
} from '../config/constants.js';

/**
 * Incident Schema
 * Emergency SOS triggers, safety violations, harassment, and site conflicts.
 */
const incidentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(INCIDENT_TYPES),
      required: true,
    },
    severity: {
      type: String,
      enum: Object.values(INCIDENT_SEVERITY),
      required: true,
      default: INCIDENT_SEVERITY.MEDIUM,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lon, lat]
      },
    },
    description: {
      type: String,
      default: '',
    },
    photos: [
      {
        type: String,
      },
    ],
    status: {
      type: String,
      enum: Object.values(INCIDENT_STATUS),
      default: INCIDENT_STATUS.OPEN,
    },
    alertedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        channel: { type: String, default: 'socket' },
        sentAt: { type: Date, default: Date.now },
        ackAt: { type: Date, default: null },
      },
    ],
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
incidentSchema.index({ status: 1, severity: 1 });
incidentSchema.index({ job: 1, status: 1 });
incidentSchema.index({ location: '2dsphere' });

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
