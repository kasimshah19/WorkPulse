import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import AuditLog from '../models/AuditLog.js';
import Notification from '../models/Notification.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';
import { saveIncidentPhoto, resolveIncidentPhotoPath } from './storage.service.js';
import { appendTimeline } from './sos.service.js';
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_TIMELINE_EVENT,
  INCIDENT_VISIBILITY,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  ATTENDANCE_STATUS,
} from '../config/constants.js';

/**
 * Creates a site incident report (INJURY, HARASSMENT, DISPUTE, OTHER).
 */
export async function createIncident(reporterId, userRole, payload, files = []) {
  const {
    type,
    severity = INCIDENT_SEVERITY.MEDIUM,
    description,
    jobId,
    accusedUserId,
    lat,
    lng,
  } = payload;

  if (!description || description.trim().length < 10) {
    const err = new Error('Description must be at least 10 characters long');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  // Validate Job relationship
  let job = null;
  if (jobId) {
    job = await Job.findById(jobId).populate('contractor');
    if (!job) {
      const err = new Error('Job not found');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (userRole === 'worker') {
      const isAssigned = (job.assignedWorkers || []).some(
        (w) => (w._id ? w._id.toString() : w.toString()) === reporterId.toString()
      );
      if (!isAssigned) {
        const err = new Error('You are not assigned to this job');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    } else if (userRole === 'contractor') {
      const contractorId = job.contractor._id ? job.contractor._id.toString() : job.contractor.toString();
      if (contractorId !== reporterId.toString()) {
        const err = new Error('You do not own this job');
        err.status = 403;
        err.code = 'FORBIDDEN';
        throw err;
      }
    }
  }

  // Determine Visibility:
  // HARASSMENT and DISPUTE are strictly ADMIN_ONLY so the contractor/coworkers cannot see them or retaliate.
  const isSensitive = [INCIDENT_TYPES.HARASSMENT, INCIDENT_TYPES.DISPUTE].includes(type);
  const visibility = isSensitive ? INCIDENT_VISIBILITY.ADMIN_ONLY : INCIDENT_VISIBILITY.ALERTED_USERS;

  // Process Photos (up to INCIDENT_PHOTO_MAX)
  const photoPaths = [];
  if (Array.isArray(files) && files.length > 0) {
    if (files.length > env.incidentPhotoMax) {
      const err = new Error(`Maximum ${env.incidentPhotoMax} photos allowed`);
      err.status = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const tempIncidentId = new mongoose.Types.ObjectId();
    for (const file of files) {
      const saved = await saveIncidentPhoto({
        buffer: file.buffer,
        incidentId: tempIncidentId.toString(),
      });
      photoPaths.push(saved.relativePath);
    }
  }

  const now = clock.now();
  let coordinates = [0, 0];
  if (typeof lat === 'number' && typeof lng === 'number') {
    coordinates = [lng, lat];
  }

  const alertedUsers = [];
  // If ALERTED_USERS visibility, alert the job contractor
  if (visibility === INCIDENT_VISIBILITY.ALERTED_USERS && job && job.contractor) {
    alertedUsers.push({
      user: job.contractor._id,
      channel: 'socket',
      sentAt: now,
    });
  }

  const incident = await Incident.create({
    reportedBy: reporterId,
    job: job ? job._id : null,
    type,
    severity,
    description: description.trim(),
    photos: photoPaths,
    location: { type: 'Point', coordinates },
    accusedUser: accusedUserId || null,
    visibility,
    status: INCIDENT_STATUS.OPEN,
    alertedUsers,
    timeline: [
      {
        event: INCIDENT_TIMELINE_EVENT.CREATED,
        at: now,
        by: reporterId,
        data: { type, severity, visibility },
      },
    ],
  });

  // Socket notification
  const io = getIO();
  if (io) {
    // Admins always receive incident alerts
    io.to('role:admin').emit('incident:new', {
      incidentId: incident._id,
      type,
      severity,
      jobId: job ? job._id : null,
      visibility,
    });

    // Contractor alerted only if visibility is ALERTED_USERS
    if (visibility === INCIDENT_VISIBILITY.ALERTED_USERS && job && job.contractor) {
      io.to(`user:${job.contractor._id.toString()}`).emit('incident:new', {
        incidentId: incident._id,
        type,
        severity,
        jobId: job._id,
      });
    }
  }

  return incident;
}

/**
 * Returns incidents reported by the given user.
 */
export async function getMyIncidents(userId, { status, type, page = 1, limit = 20 } = {}) {
  const filter = { reportedBy: userId };
  if (status) filter.status = status;
  if (type) filter.type = type;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const items = await Incident.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .populate('job', 'title location')
    .lean();

  const total = await Incident.countDocuments(filter);
  return { items, total, page: parseInt(page, 10) };
}

/**
 * Returns incidents for a contractor's job.
 * Privacy rule: HARASSMENT and DISPUTE (ADMIN_ONLY) NEVER appear here.
 */
export async function getJobIncidents(contractorId, jobId) {
  const job = await Job.findById(jobId);
  if (!job) {
    const err = new Error('Job not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const ownerId = job.contractor._id ? job.contractor._id.toString() : job.contractor.toString();
  if (ownerId !== contractorId.toString()) {
    const err = new Error('You do not own this job');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  return await Incident.find({
    job: jobId,
    visibility: INCIDENT_VISIBILITY.ALERTED_USERS,
  })
    .sort({ createdAt: -1 })
    .populate('reportedBy', 'name phone role')
    .lean();
}

/**
 * Get incident detail by ID with strict visibility and participant checks.
 */
export async function getIncidentById(incidentId, user) {
  const incident = await Incident.findById(incidentId)
    .populate('reportedBy', 'name phone role')
    .populate('accusedUser', 'name role')
    .populate('job', 'title location contractor')
    .populate('timeline.by', 'name role')
    .populate('alertedUsers.user', 'name role phone');

  if (!incident) {
    const err = new Error('Incident not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const userId = user._id ? user._id.toString() : user.id.toString();
  const isAdmin = user.role === 'admin';
  const isReporter = incident.reportedBy && incident.reportedBy._id.toString() === userId;

  // If ADMIN_ONLY, only reporter and admin can view
  if (incident.visibility === INCIDENT_VISIBILITY.ADMIN_ONLY) {
    if (!isAdmin && !isReporter) {
      const err = new Error('Incident not found or unauthorized');
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
  } else {
    // ALERTED_USERS: reporter, admin, or alerted user
    const isAlerted = (incident.alertedUsers || []).some(
      (u) => u.user && u.user._id.toString() === userId
    );
    const isJobContractor =
      incident.job &&
      incident.job.contractor &&
      incident.job.contractor.toString() === userId;

    if (!isAdmin && !isReporter && !isAlerted && !isJobContractor) {
      const err = new Error('Unauthorized to view this incident');
      err.status = 403;
      err.code = 'FORBIDDEN';
      throw err;
    }
  }

  return incident;
}

/**
 * Returns full path of an authenticated incident photo with access check.
 */
export async function getIncidentPhotoPath(incidentId, index, user) {
  const incident = await getIncidentById(incidentId, user);
  const photos = incident.photos || [];
  const idx = parseInt(index, 10);

  if (isNaN(idx) || idx < 0 || idx >= photos.length) {
    const err = new Error('Photo not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  return resolveIncidentPhotoPath(photos[idx]);
}

/**
 * Admin action: Appends a note to incident timeline.
 */
export async function addAdminNote(incidentId, adminId, text) {
  if (!text || text.trim().length < 2) {
    const err = new Error('Note text is required');
    err.status = 400;
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const updated = await appendTimeline(incidentId, INCIDENT_TIMELINE_EVENT.NOTE, adminId, {
    note: text.trim(),
  });

  if (!updated) {
    const err = new Error('Incident not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  await AuditLog.create({
    action: 'ADMIN_INCIDENT_NOTE',
    actor: adminId,
    target: incidentId,
    targetModel: 'Incident',
    details: { text },
  });

  return updated;
}

/**
 * Admin: Query incidents list with filters (CRITICAL and SOS first).
 */
export async function getAdminIncidents({ status, severity, type, page = 1, limit = 20 } = {}) {
  const filter = {};
  if (status) filter.status = status;
  if (severity) filter.severity = severity;
  if (type) filter.type = type;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  // Custom sort: open/critical first, then oldest open
  const items = await Incident.find(filter)
    .sort({
      status: 1, // 'OPEN' comes before 'RESOLVED' alphabetically
      createdAt: -1,
    })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .populate('reportedBy', 'name phone role')
    .populate('job', 'title location')
    .lean();

  const total = await Incident.countDocuments(filter);
  return { items, total, page: parseInt(page, 10) };
}

/**
 * Admin: Comprehensive Safety & Incident Statistics.
 */
export async function getAdminSafetyStats() {
  const [
    totalCount,
    sosCount,
    injuryCount,
    harassmentCount,
    disputeCount,
    otherCount,
    openCount,
    ackCount,
    resolvedCount,
    criticalCount,
  ] = await Promise.all([
    Incident.countDocuments(),
    Incident.countDocuments({ type: INCIDENT_TYPES.SOS }),
    Incident.countDocuments({ type: INCIDENT_TYPES.INJURY }),
    Incident.countDocuments({ type: INCIDENT_TYPES.HARASSMENT }),
    Incident.countDocuments({ type: INCIDENT_TYPES.DISPUTE }),
    Incident.countDocuments({ type: INCIDENT_TYPES.OTHER }),
    Incident.countDocuments({ status: INCIDENT_STATUS.OPEN }),
    Incident.countDocuments({ status: INCIDENT_STATUS.ACKNOWLEDGED }),
    Incident.countDocuments({ status: INCIDENT_STATUS.RESOLVED }),
    Incident.countDocuments({ severity: INCIDENT_SEVERITY.CRITICAL }),
  ]);

  // False Alarm Rate
  const falseAlarmCount = await Incident.countDocuments({
    resolutionType: 'FALSE_ALARM',
  });
  const falseAlarmRate =
    resolvedCount > 0 ? parseFloat(((falseAlarmCount / resolvedCount) * 100).toFixed(2)) : 0;

  // Escalation Rate
  const escalatedCount = await Incident.countDocuments({
    escalationLevel: { $gt: 0 },
  });
  const escalationRate =
    sosCount > 0 ? parseFloat(((escalatedCount / sosCount) * 100).toFixed(2)) : 0;

  // Calculate Median Ack Time for SOS incidents
  const acknowledgedSosIncidents = await Incident.find({
    type: INCIDENT_TYPES.SOS,
    status: { $in: [INCIDENT_STATUS.ACKNOWLEDGED, INCIDENT_STATUS.RESOLVED] },
    'alertedUsers.ackAt': { $ne: null },
  }).select('createdAt alertedUsers');

  const ackDurationsSec = [];
  for (const inc of acknowledgedSosIncidents) {
    const acks = (inc.alertedUsers || [])
      .filter((u) => u.ackAt)
      .map((u) => (new Date(u.ackAt).getTime() - new Date(inc.createdAt).getTime()) / 1000);
    if (acks.length > 0) {
      ackDurationsSec.push(Math.min(...acks));
    }
  }

  ackDurationsSec.sort((a, b) => a - b);
  let medianAckSec = 0;
  let p90AckSec = 0;
  if (ackDurationsSec.length > 0) {
    const mid = Math.floor(ackDurationsSec.length / 2);
    medianAckSec =
      ackDurationsSec.length % 2 !== 0
        ? ackDurationsSec[mid]
        : (ackDurationsSec[mid - 1] + ackDurationsSec[mid]) / 2;
    const p90Idx = Math.floor(ackDurationsSec.length * 0.9);
    p90AckSec = ackDurationsSec[Math.min(p90Idx, ackDurationsSec.length - 1)];
  }

  // Incidents per 100 worker-days platform-wide
  const totalCheckedOutDays = await Attendance.countDocuments({
    status: ATTENDANCE_STATUS.CHECKED_OUT,
  });
  const incidentsPer100Days =
    totalCheckedOutDays > 0
      ? parseFloat(((totalCount / totalCheckedOutDays) * 100).toFixed(2))
      : 0;

  return {
    totals: {
      totalCount,
      openCount,
      ackCount,
      resolvedCount,
      criticalCount,
    },
    types: {
      sos: sosCount,
      injury: injuryCount,
      harassment: harassmentCount,
      dispute: disputeCount,
      other: otherCount,
    },
    metrics: {
      medianAckSec: Math.round(medianAckSec),
      p90AckSec: Math.round(p90AckSec),
      escalationRate,
      falseAlarmRate,
      incidentsPer100Days,
      totalCheckedOutDays,
    },
  };
}
