import mongoose from 'mongoose';
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from '../config/constants.js';

/**
 * Incident schema – safety incidents and disputes.
 * TODO Phase 7: Add escalation workflow, SOS alert broadcasting.
 */
const incidentSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    severity: {
      type: String,
      enum: Object.values(INCIDENT_SEVERITY),
      default: INCIDENT_SEVERITY.MEDIUM,
    },
    type: {
      type: String,
      enum: Object.values(INCIDENT_TYPES),
      required: true,
    },
    status: {
      type: String,
      enum: ['open', 'investigating', 'resolved', 'closed'],
      default: 'open',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

const Incident = mongoose.model('Incident', incidentSchema);

export default Incident;
