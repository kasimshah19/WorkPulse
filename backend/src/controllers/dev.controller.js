import EscrowTransaction from '../models/EscrowTransaction.js';
import { runEscrowSchedulerOnce } from '../services/escrow.scheduler.js';
import { devWalletTopup } from './payments.controller.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import env from '../config/env.js';
import clock from '../utils/clock.js';

/**
 * POST /api/v1/dev/escrow/:id/expire-approval
 * Fast-forwards the auto-approval timer for an escrow milestone into the past.
 */
export const devExpireApproval = async (req, res) => {
  if (env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev endpoints are disabled in production.', 'FORBIDDEN');
  }

  const escrowId = req.params.id;
  const escrow = await EscrowTransaction.findById(escrowId);

  if (!escrow) {
    return sendError(res, 404, 'Escrow transaction not found', 'NOT_FOUND');
  }

  // Set autoApprovalAt to 1 minute in the past
  const pastTime = new Date(clock.now().getTime() - 60000);
  escrow.autoApprovalAt = pastTime;
  await escrow.save();

  return sendSuccess(res, 200, {
    message: 'Auto-approval timestamp set to past.',
    escrowId,
    autoApprovalAt: escrow.autoApprovalAt,
  });
};

/**
 * POST /api/v1/dev/scheduler/run
 * Immediately triggers one execution of the scheduler tasks.
 */
export const devRunScheduler = async (req, res) => {
  if (env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev endpoints are disabled in production.', 'FORBIDDEN');
  }

  const result = await runEscrowSchedulerOnce();
  return sendSuccess(res, 200, result);
};

export { devWalletTopup };
