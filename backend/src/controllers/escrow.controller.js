import mongoose from 'mongoose';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Job from '../models/Job.js';
import { fundJob, approveAndRelease } from '../services/escrow.service.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { ESCROW_STATUS } from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * POST /api/v1/escrow/jobs/:id/fund
 * Locks funds in escrow for all pending days of a job.
 */
export const fundJobEscrow = async (req, res) => {
  const jobId = req.params.id;
  const result = await fundJob(jobId, req.user._id);
  return sendSuccess(res, 200, result);
};

/**
 * GET /api/v1/escrow/jobs/:id/funding-quote
 * Returns required funds, wallet balance, and shortfall.
 */
export const getJobFundingQuote = async (req, res) => {
  const jobId = req.params.id;
  const job = await Job.findById(jobId);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN');
  }

  const createdRows = await EscrowTransaction.find({
    job: jobId,
    status: ESCROW_STATUS.CREATED,
  });

  const requiredPaise = createdRows.reduce((sum, r) => sum + r.amountPaise, 0);
  const wallet = await getOrCreateWallet(job.contractor);

  const shortfallPaise = Math.max(0, requiredPaise - wallet.balancePaise);

  return sendSuccess(res, 200, {
    jobId,
    pendingDaysCount: createdRows.length,
    wagePerDayPaise: job.wagePerDayPaise,
    requiredPaise,
    walletBalancePaise: wallet.balancePaise,
    shortfallPaise,
    canFund: shortfallPaise === 0,
  });
};

/**
 * GET /api/v1/escrow/jobs/:id
 * Returns all escrow rows for a job grouped with financial totals.
 */
export const getJobEscrows = async (req, res) => {
  const jobId = req.params.id;
  const job = await Job.findById(jobId);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN');
  }

  const escrows = await EscrowTransaction.find({ job: jobId })
    .populate('worker', 'name phone skills')
    .sort({ dayDate: 1, createdAt: 1 })
    .lean();

  let totalPaise = 0;
  let fundedPaise = 0;
  let lockedPaise = 0;
  let releasedPaise = 0;
  let refundedPaise = 0;
  let pendingFundingPaise = 0;

  for (const row of escrows) {
    totalPaise += row.amountPaise;
    if (row.status === ESCROW_STATUS.CREATED) {
      pendingFundingPaise += row.amountPaise;
    }
    if (
      [
        ESCROW_STATUS.FUNDED,
        ESCROW_STATUS.CHECKED_IN,
        ESCROW_STATUS.CHECKED_OUT,
        ESCROW_STATUS.APPROVED,
        ESCROW_STATUS.DISPUTED,
      ].includes(row.status)
    ) {
      lockedPaise += row.amountPaise;
    }
    if (row.status === ESCROW_STATUS.FUNDED) {
      fundedPaise += row.amountPaise;
    }
    if (row.status === ESCROW_STATUS.RELEASED) {
      releasedPaise += row.amountPaise;
    }
    if (row.status === ESCROW_STATUS.REFUNDED) {
      refundedPaise += row.amountPaise;
    }
  }

  return sendSuccess(res, 200, {
    escrows,
    totals: {
      totalPaise,
      fundedPaise,
      lockedPaise,
      releasedPaise,
      refundedPaise,
      pendingFundingPaise,
    },
  });
};

/**
 * GET /api/v1/escrow/my
 * Worker retrieves own escrow transactions.
 */
export const getMyWorkerEscrows = async (req, res) => {
  const { status, date } = req.query;
  const filter = req.user.role === 'contractor' ? { contractor: req.user._id } : { worker: req.user._id };

  if (status) filter.status = status;
  if (date) filter.dayDate = date;

  const escrows = await EscrowTransaction.find(filter)
    .populate('job', 'title addressText workingHours contractor')
    .populate('worker', 'name phone skills')
    .populate({
      path: 'job',
      populate: { path: 'contractor', select: 'name phone' },
    })
    .sort({ dayDate: -1 })
    .lean();

  return sendSuccess(res, 200, escrows);
};

/**
 * GET /api/v1/escrow/:id
 * Retrieve single escrow detail with statusHistory.
 */
export const getEscrowById = async (req, res) => {
  const escrow = await EscrowTransaction.findById(req.params.id)
    .populate('job')
    .populate('worker', 'name phone')
    .populate('contractor', 'name phone')
    .populate('attendance')
    .lean();

  if (!escrow) {
    return sendError(res, 404, 'Escrow transaction not found', 'NOT_FOUND');
  }

  const isWorker = escrow.worker._id.toString() === req.user._id.toString();
  const isContractor = escrow.contractor._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isWorker && !isContractor && !isAdmin) {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN');
  }

  return sendSuccess(res, 200, escrow);
};

/**
 * POST /api/v1/escrow/:id/release
 * Contractor or Admin releases an escrow row.
 */
export const releaseEscrow = async (req, res) => {
  const escrowId = req.params.id;
  const result = await approveAndRelease(
    escrowId,
    req.user._id,
    req.user.role,
    req.body.reason || 'Manual release'
  );
  return sendSuccess(res, 200, result);
};
