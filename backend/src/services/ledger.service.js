import mongoose from 'mongoose';
import LedgerEntry from '../models/LedgerEntry.js';
import Wallet from '../models/Wallet.js';
import {
  LEDGER_ENTRY_TYPE,
  LEDGER_ACCOUNT,
} from '../config/constants.js';
import logger from '../utils/logger.js';
import { getIO } from '../sockets/index.js';

/**
 * CRITICAL MONEY ENGINE: LEDGER SERVICE
 *
 * NOTE FOR CODE REVIEWS AND STATIC CHECKS:
 * This file is the ONLY authorized module in the entire codebase allowed to
 * modify Wallet balancePaise and lockedPaise.
 * Any other module attempting $inc or direct mutation on balancePaise or lockedPaise
 * violates the double-entry accounting invariants.
 */

/**
 * Custom Ledger Error
 */
export class LedgerError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Executes an atomic, idempotent double-entry ledger group.
 *
 * @param {Object} params
 * @param {string} params.groupId - Unique deterministic idempotency key (e.g. "TOPUP:<id>", "FUND:<id>")
 * @param {Array<Object>} params.entries - List of ledger movement objects
 * @param {mongoose.ClientSession} [params.session] - Existing Mongoose transaction session
 * @returns {Promise<{ alreadyApplied: boolean, entries: Array<Object> }>}
 */
export async function postLedgerGroup({ groupId, entries, legs, session: providedSession }) {
  if (!groupId || typeof groupId !== 'string') {
    throw new LedgerError(400, 'INVALID_GROUP_ID', 'Deterministic groupId string is required.');
  }

  let normalizedEntries = entries;
  if (!normalizedEntries && Array.isArray(legs)) {
    normalizedEntries = [];
    for (const leg of legs) {
      const entryType =
        leg.entryType ||
        (leg.amountPaise < 0 ? LEDGER_ENTRY_TYPE.DEBIT : LEDGER_ENTRY_TYPE.CREDIT);
      normalizedEntries.push({
        ...leg,
        entryType,
        amountPaise: Math.abs(leg.amountPaise),
        userId: leg.userId || leg.user,
      });
    }
  }

  if (!Array.isArray(normalizedEntries) || normalizedEntries.length < 2) {
    throw new LedgerError(400, 'INVALID_LEDGER_ENTRIES', 'A ledger group requires at least 2 entries.');
  }

  // 1. Check if this groupId has already been posted (Idempotency)
  const existingEntries = await LedgerEntry.find({ groupId }).sort({ entryIndex: 1 }).lean();
  if (existingEntries.length > 0) {
    logger.info(`[Ledger] Idempotent hit: groupId "${groupId}" already recorded. Skipping.`);
    existingEntries.alreadyApplied = true;
    existingEntries.entries = existingEntries;
    return existingEntries;
  }

  // 2. Validate entries structure & double-entry balance: sum(DEBIT) == sum(CREDIT)
  let totalDebit = 0;
  let totalCredit = 0;

  for (let i = 0; i < normalizedEntries.length; i++) {
    const entry = normalizedEntries[i];
    const { account, entryType, amountPaise } = entry;

    if (!Object.values(LEDGER_ACCOUNT).includes(account)) {
      throw new LedgerError(400, 'INVALID_ACCOUNT', `Unknown ledger account: ${account}`);
    }

    if (!Object.values(LEDGER_ENTRY_TYPE).includes(entryType)) {
      throw new LedgerError(400, 'INVALID_ENTRY_TYPE', `Unknown entry type: ${entryType}`);
    }

    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      throw new LedgerError(
        400,
        'INVALID_AMOUNT',
        `amountPaise must be a positive safe integer. Received: ${amountPaise}`
      );
    }

    if (entryType === LEDGER_ENTRY_TYPE.DEBIT) {
      totalDebit += amountPaise;
    } else {
      totalCredit += amountPaise;
    }
  }

  if (totalDebit !== totalCredit) {
    throw new LedgerError(
      400,
      'LEDGER_UNBALANCED',
      `Ledger group is unbalanced: totalDebit (${totalDebit} paise) !== totalCredit (${totalCredit} paise)`
    );
  }

  // Internal execution within session
  const executeGroup = async (session) => {
    // Re-check inside session for concurrent idempotency
    const inSessionExisting = await LedgerEntry.find({ groupId }).session(session).sort({ entryIndex: 1 }).lean();
    if (inSessionExisting.length > 0) {
      inSessionExisting.alreadyApplied = true;
      inSessionExisting.entries = inSessionExisting;
      return inSessionExisting;
    }

    const appliedEntries = [];
    const modifiedWallets = new Map(); // walletId -> updated Wallet doc

    // Process each entry in order
    for (let index = 0; index < normalizedEntries.length; index++) {
      const entry = normalizedEntries[index];
      let {
        account,
        wallet: walletId,
        userId,
        user,
        entryType,
        amountPaise,
        description,
        referenceType = 'ESCROW_SETTLEMENT',
        referenceId = '',
        transaction = null,
      } = entry;

      if (!walletId && (userId || user)) {
        const uId = userId || user;
        const w = await Wallet.findOne({ user: uId }).session(session);
        if (w) walletId = w._id;
      }

      let balanceAfter = 0;

      // Handle external/platform accounts where wallet is null
      if (
        account === LEDGER_ACCOUNT.GATEWAY_EXTERNAL ||
        account === LEDGER_ACCOUNT.PLATFORM_FEE ||
        account === LEDGER_ACCOUNT.PAYOUT_EXTERNAL
      ) {
        balanceAfter = 0;
      } else {
        // Internal account must be associated with a valid wallet
        if (!walletId) {
          throw new LedgerError(
            400,
            'MISSING_WALLET',
            `Internal account ${account} requires a wallet reference.`
          );
        }

        let updatedWallet = null;

        // Apply conditional updates according to account type
        if (account === LEDGER_ACCOUNT.CONTRACTOR_WALLET || account === LEDGER_ACCOUNT.WORKER_WALLET) {
          if (entryType === LEDGER_ENTRY_TYPE.DEBIT) {
            // Outgoing money: Balance must be >= amountPaise
            updatedWallet = await Wallet.findOneAndUpdate(
              { _id: walletId, balancePaise: { $gte: amountPaise } },
              { $inc: { balancePaise: -amountPaise, version: 1 } },
              { new: true, session }
            );
            if (!updatedWallet) {
              const currentWallet = await Wallet.findById(walletId).session(session);
              throw new LedgerError(
                402,
                'INSUFFICIENT_BALANCE',
                `Insufficient wallet balance for debit of ${amountPaise} paise.`,
                {
                  requiredPaise: amountPaise,
                  availablePaise: currentWallet ? currentWallet.balancePaise : 0,
                  shortfallPaise: currentWallet ? Math.max(0, amountPaise - currentWallet.balancePaise) : amountPaise,
                }
              );
            }
            balanceAfter = updatedWallet.balancePaise;
          } else {
            // Incoming money
            updatedWallet = await Wallet.findByIdAndUpdate(
              walletId,
              { $inc: { balancePaise: amountPaise, version: 1 } },
              { new: true, session }
            );
            if (!updatedWallet) {
              throw new LedgerError(404, 'WALLET_NOT_FOUND', `Wallet ${walletId} not found.`);
            }
            balanceAfter = updatedWallet.balancePaise;
          }
        } else if (account === LEDGER_ACCOUNT.ESCROW_HOLD) {
          if (entryType === LEDGER_ENTRY_TYPE.DEBIT) {
            // Releasing from hold: lockedPaise must be >= amountPaise
            updatedWallet = await Wallet.findOneAndUpdate(
              { _id: walletId, lockedPaise: { $gte: amountPaise } },
              { $inc: { lockedPaise: -amountPaise, version: 1 } },
              { new: true, session }
            );
            if (!updatedWallet) {
              const currentWallet = await Wallet.findById(walletId).session(session);
              throw new LedgerError(
                409,
                'INSUFFICIENT_LOCKED_FUNDS',
                `Insufficient locked funds for debit of ${amountPaise} paise.`,
                {
                  requiredPaise: amountPaise,
                  lockedPaise: currentWallet ? currentWallet.lockedPaise : 0,
                }
              );
            }
            balanceAfter = updatedWallet.lockedPaise;
          } else {
            // Locking funds in escrow hold
            updatedWallet = await Wallet.findByIdAndUpdate(
              walletId,
              { $inc: { lockedPaise: amountPaise, version: 1 } },
              { new: true, session }
            );
            if (!updatedWallet) {
              throw new LedgerError(404, 'WALLET_NOT_FOUND', `Wallet ${walletId} not found.`);
            }
            balanceAfter = updatedWallet.lockedPaise;
          }
        }

        if (updatedWallet) {
          modifiedWallets.set(updatedWallet._id.toString(), updatedWallet);
        }
      }

      // Create LedgerEntry
      const [ledgerDoc] = await LedgerEntry.create(
        [
          {
            groupId,
            entryIndex: index,
            transaction: transaction || null,
            wallet: walletId || null,
            entryType,
            account,
            amountPaise,
            balanceAfterPaise: balanceAfter,
            referenceType,
            referenceId: String(referenceId || ''),
            description: description || `Ledger movement for ${groupId}`,
          },
        ],
        { session }
      );

      appliedEntries.push(ledgerDoc);
    }

    return { alreadyApplied: false, entries: appliedEntries, modifiedWallets };
  };

  let result;
  if (providedSession) {
    result = await executeGroup(providedSession);
  } else {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        result = await executeGroup(session);
      });
    } catch (err) {
      if (err.code === 11000) {
        // Compound index duplicate key error: concurrent duplicate call succeeded first
        const concurrentEntries = await LedgerEntry.find({ groupId }).sort({ entryIndex: 1 }).lean();
        return { alreadyApplied: true, entries: concurrentEntries };
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  // Socket notification for updated wallets
  if (result.modifiedWallets && result.modifiedWallets.size > 0) {
    try {
      const io = getIO();
      for (const wallet of result.modifiedWallets.values()) {
        io.to(`user:${wallet.user.toString()}`).emit('wallet:updated', {
          balancePaise: wallet.balancePaise,
          lockedPaise: wallet.lockedPaise,
          totalPaise: wallet.balancePaise + wallet.lockedPaise,
          currency: wallet.currency,
        });
      }
    } catch (_e) {
      // Sockets not initialized in tests or isolated runs
    }
  }

  const entriesArray = Array.isArray(result) ? result : (result.entries || []);
  entriesArray.alreadyApplied = Boolean(result.alreadyApplied);
  entriesArray.entries = entriesArray;
  return entriesArray;
}
