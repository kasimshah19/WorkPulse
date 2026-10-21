import mongoose from 'mongoose';
import Rating from '../models/Rating.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Dispute from '../models/Dispute.js';
import Incident from '../models/Incident.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';
import {
  RATING_TYPES,
  RATING_TAGS,
  ATTENDANCE_STATUS,
  ESCROW_STATUS,
  DISPUTE_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
} from '../config/constants.js';

// 60-second in-memory cache for reputation & objective stats
const reputationCache = new Map();
const CACHE_TTL_MS = 60 * 1000;

/**
 * Strip HTML tags from comments to prevent XSS.
 */
function sanitizeComment(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').trim();
}

/**
 * Single evaluation function for rating eligibility.
 *
 * @param {Object} job
 * @param {string} fromUserId
 * @param {string} toUserId
 * @returns {Promise<{ allowed: boolean, types: string[], reason?: string, windowOpensAt: Date, windowClosesAt: Date }>}
 */
export async function getRatingEligibility(job, fromUserId, toUserId) {
  if (fromUserId.toString() === toUserId.toString()) {
    return {
      allowed: false,
      types: [],
      reason: 'SELF_RATING_BLOCKED',
      windowOpensAt: null,
      windowClosesAt: null,
    };
  }

  const contractorId = job.contractor._id ? job.contractor._id.toString() : job.contractor.toString();
  const isFromContractor = fromUserId.toString() === contractorId;
  const isToContractor = toUserId.toString() === contractorId;

  if (!isFromContractor && !isToContractor) {
    return {
      allowed: false,
      types: [],
      reason: 'NOT_JOB_PARTICIPANT',
      windowOpensAt: null,
      windowClosesAt: null,
    };
  }

  const workerId = isFromContractor ? toUserId.toString() : fromUserId.toString();

  // Verify worker has assignment on this job
  const isAssigned = (job.assignedWorkers || []).some(
    (w) => (w._id ? w._id.toString() : w.toString()) === workerId
  );
  if (!isAssigned) {
    return {
      allowed: false,
      types: [],
      reason: 'NOT_JOB_PARTICIPANT',
      windowOpensAt: null,
      windowClosesAt: null,
    };
  }

  // Calculate Rating Window
  const windowOpensAt = job.endDate ? new Date(job.endDate) : new Date(job.createdAt);
  const windowClosesAt = new Date(windowOpensAt.getTime() + env.ratingWindowDays * 24 * 60 * 60 * 1000);
  const now = clock.now();

  const isWindowOpen =
    env.devRatingAllowAnytime ||
    job.status === 'COMPLETED' ||
    now >= windowOpensAt;

  if (!isWindowOpen) {
    return {
      allowed: false,
      types: [],
      reason: 'RATING_NOT_OPEN',
      windowOpensAt,
      windowClosesAt,
    };
  }

  if (now > windowClosesAt && !env.devRatingAllowAnytime) {
    return {
      allowed: false,
      types: [],
      reason: 'RATING_WINDOW_CLOSED',
      windowOpensAt,
      windowClosesAt,
    };
  }

  // Check required attendance: worker must have >= 1 CHECKED_OUT attendance
  const validAttendance = await Attendance.findOne({
    job: job._id,
    worker: workerId,
    status: ATTENDANCE_STATUS.CHECKED_OUT,
  });

  if (!validAttendance) {
    return {
      allowed: false,
      types: [],
      reason: 'NO_CHECKED_OUT_ATTENDANCE',
      windowOpensAt,
      windowClosesAt,
    };
  }

  // Existing ratings by fromUser for this job & counterparty
  const existingRatings = await Rating.find({
    job: job._id,
    fromUser: fromUserId,
    toUser: toUserId,
  }).select('type');
  const alreadyRatedTypes = new Set(existingRatings.map((r) => r.type));

  const eligibleTypes = [];

  if (isFromContractor) {
    // Contractor -> Worker: WORKER_SKILL
    if (!alreadyRatedTypes.has(RATING_TYPES.WORKER_SKILL)) {
      eligibleTypes.push(RATING_TYPES.WORKER_SKILL);
    }
  } else {
    // Worker -> Contractor: CONTRACTOR_SAFETY & CONTRACTOR_PAYMENT
    if (!alreadyRatedTypes.has(RATING_TYPES.CONTRACTOR_SAFETY)) {
      eligibleTypes.push(RATING_TYPES.CONTRACTOR_SAFETY);
    }

    if (!alreadyRatedTypes.has(RATING_TYPES.CONTRACTOR_PAYMENT)) {
      // Payment rating requires >= 1 escrow row settled (RELEASED, REFUNDED, or DISPUTED)
      const settledEscrow = await EscrowTransaction.findOne({
        job: job._id,
        worker: workerId,
        status: {
          $in: [
            ESCROW_STATUS.RELEASED,
            ESCROW_STATUS.REFUNDED,
            ESCROW_STATUS.DISPUTED,
          ],
        },
      });

      if (settledEscrow) {
        eligibleTypes.push(RATING_TYPES.CONTRACTOR_PAYMENT);
      }
    }
  }

  return {
    allowed: eligibleTypes.length > 0,
    types: eligibleTypes,
    reason: eligibleTypes.length === 0 ? 'ALREADY_RATED' : null,
    windowOpensAt,
    windowClosesAt,
  };
}

/**
 * Creates a rating if eligible, keeping it double-blind until reveal conditions met.
 */
export async function createRating(fromUserId, payload) {
  const { jobId, toUserId, type, score, tags = [], comment = '' } = payload;

  const job = await Job.findById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const eligibility = await getRatingEligibility(job, fromUserId, toUserId);
  if (!eligibility.allowed) {
    const err = new Error(`Rating not permitted: ${eligibility.reason}`);
    err.status = eligibility.reason === 'NOT_JOB_PARTICIPANT' ? 403 : 409;
    err.code = eligibility.reason === 'ALREADY_RATED_ALL' ? 'ALREADY_RATED' : eligibility.reason;
    throw err;
  }

  if (!eligibility.types.includes(type)) {
    const err = new Error(`Rating type '${type}' is not eligible or already submitted`);
    err.status = 409;
    err.code = 'ALREADY_RATED';
    throw err;
  }

  // Validate Score
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    const err = new Error('Score must be an integer between 1 and 5');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Validate Tags
  const allowedTags = RATING_TAGS[type] || [];
  if (Array.isArray(tags)) {
    if (tags.length > 4) {
      const err = new Error('Maximum 4 tags allowed per rating');
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }
    for (const tag of tags) {
      if (!allowedTags.includes(tag)) {
        const err = new Error(`Invalid tag '${tag}' for rating type '${type}'`);
        err.status = 400;
        err.code = 'INVALID_TAG';
        throw err;
      }
    }
  }

  const cleanComment = sanitizeComment(comment).slice(0, env.ratingCommentMax);

  let rating;
  try {
    rating = await Rating.create({
      job: jobId,
      fromUser: fromUserId,
      toUser: toUserId,
      type,
      score,
      tags: tags || [],
      comment: cleanComment,
      revealedAt: null, // Double-blind
    });
  } catch (err) {
    if (err.code === 11000) {
      const conflictErr = new Error('You have already submitted this rating');
      conflictErr.status = 409;
      conflictErr.code = 'ALREADY_RATED';
      throw conflictErr;
    }
    throw err;
  }

  // Invalidate reputation cache for target
  reputationCache.delete(toUserId.toString());

  // Log Audit
  await AuditLog.create({
    action: 'RATING_SUBMITTED',
    actor: fromUserId,
    target: rating._id,
    targetModel: 'Rating',
    details: { jobId, toUserId, type, score },
  });

  // Evaluate double-blind reveal trigger
  const contractorId = job.contractor._id ? job.contractor._id.toString() : job.contractor.toString();
  const workerId = fromUserId.toString() === contractorId ? toUserId.toString() : fromUserId.toString();
  const revealedCount = await revealIfReady(jobId, workerId);

  return {
    rating,
    isRevealed: revealedCount > 0,
  };
}

/**
 * Double-Blind Reveal Logic:
 * Checks if contractor submitted WORKER_SKILL AND worker submitted >= 1 CONTRACTOR_PAYMENT/SAFETY.
 * If yes, reveals all pending ratings for that (job, worker) pair.
 */
export async function revealIfReady(jobId, workerId) {
  const job = await Job.findById(jobId);
  if (!job) return 0;

  const contractorId = job.contractor._id ? job.contractor._id.toString() : job.contractor.toString();

  // Has contractor rated worker skill?
  const contractorRated = await Rating.exists({
    job: jobId,
    fromUser: contractorId,
    toUser: workerId,
    type: RATING_TYPES.WORKER_SKILL,
  });

  // Has worker rated contractor safety or payment?
  const workerRated = await Rating.exists({
    job: jobId,
    fromUser: workerId,
    toUser: contractorId,
    type: { $in: [RATING_TYPES.CONTRACTOR_PAYMENT, RATING_TYPES.CONTRACTOR_SAFETY] },
  });

  if (contractorRated && workerRated) {
    const now = clock.now();

    const updateRes = await Rating.updateMany(
      {
        job: jobId,
        revealedAt: null,
        $or: [
          { fromUser: contractorId, toUser: workerId },
          { fromUser: workerId, toUser: contractorId },
        ],
      },
      { $set: { revealedAt: now } }
    );

    if (updateRes.modifiedCount > 0) {
      logger.info(`[RatingService] Revealed ${updateRes.modifiedCount} ratings for job ${jobId}`);

      // Recompute summaries for both users
      await Promise.all([
        recomputeRatingSummary(workerId),
        recomputeRatingSummary(contractorId),
      ]);

      // Invalidate caches
      reputationCache.delete(workerId);
      reputationCache.delete(contractorId);

      // Create Notifications & Sockets
      await Notification.create([
        {
          user: workerId,
          type: NOTIFICATION_TYPE.RATING_REQUEST,
          title: 'Aapko nayi rating mili!',
          body: `Contractor ne aapke kaam ko rate kiya hai. Dekhein apna profile score.`,
          data: { jobId },
          status: NOTIFICATION_STATUS.SENT,
        },
        {
          user: contractorId,
          type: NOTIFICATION_TYPE.RATING_REQUEST,
          title: 'Aapko nayi rating mili!',
          body: `Worker ne site safety aur payment ko rate kiya hai.`,
          data: { jobId },
          status: NOTIFICATION_STATUS.SENT,
        },
      ]);

      const io = getIO();
      if (io) {
        io.to(`user:${workerId}`).emit('rating:revealed', { jobId });
        io.to(`user:${contractorId}`).emit('rating:revealed', { jobId });
      }

      return updateRes.modifiedCount;
    }
  }

  return 0;
}

/**
 * Recomputes Bayesian smoothed rating summaries from scratch.
 * Formula: smoothed = (PRIOR_COUNT * PRIOR_MEAN + sum) / (PRIOR_COUNT + count)
 */
export async function recomputeRatingSummary(userId) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  // Match only revealed and not hidden ratings
  const ratings = await Rating.find({
    toUser: userObjectId,
    revealedAt: { $ne: null },
    isHidden: false,
  });

  const workerSkills = ratings.filter((r) => r.type === RATING_TYPES.WORKER_SKILL);
  const contractorPayments = ratings.filter((r) => r.type === RATING_TYPES.CONTRACTOR_PAYMENT);
  const contractorSafeties = ratings.filter((r) => r.type === RATING_TYPES.CONTRACTOR_SAFETY);

  const priorC = env.ratingPriorCount;
  const priorM = env.ratingPriorMean;

  const calcGroup = (items) => {
    const count = items.length;
    if (count === 0) {
      return { avg: 0, count: 0, score: 0 };
    }
    const sum = items.reduce((acc, curr) => acc + curr.score, 0);
    const avg = parseFloat((sum / count).toFixed(2));
    const score = parseFloat(((priorC * priorM + sum) / (priorC + count)).toFixed(2));
    return { avg, count, score };
  };

  const ws = calcGroup(workerSkills);
  const cp = calcGroup(contractorPayments);
  const cs = calcGroup(contractorSafeties);

  const updatedSummary = {
    workerSkillAvg: ws.avg,
    workerSkillCount: ws.count,
    workerSkillScore: ws.score,
    contractorPaymentAvg: cp.avg,
    contractorPaymentCount: cp.count,
    contractorPaymentScore: cp.score,
    contractorSafetyAvg: cs.avg,
    contractorSafetyCount: cs.count,
    contractorSafetyScore: cs.score,
    updatedAt: clock.now(),
  };

  await User.findByIdAndUpdate(userId, { ratingSummary: updatedSummary });
  reputationCache.delete(userId.toString());

  return updatedSummary;
}

/**
 * Returns reputation profile and objective performance stats for any user.
 */
export async function getReputationAndObjectiveStats(targetUserId) {
  const cached = reputationCache.get(targetUserId.toString());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const user = await User.findById(targetUserId).select('name role ratingSummary location createdAt');
  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const isContractor = user.role === 'contractor';

  // Revealed and visible ratings
  const ratings = await Rating.find({
    toUser: user._id,
    revealedAt: { $ne: null },
    isHidden: false,
  })
    .sort({ createdAt: -1 })
    .populate('fromUser', 'name')
    .lean();

  // Top Tags Aggregation
  const tagCounts = {};
  for (const r of ratings) {
    for (const tag of r.tags || []) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Recent Comments (Max 5, masked names: "Ramesh K.")
  const recentComments = ratings
    .filter((r) => r.comment && r.comment.length > 0)
    .slice(0, 5)
    .map((r) => {
      const fullName = r.fromUser?.name || 'Verified User';
      const parts = fullName.split(' ');
      const maskedName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
      return {
        id: r._id,
        author: maskedName,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
        type: r.type,
      };
    });

  // Calculate Badge based on relevant score
  const summary = user.ratingSummary || {};
  const totalCount = isContractor
    ? (summary.contractorPaymentCount || 0) + (summary.contractorSafetyCount || 0)
    : (summary.workerSkillCount || 0);

  const mainScore = isContractor
    ? (summary.contractorPaymentScore || 0)
    : (summary.workerSkillScore || 0);

  let badge = 'NEW';
  if (totalCount >= env.ratingMinCountForBadge) {
    if (mainScore >= 4.2) badge = 'GOOD';
    else if (mainScore >= 3.4) badge = 'OK';
    else badge = 'LOW';
  }

  // Objective Stats
  let objectiveStats = {};

  if (isContractor) {
    const contractorJobs = await Job.find({ contractor: user._id }).select('_id');
    const jobIds = contractorJobs.map((j) => j._id);

    const workerDaysTotal = await Attendance.countDocuments({
      job: { $in: jobIds },
      status: ATTENDANCE_STATUS.CHECKED_OUT,
    });

    const escrowRowsSettled = await EscrowTransaction.countDocuments({
      contractor: user._id,
      status: { $in: [ESCROW_STATUS.RELEASED, ESCROW_STATUS.REFUNDED] },
    });

    const approvedByContractorCount = await EscrowTransaction.countDocuments({
      contractor: user._id,
      status: ESCROW_STATUS.RELEASED,
      releasedBy: user._id,
    });

    const autoApprovedCount = await EscrowTransaction.countDocuments({
      contractor: user._id,
      status: ESCROW_STATUS.RELEASED,
      releasedBy: 'system',
    });

    const disputesOpenedAgainst = await Dispute.countDocuments({
      againstUser: user._id,
    });

    const disputesResolvedForWorker = await Dispute.countDocuments({
      againstUser: user._id,
      status: DISPUTE_STATUS.RESOLVED_FOR_WORKER,
    });

    const incidentsReported = await Incident.countDocuments({
      job: { $in: jobIds },
      type: { $in: ['SOS', 'INJURY'] },
    });

    const incidentsPer100WorkerDays =
      workerDaysTotal > 0 ? parseFloat(((incidentsReported / workerDaysTotal) * 100).toFixed(2)) : 0;

    objectiveStats = {
      workerDaysTotal,
      escrowRowsSettled,
      approvedByContractorCount,
      autoApprovedCount,
      disputesOpenedAgainst,
      disputesResolvedForWorker,
      incidentsReported,
      incidentsPer100WorkerDays,
      sampleTooSmall: workerDaysTotal < 5,
    };
  } else {
    // Worker Objective Stats
    const daysWorked = await Attendance.countDocuments({
      worker: user._id,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
    });

    const noShowCount = await Attendance.countDocuments({
      worker: user._id,
      status: ATTENDANCE_STATUS.MISSED,
    });

    const disputesLost = await Dispute.countDocuments({
      raisedBy: user._id,
      status: DISPUTE_STATUS.RESOLVED_FOR_CONTRACTOR,
    });

    objectiveStats = {
      daysWorked,
      noShowCount,
      disputesLost,
      sampleTooSmall: daysWorked < 5,
    };
  }

  const result = {
    userId: user._id,
    name: user.name,
    role: user.role,
    summary: {
      ...summary,
      totalCount,
      score: mainScore,
      badge,
    },
    topTags,
    recentComments,
    objectiveStats,
  };

  reputationCache.set(targetUserId.toString(), {
    data: result,
    timestamp: Date.now(),
  });

  return result;
}

/**
 * Returns pending rateable items for the current user.
 */
export async function getPendingRatings(userId) {
  const user = await User.findById(userId);
  if (!user) return [];

  const isContractor = user.role === 'contractor';
  const pending = [];

  if (isContractor) {
    const jobs = await Job.find({ contractor: userId })
      .sort({ createdAt: -1 })
      .populate('assignedWorkers', '_id name phone');

    for (const job of jobs) {
      for (const worker of job.assignedWorkers || []) {
        const eligibility = await getRatingEligibility(job, userId, worker._id);
        if (eligibility.allowed) {
          pending.push({
            job: {
              id: job._id,
              title: job.title,
              endDate: job.endDate,
            },
            counterparty: {
              id: worker._id,
              name: worker.name,
              role: 'worker',
            },
            types: eligibility.types,
            windowClosesAt: eligibility.windowClosesAt,
          });
        }
      }
    }
  } else {
    // Worker pending ratings for contractors
    const attendances = await Attendance.find({
      worker: userId,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
    })
      .populate({
        path: 'job',
        populate: { path: 'contractor', select: '_id name' },
      })
      .sort({ createdAt: -1 });

    const seenJobs = new Set();

    for (const att of attendances) {
      const job = att.job;
      if (!job || !job.contractor || seenJobs.has(job._id.toString())) continue;
      seenJobs.add(job._id.toString());

      const eligibility = await getRatingEligibility(job, userId, job.contractor._id);
      if (eligibility.allowed) {
        pending.push({
          job: {
            id: job._id,
            title: job.title,
            endDate: job.endDate,
          },
          counterparty: {
            id: job.contractor._id,
            name: job.contractor.name,
            role: 'contractor',
          },
          types: eligibility.types,
          windowClosesAt: eligibility.windowClosesAt,
        });
      }
    }
  }

  return pending;
}

/**
 * Reports an unfair or abusive rating. Only the recipient can report, once, after reveal.
 */
export async function reportRating(ratingId, recipientUserId, reason) {
  const rating = await Rating.findById(ratingId);
  if (!rating) {
    const err = new Error('Rating not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (rating.toUser.toString() !== recipientUserId.toString()) {
    const err = new Error('Only the recipient of a rating can report it');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (!rating.revealedAt) {
    const err = new Error('Rating cannot be reported before it is revealed');
    err.status = 409;
    err.code = 'RATING_NOT_REVEALED';
    throw err;
  }

  if (rating.reportedByRecipient) {
    const err = new Error('You have already reported this rating');
    err.status = 409;
    err.code = 'ALREADY_REPORTED';
    throw err;
  }

  rating.reportedByRecipient = true;
  rating.reportReason = reason || 'Unfair rating reported by recipient';
  rating.reportedAt = clock.now();
  await rating.save();

  await AuditLog.create({
    action: 'RATING_REPORTED',
    actor: recipientUserId,
    target: rating._id,
    targetModel: 'Rating',
    details: { reason },
  });

  return rating;
}

/**
 * Admin action: Hide a rating with required reason.
 */
export async function hideRating(ratingId, adminUserId, reason) {
  if (!reason || reason.trim().length < 5) {
    const err = new Error('A reason of at least 5 characters is required to hide a rating');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const rating = await Rating.findByIdAndUpdate(
    ratingId,
    {
      $set: {
        isHidden: true,
        hiddenBy: adminUserId,
        hiddenReason: reason.trim(),
        hiddenAt: clock.now(),
      },
    },
    { new: true }
  );

  if (!rating) {
    const err = new Error('Rating not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Recompute target user summary
  await recomputeRatingSummary(rating.toUser);

  await AuditLog.create({
    action: 'ADMIN_RATING_HIDDEN',
    actor: adminUserId,
    target: rating._id,
    targetModel: 'Rating',
    details: { reason },
  });

  return rating;
}

/**
 * Admin action: Unhide a hidden rating.
 */
export async function unhideRating(ratingId, adminUserId) {
  const rating = await Rating.findByIdAndUpdate(
    ratingId,
    {
      $set: {
        isHidden: false,
        hiddenBy: null,
        hiddenReason: null,
        hiddenAt: null,
      },
    },
    { new: true }
  );

  if (!rating) {
    const err = new Error('Rating not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await recomputeRatingSummary(rating.toUser);

  await AuditLog.create({
    action: 'ADMIN_RATING_UNHIDDEN',
    actor: adminUserId,
    target: rating._id,
    targetModel: 'Rating',
    details: {},
  });

  return rating;
}
