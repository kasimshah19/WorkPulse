import mongoose from 'mongoose';
import { WALLET_STATUS } from '../config/constants.js';

/**
 * Wallet Schema
 * Tracks balances in integer Paise for workers and contractors.
 */
const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    balancePaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: '{VALUE} is not a safe integer value in paise',
      },
    },
    lockedPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: {
        validator: Number.isSafeInteger,
        message: '{VALUE} is not a safe integer value in paise',
      },
    },
    version: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      enum: Object.values(WALLET_STATUS),
      default: WALLET_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
    versionKey: '__v',
  },
);

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;
