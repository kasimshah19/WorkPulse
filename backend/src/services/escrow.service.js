import mongoose from 'mongoose';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Dispute from '../models/Dispute.js';
import Attendance from '../models/Attendance.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import User from '../models/User.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import { getOrCreateWallet } from './wallet.service.js';
import { postLedgerGroup, LedgerError } from './ledger.service.js';
import { triggerAutoReleasePayout } from './payouts/payout.service.js';
import {
  ESCROW_STATUS,
  ALLOWED_TRANSITIONS,
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
  DISPUTE_STATUS,
  DISPUTE_OPENED_FROM,
  DISPUTE_EVIDENCE_TYPE,
  DISPUTE_REASON,
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
} from '../config/constants.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { getISTDateString } from '../utils/time.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';

export class EscrowError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Permitted roles mapping for each valid state transition.
 */
const TRANSITION_ROLES = {
  [`${ESCROW_STATUS.CREATED}->${ESCROW_STATUS.FUNDED}`]: ['contractor'],
  [`${ESCROW_STATUS.CREATED}->${ESCROW_STATUS.CANCELLED}`]: ['contractor', 'admin', 'system'],
  [`${ESCROW_STATUS.FUNDED}->${ESCROW_STATUS.CHECKED_IN}`]: ['worker', 'system'],
  [`${ESCROW_STATUS.FUNDED}->${ESCROW_STATUS.CANCELLED}`]: ['contractor', 'admin', 'system'],
  [`${ESCROW_STATUS.FUNDED}->${ESCROW_STATUS.REFUNDED}`]: ['system', 'admin'],
  [`${ESCROW_STATUS.CHECKED_IN}->${ESCROW_STATUS.CHECKED_OUT}`]: ['worker', 'system'],
  [`${ESCROW_STATUS.CHECKED_IN}->${ESCROW_STATUS.DISPUTED}`]: ['contractor', 'admin', 'system'],
  [`${ESCROW_STATUS.CHECKED_OUT}->${ESCROW_STATUS.APPROVED}`]: ['contractor', 'system', 'admin'],
  [`${ESCROW_STATUS.CHECKED_OUT}->${ESCROW_STATUS.DISPUTED}`]: ['contractor', 'worker', 'admin', 'system'],
  [`${ESCROW_STATUS.APPROVED}->${ESCROW_STATUS.RELEASED}`]: ['system', 'admin', 'contractor'],
  [`${ESCROW_STATUS.DISPUTED}->${ESCROW_STATUS.RELEASED}`]: ['admin'],
  [`${ESCROW_STATUS.DISPUTED}->${ESCROW_STATUS.REFUNDED}`]: ['admin'],
};

/**
 * THE SINGLE STATUS TRANSITION ENGINE FOR ESCROW
 * All status changes MUST pass through this function.
 *
 * @param {string|mongoose.Types.ObjectId} txId
 * @param {string} toStatus
 * @param {Object} options
 * @param {string|mongoose.Types.ObjectId} [options.actor]
 * @param {string} [options.actorRole='system']
 * @param {string} [options.reason='']
 * @param {mongoose.ClientSession} [options.session]
 * @param {Object} [options.extraSet={}]
 * @returns {Promise<{ alreadyDone: boolean, escrow: Object }>}
 */
export async function transition(
  txId,
  toStatus,
  {
    actor = null,
    actorRole = 'system',
    reason = '',
    session = null,
    extraSet = {},
  } = {}
) {
  const id = txId?._id || txId;
  const currentDoc = await EscrowTransaction.findById(id).session(session);
  if (!currentDoc) {
    throw new EscrowError(404, 'ESCROW_NOT_FOUND', `EscrowTransaction ${id} not found.`);
  }

  const fromStatus = currentDoc.status;

  // Idempotency: If already in the target state, return success immediately
  if (fromStatus === toStatus) {
    return { alreadyDone: true, escrow: currentDoc };
  }

  // 1. Check if transition is allowed
  const allowedNext = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowedNext.includes(toStatus)) {
    throw new EscrowError(
      409,
      'INVALID_TRANSITION',
      `Cannot transition escrow from ${fromStatus} to ${toStatus}. Allowed: [${allowedNext.join(', ')}]`,
      { from: fromStatus, to: toStatus, allowed: allowedNext }
    );
  }

  // 2. Check actor role permissions
  const transitionKey = `${fromStatus}->${toStatus}`;
  const permittedRoles = TRANSITION_ROLES[transitionKey] || ['admin', 'system'];
  if (!permittedRoles.includes(actorRole) && actorRole !== 'admin') {
    throw new EscrowError(
      403,
      'FORBIDDEN_TRANSITION',
      `Role '${actorRole}' is not authorized to transition escrow from ${fromStatus} to ${toStatus}.`,
      { permittedRoles }
    );
  }

  // 3. Atomic findOneAndUpdate with status precondition
  const updatePayload = {
    $set: {
      status: toStatus,
      ...extraSet,
    },
    $inc: { version: 1 },
    $push: {
      statusHistory: {
        from: fromStatus,
        to: toStatus,
        at: clock.now(),
        by: actor && mongoose.Types.ObjectId.isValid(actor) ? actor : null,
        reason: reason || `Transition from ${fromStatus} to ${toStatus}`,
      },
    },
  };

  const updated = await EscrowTransaction.findOneAndUpdate(
    { _id: txId, status: fromStatus },
    updatePayload,
    { new: true, session }
  );

  if (!updated) {
    // Concurrent transition occurred! Reload and evaluate
    const reloaded = await EscrowTransaction.findById(txId).session(session);
    if (reloaded && reloaded.status === toStatus) {
      return { alreadyDone: true, escrow: reloaded };
    }
    throw new EscrowError(
      409,
      'INVALID_TRANSITION',
      `Concurrent transition detected. Current status is ${reloaded?.status}, cannot transition to ${toStatus}.`,
      { from: reloaded?.status, to: toStatus, allowed: ALLOWED_TRANSITIONS[reloaded?.status] || [] }
    );
  }

  // 4. Audit Log
  try {
    const actorId = actor && mongoose.Types.ObjectId.isValid(actor) ? actor : 'system';
    await AuditLog.create(
      [
        {
          actor: actorId,
          action: 'ESCROW_TRANSITION',
          entityType: 'EscrowTransaction',
          entityId: String(txId),
          before: { status: fromStatus },
          after: {
            status: toStatus,
            reason,
            actorRole,
          },
        },
      ],
      session ? { session } : {}
    );
  } catch (auditErr) {
    logger.warn(`Failed to write auditlog for escrow transition: ${auditErr.message}`);
  }

  return { alreadyDone: false, escrow: updated };
}

/**
 * Creates one EscrowTransaction row (status CREATED) per working day between job.startDate and job.endDate.
 * Uses atomic upsert with duplicate key tolerance.
 */
export async function createEscrowForAssignment(jobOrParams, workerIdParam, session = null) {
  let job;
  let workerId = workerIdParam;

  if (jobOrParams && (jobOrParams.jobId || jobOrParams.job)) {
    const jId = jobOrParams.jobId || jobOrParams.job;
    job = await Job.findById(jId).session(session);
    workerId = workerId || jobOrParams.workerId || jobOrParams.worker;
  } else if (typeof jobOrParams === 'string' || jobOrParams instanceof mongoose.Types.ObjectId) {
    job = await Job.findById(jobOrParams).session(session);
  } else {
    job = jobOrParams;
  }

  if (!job) {
    throw new EscrowError(404, 'JOB_NOT_FOUND', 'Job not found for creating escrow.');
  }

  const start = new Date(job.startDate);
  const end = new Date(job.endDate);

  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  const dayStep = 24 * 60 * 60 * 1000;

  const platformFeePaise = Math.floor((job.wagePerDayPaise * (env.platformFeePercent || 0)) / 100);

  const createdRows = [];

  for (let currentUtc = startUtc; currentUtc <= endUtc; currentUtc += dayStep) {
    const dayDate = getISTDateString(new Date(currentUtc));
    const idempotencyKey = `ESCROW:${job._id.toString()}:${workerId.toString()}:${dayDate}`;

    try {
      const options = session ? { session, new: true, upsert: true } : { new: true, upsert: true };
      const row = await EscrowTransaction.findOneAndUpdate(
        { idempotencyKey },
        {
          $setOnInsert: {
            job: job._id,
            contractor: job.contractor,
            worker: workerId,
            dayDate,
            amountPaise: job.wagePerDayPaise,
            platformFeePaise,
            status: ESCROW_STATUS.CREATED,
            idempotencyKey,
          },
        },
        options
      );
      createdRows.push(row);
    } catch (err) {
      if (err.code === 11000) {
        const existing = await EscrowTransaction.findOne({ idempotencyKey }).session(session);
        createdRows.push(existing);
      } else {
        throw err;
      }
    }
  }

  return createdRows;
}

/**
 * POST /api/v1/escrow/jobs/:id/fund
 * Locks money for all CREATED escrow rows of a job.
 * All-or-nothing in a single transaction.
 */
export async function fundJob(jobId, contractorId) {
  const job = await Job.findById(jobId);
  if (!job) {
    throw new EscrowError(404, 'JOB_NOT_FOUND', 'Job not found.');
  }

  if (job.contractor.toString() !== contractorId.toString()) {
    throw new EscrowError(403, 'FORBIDDEN', 'Only the job owner can fund this job.');
  }

  if (['CANCELLED', 'COMPLETED'].includes(job.status)) {
    throw new EscrowError(400, 'INVALID_JOB_STATUS', `Cannot fund job in ${job.status} status.`);
  }

  // Find all CREATED rows for this job
  const createdRows = await EscrowTransaction.find({
    job: jobId,
    status: ESCROW_STATUS.CREATED,
  });

  if (createdRows.length === 0) {
    // Idempotent: check how many are already FUNDED
    const alreadyFundedCount = await EscrowTransaction.countDocuments({
      job: jobId,
      status: { $in: [ESCROW_STATUS.FUNDED, ESCROW_STATUS.CHECKED_IN, ESCROW_STATUS.CHECKED_OUT, ESCROW_STATUS.APPROVED, ESCROW_STATUS.RELEASED] },
    });
    return {
      message: 'No pending escrow rows to fund',
      fundedCount: 0,
      totalLockedPaise: 0,
      alreadyFundedCount,
    };
  }

  // Calculate required total
  const requiredPaise = createdRows.reduce((sum, row) => sum + row.amountPaise, 0);

  // Check contractor wallet balance
  const contractorWallet = await getOrCreateWallet(contractorId);
  if (contractorWallet.balancePaise < requiredPaise) {
    throw new EscrowError(402, 'INSUFFICIENT_BALANCE', 'Insufficient contractor wallet balance to fund job.', {
      requiredPaise,
      availablePaise: contractorWallet.balancePaise,
      shortfallPaise: requiredPaise - contractorWallet.balancePaise,
    });
  }

  // Execute funding in a single atomic transaction
  const session = await mongoose.startSession();
  try {
    let fundedCount = 0;
    await session.withTransaction(async () => {
      for (const row of createdRows) {
        // 1. Post ledger group: DEBIT CONTRACTOR_WALLET, CREDIT ESCROW_HOLD
        const groupId = `FUND:${row._id.toString()}`;
        await postLedgerGroup({
          groupId,
          entries: [
            {
              account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
              wallet: contractorWallet._id,
              entryType: LEDGER_ENTRY_TYPE.DEBIT,
              amountPaise: row.amountPaise,
              description: `Escrow hold for Job ${job.title} on ${row.dayDate}`,
              referenceType: 'ESCROW_FUND',
              referenceId: row._id.toString(),
              transaction: row._id,
            },
            {
              account: LEDGER_ACCOUNT.ESCROW_HOLD,
              wallet: contractorWallet._id,
              entryType: LEDGER_ENTRY_TYPE.CREDIT,
              amountPaise: row.amountPaise,
              description: `Escrow hold locked for Job ${job.title} on ${row.dayDate}`,
              referenceType: 'ESCROW_FUND',
              referenceId: row._id.toString(),
              transaction: row._id,
            },
          ],
          session,
        });

        // 2. Transition status: CREATED -> FUNDED
        await transition(row._id, ESCROW_STATUS.FUNDED, {
          actor: contractorId,
          actorRole: 'contractor',
          reason: 'Contractor funded job escrow',
          session,
        });

        fundedCount++;
      }
    });

    // Notify workers and contractor via sockets and notifications
    try {
      const io = getIO();
      io.to(`user:${contractorId.toString()}`).emit('escrow:funded', {
        jobId: job._id.toString(),
        count: fundedCount,
        totalPaise: requiredPaise,
      });

      // Group by worker to notify each
      const workerDatesMap = new Map();
      for (const row of createdRows) {
        const wId = row.worker.toString();
        if (!workerDatesMap.has(wId)) workerDatesMap.set(wId, []);
        workerDatesMap.get(wId).push(row.dayDate);
      }

      for (const [wId, dates] of workerDatesMap.entries()) {
        io.to(`user:${wId}`).emit('escrow:funded', {
          jobId: job._id.toString(),
          dates,
        });
        Notification.create({
          user: wId,
          type: NOTIFICATION_TYPE.JOB_MATCH,
          title: 'Kamai Surakshit (Escrow Funded)',
          body: `${job.title} ke liye ${dates.length} din ki kamai escrow mein lock ho gayi hai.`,
          data: { jobId: job._id.toString() },
          channel: NOTIFICATION_CHANNEL.SOCKET,
          status: NOTIFICATION_STATUS.SENT,
          sentAt: new Date(),
        }).catch(() => {});
      }
    } catch (_e) {}

    return {
      message: 'Job escrow successfully funded',
      fundedCount,
      totalLockedPaise: requiredPaise,
      totalAmountPaise: requiredPaise,
      amountPaise: requiredPaise,
    };
  } finally {
    await session.endSession();
  }
}

/**
 * Hook on check-in: verifies today's escrow row is FUNDED, and transitions it to CHECKED_IN.
 */
export async function onCheckIn(attendance, session = null) {
  const { job: jobId, worker: workerId, date: dayDate } = attendance;

  const escrow = await EscrowTransaction.findOne({
    job: jobId,
    worker: workerId,
    dayDate,
  }).session(session);

  if (!escrow) {
    if (env.attendanceRequireFunding) {
      throw new EscrowError(402, 'ESCROW_NOT_FUNDED', "Contractor ne aaj ke kaam ka paisa abhi lock nahi kiya hai.");
    }
    return null;
  }

  if (escrow.status === ESCROW_STATUS.CHECKED_IN) {
    return escrow; // Idempotent
  }

  if (escrow.status !== ESCROW_STATUS.FUNDED) {
    if (env.attendanceRequireFunding) {
      throw new EscrowError(
        402,
        'ESCROW_NOT_FUNDED',
        `Aaj ke din ke liye escrow FUNDED nahi hai (Current: ${escrow.status}).`,
        { currentStatus: escrow.status }
      );
    }
    return escrow;
  }

  const { escrow: updated } = await transition(escrow._id, ESCROW_STATUS.CHECKED_IN, {
    actor: workerId,
    actorRole: 'worker',
    reason: 'Worker verified check-in',
    session,
    extraSet: { attendance: attendance._id },
  });

  return updated;
}

/**
 * Hook on check-out: transitions escrow from CHECKED_IN to CHECKED_OUT and schedules autoApprovalAt.
 */
export async function onCheckOut(attendance, session = null) {
  const { job: jobId, worker: workerId, date: dayDate, checkOutAt } = attendance;

  const escrow = await EscrowTransaction.findOne({
    job: jobId,
    worker: workerId,
    dayDate,
  }).session(session);

  if (!escrow) return null;

  if (escrow.status === ESCROW_STATUS.CHECKED_OUT) {
    return escrow; // Idempotent
  }

  const job = await Job.findById(jobId).session(session);
  const autoApprovalHours = job?.autoApprovalHours || 12;

  let autoApprovalAt;
  if (env.escrowAutoApprovalOverrideSec && env.nodeEnv !== 'production') {
    autoApprovalAt = new Date(new Date(checkOutAt).getTime() + env.escrowAutoApprovalOverrideSec * 1000);
  } else {
    autoApprovalAt = new Date(new Date(checkOutAt).getTime() + autoApprovalHours * 3600 * 1000);
  }

  const { escrow: updated } = await transition(escrow._id, ESCROW_STATUS.CHECKED_OUT, {
    actor: workerId,
    actorRole: 'worker',
    reason: 'Worker check-out completed',
    session,
    extraSet: { autoApprovalAt, attendance: attendance._id },
  });

  return updated;
}

/**
 * Executes full release of escrow to worker wallet:
 * CHECKED_OUT -> APPROVED -> RELEASED with RELEASE ledger group.
 * Called by contractor signoff APPROVED, auto-approval scheduler, or admin dispute resolution.
 */
export async function approveAndRelease(txId, actor = null, actorRole = 'contractor', reason = 'Signoff approved') {
  const escrow = await EscrowTransaction.findById(txId);
  if (!escrow) {
    throw new EscrowError(404, 'ESCROW_NOT_FOUND', 'Escrow transaction not found.');
  }

  // Double release protection: already released throws 409
  if (escrow.status === ESCROW_STATUS.RELEASED) {
    throw new EscrowError(409, 'INVALID_TRANSITION', 'Escrow transaction is already released.');
  }

  const contractorWallet = await getOrCreateWallet(escrow.contractor);
  const workerWallet = await getOrCreateWallet(escrow.worker);

  const amountPaise = escrow.amountPaise;
  const platformFeePaise = escrow.platformFeePaise || 0;
  const workerCreditPaise = amountPaise - platformFeePaise;

  const session = await mongoose.startSession();
  let updatedEscrow;

  try {
    await session.withTransaction(async () => {
      const inSessionEscrow = await EscrowTransaction.findById(txId).session(session);
      if (inSessionEscrow.status === ESCROW_STATUS.RELEASED) {
        throw new EscrowError(409, 'INVALID_TRANSITION', 'Escrow transaction already released.');
      }

      // Step 1: Transition to APPROVED if not already approved
      if (inSessionEscrow.status !== ESCROW_STATUS.APPROVED) {
        await transition(txId, ESCROW_STATUS.APPROVED, {
          actor,
          actorRole,
          reason,
          session,
        });
      }

      // Step 2: Post RELEASE ledger group
      const groupId = `RELEASE:${txId.toString()}`;
      const entries = [
        {
          account: LEDGER_ACCOUNT.ESCROW_HOLD,
          wallet: contractorWallet._id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amountPaise,
          description: `Escrow hold release for day ${escrow.dayDate}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: txId.toString(),
          transaction: txId,
        },
        {
          account: LEDGER_ACCOUNT.WORKER_WALLET,
          wallet: workerWallet._id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: workerCreditPaise,
          description: `Payment released for work on ${escrow.dayDate}`,
          referenceType: 'ESCROW_RELEASE',
          referenceId: txId.toString(),
          transaction: txId,
        },
      ];

      if (platformFeePaise > 0) {
        entries.push({
          account: LEDGER_ACCOUNT.PLATFORM_FEE,
          wallet: null,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: platformFeePaise,
          description: `Platform fee for escrow ${txId.toString()}`,
          referenceType: 'PLATFORM_FEE',
          referenceId: txId.toString(),
          transaction: txId,
        });
      }

      await postLedgerGroup({ groupId, entries, session });

      // Step 3: Transition APPROVED -> RELEASED
      const result = await transition(txId, ESCROW_STATUS.RELEASED, {
        actor,
        actorRole: 'system',
        reason: 'Payment successfully credited to worker wallet',
        session,
        extraSet: { releasedAt: clock.now() },
      });

      updatedEscrow = result.escrow;
    });
  } finally {
    await session.endSession();
  }

  // Real-time notifications and simulated UPI payout (post-commit)
  try {
    const io = getIO();
    io.to(`user:${escrow.worker.toString()}`).emit('payment:released', {
      escrowId: txId.toString(),
      jobId: escrow.job.toString(),
      amountPaise: workerCreditPaise,
      dayDate: escrow.dayDate,
    });
    io.to(`user:${escrow.contractor.toString()}`).emit('payment:released', {
      escrowId: txId.toString(),
      jobId: escrow.job.toString(),
      amountPaise: workerCreditPaise,
      dayDate: escrow.dayDate,
    });

    Notification.create({
      user: escrow.worker,
      type: NOTIFICATION_TYPE.PAYMENT_RELEASED,
      title: 'Paisa Mila! (Payment Released)',
      body: `Aapko ${escrow.dayDate} ke kaam ke liye Rs ${Math.floor(workerCreditPaise / 100)} mil gaye hain.`,
      data: { escrowId: txId.toString() },
      channel: NOTIFICATION_CHANNEL.SOCKET,
      status: NOTIFICATION_STATUS.SENT,
      sentAt: new Date(),
    }).catch(() => {});
  } catch (_e) {}

  // Trigger simulated UPI payout (post-commit)
  await triggerAutoReleasePayout(updatedEscrow).catch((pErr) => {
    logger.error(`[Escrow] Payout trigger error: ${pErr.message}`);
  });

  return { alreadyReleased: false, escrow: updatedEscrow };
}

/**
 * Refunds an escrow transaction back to contractor:
 * FUNDED -> CANCELLED (cancel before check-in) or FUNDED -> REFUNDED (no-show).
 */
export async function refund(txId, actor, actorRole = 'system', reason = 'Escrow refund', toStatus = ESCROW_STATUS.REFUNDED) {
  const escrow = await EscrowTransaction.findById(txId);
  if (!escrow) {
    throw new EscrowError(404, 'ESCROW_NOT_FOUND', 'Escrow transaction not found.');
  }

  if (escrow.status === ESCROW_STATUS.REFUNDED || escrow.status === ESCROW_STATUS.CANCELLED) {
    return { alreadyRefunded: true, escrow };
  }

  if (escrow.status !== ESCROW_STATUS.FUNDED && escrow.status !== ESCROW_STATUS.DISPUTED) {
    throw new EscrowError(
      409,
      'INVALID_REFUND_STATE',
      `Cannot refund escrow from state ${escrow.status}. Must be FUNDED or DISPUTED.`
    );
  }

  const contractorWallet = await getOrCreateWallet(escrow.contractor);
  const session = await mongoose.startSession();
  let updatedEscrow;

  try {
    await session.withTransaction(async () => {
      // 1. Post REFUND ledger group: DEBIT ESCROW_HOLD, CREDIT CONTRACTOR_WALLET
      const groupId = `REFUND:${txId.toString()}`;
      await postLedgerGroup({
        groupId,
        entries: [
          {
            account: LEDGER_ACCOUNT.ESCROW_HOLD,
            wallet: contractorWallet._id,
            entryType: LEDGER_ENTRY_TYPE.DEBIT,
            amountPaise: escrow.amountPaise,
            description: `Escrow refund for day ${escrow.dayDate}`,
            referenceType: 'ESCROW_REFUND',
            referenceId: txId.toString(),
            transaction: txId,
          },
          {
            account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
            wallet: contractorWallet._id,
            entryType: LEDGER_ENTRY_TYPE.CREDIT,
            amountPaise: escrow.amountPaise,
            description: `Escrow refunded to contractor wallet for ${escrow.dayDate}`,
            referenceType: 'ESCROW_REFUND',
            referenceId: txId.toString(),
            transaction: txId,
          },
        ],
        session,
      });

      // 2. Transition status: FUNDED -> REFUNDED or CANCELLED
      const result = await transition(txId, toStatus, {
        actor,
        actorRole,
        reason,
        session,
        extraSet: { refundedAt: clock.now() },
      });

      updatedEscrow = result.escrow;
    });
  } finally {
    await session.endSession();
  }

  // Socket notification
  try {
    const io = getIO();
    io.to(`user:${escrow.contractor.toString()}`).emit('payment:refunded', {
      escrowId: txId.toString(),
      jobId: escrow.job.toString(),
      amountPaise: escrow.amountPaise,
    });
  } catch (_e) {}

  return { alreadyRefunded: false, escrow: updatedEscrow };
}

/**
 * Opens a formal dispute for an escrow milestone.
 * Gathers auto-collected evidence (attendance, GPS, selfies, rejected attempts).
 */
export async function openDispute({
  escrowId,
  escrowTransactionId,
  actorId,
  openedById,
  actorRole = 'contractor',
  reason,
  description = '',
  openedFrom = DISPUTE_OPENED_FROM.CONTRACTOR_SIGNOFF,
}) {
  const targetId = escrowId || escrowTransactionId;
  const currentActorId = actorId || openedById;
  const escrow = await EscrowTransaction.findById(targetId);
  if (!escrow) {
    throw new EscrowError(404, 'ESCROW_NOT_FOUND', 'Escrow transaction not found.');
  }

  const existingDispute = await Dispute.findOne({ escrowTransaction: escrowId });
  if (existingDispute) {
    return existingDispute;
  }

  // Auto-collect evidence
  const evidence = [];
  const attendance = escrow.attendance ? await Attendance.findById(escrow.attendance) : null;

  if (attendance) {
    evidence.push({
      type: DISPUTE_EVIDENCE_TYPE.ATTENDANCE,
      refId: attendance._id.toString(),
      url: `/api/v1/jobs/${escrow.job}/attendance/date/${escrow.dayDate}`,
    });

    if (attendance.selfieUrl) {
      evidence.push({
        type: DISPUTE_EVIDENCE_TYPE.SELFIE,
        refId: attendance._id.toString(),
        url: `/api/v1/attendance/${attendance._id}/selfie`,
      });
    }

    if (attendance.checkIn?.location) {
      evidence.push({
        type: DISPUTE_EVIDENCE_TYPE.GPS_LOG,
        refId: 'checkin_gps',
        url: `lat=${attendance.checkIn.location.coordinates[1]},lng=${attendance.checkIn.location.coordinates[0]}`,
      });
    }
  }

  // Gather rejected attempt logs for that day
  try {
    const rejectedLogs = await AuditLog.find({
      user: escrow.worker,
      action: 'CHECKIN_REJECTED',
      createdAt: {
        $gte: new Date(new Date(escrow.dayDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(escrow.dayDate).setHours(23, 59, 59, 999)),
      },
    }).limit(10);

    for (const log of rejectedLogs) {
      evidence.push({
        type: DISPUTE_EVIDENCE_TYPE.NOTE,
        refId: log._id.toString(),
        url: `Rejected attempt: ${log.details?.reasonCode || 'Unknown reason'}`,
      });
    }
  } catch (_e) {}

  if (description) {
    evidence.push({
      type: DISPUTE_EVIDENCE_TYPE.NOTE,
      refId: 'user_note',
      url: description,
    });
  }

  const finalActorId = currentActorId || actorId;
  const againstId = finalActorId.toString() === escrow.contractor.toString() ? escrow.worker : escrow.contractor;

  // Transition escrow to DISPUTED
  await transition(escrow._id, ESCROW_STATUS.DISPUTED, {
    actor: finalActorId,
    actorRole,
    reason: `Dispute opened: ${reason} - ${description}`,
  });

  let finalReason = reason;
  let finalDescription = description || '';

  if (!Object.values(DISPUTE_REASON).includes(finalReason)) {
    finalDescription = finalDescription ? `${finalReason}: ${finalDescription}` : String(finalReason || 'Dispute raised');
    finalReason = DISPUTE_REASON.OTHER;
  }
  if (!finalDescription) {
    finalDescription = String(finalReason);
  }

  const dispute = await Dispute.create({
    escrowTransaction: escrow._id,
    job: escrow.job,
    openedFrom,
    raisedBy: finalActorId,
    against: againstId,
    reason: finalReason,
    description: finalDescription,
    evidence,
    status: DISPUTE_STATUS.OPEN,
  });

  // Notify parties and admin
  try {
    const io = getIO();
    io.to(`user:${actorId.toString()}`).emit('dispute:opened', { disputeId: dispute._id, escrowId: escrow._id });
    io.to(`user:${againstId.toString()}`).emit('dispute:opened', { disputeId: dispute._id, escrowId: escrow._id });
    io.to('role:admin').emit('dispute:opened', { disputeId: dispute._id, escrowId: escrow._id });

    Notification.create({
      user: againstId,
      type: NOTIFICATION_TYPE.DISPUTE_UPDATE,
      title: 'Dispute Darj Hua (Dispute Opened)',
      body: `Aapke ${escrow.dayDate} ke kaam par dispute darj kiya gaya hai.`,
      data: { disputeId: dispute._id.toString() },
      channel: NOTIFICATION_CHANNEL.SOCKET,
      status: NOTIFICATION_STATUS.SENT,
      sentAt: new Date(),
    }).catch(() => {});
  } catch (_e) {}

  return dispute;
}

/**
 * Admin resolves a dispute: FOR_WORKER, FOR_CONTRACTOR, or SPLIT.
 * All operations executed atomically inside one session.
 */
export async function resolveDispute({
  disputeId,
  adminId,
  decision, // 'FOR_WORKER' | 'FOR_CONTRACTOR' | 'SPLIT'
  workerAmountPaise = 0,
  notes = '',
}) {
  const dispute = await Dispute.findById(disputeId);
  if (!dispute) {
    throw new EscrowError(404, 'DISPUTE_NOT_FOUND', 'Dispute record not found.');
  }

  if (dispute.status !== DISPUTE_STATUS.OPEN && dispute.status !== DISPUTE_STATUS.UNDER_REVIEW) {
    throw new EscrowError(409, 'ALREADY_RESOLVED', `Dispute is already in status '${dispute.status}'.`);
  }

  const escrow = await EscrowTransaction.findById(dispute.escrowTransaction);
  if (!escrow) {
    throw new EscrowError(404, 'ESCROW_NOT_FOUND', 'Associated escrow transaction not found.');
  }

  const totalPaise = escrow.amountPaise;
  const contractorWallet = await getOrCreateWallet(escrow.contractor);
  const workerWallet = await getOrCreateWallet(escrow.worker);

  let finalWorkerPaise = 0;
  let finalContractorRefundPaise = 0;
  let disputeStatus;

  if (decision === 'FOR_WORKER') {
    finalWorkerPaise = totalPaise;
    finalContractorRefundPaise = 0;
    disputeStatus = DISPUTE_STATUS.RESOLVED_FOR_WORKER;
  } else if (decision === 'FOR_CONTRACTOR') {
    finalWorkerPaise = 0;
    finalContractorRefundPaise = totalPaise;
    disputeStatus = DISPUTE_STATUS.RESOLVED_FOR_CONTRACTOR;
  } else if (decision === 'SPLIT') {
    if (!Number.isSafeInteger(workerAmountPaise) || workerAmountPaise < 0 || workerAmountPaise > totalPaise) {
      throw new EscrowError(
        400,
        'INVALID_SPLIT',
        `workerAmountPaise must be between 0 and total amount (${totalPaise} paise).`
      );
    }
    finalWorkerPaise = workerAmountPaise;
    finalContractorRefundPaise = totalPaise - workerAmountPaise;
    disputeStatus = DISPUTE_STATUS.SPLIT;
  } else {
    throw new EscrowError(400, 'INVALID_DECISION', `Unknown decision '${decision}'.`);
  }

  const platformFeePaise = finalWorkerPaise > 0
    ? Math.floor((finalWorkerPaise * (env.platformFeePercent || 0)) / 100)
    : 0;
  const netWorkerPaise = finalWorkerPaise - platformFeePaise;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // 1. Post Ledger Group
      const groupId = `SPLIT:${dispute._id.toString()}`;
      const entries = [
        {
          account: LEDGER_ACCOUNT.ESCROW_HOLD,
          wallet: contractorWallet._id,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amountPaise: totalPaise,
          description: `Dispute settlement for ${escrow.dayDate}`,
          referenceType: 'DISPUTE_SETTLEMENT',
          referenceId: dispute._id.toString(),
          transaction: escrow._id,
        },
      ];

      if (netWorkerPaise > 0) {
        entries.push({
          account: LEDGER_ACCOUNT.WORKER_WALLET,
          wallet: workerWallet._id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: netWorkerPaise,
          description: `Dispute settlement worker share for ${escrow.dayDate}`,
          referenceType: 'DISPUTE_SETTLEMENT',
          referenceId: dispute._id.toString(),
          transaction: escrow._id,
        });
      }

      if (platformFeePaise > 0) {
        entries.push({
          account: LEDGER_ACCOUNT.PLATFORM_FEE,
          wallet: null,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: platformFeePaise,
          description: `Platform fee on dispute settlement share`,
          referenceType: 'PLATFORM_FEE',
          referenceId: dispute._id.toString(),
          transaction: escrow._id,
        });
      }

      if (finalContractorRefundPaise > 0) {
        entries.push({
          account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
          wallet: contractorWallet._id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: finalContractorRefundPaise,
          description: `Dispute settlement refund for ${escrow.dayDate}`,
          referenceType: 'DISPUTE_SETTLEMENT',
          referenceId: dispute._id.toString(),
          transaction: escrow._id,
        });
      }

      await postLedgerGroup({ groupId, entries, session });

      // 2. Final escrow state: RELEASED if worker gets money (> 0), else REFUNDED
      const targetEscrowStatus = finalWorkerPaise > 0 ? ESCROW_STATUS.RELEASED : ESCROW_STATUS.REFUNDED;
      await transition(escrow._id, targetEscrowStatus, {
        actor: adminId,
        actorRole: 'admin',
        reason: `Dispute resolved by admin: ${decision}`,
        session,
        extraSet: {
          releasedAt: targetEscrowStatus === ESCROW_STATUS.RELEASED ? clock.now() : null,
          refundedAt: targetEscrowStatus === ESCROW_STATUS.REFUNDED ? clock.now() : null,
        },
      });

      // 3. Update dispute document
      dispute.status = disputeStatus;
      dispute.resolution = {
        decidedBy: adminId,
        workerAmountPaise: finalWorkerPaise,
        contractorRefundPaise: finalContractorRefundPaise,
        notes,
        decidedAt: clock.now(),
      };
      await dispute.save({ session });
    });
  } finally {
    await session.endSession();
  }

  // Trigger simulated payout for worker if worker received money
  if (finalWorkerPaise > 0) {
    const updatedEscrow = await EscrowTransaction.findById(escrow._id);
    triggerAutoReleasePayout(updatedEscrow).catch(() => {});
  }

  // Notify parties
  try {
    const io = getIO();
    io.to(`user:${dispute.raisedBy.toString()}`).emit('dispute:resolved', { disputeId, decision });
    io.to(`user:${dispute.against.toString()}`).emit('dispute:resolved', { disputeId, decision });
    io.to('role:admin').emit('dispute:resolved', { disputeId, decision });
  } catch (_e) {}

  return dispute;
}
