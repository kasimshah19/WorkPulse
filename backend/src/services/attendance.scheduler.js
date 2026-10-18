import Attendance from '../models/Attendance.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import env from '../config/env.js';
import {
  ATTENDANCE_STATUS,
  SIGNOFF_STATUS,
  NOTIFICATION_TYPE,
  NOTIFICATION_CHANNEL,
  NOTIFICATION_STATUS,
  JOB_STATUS,
} from '../config/constants.js';
import {
  getISTDateString,
  getISTMinutesFromMidnight,
  parseTimeStringToMinutes,
  calculateHoursWorked,
} from '../utils/time.js';
import clock from '../utils/clock.js';
import { getIO } from '../sockets/index.js';

let schedulerInterval = null;

/**
 * Automatically marks forgotten check-ins as CHECKED_OUT after late grace period.
 * Idempotent.
 */
export async function autoCheckoutForgotten() {
  const openAttendances = await Attendance.find({
    status: ATTENDANCE_STATUS.CHECKED_IN,
  }).populate('job');

  const todayDate = getISTDateString();
  const currentMinutes = getISTMinutesFromMidnight();
  const results = [];

  for (const att of openAttendances) {
    const job = att.job;
    if (!job) continue;

    const endMinutes = parseTimeStringToMinutes(job.workingHours?.end || '17:00');
    const autoCheckoutThreshold = endMinutes + env.attendanceLateGraceMin;

    // Check if day has passed OR time today has passed autoCheckoutThreshold
    const isPastDate = att.date < todayDate;
    const isPastGraceToday = att.date === todayDate && currentMinutes >= autoCheckoutThreshold;

    if (isPastDate || isPastGraceToday) {
      const now = clock.now();
      const hoursWorked = calculateHoursWorked(att.checkInAt, now);

      const updated = await Attendance.findOneAndUpdate(
        { _id: att._id, status: ATTENDANCE_STATUS.CHECKED_IN },
        {
          $set: {
            status: ATTENDANCE_STATUS.CHECKED_OUT,
            checkOutAt: now,
            autoCheckout: true,
            hoursWorked,
            'contractorSignoff.status': SIGNOFF_STATUS.PENDING,
          },
          $addToSet: {
            flags: 'AUTO_CHECKOUT',
          },
        },
        { new: true },
      );

      if (updated) {
        results.push(updated);

        // Notify contractor
        const worker = await User.findById(att.worker).select('name');
        const workerName = worker?.name || 'Worker';

        await Notification.create({
          user: job.contractor,
          type: NOTIFICATION_TYPE.SIGNOFF_REQUEST,
          title: 'ऑटो चेक-आउट (Auto Check-Out)',
          body: `${workerName} का चेक-आउट स्वतः (Auto) कर दिया गया है (${hoursWorked} घंटे)। कृपया हाज़िरी जांचें।`,
          channel: NOTIFICATION_CHANNEL.SOCKET,
          status: NOTIFICATION_STATUS.SENT,
          data: { attendanceId: updated._id, jobId: job._id, autoCheckout: true },
        });

        const io = getIO();
        if (io) {
          const payload = {
            attendanceId: updated._id,
            jobId: job._id,
            workerId: att.worker,
            workerName,
            checkOutAt: updated.checkOutAt,
            hoursWorked,
            autoCheckout: true,
          };
          io.to(`user:${job.contractor}`).emit('attendance:checkedOut', payload);
          io.to(`job:${job._id}`).emit('attendance:checkedOut', payload);
        }
      }
    }
  }

  return results;
}

/**
 * Marks assigned workers who never checked in after working hours as MISSED.
 * Idempotent.
 */
export async function markMissed() {
  const activeJobs = await Job.find({
    status: { $in: [JOB_STATUS.FILLED, JOB_STATUS.IN_PROGRESS] },
  });

  const todayDate = getISTDateString();
  const currentMinutes = getISTMinutesFromMidnight();
  const missedRecords = [];

  for (const job of activeJobs) {
    const endMinutes = parseTimeStringToMinutes(job.workingHours?.end || '17:00');
    const graceThreshold = endMinutes + env.attendanceLateGraceMin;

    // Only process for today if grace period has elapsed
    if (currentMinutes < graceThreshold) continue;

    const startIST = getISTDateString(job.startDate);
    const endIST = getISTDateString(job.endDate);

    if (todayDate < startIST || todayDate > endIST) continue;

    // Find all assigned workers
    const assignedApps = await JobApplication.find({
      job: job._id,
      status: 'ASSIGNED',
    });

    for (const app of assignedApps) {
      // Check if attendance exists for today
      const existing = await Attendance.findOne({
        job: job._id,
        worker: app.worker,
        date: todayDate,
      });

      if (!existing) {
        try {
          const missed = await Attendance.create({
            job: job._id,
            worker: app.worker,
            date: todayDate,
            status: ATTENDANCE_STATUS.MISSED,
            rejectionReason: 'NO_SHOW',
            hoursWorked: 0,
            flags: ['NO_SHOW'],
          });
          missedRecords.push(missed);

          const worker = await User.findById(app.worker).select('name');
          const workerName = worker?.name || 'Worker';

          // Notify contractor
          await Notification.create({
            user: job.contractor,
            type: NOTIFICATION_TYPE.SIGNOFF_REQUEST,
            title: 'कारीगर अनुपस्थित (Worker No-Show)',
            body: `${workerName} आज काम पर उपस्थित नहीं हुए (${todayDate})।`,
            channel: NOTIFICATION_CHANNEL.SOCKET,
            status: NOTIFICATION_STATUS.SENT,
          });

          const io = getIO();
          if (io) {
            io.to(`user:${job.contractor}`).emit('attendance:missed', {
              jobId: job._id,
              workerId: app.worker,
              workerName,
              date: todayDate,
            });
          }

          // TODO(Phase 5): Trigger automatic escrow refund for this day
        } catch (err) {
          // Ignore duplicate key race conditions
          if (err.code !== 11000) {
            console.error('[SCHEDULER_MISSED_ERROR]', err.message);
          }
        }
      }
    }

    // Check if all days of the job have elapsed and all attendances are closed
    if (todayDate >= endIST && currentMinutes >= graceThreshold) {
      const openAtts = await Attendance.countDocuments({
        job: job._id,
        status: ATTENDANCE_STATUS.CHECKED_IN,
      });
      if (openAtts === 0) {
        await Job.findByIdAndUpdate(job._id, { status: JOB_STATUS.COMPLETED });
      }
    }
  }

  return missedRecords;
}

/**
 * Starts background scheduler interval.
 * Skipped automatically in test environment.
 */
export function startAttendanceScheduler() {
  if (env.nodeEnv === 'test') {
    return;
  }

  if (schedulerInterval) {
    clearInterval(schedulerInterval);
  }

  schedulerInterval = setInterval(async () => {
    try {
      await autoCheckoutForgotten();
      await markMissed();
    } catch (err) {
      console.error('[ATTENDANCE_SCHEDULER_ERROR]', err.message);
    }
  }, env.attendanceSchedulerIntervalSec * 1000);
}

/**
 * Stops scheduler interval.
 */
export function stopAttendanceScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
