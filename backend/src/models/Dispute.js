import mongoose from 'mongoose';
import {
  DISPUTE_REASON,
  DISPUTE_STATUS,
  DISPUTE_EVIDENCE_TYPE,
  DISPUTE_OPENED_FROM,
} from '../config/constants.js';

/**
 * Dispute Schema
 * Manages arbitration proceedings between contractor and worker.
 */
const disputeSchema = new mongoose.Schema(
  {
    escrowTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EscrowTransaction',
      required: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    openedFrom: {
      type: String,
      enum: Object.values(DISPUTE_OPENED_FROM),
      default: DISPUTE_OPENED_FROM.CONTRACTOR_SIGNOFF,
      required: true,
    },
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    against: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reason: {
      type: String,
      enum: Object.values(DISPUTE_REASON),
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    evidence: [
      {
        type: {
          type: String,
          enum: Object.values(DISPUTE_EVIDENCE_TYPE),
          required: true,
        },
        refId: { type: String, default: '' },
        url: { type: String, default: '' },
      },
    ],
    status: {
      type: String,
      enum: Object.values(DISPUTE_STATUS),
      default: DISPUTE_STATUS.OPEN,
      index: true,
    },
    resolution: {
      decidedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      workerAmountPaise: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
          validator: Number.isInteger,
          message: '{VALUE} must be an integer in paise',
        },
      },
      contractorRefundPaise: {
        type: Number,
        default: 0,
        min: 0,
        validate: {
          validator: Number.isInteger,
          message: '{VALUE} must be an integer in paise',
        },
      },
      notes: { type: String, default: '' },
      decidedAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
disputeSchema.index({ escrowTransaction: 1 }, { unique: true });
disputeSchema.index({ status: 1, createdAt: 1 });
disputeSchema.index({ job: 1, status: 1 });

const Dispute = mongoose.model('Dispute', disputeSchema);

export default Dispute;
