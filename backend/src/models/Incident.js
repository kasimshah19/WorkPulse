import mongoose from 'mongoose';
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_TIMELINE_EVENT,
  LOCATION_FLAG,
  RESOLUTION_TYPE,
  JOB_CONTEXT,
  INCIDENT_VISIBILITY,
} from '../config/constants.js';

/**
 * Incident Schema
 * Emergency SOS triggers, safety violations, harassment, and site conflicts.
 * Timeline and locationTrail are append-only. Incidents are never deleted.
 */
const incidentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: false,
      default: null,
      index: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      default: null,
      trim: true,
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
        default: [0, 0],
      },
    },
    locationFlag: {
      type: String,
      enum: Object.values(LOCATION_FLAG),
      default: LOCATION_FLAG.OK,
    },
    locationTrail: [
      {
        coordinates: { type: [Number], required: true },
        accuracy: { type: Number, default: null },
        at: { type: Date, default: Date.now },
      },
    ],
    timeline: [
      {
        event: {
          type: String,
          enum: Object.values(INCIDENT_TIMELINE_EVENT),
          required: true,
        },
        at: {
          type: Date,
          default: Date.now,
        },
        by: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          default: null,
        },
        data: {
          type: mongoose.Schema.Types.Mixed,
          default: {},
        },
      },
    ],
    notifyContractor: {
      type: Boolean,
      default: true,
    },
    escalationLevel: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    jobContext: {
      type: String,
      enum: Object.values(JOB_CONTEXT),
      default: JOB_CONTEXT.NONE,
    },
    accusedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    visibility: {
      type: String,
      enum: Object.values(INCIDENT_VISIBILITY),
      default: INCIDENT_VISIBILITY.ALERTED_USERS,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
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
      index: true,
    },
    alertedUsers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        channel: { type: String, default: 'socket' },
        phone: { type: String, default: null }, // for external contacts like emergencyContact
        sentAt: { type: Date, default: Date.now },
        ackAt: { type: Date, default: null },
        deliveredAt: { type: Date, default: null },
      },
    ],
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    resolutionType: {
      type: String,
      enum: Object.values(RESOLUTION_TYPE),
      default: null,
    },
    resolutionNotes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
incidentSchema.index({ status: 1, severity: 1, createdAt: -1 });
incidentSchema.index({ reportedBy: 1, createdAt: -1 });
incidentSchema.index({ job: 1, createdAt: -1 });
incidentSchema.index({ location: '2dsphere' });
incidentSchema.index({ type: 1, status: 1 });
incidentSchema.index(
  { reportedBy: 1, idempotencyKey: 1 },
  { unique: true, sparse: true },
);

/**
 * Immutability Guard:
 * Individual incidents cannot be deleted.
 */
incidentSchema.pre(['findOneAndDelete', 'findByIdAndDelete'], function (next) {
  next(new Error('IMMUTABLE_INCIDENT: Incidents cannot be deleted. Use status RESOLVED.'));
});

incidentSchema.pre('deleteOne', { document: true, query: false }, function (next) {
  next(new Error('IMMUTABLE_INCIDENT: Incidents cannot be deleted. Use status RESOLVED.'));
});

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
