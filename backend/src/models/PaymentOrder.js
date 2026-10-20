import mongoose from 'mongoose';
import {
  PAYMENT_ORDER_STATUS,
  PAYMENT_PROVIDER,
} from '../config/constants.js';

/**
 * PaymentOrder Schema (Contractor Wallet Top-up Orders)
 * Records external top-up attempts via Razorpay or Mock driver.
 */
const paymentOrderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      default: 'WALLET_TOPUP',
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
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    provider: {
      type: String,
      enum: Object.values(PAYMENT_PROVIDER),
      default: PAYMENT_PROVIDER.MOCK,
      required: true,
    },
    providerOrderId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      sparse: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_ORDER_STATUS),
      default: PAYMENT_ORDER_STATUS.CREATED,
      index: true,
    },
    signatureVerified: {
      type: Boolean,
      default: false,
    },
    webhookReceivedAt: {
      type: Date,
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    ledgerGroupId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
paymentOrderSchema.index({ user: 1, status: 1 });

const PaymentOrder = mongoose.model('PaymentOrder', paymentOrderSchema);

export default PaymentOrder;
