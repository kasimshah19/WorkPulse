import mongoose from 'mongoose';
import {
  LEDGER_ENTRY_TYPE,
  LEDGER_ACCOUNT,
} from '../config/constants.js';

/**
 * LedgerEntry Schema (APPEND-ONLY)
 * Immutable double-entry bookkeeping system.
 * Updates and deletions are strictly disallowed at application and database level.
 */
const ledgerEntrySchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowTransaction',
    default: null,
    index: true,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    default: null,
    index: true,
  },
  entryType: {
    type: String,
    enum: Object.values(LEDGER_ENTRY_TYPE),
    required: true,
  },
  account: {
    type: String,
    enum: Object.values(LEDGER_ACCOUNT),
    required: true,
  },
  amountPaise: {
    type: Number,
    required: true,
    min: 0,
    validate: {
      validator: Number.isSafeInteger,
      message: '{VALUE} is not a safe integer value in paise',
    },
  },
  balanceAfterPaise: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isSafeInteger,
      message: '{VALUE} must be a safe integer in paise',
    },
  },
  referenceType: {
    type: String,
    default: 'ESCROW_SETTLEMENT',
  },
  referenceId: {
    type: String,
    default: '',
  },
  description: {
    type: String,
    required: true,
  },
  groupId: {
    type: String, // Deterministic idempotency key string (e.g. "FUND:<txId>", "TOPUP:<paymentId>")
    required: true,
    index: true,
  },
  entryIndex: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// Unique compound index: (groupId, entryIndex)
ledgerEntrySchema.index({ groupId: 1, entryIndex: 1 }, { unique: true });
// Index for wallet statement query
ledgerEntrySchema.index({ wallet: 1, createdAt: -1 });

// Guard: Disallow updates and deletions to enforce append-only invariant
ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Ledger entries are strictly immutable.'));
  }
  next();
});

const immutableMethods = [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'findOneAndDelete',
  'deleteOne',
  'deleteMany',
  'replaceOne',
];

immutableMethods.forEach((method) => {
  ledgerEntrySchema.pre(method, function (next) {
    next(new Error(`Ledger entries are strictly immutable: cannot perform ${method}`));
  });
});

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

export default LedgerEntry;
