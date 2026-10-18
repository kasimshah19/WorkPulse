import mongoose from 'mongoose';
import { ESCROW_STATUS } from '../config/constants.js';

/**
 * EscrowTransaction Schema
 * Manages daily escrow lifecycle for each assigned worker per day.
 * Amount is stored strictly in integer Paise.
 */
const escrowTransactionSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    attendance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Attendance',
      default: null,
    },
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} is not an integer value in paise',
      },
    },
    platformFeePaise: {
      type: Number,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isInteger,
        message: '{VALUE} must be an integer',
      },
    },
    status: {
      type: String,
      enum: Object.values(ESCROW_STATUS),
      default: ESCROW_STATUS.CREATED,
      index: true,
    },
    statusHistory: [
      {
        from: { type: String, required: true },
        to: { type: String, required: true },
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        reason: { type: String, default: '' },
      },
    ],
    razorpayOrderId: {
      type: String,
      default: '',
    },
    razorpayPaymentId: {
      type: String,
      default: '',
    },
    payoutReference: {
      type: String,
      default: '',
    },
    idempotencyKey: {
      type: String,
      required: true,
    },
    autoApprovalAt: {
      type: Date,
      default: null,
    },
    releasedAt: {
      type: Date,
      default: null,
    },
    dayDate: {
      type: String, // YYYY-MM-DD
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
escrowTransactionSchema.index({ idempotencyKey: 1 }, { unique: true });
escrowTransactionSchema.index({ job: 1, worker: 1, dayDate: 1 }, { unique: true });
escrowTransactionSchema.index({ status: 1, autoApprovalAt: 1 });

const EscrowTransaction = mongoose.model(
  'EscrowTransaction',
  escrowTransactionSchema,
);

export default EscrowTransaction;
