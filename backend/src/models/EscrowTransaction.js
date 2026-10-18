import mongoose from 'mongoose';
import { ESCROW_STATUS } from '../config/constants.js';

/**
 * Escrow Transaction schema – payment lifecycle for each worker-job pair.
 * TODO Phase 3: Add Razorpay order/payment IDs, webhook fields.
 */
const escrowTransactionSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    contractor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ESCROW_STATUS),
      default: ESCROW_STATUS.CREATED,
    },
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  },
);

const EscrowTransaction = mongoose.model('EscrowTransaction', escrowTransactionSchema);

export default EscrowTransaction;
