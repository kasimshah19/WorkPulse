import mongoose from 'mongoose';
import {
  PAYOUT_STATUS,
  PAYOUT_TYPE,
  PAYMENT_PROVIDER,
} from '../config/constants.js';

/**
 * Payout Schema
 * Tracks worker simulated UPI payouts (auto-release and wallet withdrawals).
 */
const payoutSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    escrowTransaction: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EscrowTransaction',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(PAYOUT_TYPE),
      required: true,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
      validate: {
        validator: Number.isSafeInteger,
        message: '{VALUE} must be a safe integer in paise',
      },
    },
    upiId: {
      type: String,
      required: true,
    },
    provider: {
      type: String,
      default: 'mock',
    },
    providerRef: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(PAYOUT_STATUS),
      default: PAYOUT_STATUS.PENDING,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    failureReason: {
      type: String,
      default: '',
    },
    ledgerGroupId: {
      type: String,
      default: null,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

payoutSchema.index({ status: 1, attempts: 1, createdAt: 1 });

const Payout = mongoose.model('Payout', payoutSchema);

export default Payout;
