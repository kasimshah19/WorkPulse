import Dispute from '../models/Dispute.js';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import PaymentOrder from '../models/PaymentOrder.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import { resolveDispute } from '../services/escrow.service.js';
import { runReconciliation } from '../services/reconcile.service.js';
import {
  DISPUTE_STATUS,
  ESCROW_STATUS,
  PAYMENT_ORDER_STATUS,
} from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * GET /api/v1/admin/disputes
 * Admin dispute queue sorted by oldest first.
 */
export const getAdminDisputes = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const total = await Dispute.countDocuments(filter);
  const disputes = await Dispute.find(filter)
    .populate('job', 'title addressText startDate endDate wagePerDayPaise')
    .populate('escrowTransaction', 'amountPaise dayDate status')
    .populate('raisedBy', 'name phone role')
    .populate('against', 'name phone role')
    .sort({ createdAt: 1 }) // Oldest first
    .skip(skip)
    .limit(limitNum)
    .lean();

  return sendSuccess(res, 200, disputes, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
};

/**
 * GET /api/v1/admin/disputes/:id
 * Returns complete evidence bundle for admin arbitration.
 */
export const getAdminDisputeDetail = async (req, res) => {
  const dispute = await Dispute.findById(req.params.id)
    .populate('job')
    .populate('escrowTransaction')
    .populate('raisedBy', 'name phone role skills rating')
    .populate('against', 'name phone role skills rating')
    .populate('resolution.decidedBy', 'name role')
    .lean();

  if (!dispute) {
    return sendError(res, 404, 'Dispute not found', 'NOT_FOUND');
  }

  // Fetch full attendance record if available
  let attendanceRecord = null;
  if (dispute.escrowTransaction?.attendance) {
    attendanceRecord = await Attendance.findById(dispute.escrowTransaction.attendance).lean();
  }

  // Fetch audit logs related to this job and day
  const escrow = dispute.escrowTransaction;
  let auditLogs = [];
  if (escrow) {
    auditLogs = await AuditLog.find({
      $or: [
        { resourceId: escrow._id.toString() },
        {
          user: escrow.worker,
          action: 'CHECKIN_REJECTED',
          createdAt: {
            $gte: new Date(new Date(escrow.dayDate).setHours(0, 0, 0, 0)),
            $lte: new Date(new Date(escrow.dayDate).setHours(23, 59, 59, 999)),
          },
        },
      ],
    })
      .sort({ createdAt: 1 })
      .limit(30)
      .lean();
  }

  return sendSuccess(res, 200, {
    dispute,
    attendance: attendanceRecord,
    auditLogs,
  });
};

/**
 * POST /api/v1/admin/disputes/:id/resolve
 * Admin resolves a dispute (FOR_WORKER, FOR_CONTRACTOR, SPLIT).
 */
export const resolveAdminDispute = async (req, res) => {
  const decision = req.body.decision || req.body.resolution;
  let workerAmountPaise = req.body.workerAmountPaise;
  const splitPaise = req.body.splitPaise;

  if (!decision || !['FOR_WORKER', 'FOR_CONTRACTOR', 'SPLIT'].includes(decision)) {
    return sendError(res, 400, "Decision must be 'FOR_WORKER', 'FOR_CONTRACTOR', or 'SPLIT'.", 'INVALID_DECISION');
  }

  if (decision === 'SPLIT' && splitPaise) {
    if (splitPaise.worker !== undefined && splitPaise.contractor !== undefined) {
      workerAmountPaise = splitPaise.worker;
      const dispute = await Dispute.findById(req.params.id).populate('escrowTransaction');
      if (dispute && dispute.escrowTransaction) {
        if (splitPaise.worker + splitPaise.contractor !== dispute.escrowTransaction.amountPaise) {
          return sendError(
            res,
            400,
            `Split sum (${splitPaise.worker + splitPaise.contractor}) must equal escrow amount (${dispute.escrowTransaction.amountPaise})`,
            'INVALID_SPLIT_SUM'
          );
        }
      }
    }
  }

  const notes = req.body.notes || req.body.adminNotes || '';

  const resolved = await resolveDispute({
    disputeId: req.params.id,
    adminId: req.user._id,
    decision,
    workerAmountPaise,
    notes,
  });

  return sendSuccess(res, 200, {
    ...(resolved.toObject ? resolved.toObject() : resolved),
    status: DISPUTE_STATUS.RESOLVED,
  });
};

/**
 * GET /api/v1/admin/ledger/reconcile
 * Runs full 5-invariant reconciliation.
 */
export const getReconciliationReport = async (req, res) => {
  const report = await runReconciliation();
  return sendSuccess(res, 200, report);
};

/**
 * GET /api/v1/admin/stats
 * Overview financial and operational stats for admin.
 */
export const getAdminStats = async (req, res) => {
  // Top-ups total
  const topups = await PaymentOrder.aggregate([
    { $match: { status: PAYMENT_ORDER_STATUS.PAID } },
    { $group: { _id: null, total: { $sum: '$amountPaise' }, count: { $sum: 1 } } },
  ]);

  // Escrow totals by status
  const escrowAgg = await EscrowTransaction.aggregate([
    {
      $group: {
        _id: '$status',
        totalPaise: { $sum: '$amountPaise' },
        count: { $sum: 1 },
      },
    },
  ]);

  const escrowMap = {};
  for (const item of escrowAgg) {
    escrowMap[item._id] = { totalPaise: item.totalPaise, count: item.count };
  }

  const openDisputesCount = await Dispute.countDocuments({
    status: { $in: [DISPUTE_STATUS.OPEN, DISPUTE_STATUS.UNDER_REVIEW] },
  });

  const lockedStatuses = [
    ESCROW_STATUS.FUNDED,
    ESCROW_STATUS.CHECKED_IN,
    ESCROW_STATUS.CHECKED_OUT,
    ESCROW_STATUS.APPROVED,
    ESCROW_STATUS.DISPUTED,
  ];

  let lockedPaise = 0;
  for (const s of lockedStatuses) {
    lockedPaise += escrowMap[s]?.totalPaise || 0;
  }

  return sendSuccess(res, 200, {
    totalTopupsPaise: topups[0]?.total || 0,
    topupsCount: topups[0]?.count || 0,
    lockedPaise,
    releasedPaise: escrowMap[ESCROW_STATUS.RELEASED]?.totalPaise || 0,
    refundedPaise: escrowMap[ESCROW_STATUS.REFUNDED]?.totalPaise || 0,
    openDisputesCount,
    escrowBreakdown: escrowMap,
  });
};
