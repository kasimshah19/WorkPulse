import mongoose from 'mongoose';

/**
 * Ledger Entry schema – append-only financial audit trail.
 * Each escrow state transition creates a ledger entry.
 * TODO Phase 3: Add reconciliation and balance snapshot logic.
 */
const ledgerEntrySchema = new mongoose.Schema({
  transaction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EscrowTransaction',
    required: true,
  },
  type: {
    type: String,
    enum: ['DEBIT', 'CREDIT'],
    required: true,
  },
  account: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true, // Append-only: cannot be updated
  },
});

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema);

export default LedgerEntry;
