import mongoose from 'mongoose';
import Wallet from '../models/Wallet.js';
import LedgerEntry from '../models/LedgerEntry.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import { getISTDateString } from '../utils/time.js';
import { ESCROW_STATUS, LEDGER_ACCOUNT, LEDGER_ENTRY_TYPE } from '../config/constants.js';

/**
 * Retrieves existing wallet or creates one lazily with 0 balance.
 *
 * @param {string|mongoose.Types.ObjectId} userId
 * @param {mongoose.ClientSession} [session]
 * @returns {Promise<Object>} Wallet document
 */
export async function getOrCreateWallet(userId, session = null) {
  let query = Wallet.findOne({ user: userId });
  if (session) query = query.session(session);
  let wallet = await query;

  if (!wallet) {
    try {
      const options = session ? { session } : {};
      const [newWallet] = await Wallet.create(
        [
          {
            user: userId,
            balancePaise: 0,
            lockedPaise: 0,
            currency: 'INR',
          },
        ],
        options
      );
      wallet = newWallet;
    } catch (err) {
      if (err.code === 11000) {
        // Race condition: wallet was created concurrently
        wallet = await Wallet.findOne({ user: userId }).session(session);
      } else {
        throw err;
      }
    }
  }

  return wallet;
}

/**
 * Returns basic wallet state for the authenticated user.
 */
export async function getWalletDetails(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    walletId: wallet._id,
    balancePaise: wallet.balancePaise,
    lockedPaise: wallet.lockedPaise,
    totalPaise: wallet.balancePaise + wallet.lockedPaise,
    currency: wallet.currency,
    status: wallet.status,
  };
}

/**
 * Returns paginated ledger history for a user's wallet.
 */
export async function getWalletLedger(userId, { page = 1, limit = 20, type = null, startDate = null, endDate = null }) {
  const wallet = await getOrCreateWallet(userId);
  const filter = { wallet: wallet._id };

  if (type) {
    filter.entryType = type;
  }

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const total = await LedgerEntry.countDocuments(filter);
  const entries = await LedgerEntry.find(filter)
    .sort({ createdAt: -1, entryIndex: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  return {
    entries,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum),
    },
  };
}

/**
 * Returns role-tailored financial summary.
 */
export async function getWalletSummary(userId, role) {
  const wallet = await getOrCreateWallet(userId);
  const todayDate = getISTDateString();

  if (role === 'worker') {
    // 1. Today's earnings (RELEASED on todayDate)
    const todayReleased = await EscrowTransaction.aggregate([
      {
        $match: {
          worker: new mongoose.Types.ObjectId(userId),
          status: ESCROW_STATUS.RELEASED,
          dayDate: todayDate,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaise' },
        },
      },
    ]);

    // 2. Pending earnings (CHECKED_OUT or APPROVED but not yet released)
    const pendingEarnings = await EscrowTransaction.aggregate([
      {
        $match: {
          worker: new mongoose.Types.ObjectId(userId),
          status: { $in: [ESCROW_STATUS.CHECKED_OUT, ESCROW_STATUS.APPROVED] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaise' },
        },
      },
    ]);

    // 3. Lifetime released total
    const lifetimeReleased = await EscrowTransaction.aggregate([
      {
        $match: {
          worker: new mongoose.Types.ObjectId(userId),
          status: ESCROW_STATUS.RELEASED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaise' },
        },
      },
    ]);

    return {
      balancePaise: wallet.balancePaise,
      lockedPaise: wallet.lockedPaise,
      todayEarningsPaise: todayReleased[0]?.total || 0,
      pendingAmountPaise: pendingEarnings[0]?.total || 0,
      releasedTotalPaise: lifetimeReleased[0]?.total || 0,
      currency: wallet.currency,
    };
  } else {
    // Contractor summary
    // 1. Locked amount in active jobs
    const activeLocked = await EscrowTransaction.aggregate([
      {
        $match: {
          contractor: new mongoose.Types.ObjectId(userId),
          status: {
            $in: [
              ESCROW_STATUS.FUNDED,
              ESCROW_STATUS.CHECKED_IN,
              ESCROW_STATUS.CHECKED_OUT,
              ESCROW_STATUS.APPROVED,
              ESCROW_STATUS.DISPUTED,
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaise' },
        },
      },
    ]);

    // 2. Spent amount (RELEASED)
    const spentTotal = await EscrowTransaction.aggregate([
      {
        $match: {
          contractor: new mongoose.Types.ObjectId(userId),
          status: ESCROW_STATUS.RELEASED,
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amountPaise' },
        },
      },
    ]);

    return {
      availablePaise: wallet.balancePaise,
      lockedPaise: wallet.lockedPaise,
      activeLockedPaise: activeLocked[0]?.total || 0,
      spentTotalPaise: spentTotal[0]?.total || 0,
      currency: wallet.currency,
    };
  }
}
