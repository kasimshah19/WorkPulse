import mongoose from 'mongoose';
import Incident from '../models/Incident.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import Notification from '../models/Notification.js';
import AuditLog from '../models/AuditLog.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';
import { sendSms } from './sms/sms.service.js';
import {
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
  INCIDENT_TIMELINE_EVENT,
  LOCATION_FLAG,
  RESOLUTION_TYPE,
  JOB_CONTEXT,
  INCIDENT_VISIBILITY,
  NOTIFICATION_TYPE,
  NOTIFICATION_STATUS,
  ATTENDANCE_STATUS,
} from '../config/constants.js';

/**
 * Resolves job context for worker today (IST).
 */
export async function resolveJobContext(workerId, now) {
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  // 1. Check if worker is CHECKED_IN today on an active job
  const checkedInAttendance = await Attendance.findOne({
    worker: workerId,
    status: ATTENDANCE_STATUS.CHECKED_IN,
    date: { $gte: startOfDay, $lte: endOfDay },
  }).populate('job');

  if (checkedInAttendance && checkedInAttendance.job) {
    return {
      job: checkedInAttendance.job,
      jobContext: JOB_CONTEXT.CHECKED_IN,
    };
  }

  // 2. Check if worker is assigned to a job covering today
  const assignedJob = await Job.findOne({
    assignedWorkers: workerId,
    startDate: { $lte: endOfDay },
    endDate: { $gte: startOfDay },
  });

  if (assignedJob) {
    return {
      job: assignedJob,
      jobContext: JOB_CONTEXT.ASSIGNED_TODAY,
    };
  }

  return {
    job: null,
    jobContext: JOB_CONTEXT.NONE,
  };
}

/**
 * Append an immutable event to an incident's timeline.
 */
export async function appendTimeline(incidentId, event, byUserId = null, data = {}) {
  return await Incident.findByIdAndUpdate(
    incidentId,
    {
      $push: {
        timeline: {
          event,
          at: clock.now(),
          by: byUserId,
          data,
        },
      },
    },
    { new: true }
  );
}

/**
 * Trigger an Emergency SOS Incident.
 * Never fails for missing GPS, duplicate taps, or network retries.
 */
export async function triggerSos(workerId, payload) {
  const {
    lat,
    lng,
    accuracy,
    idempotencyKey,
    jobId,
    notifyContractor = true,
  } = payload;

  const now = clock.now();
  const worker = await User.findById(workerId);
  if (!worker) {
    const err = new Error('Worker not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // 1. Idempotency Check: Same (reportedBy, idempotencyKey)
  if (idempotencyKey) {
    const existing = await Incident.findOne({
      reportedBy: workerId,
      idempotencyKey,
    });
    if (existing) {
      return {
        incident: existing,
        alreadyExists: true,
        alerted: {
          contractor: existing.notifyContractor && Boolean(existing.job),
          coworkers: (existing.alertedUsers || []).filter((u) => u.channel === 'socket').length,
          emergencyContact: Boolean(worker.emergencyContact?.phone),
          admins: true,
        },
      };
    }
  }

  // 2. Dedupe Window: If active SOS exists within SOS_DEDUPE_WINDOW_SEC, attach update
  const dedupeCutoff = new Date(now.getTime() - env.sosDedupeWindowSec * 1000);
  const recentSos = await Incident.findOne({
    reportedBy: workerId,
    type: INCIDENT_TYPES.SOS,
    status: { $in: [INCIDENT_STATUS.OPEN, INCIDENT_STATUS.ACKNOWLEDGED] },
    createdAt: { $gte: dedupeCutoff },
  });

  if (recentSos) {
    // Append location update if coordinates provided
    if (typeof lat === 'number' && typeof lng === 'number') {
      await updateSosLocation(recentSos._id, workerId, { lat, lng, accuracy });
    }
    await appendTimeline(recentSos._id, INCIDENT_TIMELINE_EVENT.LOCATION_UPDATE, workerId, {
      note: 'Deduplicated SOS call within window',
    });
    return {
      incident: recentSos,
      alreadyExists: true,
      alerted: {
        contractor: recentSos.notifyContractor && Boolean(recentSos.job),
        coworkers: (recentSos.alertedUsers || []).filter((u) => u.channel === 'socket').length,
        emergencyContact: Boolean(worker.emergencyContact?.phone),
        admins: true,
      },
    };
  }

  // 3. Hourly Rate Limit Check: max SOS_MAX_NEW_PER_HOUR new SOS incidents
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const hourlyCount = await Incident.countDocuments({
    reportedBy: workerId,
    type: INCIDENT_TYPES.SOS,
    createdAt: { $gte: oneHourAgo },
  });

  let rateLimitedAttached = false;
  if (hourlyCount >= env.sosMaxNewPerHour) {
    const latestOpen = await Incident.findOne({
      reportedBy: workerId,
      type: INCIDENT_TYPES.SOS,
      status: { $in: [INCIDENT_STATUS.OPEN, INCIDENT_STATUS.ACKNOWLEDGED] },
    }).sort({ createdAt: -1 });

    if (latestOpen) {
      rateLimitedAttached = true;
      await appendTimeline(latestOpen._id, INCIDENT_TIMELINE_EVENT.LOCATION_UPDATE, workerId, {
        note: 'Rate limit exceeded: attached to open SOS',
      });
      return {
        incident: latestOpen,
        rateLimitedAttached: true,
        alerted: {
          contractor: latestOpen.notifyContractor && Boolean(latestOpen.job),
          coworkers: 0,
          emergencyContact: Boolean(worker.emergencyContact?.phone),
          admins: true,
        },
      };
    }
  }

  // 4. Resolve Coordinates & Location Flag
  let coordinates = [0, 0];
  let locationFlag = LOCATION_FLAG.MISSING;

  if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
    coordinates = [lng, lat];
    locationFlag = LOCATION_FLAG.OK;
  } else if (
    worker.location &&
    Array.isArray(worker.location.coordinates) &&
    (worker.location.coordinates[0] !== 0 || worker.location.coordinates[1] !== 0)
  ) {
    coordinates = worker.location.coordinates;
    locationFlag = LOCATION_FLAG.STALE;
  }

  // 5. Job Context Resolution
  let targetJob = null;
  let jobContext = JOB_CONTEXT.NONE;

  if (jobId) {
    targetJob = await Job.findById(jobId).populate('assignedWorkers contractor');
    if (targetJob) {
      const isAssigned = (targetJob.assignedWorkers || []).some(
        (w) => (w._id ? w._id.toString() : w.toString()) === workerId.toString()
      );
      if (isAssigned) {
        jobContext = JOB_CONTEXT.ASSIGNED_TODAY;
      }
    }
  }

  if (!targetJob) {
    const resolved = await resolveJobContext(workerId, now);
    targetJob = resolved.job;
    jobContext = resolved.jobContext;
    if (targetJob) {
      await targetJob.populate('assignedWorkers contractor');
    }
  }

  // 6. Create Incident Document
  const initialTimeline = [
    {
      event: INCIDENT_TIMELINE_EVENT.CREATED,
      at: now,
      by: worker._id,
      data: {
        locationFlag,
        jobContext,
        notifyContractor,
      },
    },
  ];

  const locationTrail =
    locationFlag !== LOCATION_FLAG.MISSING
      ? [{ coordinates, accuracy: accuracy || null, at: now }]
      : [];

  const incident = await Incident.create({
    reportedBy: worker._id,
    idempotencyKey: idempotencyKey || null,
    job: targetJob ? targetJob._id : null,
    type: INCIDENT_TYPES.SOS,
    severity: INCIDENT_SEVERITY.CRITICAL,
    status: INCIDENT_STATUS.OPEN,
    location: { type: 'Point', coordinates },
    locationFlag,
    locationTrail,
    timeline: initialTimeline,
    notifyContractor: Boolean(notifyContractor),
    escalationLevel: 0,
    jobContext,
    visibility: INCIDENT_VISIBILITY.ALERTED_USERS,
    alertedUsers: [],
  });

  // 7. Assemble Alert Recipients & Dispatch
  const alertedUsersToSave = [];
  const io = getIO();
  const mapsUrl =
    locationFlag !== LOCATION_FLAG.MISSING
      ? `https://maps.google.com/?q=${coordinates[1]},${coordinates[0]}`
      : 'location nahi mili';

  // a. Contractor (if notifyContractor && targetJob)
  let contractorAlerted = false;
  if (notifyContractor && targetJob && targetJob.contractor) {
    const contractor = targetJob.contractor;
    const contractorId = contractor._id.toString();

    alertedUsersToSave.push({
      user: contractor._id,
      channel: 'socket_and_sms',
      phone: contractor.phone,
      sentAt: now,
    });
    contractorAlerted = true;

    if (io) {
      io.to(`user:${contractorId}`).emit('sos:alert', {
        incidentId: incident._id,
        reporter: {
          id: worker._id,
          name: worker.name,
          phone: worker.phone,
        },
        jobId: targetJob._id,
        jobTitle: targetJob.title,
        location: { lat: coordinates[1], lng: coordinates[0] },
        locationFlag,
        accuracy,
        createdAt: incident.createdAt,
        severity: incident.severity,
        isEscalation: false,
      });
    }

    if (env.sosSmsEnabled && contractor.phone) {
      sendSms(
        contractor.phone,
        `WorkPulse SOS: Site par worker ${worker.name} ko emergency madad chahiye. Location: ${mapsUrl} . Worker number: ${worker.phone}`
      ).catch((err) => logger.error(`[SOS] Failed to send SMS to contractor: ${err.message}`));
    }
  }

  // b. Coworkers on the same job (up to SOS_MAX_COWORKERS_ALERTED)
  let coworkersCount = 0;
  if (targetJob && Array.isArray(targetJob.assignedWorkers)) {
    const otherWorkers = targetJob.assignedWorkers.filter(
      (w) => w._id.toString() !== workerId.toString()
    );

    for (const cw of otherWorkers.slice(0, env.sosMaxCoworkersAlerted)) {
      alertedUsersToSave.push({
        user: cw._id,
        channel: 'socket',
        phone: cw.phone,
        sentAt: now,
      });
      coworkersCount++;

      if (io) {
        io.to(`user:${cw._id.toString()}`).emit('sos:alert', {
          incidentId: incident._id,
          reporter: {
            id: worker._id,
            name: worker.name,
            phone: worker.phone,
          },
          jobId: targetJob._id,
          jobTitle: targetJob.title,
          location: { lat: coordinates[1], lng: coordinates[0] },
          locationFlag,
          accuracy,
          createdAt: incident.createdAt,
          severity: incident.severity,
          isEscalation: false,
        });
      }
    }
  }

  // c. Emergency Contact (SMS always)
  let emergencyContactAlerted = false;
  if (worker.emergencyContact && worker.emergencyContact.phone) {
    const ecPhone = worker.emergencyContact.phone;
    const maskedPhone = ecPhone.replace(/.(?=.{4})/g, '*');

    alertedUsersToSave.push({
      user: null,
      channel: 'sms',
      phone: maskedPhone,
      sentAt: now,
    });
    emergencyContactAlerted = true;

    if (env.sosSmsEnabled) {
      sendSms(
        ecPhone,
        `WorkPulse SOS: ${worker.name} ko madad chahiye. Location: ${mapsUrl} . Pehle 112 par call karein.`
      ).catch((err) => logger.error(`[SOS] Failed to send SMS to emergency contact: ${err.message}`));
    }
  }

  // d. Platform Admins
  if (io) {
    io.to('role:admin').emit('sos:alert', {
      incidentId: incident._id,
      reporter: {
        id: worker._id,
        name: worker.name,
        phone: worker.phone,
      },
      jobId: targetJob ? targetJob._id : null,
      jobTitle: targetJob ? targetJob.title : 'Off-site / No active job',
      location: { lat: coordinates[1], lng: coordinates[0] },
      locationFlag,
      accuracy,
      createdAt: incident.createdAt,
      severity: incident.severity,
      isEscalation: false,
    });
  }

  // e. Nearby Volunteers (Opt-in privacy feature, default off)
  if (env.sosNearbyVolunteers && locationFlag !== LOCATION_FLAG.MISSING) {
    try {
      const radiusMeters = env.sosNearbyRadiusKm * 1000;
      const nearbyWorkers = await User.find({
        _id: { $ne: worker._id },
        role: 'worker',
        isAvailable: true,
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: radiusMeters,
          },
        },
      })
        .limit(env.sosNearbyMax)
        .select('_id name phone');

      for (const vol of nearbyWorkers) {
        if (!alertedUsersToSave.some((u) => u.user && u.user.toString() === vol._id.toString())) {
          alertedUsersToSave.push({
            user: vol._id,
            channel: 'volunteer_socket',
            sentAt: now,
          });

          if (io) {
            // Privacy rule: first name only, no phone number!
            const firstName = worker.name ? worker.name.split(' ')[0] : 'Ek worker';
            io.to(`user:${vol._id.toString()}`).emit('sos:alert', {
              incidentId: incident._id,
              reporter: {
                id: worker._id,
                name: firstName,
                phone: null, // Hidden for volunteers
              },
              location: { lat: coordinates[1], lng: coordinates[0] },
              locationFlag,
              createdAt: incident.createdAt,
              severity: incident.severity,
              isVolunteerAlert: true,
            });
          }
        }
      }
    } catch (volErr) {
      logger.warn(`[SOS] Nearby volunteer lookup failed: ${volErr.message}`);
    }
  }

  // Persist Alerted Users
  incident.alertedUsers = alertedUsersToSave;
  await incident.save();

  // Timeline entry for ALERTED
  await appendTimeline(incident._id, INCIDENT_TIMELINE_EVENT.ALERTED, null, {
    contractorAlerted,
    coworkersCount,
    emergencyContactAlerted,
  });

  return {
    incident,
    alreadyExists: false,
    alerted: {
      contractor: contractorAlerted,
      coworkers: coworkersCount,
      emergencyContact: emergencyContactAlerted,
      admins: true,
    },
  };
}

/**
 * Update live location trail for an active SOS incident.
 */
export async function updateSosLocation(incidentId, reporterId, { lat, lng, accuracy }) {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    const err = new Error('Incident not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (incident.reportedBy.toString() !== reporterId.toString()) {
    const err = new Error('Only the reporter can update incident location');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (incident.status === INCIDENT_STATUS.RESOLVED) {
    const err = new Error('Cannot update location for a resolved incident');
    err.status = 409;
    err.code = 'INCIDENT_CLOSED';
    throw err;
  }

  const now = clock.now();
  const trail = incident.locationTrail || [];

  // Minimum interval check (5s)
  if (trail.length > 0) {
    const lastPoint = trail[trail.length - 1];
    const diffSec = (now.getTime() - new Date(lastPoint.at).getTime()) / 1000;
    if (diffSec < env.sosLocationMinIntervalSec) {
      return { ignored: true, reason: 'RATE_LIMITED' };
    }
  }

  const newPoint = {
    coordinates: [lng, lat],
    accuracy: accuracy || null,
    at: now,
  };

  // Push with $slice to enforce SOS_LOCATION_TRAIL_MAX
  const updated = await Incident.findByIdAndUpdate(
    incidentId,
    {
      $set: {
        location: { type: 'Point', coordinates: [lng, lat] },
        locationFlag: LOCATION_FLAG.OK,
      },
      $push: {
        locationTrail: {
          $each: [newPoint],
          $slice: -env.sosLocationTrailMax,
        },
      },
    },
    { new: true }
  );

  // Broadcast to alerted user rooms
  const io = getIO();
  if (io && updated) {
    for (const au of updated.alertedUsers || []) {
      if (au.user) {
        io.to(`user:${au.user.toString()}`).emit('sos:location', {
          incidentId,
          lat,
          lng,
          accuracy,
          at: now,
        });
      }
    }
    io.to('role:admin').emit('sos:location', {
      incidentId,
      lat,
      lng,
      accuracy,
      at: now,
    });
  }

  return { success: true, updated };
}

/**
 * Acknowledge an active SOS incident.
 */
export async function acknowledgeSos(incidentId, userId, userRole) {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    const err = new Error('Incident not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (incident.status === INCIDENT_STATUS.RESOLVED) {
    const err = new Error('Incident is already resolved');
    err.status = 409;
    err.code = 'INCIDENT_CLOSED';
    throw err;
  }

  const isAlerted = (incident.alertedUsers || []).some(
    (u) => u.user && u.user.toString() === userId.toString()
  );
  const isAdmin = userRole === 'admin';

  if (!isAlerted && !isAdmin) {
    const err = new Error('You are not authorized to acknowledge this incident');
    err.status = 403;
    err.code = 'NOT_ALERTED_USER';
    throw err;
  }

  const now = clock.now();
  const ackUser = await User.findById(userId).select('name role');

  // Update ack time for user and transition status OPEN -> ACKNOWLEDGED
  await Incident.updateOne(
    {
      _id: incidentId,
      'alertedUsers.user': userId,
      'alertedUsers.ackAt': null,
    },
    {
      $set: {
        'alertedUsers.$.ackAt': now,
        status: INCIDENT_STATUS.ACKNOWLEDGED,
      },
    }
  );

  // Ensure incident status moves to ACKNOWLEDGED even if admin was not in alertedUsers
  if (incident.status === INCIDENT_STATUS.OPEN) {
    await Incident.findByIdAndUpdate(incidentId, {
      $set: { status: INCIDENT_STATUS.ACKNOWLEDGED },
    });
  }

  await appendTimeline(incidentId, INCIDENT_TIMELINE_EVENT.ACKNOWLEDGED, userId, {
    byName: ackUser?.name,
    byRole: ackUser?.role,
  });

  // Notify reporter
  await Notification.create({
    user: incident.reportedBy,
    type: NOTIFICATION_TYPE.SOS_ACK,
    title: 'Madad aa rahi hai!',
    body: `${ackUser?.name || 'Ek sadasya'} ne aapka SOS dekh liya hai aur madad ke liye aa rahe hain.`,
    data: { incidentId },
    status: NOTIFICATION_STATUS.SENT,
  });

  const io = getIO();
  if (io) {
    io.to(`user:${incident.reportedBy.toString()}`).emit('sos:acknowledged', {
      incidentId,
      byName: ackUser?.name,
      byRole: ackUser?.role,
      at: now,
    });
  }

  return await Incident.findById(incidentId);
}

/**
 * Resolve an incident (SOS or site report).
 */
export async function resolveSos(incidentId, userId, userRole, { resolutionType, notes = '' }) {
  const incident = await Incident.findById(incidentId);
  if (!incident) {
    const err = new Error('Incident not found');
    err.status = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Idempotent resolution
  if (incident.status === INCIDENT_STATUS.RESOLVED) {
    return incident;
  }

  const isReporter = incident.reportedBy.toString() === userId.toString();
  const isAdmin = userRole === 'admin';
  const isJobContractor =
    incident.job &&
    (await Job.exists({ _id: incident.job, contractor: userId }));

  if (!isReporter && !isAdmin && !isJobContractor) {
    const err = new Error('You are not authorized to resolve this incident');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  // Role resolution permissions:
  // Reporter may only use SELF_SAFE or OTHER
  if (isReporter && !isAdmin && !isJobContractor) {
    if (![RESOLUTION_TYPE.SELF_SAFE, RESOLUTION_TYPE.OTHER].includes(resolutionType)) {
      const err = new Error("Workers may only resolve as 'SELF_SAFE' or 'OTHER'");
      err.status = 400;
      err.code = 'INVALID_RESOLUTION_TYPE';
      throw err;
    }
  }

  const now = clock.now();
  const updated = await Incident.findOneAndUpdate(
    { _id: incidentId, status: { $ne: INCIDENT_STATUS.RESOLVED } },
    {
      $set: {
        status: INCIDENT_STATUS.RESOLVED,
        resolvedAt: now,
        resolvedBy: userId,
        resolutionType: resolutionType || RESOLUTION_TYPE.OTHER,
        resolutionNotes: notes.trim(),
      },
    },
    { new: true }
  );

  if (!updated) {
    return incident;
  }

  await appendTimeline(incidentId, INCIDENT_TIMELINE_EVENT.RESOLVED, userId, {
    resolutionType,
    notes,
  });

  await AuditLog.create({
    action: 'INCIDENT_RESOLVED',
    actor: userId,
    target: incidentId,
    targetModel: 'Incident',
    details: { resolutionType, notes },
  });

  // Notify alerted users
  const io = getIO();
  if (io) {
    for (const au of updated.alertedUsers || []) {
      if (au.user) {
        io.to(`user:${au.user.toString()}`).emit('sos:resolved', {
          incidentId,
          resolutionType,
        });
      }
    }
    io.to(`user:${updated.reportedBy.toString()}`).emit('sos:resolved', {
      incidentId,
      resolutionType,
    });
    io.to('role:admin').emit('sos:resolved', {
      incidentId,
      resolutionType,
    });
  }

  return updated;
}
