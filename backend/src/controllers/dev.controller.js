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

import Incident from '../models/Incident.js';
import Job from '../models/Job.js';
import { runSafetySchedulerOnce } from '../services/safety.scheduler.js';

/**
 * POST /api/v1/dev/incidents/:id/age
 * Shifts an incident's createdAt and timeline timestamps into the past.
 */
export const devAgeIncident = async (req, res) => {
  if (env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev endpoints are disabled in production.', 'FORBIDDEN');
  }

  const { seconds = 90 } = req.body;
  const incident = await Incident.findById(req.params.id);
  if (!incident) {
    return sendError(res, 404, 'Incident not found', 'NOT_FOUND');
  }

  const shiftMs = seconds * 1000;
  incident.createdAt = new Date(incident.createdAt.getTime() - shiftMs);
  for (const t of incident.timeline || []) {
    t.at = new Date(new Date(t.at).getTime() - shiftMs);
  }

  await incident.save();

  return sendSuccess(res, 200, {
    message: `Aged incident by ${seconds} seconds`,
    incidentId: incident._id,
    newCreatedAt: incident.createdAt,
  });
};

/**
 * POST /api/v1/dev/jobs/:id/open-rating-window
 * Sets a job's endDate to yesterday safely without corrupting data.
 */
export const devOpenRatingWindow = async (req, res) => {
  if (env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev endpoints are disabled in production.', 'FORBIDDEN');
  }

  const job = await Job.findById(req.params.id);
  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  // Set endDate to 1 day in the past
  const yesterday = new Date(clock.now().getTime() - 24 * 60 * 60 * 1000);
  job.endDate = yesterday;
  job.status = 'COMPLETED';
  await job.save();

  return sendSuccess(res, 200, {
    message: 'Job marked COMPLETED with past endDate for rating window testing',
    jobId: job._id,
    endDate: job.endDate,
  });
};

/**
 * POST /api/v1/dev/scheduler/run
 * Immediately triggers execution of both escrow and safety scheduler tasks.
 */
export const devRunScheduler = async (req, res) => {
  if (env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev endpoints are disabled in production.', 'FORBIDDEN');
  }

  const [escrowResult, safetyResult] = await Promise.all([
    runEscrowSchedulerOnce(),
    runSafetySchedulerOnce(),
  ]);

  return sendSuccess(res, 200, {
    escrow: escrowResult,
    safety: safetyResult,
  });
};

export { devWalletTopup };
