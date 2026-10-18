import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Notification from '../models/Notification.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { haversineDistance } from '../utils/geo.js';
import { sendSms } from './sms/sms.service.js';
import { getIO, registerFallbackTimer, activeFallbackTimers } from '../sockets/index.js';

/**
 * Ensure 2dsphere geospatial indexes exist on startup.
 */
export const ensureGeoIndexes = async () => {
  try {
    await User.init();
    await Job.init();

    const userIndexes = await User.collection.indexes();
    const hasUser2dSphere = userIndexes.some((idx) =>
      Object.values(idx.key || {}).includes('2dsphere')
    );

    const jobIndexes = await Job.collection.indexes();
    const hasJob2dSphere = jobIndexes.some((idx) =>
      Object.values(idx.key || {}).includes('2dsphere')
    );

    if (!hasUser2dSphere || !hasJob2dSphere) {
      throw new Error(
        `CRITICAL: Missing 2dsphere index! User 2dsphere: ${hasUser2dSphere}, Job 2dsphere: ${hasJob2dSphere}`
      );
    }

    logger.info('✅ 2dsphere geospatial indexes verified on User and Job collections.');
  } catch (err) {
    logger.error(`❌ GeoIndex initialization failed: ${err.message}`);
    throw err;
  }
};

/**
 * Find available matching workers within the job's radius.
 *
 * @param {object} job - Target job document
 * @returns {Promise<Array<{ worker: object, distanceMeters: number }>>}
 */
export const findMatchingWorkers = async (job) => {
  const radiusMeters = (job.matchRadiusKm || 5) * 1000;
  const jobLat = job.location.coordinates[1];
  const jobLng = job.location.coordinates[0];

  // 1. Exclude workers who have an overlapping ASSIGNED job
  const overlappingJobs = await Job.find({
    _id: { $ne: job._id },
    status: { $in: ['OPEN', 'FILLED', 'IN_PROGRESS'] },
    startDate: { $lte: job.endDate },
    endDate: { $gte: job.startDate },
  }).select('_id');

  const busyWorkerIds = await JobApplication.distinct('worker', {
    job: { $in: overlappingJobs.map((j) => j._id) },
    status: 'ASSIGNED',
  });

  // 2. Query available workers matching skill and radius
  const workers = await User.find({
    role: 'worker',
    isActive: true,
    isAvailable: true,
    skills: job.skillRequired,
    _id: { $ne: job.contractor, $nin: busyWorkerIds },
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [jobLng, jobLat], // [lng, lat]
        },
        $maxDistance: radiusMeters,
      },
    },
  })
    .limit(env.maxWorkersNotifiedPerJob)
    .lean();

  // 3. Attach exact distance in metres
  return workers.map((worker) => {
    const workerLng = worker.location.coordinates[0];
    const workerLat = worker.location.coordinates[1];
    const distanceMeters = Math.round(
      haversineDistance(jobLat, jobLng, workerLat, workerLng)
    );
    return { worker, distanceMeters };
  });
};

/**
 * Notify matched workers via Socket.io with delayed SMS fallback,
 * or immediate SMS if the worker is offline.
 *
 * @param {object} job - Target job document
 * @param {Array<{ worker: object, distanceMeters: number }>} matchedWorkers
 * @returns {Promise<{ notified: number, viaSocket: number, viaSms: number }>}
 */
export const notifyWorkers = async (job, matchedWorkers) => {
  let viaSocket = 0;
  let viaSms = 0;
  let io = null;

  try {
    io = getIO();
  } catch (_e) {
    logger.warn('Socket.io not ready, falling back to SMS only.');
  }

  for (const { worker, distanceMeters } of matchedWorkers) {
    const workerRoom = `user:${worker._id.toString()}`;
    let hasLiveSocket = false;

    if (io) {
      try {
        const liveSockets = await io.in(workerRoom).fetchSockets();
        hasLiveSocket = liveSockets && liveSockets.length > 0;
      } catch (err) {
        logger.warn(`Error fetching sockets for ${workerRoom}: ${err.message}`);
      }
    }

    const notifiedVia = hasLiveSocket ? 'socket' : 'sms';

    // 1. Upsert JobApplication record
    await JobApplication.findOneAndUpdate(
      { job: job._id, worker: worker._id },
      {
        $setOnInsert: {
          job: job._id,
          worker: worker._id,
          status: 'NOTIFIED',
          notifiedAt: new Date(),
          notifiedVia,
        },
      },
      { upsert: true, new: true }
    );

    // 2. Create in-app Notification record
    const wageInRupees = Math.round(job.wagePerDayPaise / 100);
    const distanceKm = (distanceMeters / 1000).toFixed(1);

    await Notification.create({
      user: worker._id,
      type: 'JOB_MATCH',
      title: 'Naya Kaam Mila (New Job Match)',
      body: `Naya Kaam: ${job.skillRequired}, ₹${wageInRupees}/din, ${distanceKm} km door`,
      data: { jobId: job._id },
      channel: notifiedVia,
      status: 'SENT',
      sentAt: new Date(),
    });

    const smsText = `WorkPulse: naya kaam - ${job.skillRequired}, Rs${wageInRupees}/din, ${distanceKm} km door. Dekhne ke liye: ${env.appPublicUrl}/worker/jobs/${job._id}`;

    if (hasLiveSocket && io) {
      // Dispatch via Socket
      viaSocket++;
      io.to(workerRoom).emit('job:new', {
        jobId: job._id,
        title: job.title,
        skillRequired: job.skillRequired,
        wagePerDayPaise: job.wagePerDayPaise,
        distanceMeters,
        startDate: job.startDate,
        endDate: job.endDate,
        addressText: job.addressText,
      });

      // Register delayed SMS fallback
      // TODO: In production, delayed fallback should use a persistent queue like BullMQ.
      const timer = setTimeout(async () => {
        activeFallbackTimers.delete(`${job._id}_${worker._id}`);
        logger.info(
          `⏱️ SMS fallback triggered for worker ${worker.phone} (no socket ack within ${env.smsFallbackDelaySec}s)`
        );
        await sendSms(worker.phone, smsText);
        await JobApplication.updateOne(
          { job: job._id, worker: worker._id, status: 'NOTIFIED' },
          { notifiedVia: 'sms' }
        );
      }, env.smsFallbackDelaySec * 1000);

      registerFallbackTimer(job._id.toString(), worker._id.toString(), timer);
    } else {
      // Offline worker: Send SMS immediately
      viaSms++;
      await sendSms(worker.phone, smsText);
    }
  }

  return {
    notified: matchedWorkers.length,
    viaSocket,
    viaSms,
  };
};
