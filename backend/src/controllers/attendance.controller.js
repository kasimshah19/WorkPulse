import fs from 'fs';
import Attendance from '../models/Attendance.js';
import Job from '../models/Job.js';
import Dispute from '../models/Dispute.js';
import {
  checkIn,
  checkOut,
  signoff,
  getTodayWorkerAttendance,
  getJobAttendanceForDate,
  generateAttendanceCode,
} from '../services/attendance.service.js';
import { resolveSelfiePath } from '../services/storage.service.js';
import { getISTDateString } from '../utils/time.js';
import { apiResponse } from '../utils/apiResponse.js';

export async function handleCheckIn(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const {
      lat,
      lng,
      accuracy,
      clientTimestamp,
      method,
      code,
      deviceInfo,
    } = req.body;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedAccuracy = parseFloat(accuracy);

    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      return res.status(400).json(
        apiResponse.error('VALIDATION_ERROR', 'Valid latitude between -90 and 90 is required.', { lat }),
      );
    }

    if (isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      return res.status(400).json(
        apiResponse.error('VALIDATION_ERROR', 'Valid longitude between -180 and 180 is required.', { lng }),
      );
    }

    if (isNaN(parsedAccuracy) || parsedAccuracy < 0) {
      return res.status(400).json(
        apiResponse.error('VALIDATION_ERROR', 'Accuracy must be a positive number.', { accuracy }),
      );
    }

    const attendance = await checkIn({
      jobId,
      workerId: req.user._id,
      lat: parsedLat,
      lng: parsedLng,
      accuracy: parsedAccuracy,
      clientTimestamp: clientTimestamp || new Date().toISOString(),
      method: method || 'gps_selfie',
      selfieFile: req.file,
      code,
      deviceInfo: deviceInfo || req.headers['user-agent'] || '',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || '',
    });

    const responseData = {
      ...attendance.toObject(),
      selfieUrl: attendance.selfieUrl ? `/api/v1/attendance/${attendance._id}/selfie` : '',
    };

    return res.status(201).json(apiResponse.success(responseData));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json(
        apiResponse.error(err.code || 'ATTENDANCE_ERROR', err.message, err.details),
      );
    }
    next(err);
  }
}

export async function handleCheckOut(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const { lat, lng, accuracy, clientTimestamp } = req.body;

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedAccuracy = parseFloat(accuracy);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json(
        apiResponse.error('VALIDATION_ERROR', 'Valid latitude and longitude are required for check-out.'),
      );
    }

    const attendance = await checkOut({
      jobId,
      workerId: req.user._id,
      lat: parsedLat,
      lng: parsedLng,
      accuracy: isNaN(parsedAccuracy) ? 10 : parsedAccuracy,
      clientTimestamp: clientTimestamp || new Date().toISOString(),
      selfieFile: req.file,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'] || '',
    });

    const responseData = {
      ...attendance.toObject(),
      selfieUrl: attendance.selfieUrl ? `/api/v1/attendance/${attendance._id}/selfie` : '',
    };

    return res.status(200).json(apiResponse.success(responseData));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json(
        apiResponse.error(err.code || 'CHECKOUT_ERROR', err.message, err.details),
      );
    }
    next(err);
  }
}

export async function handleSignoff(req, res, next) {
  try {
    const { id: attendanceId } = req.params;
    let { decision, reason, notes } = req.body;

    if (decision === 'APPROVE') decision = 'APPROVED';
    if (decision === 'REJECT') decision = 'DISPUTED';
    const finalReason = reason || notes || '';

    const updated = await signoff({
      attendanceId,
      contractorId: req.user._id,
      decision,
      reason: finalReason,
    });

    return res.status(200).json(apiResponse.success(updated));
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json(
        apiResponse.error(err.code || 'SIGNOFF_ERROR', err.message, err.details),
      );
    }
    next(err);
  }
}

export async function getTodayAttendance(req, res, next) {
  try {
    const cards = await getTodayWorkerAttendance(req.user._id);
    return res.status(200).json(apiResponse.success(cards));
  } catch (err) {
    next(err);
  }
}

export async function getMyAttendanceHistory(req, res, next) {
  try {
    const list = await Attendance.find({ worker: req.user._id })
      .populate('job', 'title skillRequired wagePerDayPaise addressText')
      .sort({ date: -1, createdAt: -1 })
      .limit(50);
    return res.status(200).json(apiResponse.success(list));
  } catch (err) {
    next(err);
  }
}

export async function getJobAttendance(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const { date } = req.query;

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Job not found.'));
    }

    // Role check: Only contractor of job or admin
    if (req.user.role !== 'admin' && String(job.contractor) !== String(req.user._id)) {
      return res.status(403).json(apiResponse.error('FORBIDDEN', 'Access denied to this job attendance.'));
    }

    const data = await getJobAttendanceForDate(jobId, date);
    return res.status(200).json(apiResponse.success(data));
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceById(req, res, next) {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findById(id).populate('job').populate('worker', 'name phone skills');
    if (!attendance) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Attendance record not found.'));
    }

    // Access authorization: worker owner, job contractor, admin
    const isWorkerOwner = String(attendance.worker._id || attendance.worker) === String(req.user._id);
    const isContractorOwner = String(attendance.job?.contractor) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    if (!isWorkerOwner && !isContractorOwner && !isAdmin) {
      return res.status(403).json(apiResponse.error('FORBIDDEN', 'Not authorized to view this record.'));
    }

    return res.status(200).json(apiResponse.success(attendance));
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceSelfie(req, res, next) {
  try {
    const { id } = req.params;
    const attendance = await Attendance.findById(id).populate('job');
    if (!attendance || !attendance.selfieUrl) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Selfie not found for this attendance.'));
    }

    // Access control: Worker who owns it, the job contractor, dispute participants, and admin
    const isWorkerOwner = String(attendance.worker) === String(req.user._id);
    const isContractorOwner = String(attendance.job?.contractor) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';

    let isDisputeParticipant = false;
    if (!isWorkerOwner && !isContractorOwner && !isAdmin) {
      const dispute = await Dispute.findOne({
        $or: [{ raisedBy: req.user._id }, { against: req.user._id }],
        'evidence.refId': String(attendance._id),
      });
      isDisputeParticipant = !!dispute;
    }

    if (!isWorkerOwner && !isContractorOwner && !isAdmin && !isDisputeParticipant) {
      return res.status(403).json(apiResponse.error('FORBIDDEN', 'Access denied to view this selfie.'));
    }

    const fullPath = resolveSelfiePath(attendance.selfieUrl);
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Selfie file missing on disk.'));
    }

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'private, max-age=86400');
    return res.sendFile(fullPath);
  } catch (err) {
    next(err);
  }
}

export async function getAttendanceCode(req, res, next) {
  try {
    const { id: jobId } = req.params;
    const job = await Job.findById(jobId).select('+attendanceCodeSecret');
    if (!job) {
      return res.status(404).json(apiResponse.error('NOT_FOUND', 'Job not found.'));
    }

    if (req.user.role !== 'admin' && String(job.contractor) !== String(req.user._id)) {
      return res.status(403).json(apiResponse.error('FORBIDDEN', 'Only the contractor can view daily code.'));
    }

    const todayDate = getISTDateString();
    const data = generateAttendanceCode(job.attendanceCodeSecret, todayDate, job._id);

    return res.status(200).json(apiResponse.success(data));
  } catch (err) {
    next(err);
  }
}
