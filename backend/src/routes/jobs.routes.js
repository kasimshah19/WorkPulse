import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import { SKILLS } from '../config/constants.js';
import {
  createJob,
  updateJob,
  publishJob,
  cancelJob,
  getMyJobs,
  getNearbyJobs,
  getJobById,
  getJobApplicants,
  acceptJob,
  rejectJob,
} from '../controllers/jobs.controller.js';
import { jobAttendanceRouter } from './attendance.routes.js';

const router = Router();

const createJobSchema = Joi.object({
  title: Joi.string().min(3).max(200).required(),
  description: Joi.string().max(2000).optional().allow(''),
  skillRequired: Joi.string().valid(...SKILLS).required(),
  workersNeeded: Joi.number().integer().min(1).max(50).default(1),
  wagePerDayPaise: Joi.number().integer().min(10000).required(), // min 10000 paise = ₹100
  startDate: Joi.date().iso().required(),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required(),
  workingHours: Joi.object({
    start: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('09:00'),
    end: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default('18:00'),
  }).optional(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).required(),
  addressText: Joi.string().min(3).max(500).required(),
  geofenceRadiusMeters: Joi.number().min(20).max(2000).default(100),
  matchRadiusKm: Joi.number().min(1).max(25).default(5),
  requiresSelfie: Joi.boolean().default(true),
});

const updateJobSchema = Joi.object({
  title: Joi.string().min(3).max(200).optional(),
  description: Joi.string().max(2000).optional().allow(''),
  skillRequired: Joi.string().valid(...SKILLS).optional(),
  workersNeeded: Joi.number().integer().min(1).max(50).optional(),
  wagePerDayPaise: Joi.number().integer().min(10000).optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().optional(),
  workingHours: Joi.object({
    start: Joi.string().optional(),
    end: Joi.string().optional(),
  }).optional(),
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
  }).optional(),
  addressText: Joi.string().min(3).max(500).optional(),
  geofenceRadiusMeters: Joi.number().min(20).max(2000).optional(),
  matchRadiusKm: Joi.number().min(1).max(25).optional(),
  requiresSelfie: Joi.boolean().optional(),
});

// All routes require authentication
router.use(auth);

// Contractor routes
router.post('/', role('contractor'), validate(createJobSchema), asyncHandler(createJob));
router.get('/my', role('contractor'), asyncHandler(getMyJobs));
router.patch('/:id', role('contractor'), validate(updateJobSchema), asyncHandler(updateJob));
router.post('/:id/publish', role('contractor'), asyncHandler(publishJob));
router.post('/:id/cancel', role('contractor'), asyncHandler(cancelJob));
router.get('/:id/applicants', role('contractor', 'admin'), asyncHandler(getJobApplicants));

// Worker routes
router.get('/nearby', role('worker'), asyncHandler(getNearbyJobs));
router.post('/:id/accept', role('worker'), asyncHandler(acceptJob));
router.post('/:id/reject', role('worker'), asyncHandler(rejectJob));

// Mount job attendance sub-router: /jobs/:id/attendance/*
router.use('/:id/attendance', jobAttendanceRouter);

// Common job details route
router.get('/:id', asyncHandler(getJobById));

export default router;
