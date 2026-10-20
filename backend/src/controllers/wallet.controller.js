import {
  getWalletDetails,
  getWalletLedger,
  getWalletSummary,
} from '../services/wallet.service.js';
import { withdrawToUPI } from '../services/payouts/payout.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * GET /api/v1/wallet
 * Returns authenticated user's wallet state.
 */
export const getMyWallet = async (req, res) => {
  const wallet = await getWalletDetails(req.user._id);
  return sendSuccess(res, 200, wallet);
};

/**
 * GET /api/v1/wallet/ledger
 * Returns paginated ledger history for user's wallet.
 */
export const getMyLedger = async (req, res) => {
  const history = await getWalletLedger(req.user._id, req.query);
  return sendSuccess(res, 200, history.entries, history.pagination);
};

/**
 * GET /api/v1/wallet/summary
 * Returns role-specific earnings/escrow summaries.
 */
export const getMySummary = async (req, res) => {
  const summary = await getWalletSummary(req.user._id, req.user.role);
  return sendSuccess(res, 200, summary);
};

/**
 * POST /api/v1/wallet/withdraw
 * Worker withdraws funds to their configured UPI ID.
 */
export const withdrawFunds = async (req, res) => {
  const { amountPaise, idempotencyKey } = req.body;

  if (req.user.role !== 'worker') {
    return sendError(res, 403, 'Only workers can withdraw via UPI.', 'FORBIDDEN');
  }

  const payout = await withdrawToUPI({
    workerId: req.user._id,
    amountPaise,
    idempotencyKey,
  });

  return sendSuccess(res, 200, payout);
};
