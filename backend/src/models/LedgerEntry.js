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
    required: true,
    index: true,
  },
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true,
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
      validator: Number.isInteger,
      message: '{VALUE} is not an integer value in paise',
    },
  },
  balanceAfterPaise: {
    type: Number,
    required: true,
    validate: {
      validator: Number.isInteger,
      message: '{VALUE} must be an integer in paise',
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
    type: String, // UUID linking both DEBIT and CREDIT sides of a transaction
    required: true,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true,
  },
});

// Guard: Disallow updates and deletions to enforce append-only invariant
ledgerEntrySchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Ledger entries are strictly immutable.'));
  }
  next();
});

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

export default LedgerEntry;
