import EscrowTransaction from '../models/EscrowTransaction.js';
import Attendance from '../models/Attendance.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Dispute from '../models/Dispute.js';
import { approveAndRelease } from './escrow.service.js';
import { retryPendingPayouts } from './payouts/payout.service.js';
import { ESCROW_STATUS, SIGNOFF_STATUS, PAYMENT_ORDER_STATUS, DISPUTE_STATUS } from '../config/constants.js';
import clock from '../utils/clock.js';
import logger from '../utils/logger.js';
import env from '../config/env.js';

let schedulerInterval = null;

/**
 * Auto-approves shifts whose autoApprovalAt timer has expired without contractor objection.
 */
export async function autoApprove() {
  const now = clock.now();

  // Find CHECKED_OUT rows where autoApprovalAt <= now
  const candidates = await EscrowTransaction.find({
    status: ESCROW_STATUS.CHECKED_OUT,
    autoApprovalAt: { $lte: now },
  }).limit(20);

  let approvedCount = 0;

  for (const escrow of candidates) {
    try {
      // Check if there is an active dispute
      const activeDispute = await Dispute.findOne({
        escrowTransaction: escrow._id,
        status: { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
      });

      if (activeDispute) {
        continue; // Disputed rows must NOT be auto-approved
      }

      // Mark attendance signoff approved by system
      if (escrow.attendance) {
        await Attendance.findByIdAndUpdate(escrow.attendance, {
          'contractorSignoff.status': SIGNOFF_STATUS.APPROVED,
          'contractorSignoff.signedOffAt': now,
          'contractorSignoff.signoffNote': 'System auto-approved on approval window expiry',
        });
      }

      // Execute release
      await approveAndRelease(escrow._id, null, 'system', 'AUTO_APPROVAL');
      approvedCount++;
    } catch (err) {
      logger.error(`[EscrowScheduler] Failed to auto-approve escrow ${escrow._id}: ${err.message}`);
    }
  }

  return approvedCount;
}

/**
 * Retries failed or pending simulated payouts.
 */
export async function retryPayouts() {
  return await retryPendingPayouts();
}

/**
 * Expires stale payment orders older than 15 minutes.
 */
export async function expireTopups() {
  const fifteenMinutesAgo = new Date(clock.now().getTime() - 15 * 60 * 1000);

  const result = await PaymentOrder.updateMany(
    {
      status: PAYMENT_ORDER_STATUS.CREATED,
      createdAt: { $lte: fifteenMinutesAgo },
    },
    {
      $set: { status: PAYMENT_ORDER_STATUS.EXPIRED },
    }
  );

  return result.modifiedCount || 0;
}

/**
 * Runs all scheduled tasks once (useful for dev endpoints and tests).
 */
export async function runEscrowSchedulerOnce() {
  const approved = await autoApprove();
  const payouts = await retryPayouts();
  const expiredOrders = await expireTopups();

  return {
    autoApprovedCount: approved,
    payoutsRetried: payouts.retriedCount,
    payoutsSucceeded: payouts.succeededCount,
    expiredTopupsCount: expiredOrders,
  };
}

/**
 * Starts background scheduler interval (Skipped in test environment).
 */
export function startEscrowScheduler() {
  if (env.nodeEnv === 'test') {
    return;
  }

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const intervalMs = (env.escrowSchedulerIntervalSec || 60) * 1000;
  logger.info(`[EscrowScheduler] Background scheduler started with interval ${intervalMs}ms.`);

  schedulerInterval = setInterval(async () => {
    try {
      await runEscrowSchedulerOnce();
    } catch (err) {
      logger.error(`[EscrowScheduler] Execution error: ${err.message}`);
    }
  }, intervalMs);
}

/**
 * Stops background scheduler.
 */
export function stopEscrowScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('[EscrowScheduler] Background scheduler stopped.');
  }
}
