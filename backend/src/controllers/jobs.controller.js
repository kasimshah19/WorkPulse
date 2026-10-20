import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Notification from '../models/Notification.js';
import { findMatchingWorkers, notifyWorkers } from '../services/matching.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { haversineDistance } from '../utils/geo.js';
import { getIO } from '../sockets/index.js';
import logger from '../utils/logger.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import { ESCROW_STATUS } from '../config/constants.js';
import { createEscrowForAssignment, refund, transition } from '../services/escrow.service.js';

/**
 * POST /api/v1/jobs
 * Contractor creates a new job as DRAFT.
 */
export const createJob = async (req, res) => {
  const {
    title,
    description,
    skillRequired,
    workersNeeded = 1,
    wagePerDayPaise,
    startDate,
    endDate,
    workingHours = { start: '09:00', end: '18:00' },
    location, // { lat, lng }
    addressText,
    geofenceRadiusMeters = 100,
    matchRadiusKm = 5,
    requiresSelfie = true,
  } = req.body;

  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  const totalDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);

  // GeoJSON coordinates strictly [longitude, latitude]
  const geoPoint = {
    type: 'Point',
    coordinates: [location.lng, location.lat],
  };

  const job = await Job.create({
    contractor: req.user._id,
    title,
    description,
    skillRequired,
    workersNeeded,
    workersAssignedCount: 0,
    wagePerDayPaise,
    startDate: start,
    endDate: end,
    totalDays,
    workingHours,
    location: geoPoint,
    addressText,
    geofenceRadiusMeters,
    matchRadiusKm,
    status: 'DRAFT',
    requiresSelfie,
    createdVia: 'app',
  });

  return sendSuccess(res, 201, job);
};

/**
 * PATCH /api/v1/jobs/:id
 * Update job (Owner only, allowed only in DRAFT or OPEN with 0 assigned workers).
 */
export const updateJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString()) {
    return sendError(res, 403, 'You do not own this job', 'FORBIDDEN');
  }

  if (job.status !== 'DRAFT' && !(job.status === 'OPEN' && job.workersAssignedCount === 0)) {
    return sendError(
      res,
      400,
      'Jobs can only be updated while in DRAFT status, or OPEN with 0 workers assigned',
      'CANNOT_EDIT_JOB'
    );
  }

  const updates = { ...req.body };
  if (updates.location) {
    updates.location = {
      type: 'Point',
      coordinates: [updates.location.lng, updates.location.lat],
    };
  }

  const updatedJob = await Job.findByIdAndUpdate(
    job._id,
    { $set: updates },
    { new: true, runValidators: true }
  );

  return sendSuccess(res, 200, updatedJob);
};

/**
 * POST /api/v1/jobs/:id/publish
 * Owner contractor publishes job DRAFT -> OPEN and dispatches geo-matching.
 * Idempotent: publishing twice will not re-notify workers.
 */
export const publishJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString()) {
    return sendError(res, 403, 'You do not own this job', 'FORBIDDEN');
  }

  // Idempotency: If already published, return current state without re-notifying
  if (job.status === 'OPEN') {
    const existingNotified = await JobApplication.countDocuments({ job: job._id });
    return sendSuccess(res, 200, {
      job,
      matching: {
        notified: existingNotified,
        viaSocket: 0,
        viaSms: 0,
        alreadyPublished: true,
      },
    });
  }

  if (job.status !== 'DRAFT') {
    return sendError(res, 400, `Cannot publish job with status '${job.status}'`, 'INVALID_STATUS');
  }

  // 1. Transition status to OPEN
  job.status = 'OPEN';
  await job.save();

  // 2. Execute geospatial matching
  const matchedWorkers = await findMatchingWorkers(job);

  // 3. Dispatch socket/SMS notifications
  const matchResult = await notifyWorkers(job, matchedWorkers);

  return sendSuccess(res, 200, {
    job,
    matching: matchResult,
  });
};

/**
 * POST /api/v1/jobs/:id/cancel
 * Contractor cancels job.
 */
export const cancelJob = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString()) {
    return sendError(res, 403, 'You do not own this job', 'FORBIDDEN');
  }

  if (!['DRAFT', 'OPEN', 'FILLED'].includes(job.status)) {
    return sendError(res, 400, `Cannot cancel job in status '${job.status}'`, 'INVALID_STATUS');
  }

  // Phase 5: Block cancel if any day is CHECKED_IN or CHECKED_OUT and unresolved
  const activeWorkRows = await EscrowTransaction.find({
    job: job._id,
    status: { $in: [ESCROW_STATUS.CHECKED_IN, ESCROW_STATUS.CHECKED_OUT] },
  });

  if (activeWorkRows.length > 0) {
    return sendError(
      res,
      409,
      'Cannot cancel job while workers have active or unapproved shifts.',
      'JOB_HAS_ACTIVE_WORK'
    );
  }

  // Handle escrow cancellation / refunds for all rows of this job
  const allJobEscrows = await EscrowTransaction.find({ job: job._id });
  for (const row of allJobEscrows) {
    if (row.status === ESCROW_STATUS.FUNDED) {
      await refund(row._id, req.user._id, 'contractor', 'Job cancelled by contractor', ESCROW_STATUS.CANCELLED);
    } else if (row.status === ESCROW_STATUS.CREATED) {
      await transition(row._id, ESCROW_STATUS.CANCELLED, {
        actor: req.user._id,
        actorRole: 'contractor',
        reason: 'Job cancelled by contractor',
      });
    }
  }

  job.status = 'CANCELLED';
  await job.save();

  // Mark all active applications as EXPIRED
  const applications = await JobApplication.find({
    job: job._id,
    status: { $in: ['NOTIFIED', 'ACCEPTED', 'ASSIGNED'] },
  });

  await JobApplication.updateMany(
    { job: job._id, status: { $in: ['NOTIFIED', 'ACCEPTED'] } },
    { $set: { status: 'EXPIRED' } }
  );

  // Emit real-time cancellation alert
  try {
    const io = getIO();
    for (const app of applications) {
      io.to(`user:${app.worker.toString()}`).emit('job:cancelled', { jobId: job._id });
    }
  } catch (_e) {}

  return sendSuccess(res, 200, job);
};

/**
 * GET /api/v1/jobs/my
 * Contractor lists their posted jobs with applicant/assigned counts.
 */
export const getMyJobs = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { contractor: req.user._id };

  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await Job.countDocuments(filter);
  const jobs = await Job.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  // Attach application counts
  const jobIds = jobs.map((j) => j._id);
  const applications = await JobApplication.find({ job: { $in: jobIds } }).lean();

  const enrichedJobs = jobs.map((job) => {
    const jobApps = applications.filter((a) => a.job.toString() === job._id.toString());
    return {
      ...job,
      applicantCounts: {
        notified: jobApps.filter((a) => a.status === 'NOTIFIED').length,
        accepted: jobApps.filter((a) => a.status === 'ACCEPTED').length,
        assigned: jobApps.filter((a) => a.status === 'ASSIGNED').length,
        rejected: jobApps.filter((a) => a.status === 'REJECTED').length,
      },
    };
  });

  return sendSuccess(res, 200, enrichedJobs, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    totalPages: Math.ceil(total / limit),
  });
};

/**
 * GET /api/v1/jobs/nearby
 * Worker discovers available jobs near their saved coordinates using $geoNear.
 */
export const getNearbyJobs = async (req, res) => {
  const user = req.user;

  if (
    !user.location ||
    !user.location.coordinates ||
    (user.location.coordinates[0] === 0 && user.location.coordinates[1] === 0)
  ) {
    return sendError(
      res,
      400,
      'Worker location is required to search nearby jobs. Set your location in profile.',
      'LOCATION_REQUIRED'
    );
  }

  const radiusKm = parseFloat(req.query.radiusKm) || 5;
  const radiusMeters = radiusKm * 1000;
  const skillsToMatch = req.query.skill
    ? [req.query.skill]
    : user.skills && user.skills.length > 0
    ? user.skills
    : [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const matchConditions = {
    status: 'OPEN',
    endDate: { $gte: todayStart },
  };

  if (skillsToMatch.length > 0) {
    matchConditions.skillRequired = { $in: skillsToMatch };
  }

  // MongoDB Aggregation with $geoNear as the FIRST stage
  const pipeline = [
    {
      $geoNear: {
        near: user.location,
        distanceField: 'distanceMeters',
        spherical: true,
        maxDistance: radiusMeters,
        key: 'location',
        query: matchConditions,
      },
    },
    { $sort: { distanceMeters: 1 } },
  ];

  const jobs = await Job.aggregate(pipeline);

  // Check application status for each job for this worker
  const jobIds = jobs.map((j) => j._id);
  const myApplications = await JobApplication.find({
    job: { $in: jobIds },
    worker: user._id,
  }).lean();

  const myAppMap = new Map(
    myApplications.map((app) => [app.job.toString(), app.status])
  );

  const result = jobs.map((job) => ({
    ...job,
    distanceMeters: Math.round(job.distanceMeters),
    myApplicationStatus: myAppMap.get(job._id.toString()) || null,
  }));

  return sendSuccess(res, 200, result);
};

/**
 * GET /api/v1/jobs/:id
 * Retrieve details of a job.
 * Access allowed for owner contractor, assigned worker, or notified worker.
 */
export const getJobById = async (req, res) => {
  const job = await Job.findById(req.params.id).populate('contractor', 'name phone').lean();

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  const isContractor = job.contractor._id.toString() === req.user._id.toString();
  let isNotifiedOrAssigned = false;

  if (!isContractor) {
    const app = await JobApplication.findOne({
      job: job._id,
      worker: req.user._id,
    });
    isNotifiedOrAssigned = !!app;
  }

  if (!isContractor && !isNotifiedOrAssigned && req.user.role !== 'admin') {
    return sendError(res, 403, 'Access denied to this job listing', 'FORBIDDEN');
  }

  return sendSuccess(res, 200, job);
};

/**
 * GET /api/v1/jobs/:id/applicants
 * Contractor views list of applications with worker details and distances.
 */
export const getJobApplicants = async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.contractor.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    return sendError(res, 403, 'You do not own this job', 'FORBIDDEN');
  }

  const applications = await JobApplication.find({ job: job._id })
    .populate('worker', 'name phone skills ratingSummary experienceYears location')
    .sort({ respondedAt: -1, createdAt: -1 })
    .lean();

  const enriched = applications.map((app) => {
    let distanceMeters = null;
    if (app.worker?.location?.coordinates && job.location?.coordinates) {
      distanceMeters = Math.round(
        haversineDistance(
          job.location.coordinates[1],
          job.location.coordinates[0],
          app.worker.location.coordinates[1],
          app.worker.location.coordinates[0]
        )
      );
    }
    return {
      ...app,
      distanceMeters,
    };
  });

  return sendSuccess(res, 200, enriched);
};

/**
 * POST /api/v1/jobs/:id/accept
 * Worker accepts job assignment.
 * Strict atomic assignment with race-condition prevention:
 * Uses findOneAndUpdate with workersAssignedCount < workersNeeded.
 */
export const acceptJob = async (req, res) => {
  const jobId = req.params.id;
  const workerId = req.user._id;

  // 1. Verify that worker has an application for this job
  const existingApp = await JobApplication.findOne({ job: jobId, worker: workerId });

  if (!existingApp) {
    return sendError(
      res,
      403,
      'You are not in the notified pool for this job',
      'NOT_NOTIFIED'
    );
  }

  // Idempotency: If already assigned, return success with current state
  if (existingApp.status === 'ASSIGNED') {
    const job = await Job.findById(jobId);
    return sendSuccess(res, 200, {
      message: 'Already assigned to this job',
      job,
      application: existingApp,
    });
  }

  if (existingApp.status === 'EXPIRED') {
    return sendError(res, 409, 'This job has already been filled', 'JOB_FILLED');
  }

  // Fetch job to inspect workersNeeded
  const job = await Job.findById(jobId);
  if (!job) {
    return sendError(res, 404, 'Job not found', 'NOT_FOUND');
  }

  if (job.status !== 'OPEN') {
    return sendError(res, 409, `Job is not open for assignment (Status: ${job.status})`, 'JOB_NOT_OPEN');
  }

  // 2. ATOMIC ASSIGNMENT VIA $inc: { workersAssignedCount: 1 }
  // Only succeeds if status is OPEN and workersAssignedCount < workersNeeded!
  const updatedJob = await Job.findOneAndUpdate(
    {
      _id: jobId,
      status: 'OPEN',
      workersAssignedCount: { $lt: job.workersNeeded },
    },
    { $inc: { workersAssignedCount: 1 } },
    { new: true }
  );

  if (!updatedJob) {
    // Race lost! The last slot was taken by a concurrent worker
    return sendError(
      res,
      409,
      'This job has just been filled by another worker',
      'JOB_FILLED'
    );
  }

  try {
    // 3. Mark worker's application as ASSIGNED
    existingApp.status = 'ASSIGNED';
    existingApp.respondedAt = new Date();
    await existingApp.save();

    // Phase 5: Create daily escrow transaction rows (status CREATED) for the assigned worker
    await createEscrowForAssignment(updatedJob, workerId);

    // 4. If all slots filled, close the job and expire remaining applicants
    const isNowFilled = updatedJob.workersAssignedCount >= updatedJob.workersNeeded;
    if (isNowFilled) {
      updatedJob.status = 'FILLED';
      await updatedJob.save();

      // Expire remaining NOTIFIED applications
      const unassignedApps = await JobApplication.find({
        job: jobId,
        status: 'NOTIFIED',
      });

      await JobApplication.updateMany(
        { job: jobId, status: 'NOTIFIED' },
        { $set: { status: 'EXPIRED' } }
      );

      // Notify expired workers via socket
      try {
        const io = getIO();
        for (const app of unassignedApps) {
          io.to(`user:${app.worker.toString()}`).emit('job:filled', { jobId });
        }
      } catch (_e) {}
    }

    // 5. Create in-app Notification for worker
    await Notification.create({
      user: workerId,
      type: 'JOB_ASSIGNED',
      title: 'Kaam Pakka Hua! (Job Confirmed)',
      body: `Aapko ${updatedJob.title} ke liye chun liya gaya hai.`,
      data: { jobId },
      channel: 'socket',
      status: 'SENT',
      sentAt: new Date(),
    });

    // 6. Real-time Socket dispatch to Worker and Contractor
    try {
      const io = getIO();
      // Inform worker
      io.to(`user:${workerId.toString()}`).emit('job:assigned', { jobId });

      // Inform contractor in user room
      io.to(`user:${updatedJob.contractor.toString()}`).emit('applicant:accepted', {
        jobId,
        workerId: workerId.toString(),
        workerName: req.user.name,
        assignedCount: updatedJob.workersAssignedCount,
        workersNeeded: updatedJob.workersNeeded,
      });
    } catch (_e) {}

    return sendSuccess(res, 200, {
      message: 'Job successfully assigned',
      job: updatedJob,
      application: existingApp,
    });
  } catch (err) {
    // Rollback atomic counter increment if post-step failed
    logger.error(`Error in post-assignment steps: ${err.message}. Rolling back increment.`);
    await Job.findByIdAndUpdate(jobId, { $inc: { workersAssignedCount: -1 } });
    throw err;
  }
};

/**
 * POST /api/v1/jobs/:id/reject
 * Worker rejects job match.
 */
export const rejectJob = async (req, res) => {
  const jobId = req.params.id;
  const workerId = req.user._id;

  const app = await JobApplication.findOne({ job: jobId, worker: workerId });
  if (!app) {
    return sendError(res, 404, 'Application record not found', 'NOT_FOUND');
  }

  app.status = 'REJECTED';
  app.respondedAt = new Date();
  await app.save();

  // Inform contractor
  try {
    const job = await Job.findById(jobId);
    if (job) {
      const rejectedCount = await JobApplication.countDocuments({ job: jobId, status: 'REJECTED' });
      const io = getIO();
      io.to(`user:${job.contractor.toString()}`).emit('applicant:rejected', {
        jobId,
        rejectedCount,
      });
    }
  } catch (_e) {}

  return sendSuccess(res, 200, { message: 'Job rejected', application: app });
};

/**
 * GET /api/v1/applications/my
 * Worker retrieves list of their applications.
 */
export const getMyApplications = async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { worker: req.user._id };

  if (status) {
    filter.status = status;
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const total = await JobApplication.countDocuments(filter);
  const applications = await JobApplication.find(filter)
    .populate({
      path: 'job',
      populate: { path: 'contractor', select: 'name phone' },
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  return sendSuccess(res, 200, applications, {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    total,
    totalPages: Math.ceil(total / limit),
  });
};
