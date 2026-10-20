import crypto from 'crypto';
import Attendance from '../models/Attendance.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import env from '../config/env.js';
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_METHOD,
  SIGNOFF_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  JOB_STATUS,
} from '../config/constants.js';
import { haversineDistance } from '../utils/geo.js';
import {
  getISTDateString,
  isCheckInWindowOpen,
  calculateHoursWorked,
} from '../utils/time.js';
import clock from '../utils/clock.js';
import { saveSelfie } from './storage.service.js';
import { getIO } from '../sockets/index.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import { ESCROW_STATUS, DISPUTE_OPENED_FROM } from '../config/constants.js';
import {
  onCheckIn,
  onCheckOut,
  approveAndRelease,
  openDispute,
} from './escrow.service.js';

/**
 * Custom operational error with HTTP status and code.
 */
class AttendanceError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Generates deterministic 6-digit attendance code via HMAC-SHA256(secret + date)
 *
 * @param {string} secret
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string} jobId
 * @returns {{ code: string, validForDate: string, qrPayload: string }}
 */
export function generateAttendanceCode(secret, dateStr, jobId) {
  const hmac = crypto.createHmac('sha256', secret || 'fallback-secret');
  hmac.update(String(dateStr));
  const hash = hmac.digest('hex');
  const code = (parseInt(hash.slice(0, 8), 16) % 1000000).toString().padStart(6, '0');
  return {
    code,
    validForDate: dateStr,
    qrPayload: `workpulse:attendance:${jobId}:${code}`,
  };
}

/**
 * Loads context and verifies worker assignment and active job window.
 *
 * @param {string} jobId
 * @param {string} workerId
 * @returns {Promise<{ job: Object, application: Object, todayDate: string }>}
 */
export async function getAssignedContext(jobId, workerId) {
  const job = await Job.findById(jobId).select('+attendanceCodeSecret');
  if (!job) {
    throw new AttendanceError(404, 'NOT_FOUND', 'Job not found.');
  }

  const application = await JobApplication.findOne({
    job: jobId,
    worker: workerId,
  });

  if (!application || application.status !== 'ASSIGNED') {
    throw new AttendanceError(403, 'NOT_ASSIGNED', 'Worker is not assigned to this job.');
  }

  if (![JOB_STATUS.FILLED, JOB_STATUS.IN_PROGRESS].includes(job.status)) {
    throw new AttendanceError(409, 'JOB_NOT_ACTIVE', `Job is not active for attendance (Status: ${job.status}).`);
  }

  const todayDate = getISTDateString();
  const startIST = getISTDateString(job.startDate);
  const endIST = getISTDateString(job.endDate);

  if (todayDate < startIST || todayDate > endIST) {
    throw new AttendanceError(
      409,
      'OUTSIDE_JOB_DATES',
      `Today (${todayDate}) is outside the scheduled job duration (${startIST} to ${endIST}).`,
    );
  }

  return { job, application, todayDate };
}

/**
 * Helper to record rejected check-in/check-out attempts in AuditLog.
 * Rejected attempts must NEVER create Attendance documents.
 */
async function logRejectedAttempt({
  action,
  jobId,
  workerId,
  reasonCode,
  lat,
  lng,
  accuracy,
  distanceMeters,
  ip = '',
  userAgent = '',
}) {
  try {
    await AuditLog.create({
      actor: workerId,
      action,
      entityType: 'Job',
      entityId: String(jobId),
      after: {
        reason: reasonCode,
        reportedLat: lat,
        reportedLng: lng,
        accuracy,
        distanceMeters,
        ip,
        userAgent,
      },
      ip,
      userAgent,
    });
  } catch (err) {
    console.error('[AUDIT_LOG_ERROR] Failed to record rejected attempt:', err.message);
  }
}

/**
 * Executes full check-in validation and persistence.
 *
 * @param {Object} params
 * @returns {Promise<Object>} Created attendance record
 */
export async function checkIn({
  jobId,
  workerId,
  lat,
  lng,
  accuracy,
  clientTimestamp,
  method = ATTENDANCE_METHOD.GPS_SELFIE,
  selfieFile,
  code,
  deviceInfo = {},
  ip = '',
  userAgent = '',
}) {
  const flags = [];

  // Catch-all try-catch to log rejected attempts to AuditLog
  try {
    // 1. Assigned Context (NOT_ASSIGNED, JOB_NOT_ACTIVE, OUTSIDE_JOB_DATES)
    const { job, todayDate } = await getAssignedContext(jobId, workerId);

    // 2. Escrow Funding Check (Phase 5)
    let todayEscrow = await EscrowTransaction.findOne({
      job: jobId,
      worker: workerId,
      dayDate: todayDate,
    });

    if (env.attendanceRequireFunding) {
      if (!todayEscrow || todayEscrow.status !== ESCROW_STATUS.FUNDED) {
        throw new AttendanceError(
          402,
          'ESCROW_NOT_FUNDED',
          'Contractor ne abhi paisa lock nahi kiya (Escrow is not funded for today).',
          { currentStatus: todayEscrow?.status || 'NOT_FOUND' }
        );
      }
    }

    // 3. Time Window Validation
    const windowCheck = isCheckInWindowOpen(job.workingHours, env.attendanceEarlyCheckinMin);
    if (!windowCheck.allowed) {
      throw new AttendanceError(
        409,
        'OUTSIDE_WORKING_HOURS',
        `Check-in is only allowed between ${job.workingHours.start} (early by ${env.attendanceEarlyCheckinMin}m) and ${job.workingHours.end}.`,
        windowCheck,
      );
    }

    // 4. Clock Drift Check
    const now = clock.now();
    const clientTime = new Date(clientTimestamp);
    if (isNaN(clientTime.getTime())) {
      throw new AttendanceError(400, 'INVALID_TIMESTAMP', 'clientTimestamp must be a valid ISO string.');
    }

    const driftSec = Math.abs(now.getTime() - clientTime.getTime()) / 1000;
    if (driftSec > env.attendanceMaxClockDriftSec) {
      throw new AttendanceError(
        400,
        'CLOCK_MISMATCH',
        `Client clock drift of ${Math.round(driftSec)}s exceeds maximum allowed ${env.attendanceMaxClockDriftSec}s. Please synchronize device time.`,
        { driftSec, maxAllowedSec: env.attendanceMaxClockDriftSec },
      );
    }

    // 5. GPS Accuracy Check
    if (typeof accuracy !== 'number' || accuracy > env.attendanceMaxAccuracyM) {
      throw new AttendanceError(
        422,
        'LOW_ACCURACY',
        `GPS accuracy of ${accuracy}m is too low. Required accuracy is under ${env.attendanceMaxAccuracyM}m.`,
        { accuracy, maxAllowed: env.attendanceMaxAccuracyM },
      );
    }

    if (accuracy <= 0 || accuracy === 1) {
      // Unrealistic perfection flag
      flags.push('LOW_ACCURACY_WARN');
    }

    // 6. Impossible Jump Heuristic (Speed > 150 km/h compared to last attendance within 6h)
    const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    const lastAttendance = await Attendance.findOne({
      worker: workerId,
      createdAt: { $gte: sixHoursAgo },
    }).sort({ createdAt: -1 });

    if (lastAttendance && lastAttendance.checkInLocation?.coordinates) {
      const [lastLng, lastLat] = lastAttendance.checkInLocation.coordinates;
      const jumpMeters = haversineDistance(lastLat, lastLng, lat, lng);
      const timeDiffHours = (now.getTime() - lastAttendance.createdAt.getTime()) / (1000 * 60 * 60);

      if (timeDiffHours > 0) {
        const impliedSpeedKmh = (jumpMeters / 1000) / timeDiffHours;
        if (impliedSpeedKmh > env.attendanceMaxSpeedKmh) {
          throw new AttendanceError(
            422,
            'SUSPICIOUS_LOCATION',
            `Impossible physical jump detected: ${Math.round(impliedSpeedKmh)} km/h implied speed.`,
            { impliedSpeedKmh: Math.round(impliedSpeedKmh), maxSpeedKmh: env.attendanceMaxSpeedKmh },
          );
        }
      }
    }

    // 7. Server-Side Geofence Distance Calculation
    // [longitude, latitude] in MongoDB GeoJSON
    const [siteLng, siteLat] = job.location.coordinates;
    const distanceMeters = Math.round(haversineDistance(siteLat, siteLng, lat, lng));

    if (distanceMeters > job.geofenceRadiusMeters) {
      throw new AttendanceError(
        422,
        'OUTSIDE_GEOFENCE',
        `Aap site se ${distanceMeters} m door hain. Allowed: ${job.geofenceRadiusMeters} m ke andar aayein.`,
        { distanceMeters, allowedMeters: job.geofenceRadiusMeters },
      );
    }

    // 8. Method Proof Verification
    let selfieUrl = '';
    let qrUsed = false;

    if (method === ATTENDANCE_METHOD.GPS_SELFIE) {
      if (job.requiresSelfie && (!selfieFile || !selfieFile.buffer)) {
        throw new AttendanceError(400, 'SELFIE_REQUIRED', 'Selfie is required for check-in on this job.');
      }

      if (selfieFile && selfieFile.buffer) {
        const saved = await saveSelfie({
          buffer: selfieFile.buffer,
          jobId: job._id,
          date: todayDate,
        });
        selfieUrl = saved.relativePath;
      }
    } else if (method === ATTENDANCE_METHOD.GPS_QR) {
      const generated = generateAttendanceCode(job.attendanceCodeSecret, todayDate, job._id);
      if (!code || String(code).trim() !== generated.code) {
        throw new AttendanceError(422, 'INVALID_CODE', 'The 6-digit attendance code is invalid for today.');
      }
      qrUsed = true;
    }

    // 9. Check Duplicate Attendance
    const existing = await Attendance.findOne({
      job: jobId,
      worker: workerId,
      date: todayDate,
    });

    if (existing) {
      throw new AttendanceError(
        409,
        'ALREADY_CHECKED_IN',
        'Attendance record for today already exists.',
        { attendanceId: existing._id },
      );
    }

    // 10. Persist Attendance Record
    let attendance;
    try {
      attendance = await Attendance.create({
        job: jobId,
        worker: workerId,
        date: todayDate,
        status: ATTENDANCE_STATUS.CHECKED_IN,
        checkInAt: now,
        checkInLocation: {
          type: 'Point',
          coordinates: [lng, lat], // GeoJSON [lng, lat]
        },
        checkInDistanceMeters: distanceMeters,
        checkInAccuracyM: accuracy,
        clientTimestamp: clientTime,
        selfieUrl,
        method,
        qrUsed,
        flags,
        deviceInfo: (() => {
          if (typeof deviceInfo === 'string') {
            try {
              return JSON.parse(deviceInfo);
            } catch {
              return { userAgent: deviceInfo };
            }
          }
          return deviceInfo || {};
        })(),
      });
    } catch (dbErr) {
      if (dbErr.code === 11000) {
        throw new AttendanceError(
          409,
          'ALREADY_CHECKED_IN',
          'Attendance record for today already exists.',
        );
      }
      throw dbErr;
    }

    // Atomically transition job to IN_PROGRESS if currently FILLED
    if (job.status === JOB_STATUS.FILLED) {
      await Job.findByIdAndUpdate(jobId, { status: JOB_STATUS.IN_PROGRESS });
    }

    // 10. Escrow transition: FUNDED -> CHECKED_IN
    if (todayEscrow) {
      await onCheckIn(attendance);
    }

    // 11. Notifications and Socket Events
    const worker = await User.findById(workerId).select('name phone');
    const workerName = worker?.name || 'Worker';

    await Notification.create({
      user: job.contractor,
      type: NOTIFICATION_TYPE.CHECKIN_CONFIRMED,
      title: 'कारीगर चेक-इन (Worker Checked In)',
      body: `${workerName} साइट पर चेक-इन कर चुके हैं (${distanceMeters}m दूरी, ${todayDate})`,
      channel: NOTIFICATION_CHANNEL.SOCKET,
      status: NOTIFICATION_STATUS.SENT,
      data: { attendanceId: attendance._id, jobId, workerId },
    });

    const io = getIO();
    if (io) {
      const payload = {
        attendanceId: attendance._id,
        jobId,
        workerId,
        workerName,
        checkInAt: attendance.checkInAt,
        distanceMeters,
        method,
        flags,
      };
      io.to(`user:${job.contractor}`).emit('attendance:checkedIn', payload);
      io.to(`job:${jobId}`).emit('attendance:checkedIn', payload);
    }

    return attendance;
  } catch (err) {
    // Record rejection in AuditLog
    await logRejectedAttempt({
      action: 'ATTENDANCE_CHECKIN_REJECTED',
      jobId,
      workerId,
      reasonCode: err.code || 'UNKNOWN_REJECTION',
      lat,
      lng,
      accuracy,
      distanceMeters: err.details?.distanceMeters || null,
      ip,
      userAgent,
    });
    throw err;
  }
}

/**
 * Worker check-out with geofence validation and automatic hours calculation.
 *
 * @param {Object} params
 * @returns {Promise<Object>} Updated attendance record
 */
export async function checkOut({
  jobId,
  workerId,
  lat,
  lng,
  accuracy,
  clientTimestamp,
  selfieFile,
  ip = '',
  userAgent = '',
}) {
  try {
    const todayDate = getISTDateString();
    const attendance = await Attendance.findOne({
      job: jobId,
      worker: workerId,
      date: todayDate,
    });

    if (!attendance) {
      throw new AttendanceError(409, 'NOT_CHECKED_IN', 'No check-in record found for today.');
    }

    if (attendance.status === ATTENDANCE_STATUS.CHECKED_OUT) {
      throw new AttendanceError(409, 'ALREADY_CHECKED_OUT', 'Already checked out for today.');
    }

    if (attendance.status !== ATTENDANCE_STATUS.CHECKED_IN) {
      throw new AttendanceError(409, 'INVALID_ATTENDANCE_STATUS', `Cannot checkout from status ${attendance.status}.`);
    }

    // Geofence check on checkout
    const job = await Job.findById(jobId);
    const [siteLng, siteLat] = job.location.coordinates;
    const distanceMeters = Math.round(haversineDistance(siteLat, siteLng, lat, lng));

    if (distanceMeters > job.geofenceRadiusMeters) {
      throw new AttendanceError(
        422,
        'OUTSIDE_GEOFENCE',
        `Check-out geofence exceeded: ${distanceMeters}m away (Allowed: ${job.geofenceRadiusMeters}m).`,
        { distanceMeters, allowedMeters: job.geofenceRadiusMeters },
      );
    }

    // Clock drift check
    const now = clock.now();
    const clientTime = new Date(clientTimestamp);
    if (!isNaN(clientTime.getTime())) {
      const driftSec = Math.abs(now.getTime() - clientTime.getTime()) / 1000;
      if (driftSec > env.attendanceMaxClockDriftSec) {
        throw new AttendanceError(400, 'CLOCK_MISMATCH', 'Client clock drift too large on checkout.');
      }
    }

    // Optional checkout selfie
    let selfieCheckoutUrl = '';
    if (selfieFile && selfieFile.buffer) {
      const saved = await saveSelfie({
        buffer: selfieFile.buffer,
        jobId,
        date: todayDate,
      });
      selfieCheckoutUrl = saved.relativePath;
    }

    const hoursWorked = calculateHoursWorked(attendance.checkInAt, now);

    // Atomic update
    const updated = await Attendance.findOneAndUpdate(
      { _id: attendance._id, status: ATTENDANCE_STATUS.CHECKED_IN },
      {
        $set: {
          status: ATTENDANCE_STATUS.CHECKED_OUT,
          checkOutAt: now,
          checkOutLocation: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          checkOutDistanceMeters: distanceMeters,
          checkOutAccuracyM: accuracy,
          hoursWorked,
          selfieCheckoutUrl,
          'contractorSignoff.status': SIGNOFF_STATUS.PENDING,
        },
      },
      { new: true },
    );

    if (!updated) {
      throw new AttendanceError(409, 'ALREADY_CHECKED_OUT', 'Concurrent check-out conflict.');
    }

    // Notifications
    const worker = await User.findById(workerId).select('name');
    const workerName = worker?.name || 'Worker';

    await Notification.create({
      user: job.contractor,
      type: NOTIFICATION_TYPE.SIGNOFF_REQUEST,
      title: 'हाज़िरी साइन-ऑफ अनुरोध (Sign-off Request)',
      body: `${workerName} ने चेक-आउट किया है (${hoursWorked} घंटे)। कृपया हाज़िरी मंज़ूर करें।`,
      channel: NOTIFICATION_CHANNEL.SOCKET,
      status: NOTIFICATION_STATUS.SENT,
      data: { attendanceId: updated._id, jobId, hoursWorked },
    });

    const io = getIO();
    if (io) {
      const payload = {
        attendanceId: updated._id,
        jobId,
        workerId,
        workerName,
        checkOutAt: updated.checkOutAt,
        hoursWorked,
        autoCheckout: false,
      };
      io.to(`user:${job.contractor}`).emit('attendance:checkedOut', payload);
      io.to(`user:${job.contractor}`).emit('signoff:requested', {
        attendanceId: updated._id,
        jobId,
        workerName,
        hoursWorked,
      });
      io.to(`job:${jobId}`).emit('attendance:checkedOut', payload);
    }

    // Trigger Escrow transition: CHECKED_IN -> CHECKED_OUT with autoApprovalAt
    await onCheckOut(updated);

    return updated;
  } catch (err) {
    await logRejectedAttempt({
      action: 'ATTENDANCE_CHECKOUT_REJECTED',
      jobId,
      workerId,
      reasonCode: err.code || 'UNKNOWN_REJECTION',
      lat,
      lng,
      accuracy,
      ip,
      userAgent,
    });
    throw err;
  }
}

/**
 * Contractor sign-off decision (APPROVED | DISPUTED).
 * Hook onSignoffDecision marks integration point for Phase 5 escrow release.
 */
export async function signoff({ attendanceId, contractorId, decision, reason = '' }) {
  if (!['APPROVED', 'DISPUTED'].includes(decision)) {
    throw new AttendanceError(400, 'VALIDATION_ERROR', 'Decision must be APPROVED or DISPUTED.');
  }

  if (decision === 'DISPUTED' && (!reason || reason.trim().length < 5)) {
    throw new AttendanceError(400, 'REASON_REQUIRED', 'Dispute reason must be at least 5 characters.');
  }

  const attendance = await Attendance.findById(attendanceId).populate('job');
  if (!attendance) {
    throw new AttendanceError(404, 'NOT_FOUND', 'Attendance record not found.');
  }

  if (String(attendance.job.contractor) !== String(contractorId)) {
    throw new AttendanceError(403, 'FORBIDDEN', 'Only the job contractor can sign off attendance.');
  }

  if (attendance.status !== ATTENDANCE_STATUS.CHECKED_OUT || attendance.contractorSignoff.status !== SIGNOFF_STATUS.PENDING) {
    throw new AttendanceError(409, 'SIGNOFF_NOT_PENDING', 'Attendance sign-off is not pending.');
  }

  const now = clock.now();
  const updated = await Attendance.findOneAndUpdate(
    {
      _id: attendanceId,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
      'contractorSignoff.status': SIGNOFF_STATUS.PENDING,
    },
    {
      $set: {
        'contractorSignoff.status': decision,
        'contractorSignoff.at': now,
        'contractorSignoff.by': contractorId,
        'contractorSignoff.reason': reason || '',
      },
    },
    { new: true },
  );

  if (!updated) {
    throw new AttendanceError(409, 'SIGNOFF_NOT_PENDING', 'Sign-off state conflict.');
  }

  // Audit log
  await AuditLog.create({
    actor: contractorId,
    action: 'ATTENDANCE_SIGNOFF',
    entityType: 'Attendance',
    entityId: String(attendanceId),
    after: { decision, reason, at: now },
  });

  // Notify worker
  await Notification.create({
    user: attendance.worker,
    type: NOTIFICATION_TYPE.SIGNOFF_DONE,
    title: `हाज़िरी ${decision === 'APPROVED' ? 'मंज़ूर' : 'विवादित'} (Sign-off: ${decision})`,
    body: decision === 'APPROVED' ? 'ठेकेदार ने आपकी आज की हाज़िरी मंज़ूर कर दी है।' : `हाज़िरी विवादित की गई: ${reason}`,
    channel: NOTIFICATION_CHANNEL.SOCKET,
    status: NOTIFICATION_STATUS.SENT,
  });

  const io = getIO();
  if (io) {
    io.to(`user:${attendance.worker}`).emit('signoff:done', {
      attendanceId: updated._id,
      jobId: attendance.job._id,
      decision,
    });
    io.to(`job:${attendance.job._id}`).emit('signoff:done', {
      attendanceId: updated._id,
      jobId: attendance.job._id,
      decision,
    });
  }

  // Hook for Phase 5 escrow release
  await onSignoffDecision(updated, decision);

  return updated;
}

/**
 * Hook for downstream escrow integration.
 * approve -> escrow APPROVED -> release; dispute -> escrow DISPUTED.
 */
export async function onSignoffDecision(attendance, decision) {
  const jobId = attendance.job?._id || attendance.job;
  const escrow = await EscrowTransaction.findOne({
    job: jobId,
    worker: attendance.worker,
    dayDate: attendance.date,
  });

  if (!escrow) return { attendanceId: attendance._id, decision };

  if (decision === 'APPROVED') {
    return await approveAndRelease(
      escrow._id,
      attendance.contractorSignoff?.by,
      'contractor',
      'Contractor approved sign-off'
    );
  } else if (decision === 'DISPUTED') {
    return await openDispute({
      escrowId: escrow._id,
      actorId: attendance.contractorSignoff?.by,
      actorRole: 'contractor',
      reason: 'NOT_APPROVED',
      description: attendance.contractorSignoff?.reason || 'Contractor rejected attendance sign-off',
      openedFrom: DISPUTE_OPENED_FROM.CONTRACTOR_SIGNOFF,
    });
  }

  return { attendanceId: attendance._id, decision };
}

/**
 * Returns today's active assignments and attendance status for the worker home card.
 */
export async function getTodayWorkerAttendance(workerId) {
  const todayDate = getISTDateString();

  // Find assigned applications
  const assignedApps = await JobApplication.find({
    worker: workerId,
    status: 'ASSIGNED',
  }).populate('job');

  const result = [];
  for (const app of assignedApps) {
    const job = app.job;
    if (!job) continue;

    const startIST = getISTDateString(job.startDate);
    const endIST = getISTDateString(job.endDate);

    // Only include if today is within job range
    if (todayDate >= startIST && todayDate <= endIST) {
      const attendance = await Attendance.findOne({
        job: job._id,
        worker: workerId,
        date: todayDate,
      });

      result.push({
        job: {
          _id: job._id,
          title: job.title,
          skillRequired: job.skillRequired,
          wagePerDayPaise: job.wagePerDayPaise,
          workingHours: job.workingHours,
          location: job.location,
          addressText: job.addressText,
          geofenceRadiusMeters: job.geofenceRadiusMeters,
          requiresSelfie: job.requiresSelfie,
        },
        date: todayDate,
        attendanceState: attendance ? attendance.status : 'NOT_STARTED',
        attendance: attendance || null,
      });
    }
  }

  return result;
}

/**
 * Lists job attendances for a date with all assigned workers (including absentees).
 */
export async function getJobAttendanceForDate(jobId, dateInput) {
  const dateStr = dateInput || getISTDateString();
  const job = await Job.findById(jobId);
  if (!job) {
    throw new AttendanceError(404, 'NOT_FOUND', 'Job not found.');
  }

  // All assigned workers
  const applications = await JobApplication.find({
    job: jobId,
    status: 'ASSIGNED',
  }).populate('worker', 'name phone profilePhoto skills');

  const attendances = await Attendance.find({
    job: jobId,
    date: dateStr,
  });

  const attendanceMap = new Map();
  attendances.forEach((att) => {
    attendanceMap.set(String(att.worker), att);
  });

  const rows = applications.map((app) => {
    const worker = app.worker;
    const att = attendanceMap.get(String(worker?._id));

    return {
      worker: {
        _id: worker?._id,
        name: worker?.name || 'Worker',
        phone: worker?.phone ? worker.phone.replace(/(\+\d{2})(\d{5})(\d{5})/, '$1 $2-*****') : '',
        profilePhoto: worker?.profilePhoto,
        skills: worker?.skills,
      },
      date: dateStr,
      attendanceId: att?._id || null,
      status: att ? att.status : 'NOT_STARTED',
      checkInAt: att?.checkInAt || null,
      checkOutAt: att?.checkOutAt || null,
      checkInDistanceMeters: att?.checkInDistanceMeters ?? null,
      hoursWorked: att?.hoursWorked || 0,
      method: att?.method || null,
      flags: att?.flags || [],
      selfieUrl: att?.selfieUrl ? `/api/v1/attendance/${att._id}/selfie` : '',
      contractorSignoff: att?.contractorSignoff || null,
      autoCheckout: att?.autoCheckout || false,
      attendance: att || null,
    };
  });

  return {
    jobId,
    date: dateStr,
    totalAssigned: applications.length,
    checkedInCount: attendances.filter((a) => a.status === ATTENDANCE_STATUS.CHECKED_IN).length,
    checkedOutCount: attendances.filter((a) => a.status === ATTENDANCE_STATUS.CHECKED_OUT).length,
    attendances: rows,
  };
}
