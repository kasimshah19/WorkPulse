import Incident from '../models/Incident.js';
import Rating from '../models/Rating.js';
import Job from '../models/Job.js';
import User from '../models/User.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';
import { sendSms } from './sms/sms.service.js';
import { appendTimeline } from './sos.service.js';
import {
  getRatingEligibility,
  recomputeRatingSummary,
} from './rating.service.js';
import {
  INCIDENT_TYPES,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  INCIDENT_TIMELINE_EVENT,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  ATTENDANCE_STATUS,
} from '../config/constants.js';

let schedulerInterval = null;

/**
 * Level 1 (60s) & Level 2 (300s) Escalation for Unacknowledged SOS Alerts.
 * Atomically transitions escalationLevel to guarantee exactly-once firing.
 */
export async function escalateUnacknowledgedSos() {
  const now = clock.now();
  let escalatedCount = 0;

  // Level 1: 60 seconds unacknowledged
  const level1Cutoff = new Date(now.getTime() - env.sosEscalationSec * 1000);
  const level1Candidates = await Incident.find({
    type: INCIDENT_TYPES.SOS,
    status: INCIDENT_STATUS.OPEN,
    escalationLevel: 0,
    createdAt: { $lte: level1Cutoff },
  }).populate('job reportedBy');

  for (const inc of level1Candidates) {
    const updated = await Incident.findOneAndUpdate(
      {
        _id: inc._id,
        escalationLevel: 0,
        status: INCIDENT_STATUS.OPEN,
      },
      {
        $set: { escalationLevel: 1 },
      },
      { new: true }
    );

    if (!updated) continue; // Race check: already escalated

    escalatedCount++;
    await appendTimeline(inc._id, INCIDENT_TIMELINE_EVENT.ESCALATED_1, null, {
      escalatedAt: now,
      reason: `No acknowledgement within ${env.sosEscalationSec}s`,
    });

    const reporter = inc.reportedBy;
    const trail = updated.locationTrail || [];
    const latestCoords =
      trail.length > 0
        ? trail[trail.length - 1].coordinates
        : updated.location.coordinates;
    const mapsUrl = `https://maps.google.com/?q=${latestCoords[1]},${latestCoords[0]}`;

    // Resend SMS to contractor if notifyContractor
    if (updated.notifyContractor && updated.job) {
      const contractor = await User.findById(updated.job.contractor);
      if (contractor && contractor.phone && env.sosSmsEnabled) {
        sendSms(
          contractor.phone,
          `WorkPulse URGENT SOS (Escalation 1): Worker ${reporter.name} ko turant madad chahiye! Location: ${mapsUrl} . Phone: ${reporter.phone}`
        ).catch((err) => logger.error(`[Escalation 1] Contractor SMS failed: ${err.message}`));
      }
    }

    // Resend SMS to Emergency Contact
    if (reporter.emergencyContact && reporter.emergencyContact.phone && env.sosSmsEnabled) {
      sendSms(
        reporter.emergencyContact.phone,
        `WorkPulse URGENT SOS (Escalation 1): ${reporter.name} ko abhi tak madad nahi mili. Location: ${mapsUrl} . 112 par turant call karein.`
      ).catch((err) => logger.error(`[Escalation 1] Emergency contact SMS failed: ${err.message}`));
    }

    // Emit Socket sos:escalated to Admins and re-alert contractor/coworkers
    const io = getIO();
    if (io) {
      io.to('role:admin').emit('sos:escalated', {
        incidentId: inc._id,
        level: 1,
        at: now,
      });

      for (const au of updated.alertedUsers || []) {
        if (au.user) {
          io.to(`user:${au.user.toString()}`).emit('sos:alert', {
            incidentId: inc._id,
            reporter: {
              id: reporter._id,
              name: reporter.name,
              phone: reporter.phone,
            },
            location: { lat: latestCoords[1], lng: latestCoords[0] },
            isEscalation: true,
            escalationLevel: 1,
          });
        }
      }
    }
  }

  // Level 2: 300 seconds unacknowledged
  const level2Cutoff = new Date(now.getTime() - env.sosSecondEscalationSec * 1000);
  const level2Candidates = await Incident.find({
    type: INCIDENT_TYPES.SOS,
    status: INCIDENT_STATUS.OPEN,
    escalationLevel: 1,
    createdAt: { $lte: level2Cutoff },
  }).populate('job reportedBy');

  for (const inc of level2Candidates) {
    const updated = await Incident.findOneAndUpdate(
      {
        _id: inc._id,
        escalationLevel: 1,
        status: INCIDENT_STATUS.OPEN,
      },
      {
        $set: {
          escalationLevel: 2,
          severity: INCIDENT_SEVERITY.CRITICAL,
        },
      },
      { new: true }
    );

    if (!updated) continue;

    escalatedCount++;
    await appendTimeline(inc._id, INCIDENT_TIMELINE_EVENT.ESCALATED_2, null, {
      escalatedAt: now,
      reason: `No acknowledgement within ${env.sosSecondEscalationSec}s (Level 2)`,
    });

    const io = getIO();
    if (io) {
      io.to('role:admin').emit('sos:escalated', {
        incidentId: inc._id,
        level: 2,
        severity: INCIDENT_SEVERITY.CRITICAL,
        at: now,
      });
    }
  }

  return escalatedCount;
}

/**
 * Creates rating request notifications for completed jobs.
 * Uses dedupeKey to ensure exactly-once notification generation.
 */
export async function sendRatingRequests() {
  const now = clock.now();
  let createdCount = 0;

  // Find completed or ended jobs
  const jobs = await Job.find({
    $or: [{ status: 'COMPLETED' }, { endDate: { $lte: now } }],
  }).populate('assignedWorkers contractor');

  for (const job of jobs) {
    const contractor = job.contractor;
    if (!contractor) continue;

    for (const worker of job.assignedWorkers || []) {
      // 1. Check contractor -> worker request
      const cElig = await getRatingEligibility(job, contractor._id, worker._id);
      if (cElig.allowed) {
        const dedupeKey = `RATING_REQ:${job._id}:${contractor._id}:${worker._id}`;
        try {
          await Notification.create({
            user: contractor._id,
            type: NOTIFICATION_TYPE.RATING_REQUEST,
            title: 'Worker ko rate karein',
            body: `${worker.name} ne aapki site '${job.title}' par kaam poora kiya hai. Unhein rating dein.`,
            data: { jobId: job._id, counterpartyId: worker._id, types: cElig.types },
            dedupeKey,
            status: NOTIFICATION_STATUS.SENT,
          });
          createdCount++;

          const io = getIO();
          if (io) {
            io.to(`user:${contractor._id.toString()}`).emit('rating:requested', {
              jobId: job._id,
              counterpartyId: worker._id,
              types: cElig.types,
            });
          }
        } catch (err) {
          if (err.code !== 11000) logger.warn(`[RatingScheduler] Notification creation failed: ${err.message}`);
        }
      }

      // 2. Check worker -> contractor request
      const wElig = await getRatingEligibility(job, worker._id, contractor._id);
      if (wElig.allowed) {
        const dedupeKey = `RATING_REQ:${job._id}:${worker._id}:${contractor._id}`;
        try {
          await Notification.create({
            user: worker._id,
            type: NOTIFICATION_TYPE.RATING_REQUEST,
            title: 'Contractor ko rate karein',
            body: `'${job.title}' par payment aur safety kaisa raha? Apna anubhav darj karein.`,
            data: { jobId: job._id, counterpartyId: contractor._id, types: wElig.types },
            dedupeKey,
            status: NOTIFICATION_STATUS.SENT,
          });
          createdCount++;

          const io = getIO();
          if (io) {
            io.to(`user:${worker._id.toString()}`).emit('rating:requested', {
              jobId: job._id,
              counterpartyId: contractor._id,
              types: wElig.types,
            });
          }
        } catch (err) {
          if (err.code !== 11000) logger.warn(`[RatingScheduler] Notification creation failed: ${err.message}`);
        }
      }
    }
  }

  return createdCount;
}

/**
 * Sends one reminder after RATING_REMINDER_AFTER_DAYS (default 3) for pending ratings.
 */
export async function sendRatingReminders() {
  const now = clock.now();
  const reminderCutoff = new Date(now.getTime() - env.ratingReminderAfterDays * 24 * 60 * 60 * 1000);
  let reminderCount = 0;

  // Find notifications created > 3 days ago of type RATING_REQUEST
  const pendingRequests = await Notification.find({
    type: NOTIFICATION_TYPE.RATING_REQUEST,
    createdAt: { $lte: reminderCutoff },
    dedupeKey: { $regex: /^RATING_REQ:[^:]+:[^:]+:[^:]+$/ }, // Initial requests only
  });

  for (const notif of pendingRequests) {
    const reminderDedupeKey = `${notif.dedupeKey}:REMINDER`;
    try {
      await Notification.create({
        user: notif.user,
        type: NOTIFICATION_TYPE.RATING_REQUEST,
        title: 'Rating yaad dilana (Reminder)',
        body: 'Aapka rating dena abhi baaki hai. Rating dene par dusre ki rating khulegi.',
        data: notif.data,
        dedupeKey: reminderDedupeKey,
        status: NOTIFICATION_STATUS.SENT,
      });
      reminderCount++;
    } catch (err) {
      // 11000 duplicate key is expected for already reminded items
    }
  }

  return reminderCount;
}

/**
 * Automatically reveals ratings for jobs whose 14-day window has closed.
 */
export async function revealClosedWindows() {
  const now = clock.now();
  const windowCloseCutoff = new Date(now.getTime() - env.ratingWindowDays * 24 * 60 * 60 * 1000);

  // Find jobs whose endDate passed the window
  const expiredJobs = await Job.find({
    endDate: { $lte: windowCloseCutoff },
  }).select('_id');

  const expiredJobIds = expiredJobs.map((j) => j._id);
  if (expiredJobIds.length === 0) return 0;

  // Find unrevealed ratings for these jobs
  const unrevealedRatings = await Rating.find({
    job: { $in: expiredJobIds },
    revealedAt: null,
  });

  if (unrevealedRatings.length === 0) return 0;

  await Rating.updateMany(
    {
      _id: { $in: unrevealedRatings.map((r) => r._id) },
    },
    {
      $set: { revealedAt: now },
    }
  );

  // Recompute summaries for all distinct toUsers
  const targetUserIds = [...new Set(unrevealedRatings.map((r) => r.toUser.toString()))];
  for (const uid of targetUserIds) {
    await recomputeRatingSummary(uid);
  }

  logger.info(`[RatingScheduler] Auto-revealed ${unrevealedRatings.length} ratings past window close.`);
  return unrevealedRatings.length;
}

/**
 * Flags SOS incidents open for > 12 hours as STALE_OPEN without resolving them.
 */
export async function flagStaleSos() {
  const now = clock.now();
  const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

  const staleCandidates = await Incident.find({
    type: INCIDENT_TYPES.SOS,
    status: { $in: [INCIDENT_STATUS.OPEN, INCIDENT_STATUS.ACKNOWLEDGED] },
    createdAt: { $lte: twelveHoursAgo },
    'timeline.data.staleFlagged': { $ne: true },
  });

  let flaggedCount = 0;
  for (const inc of staleCandidates) {
    await appendTimeline(inc._id, INCIDENT_TIMELINE_EVENT.NOTE, null, {
      staleFlagged: true,
      note: 'Alert open for > 12 hours without resolution. Requires administrative check.',
    });
    flaggedCount++;
  }

  return flaggedCount;
}

/**
 * Single runner executing all safety tasks sequentially.
 */
export async function runSafetySchedulerOnce() {
  try {
    const [escalated, requests, reminders, revealed, stale] = await Promise.all([
      escalateUnacknowledgedSos(),
      sendRatingRequests(),
      sendRatingReminders(),
      revealClosedWindows(),
      flagStaleSos(),
    ]);

    return {
      success: true,
      escalated,
      requests,
      reminders,
      revealed,
      stale,
    };
  } catch (err) {
    logger.error(`[SafetyScheduler] Execution failed: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Start periodic background execution.
 */
export function startSafetyScheduler() {
  if (process.env.NODE_ENV === 'test') {
    return; // Tests invoke manually
  }

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  const intervalMs = env.safetySchedulerIntervalSec * 1000;
  schedulerInterval = setInterval(async () => {
    await runSafetySchedulerOnce();
  }, intervalMs);

  logger.info(`[SafetyScheduler] Started with interval ${env.safetySchedulerIntervalSec}s`);
}

export function stopSafetyScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
