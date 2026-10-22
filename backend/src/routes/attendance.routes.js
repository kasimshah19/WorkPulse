import { Router } from 'express';
import {
  handleCheckIn,
  handleCheckOut,
  handleSignoff,
  getTodayAttendance,
  getMyAttendanceHistory,
  getJobAttendance,
  getAttendanceById,
  getAttendanceSelfie,
  getAttendanceCode,
} from '../controllers/attendance.controller.js';
import { authenticate } from '../middleware/auth.js';
import { role } from '../middleware/role.js';
import { upload } from '../services/storage.service.js';

const router = Router();

// Middleware: All attendance endpoints require authenticated JWT
router.use(authenticate);

// --- Worker Endpoints ---
router.get('/today', role('worker'), getTodayAttendance);
router.get('/history', role('worker'), getMyAttendanceHistory);

// Single Attendance Detail & Secure Selfie Serving
router.get('/:id/selfie', getAttendanceSelfie);
router.get('/:id', getAttendanceById);

import Joi from 'joi';
import validate from '../middleware/validate.js';

const signoffSchema = Joi.object({
  decision: Joi.string().valid('APPROVED', 'DISPUTED', 'APPROVE', 'REJECT').required(),
  notes: Joi.string().max(500).optional().allow(''),
  reason: Joi.string().max(500).optional().allow(''),
}).strict();

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

// Contractor Sign-off Decision
router.post(
  '/:id/signoff',
  role('contractor', 'admin'),
  validate(idParamSchema, 'params'),
  validate(signoffSchema),
  handleSignoff
);

export default router;

// Sub-router for job-specific attendance routes mounted under /jobs/:id/attendance
export const jobAttendanceRouter = Router({ mergeParams: true });
jobAttendanceRouter.use(authenticate);

jobAttendanceRouter.post('/check-in', role('worker'), upload.single('selfie'), handleCheckIn);
jobAttendanceRouter.post('/check-out', role('worker'), upload.single('selfie'), handleCheckOut);
jobAttendanceRouter.get('/', role('contractor', 'admin'), getJobAttendance);
jobAttendanceRouter.get('/code', role('contractor', 'admin'), getAttendanceCode);
