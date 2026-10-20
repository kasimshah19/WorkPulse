import mongoose from 'mongoose';
import Payout from '../../models/Payout.js';
import User from '../../models/User.js';
import EscrowTransaction from '../../models/EscrowTransaction.js';
import Notification from '../../models/Notification.js';
import { getOrCreateWallet } from '../wallet.service.js';
import { postLedgerGroup, LedgerError } from '../ledger.service.js';
import mockPayoutDriver from './mock.driver.js';
import {
  PAYOUT_STATUS,
  PAYOUT_TYPE,
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
} from '../../config/constants.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { getIO } from '../../sockets/index.js';

export const UPI_REGEX = /^[\w.-]+@[\w.-]+$/;

/**
 * Validates UPI ID format.
 */
export function isValidUPI(upiId) {
  return typeof upiId === 'string' && UPI_REGEX.test(upiId.trim());
}

/**
 * Auto-triggers UPI payout for an escrow release if worker has configured UPI.
 * Payout failure must NEVER rollback or block escrow release.
 */
export async function triggerAutoReleasePayout(escrowTx) {
  try {
    const worker = await User.findById(escrowTx.worker);
    if (!worker) return null;

    const workerWallet = await getOrCreateWallet(worker._id);
    const workerAmountPaise = escrowTx.amountPaise - (escrowTx.platformFeePaise || 0);

    if (!worker.upiId || !isValidUPI(worker.upiId)) {
      // Worker has no valid UPI: Money sits safely in worker wallet
      await EscrowTransaction.findByIdAndUpdate(escrowTx._id, { payoutStatus: 'NO_UPI' });

      await Notification.create({
        user: worker._id,
        type: NOTIFICATION_TYPE.SYSTEM,
        title: 'UPI ID jodein (Add UPI ID)',
        body: `Aapki Rs ${Math.floor(workerAmountPaise / 100)} ki kamai wallet mein hai. Bank account mein paane ke liye UPI ID jodein.`,
        data: { escrowId: escrowTx._id.toString() },
        channel: NOTIFICATION_CHANNEL.SOCKET,
        status: NOTIFICATION_STATUS.SENT,
        sentAt: new Date(),
      }).catch(() => {});

      return { status: 'NO_UPI' };
    }

    const idempotencyKey = `PAYOUT:${escrowTx._id.toString()}`;

    // Find or create Payout record
    let payout = await Payout.findOne({ idempotencyKey });
    if (!payout) {
      try {
        payout = await Payout.create({
          user: worker._id,
          escrowTransaction: escrowTx._id,
          type: PAYOUT_TYPE.AUTO_RELEASE,
          amountPaise: workerAmountPaise,
          upiId: worker.upiId,
          provider: 'mock',
          status: PAYOUT_STATUS.PENDING,
          idempotencyKey,
        });
      } catch (err) {
        if (err.code === 11000) {
          payout = await Payout.findOne({ idempotencyKey });
        } else {
          throw err;
        }
      }
    }

    if (payout.status === PAYOUT_STATUS.SUCCESS) {
      return { status: PAYOUT_STATUS.SUCCESS, payout };
    }

    // Call payout driver
    payout.attempts += 1;
    const result = await mockPayoutDriver.executePayout({
      amountPaise: workerAmountPaise,
      upiId: worker.upiId,
      payoutId: payout._id.toString(),
    });

    if (result.success) {
      payout.status = PAYOUT_STATUS.SUCCESS;
      payout.providerRef = result.providerRef;
      payout.ledgerGroupId = `PAYOUT:${payout._id.toString()}`;
      await payout.save();

      await EscrowTransaction.findByIdAndUpdate(escrowTx._id, {
        payoutStatus: PAYOUT_STATUS.SUCCESS,
        payoutReference: result.providerRef,
      });

      // Emit socket notification
      try {
        const io = getIO();
        io.to(`user:${worker._id.toString()}`).emit('payout:status', {
          payoutId: payout._id.toString(),
          status: PAYOUT_STATUS.SUCCESS,
          amountPaise: workerAmountPaise,
          providerRef: result.providerRef,
        });
      } catch (_e) {}

      return { status: PAYOUT_STATUS.SUCCESS, payout };
    } else {
      payout.status = PAYOUT_STATUS.FAILED;
      payout.failureReason = result.error || 'GATEWAY_ERROR';
      await payout.save();

      await EscrowTransaction.findByIdAndUpdate(escrowTx._id, {
        payoutStatus: PAYOUT_STATUS.FAILED,
      });

      try {
        const io = getIO();
        io.to(`user:${worker._id.toString()}`).emit('payout:status', {
          payoutId: payout._id.toString(),
          status: PAYOUT_STATUS.FAILED,
          amountPaise: workerAmountPaise,
        });
      } catch (_e) {}

      return { status: PAYOUT_STATUS.FAILED, payout };
    }
  } catch (err) {
    logger.error(`[Payout] Error during triggerAutoReleasePayout: ${err.message}`);
    return { status: 'ERROR', error: err.message };
  }
}

/**
 * Worker manually requests wallet withdrawal to their UPI ID.
 */
export async function withdrawToUPI({ workerId, amountPaise, idempotencyKey }) {
  if (!Number.isSafeInteger(amountPaise) || amountPaise < env.minWithdrawPaise) {
    throw new LedgerError(
      400,
      'INVALID_AMOUNT',
      `Minimum withdrawal amount is Rs ${Math.floor(env.minWithdrawPaise / 100)}.`
    );
  }

  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    throw new LedgerError(400, 'MISSING_IDEMPOTENCY_KEY', 'A unique idempotencyKey is required.');
  }

  // Idempotent return if already handled with this key
  const existingPayout = await Payout.findOne({ idempotencyKey });
  if (existingPayout) {
    return existingPayout;
  }

  const worker = await User.findById(workerId);
  if (!worker || !worker.upiId || !isValidUPI(worker.upiId)) {
    throw new LedgerError(400, 'UPI_NOT_CONFIGURED', 'Valid UPI ID is required for withdrawal.');
  }

  const wallet = await getOrCreateWallet(workerId);
  if (wallet.balancePaise < amountPaise) {
    throw new LedgerError(402, 'INSUFFICIENT_BALANCE', 'Insufficient wallet balance for withdrawal.', {
      availablePaise: wallet.balancePaise,
      requestedPaise: amountPaise,
    });
  }

  // Create Payout document
  let payout;
  try {
    payout = await Payout.create({
      user: workerId,
      escrowTransaction: null,
      type: PAYOUT_TYPE.WITHDRAWAL,
      amountPaise,
      upiId: worker.upiId,
      provider: 'mock',
      status: PAYOUT_STATUS.PENDING,
      idempotencyKey,
    });
  } catch (err) {
    if (err.code === 11000) {
      return await Payout.findOne({ idempotencyKey });
    }
    throw err;
  }

  payout.attempts += 1;
  const result = await mockPayoutDriver.executePayout({
    amountPaise,
    upiId: worker.upiId,
    payoutId: payout._id.toString(),
  });

  if (result.success) {
    payout.status = PAYOUT_STATUS.SUCCESS;
    payout.providerRef = result.providerRef;
    payout.ledgerGroupId = `PAYOUT:${payout._id.toString()}`;
    await payout.save();

    // Deduct from worker wallet via ledger engine
    await postLedgerGroup({
      groupId: payout.ledgerGroupId,
      entries: [
        {
          account: LEDGER_ACCOUNT.WORKER_WALLET,
          wallet: wallet._id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amountPaise,
          description: `Withdrawal to UPI ${worker.upiId} (UTR: ${result.providerRef})`,
          referenceType: 'WITHDRAWAL',
          referenceId: payout._id.toString(),
        },
        {
          account: LEDGER_ACCOUNT.PAYOUT_EXTERNAL,
          wallet: null,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise,
          description: `External UPI withdrawal dispatch (UTR: ${result.providerRef})`,
          referenceType: 'WITHDRAWAL',
          referenceId: payout._id.toString(),
        },
      ],
    });

    try {
      const io = getIO();
      io.to(`user:${workerId.toString()}`).emit('payout:status', {
        payoutId: payout._id.toString(),
        status: PAYOUT_STATUS.SUCCESS,
        amountPaise,
        providerRef: result.providerRef,
      });
    } catch (_e) {}
  } else {
    payout.status = PAYOUT_STATUS.FAILED;
    payout.failureReason = result.error || 'GATEWAY_ERROR';
    await payout.save();

    try {
      const io = getIO();
      io.to(`user:${workerId.toString()}`).emit('payout:status', {
        payoutId: payout._id.toString(),
        status: PAYOUT_STATUS.FAILED,
        amountPaise,
      });
    } catch (_e) {}
  }

  return payout;
}

/**
 * Retries failed or pending payouts (called by scheduler).
 */
export async function retryPendingPayouts() {
  const oneMinuteAgo = new Date(Date.now() - 60000);
  const eligiblePayouts = await Payout.find({
    status: { $in: [PAYOUT_STATUS.PENDING, PAYOUT_STATUS.FAILED] },
    attempts: { $lt: 3 },
    createdAt: { $lte: oneMinuteAgo },
  }).limit(20);

  let retriedCount = 0;
  let succeededCount = 0;

  for (const payout of eligiblePayouts) {
    retriedCount++;
    payout.attempts += 1;
    const result = await mockPayoutDriver.executePayout({
      amountPaise: payout.amountPaise,
      upiId: payout.upiId,
      payoutId: payout._id.toString(),
    });

    if (result.success) {
      payout.status = PAYOUT_STATUS.SUCCESS;
      payout.providerRef = result.providerRef;
      payout.ledgerGroupId = `PAYOUT:${payout._id.toString()}`;
      await payout.save();

      const wallet = await getOrCreateWallet(payout.user);
      await postLedgerGroup({
        groupId: payout.ledgerGroupId,
        entries: [
          {
            account: LEDGER_ACCOUNT.WORKER_WALLET,
            wallet: wallet._id,
            entryType: LEDGER_ENTRY_TYPE.DEBIT,
            amountPaise: payout.amountPaise,
            description: `Retry UPI payout to ${payout.upiId} (UTR: ${result.providerRef})`,
            referenceType: 'PAYOUT_RETRY',
            referenceId: payout._id.toString(),
          },
          {
            account: LEDGER_ACCOUNT.PAYOUT_EXTERNAL,
            wallet: null,
            entryType: LEDGER_ENTRY_TYPE.CREDIT,
            amountPaise: payout.amountPaise,
            description: `External UPI retry dispatch (UTR: ${result.providerRef})`,
            referenceType: 'PAYOUT_RETRY',
            referenceId: payout._id.toString(),
          },
        ],
      });

      if (payout.escrowTransaction) {
        await EscrowTransaction.findByIdAndUpdate(payout.escrowTransaction, {
          payoutStatus: PAYOUT_STATUS.SUCCESS,
          payoutReference: result.providerRef,
        });
      }

      succeededCount++;
    } else {
      payout.failureReason = result.error || 'RETRY_FAILED';
      await payout.save();
    }
  }

  return { retriedCount, succeededCount };
}
