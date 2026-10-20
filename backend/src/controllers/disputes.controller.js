import Dispute from '../models/Dispute.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Attendance from '../models/Attendance.js';
import { openDispute } from '../services/escrow.service.js';
import {
  DISPUTE_REASON,
  DISPUTE_OPENED_FROM,
  DISPUTE_EVIDENCE_TYPE,
  ESCROW_STATUS,
  SIGNOFF_STATUS,
} from '../config/constants.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import clock from '../utils/clock.js';

/**
 * POST /api/v1/disputes
 * Worker or Contractor raises a formal dispute on an escrow milestone.
 */
export const raiseDispute = async (req, res) => {
  let { escrowTransactionId, reason, description } = req.body;

  if (!escrowTransactionId || !reason) {
    return sendError(res, 400, 'escrowTransactionId and reason are required.', 'INVALID_INPUT');
  }

  let reasonCode = reason;
  if (!Object.values(DISPUTE_REASON).includes(reason)) {
    description = description ? `${reason} - ${description}` : reason;
    reasonCode = DISPUTE_REASON.OTHER;
  } else if (!description) {
    description = reason;
  }

  const escrow = await EscrowTransaction.findById(escrowTransactionId);
  if (!escrow) {
    return sendError(res, 404, 'Escrow transaction not found', 'NOT_FOUND');
  }

  const isWorker = escrow.worker.toString() === req.user._id.toString();
  const isContractor = escrow.contractor.toString() === req.user._id.toString();

  if (!isWorker && !isContractor) {
    return sendError(res, 403, 'You are not a participant in this job milestone.', 'FORBIDDEN');
  }

  // Worker Claim Validation
  if (isWorker) {
    // Worker may raise if already in DISPUTED (from signoff) or if CHECKED_OUT with PENDING signoff for > DISPUTE_CLAIM_AFTER_HOURS
    if (escrow.status !== ESCROW_STATUS.CHECKED_OUT && escrow.status !== ESCROW_STATUS.DISPUTED) {
      return sendError(
        res,
        400,
        `Worker can only raise dispute when day is CHECKED_OUT or DISPUTED. Current status: ${escrow.status}`,
        'INVALID_ESCROW_STATUS'
      );
    }

    if (escrow.status === ESCROW_STATUS.CHECKED_OUT) {
      const att = escrow.attendance ? await Attendance.findById(escrow.attendance) : null;
      const disputeClaimAfterHours = process.env.DISPUTE_CLAIM_AFTER_HOURS !== undefined
        ? parseFloat(process.env.DISPUTE_CLAIM_AFTER_HOURS)
        : 1;

      if (att && att.checkOut?.timestamp) {
        const checkOutTime = new Date(att.checkOut.timestamp).getTime();
        const diffHours = (clock.now().getTime() - checkOutTime) / (1000 * 3600);
        if (diffHours < disputeClaimAfterHours && att.contractorSignoff?.status === SIGNOFF_STATUS.PENDING) {
          return sendError(
            res,
            400,
            `Sign-off is still in grace period. You can raise a claim after ${disputeClaimAfterHours} hour(s) from checkout.`,
            'SIGN_OFF_IN_PROGRESS'
          );
        }
      }
    }
  }

  const openedFrom = isWorker ? DISPUTE_OPENED_FROM.WORKER_CLAIM : DISPUTE_OPENED_FROM.CONTRACTOR_SIGNOFF;

  const dispute = await openDispute({
    escrowId: escrow._id,
    actorId: req.user._id,
    actorRole: req.user.role,
    reason,
    description,
    openedFrom,
  });

  return sendSuccess(res, 201, dispute);
};

/**
 * GET /api/v1/disputes/my
 * Returns disputes where authenticated user is raisedBy or against.
 */
export const getMyDisputes = async (req, res) => {
  const userId = req.user._id;
  const disputes = await Dispute.find({
    $or: [{ raisedBy: userId }, { against: userId }],
  })
    .populate('job', 'title addressText startDate endDate')
    .populate('escrowTransaction')
    .populate('raisedBy', 'name phone role')
    .populate('against', 'name phone role')
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, 200, disputes);
};

/**
 * GET /api/v1/disputes/:id
 * Retrieve details of a single dispute.
 */
export const getDisputeById = async (req, res) => {
  const dispute = await Dispute.findById(req.params.id)
    .populate('job')
    .populate('escrowTransaction')
    .populate('raisedBy', 'name phone role')
    .populate('against', 'name phone role')
    .populate('resolution.decidedBy', 'name role')
    .lean();

  if (!dispute) {
    return sendError(res, 404, 'Dispute not found', 'NOT_FOUND');
  }

  const isParticipant =
    dispute.raisedBy._id.toString() === req.user._id.toString() ||
    dispute.against._id.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN');
  }

  return sendSuccess(res, 200, dispute);
};

/**
 * POST /api/v1/disputes/:id/evidence
 * Participants append additional notes or photo evidence to open dispute.
 */
export const addDisputeEvidence = async (req, res) => {
  const { type, refId, url } = req.body;
  const dispute = await Dispute.findById(req.params.id);

  if (!dispute) {
    return sendError(res, 404, 'Dispute not found', 'NOT_FOUND');
  }

  const isParticipant =
    dispute.raisedBy.toString() === req.user._id.toString() ||
    dispute.against.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'admin';

  if (!isParticipant && !isAdmin) {
    return sendError(res, 403, 'Forbidden', 'FORBIDDEN');
  }

  if (dispute.status !== 'OPEN' && dispute.status !== 'UNDER_REVIEW') {
    return sendError(res, 400, 'Cannot add evidence to a closed or resolved dispute.', 'INVALID_STATUS');
  }

  dispute.evidence.push({
    type: type || DISPUTE_EVIDENCE_TYPE.NOTE,
    refId: refId || '',
    url: url || '',
  });

  await dispute.save();

  return sendSuccess(res, 200, dispute);
};
