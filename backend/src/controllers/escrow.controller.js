import { sendError } from '../utils/apiResponse.js';

/**
 * Escrow controller stubs.
 * TODO Phase 3: Implement Razorpay escrow funding, release, and dispute.
 */

export const fundEscrow = (_req, res) => {
  sendError(res, 501, 'TODO Phase 3: Implement escrow funding via Razorpay', 'NOT_IMPLEMENTED');
};

export const releaseEscrow = (_req, res) => {
  sendError(res, 501, 'TODO Phase 3: Implement escrow release to worker', 'NOT_IMPLEMENTED');
};

export const disputeEscrow = (_req, res) => {
  sendError(res, 501, 'TODO Phase 3: Implement escrow dispute', 'NOT_IMPLEMENTED');
};

export const getEscrowStatus = (_req, res) => {
  sendError(res, 501, 'TODO Phase 3: Implement escrow status check', 'NOT_IMPLEMENTED');
};
