import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import {
  getAdminDisputes,
  getAdminDisputeDetail,
  resolveAdminDispute,
  getReconciliationReport,
  getAdminStats,
} from '../controllers/admin.controller.js';
import { getVoiceStats } from '../controllers/voice.controller.js';
import {
  getAdminRatings,
  hideRatingHandler,
  unhideRatingHandler,
} from '../controllers/ratings.controller.js';
import {
  getAdminIncidentsHandler,
  getAdminIncidentDetail,
  postAdminNote,
  postResolve,
  getSafetyStats,
} from '../controllers/incidents.controller.js';

import LedgerEntry from '../models/LedgerEntry.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

import validate from '../middleware/validate.js';
import Joi from 'joi';

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

const resolveDisputeSchema = Joi.object({
  decision: Joi.string().valid('RELEASE_WORKER', 'REFUND_CONTRACTOR', 'SPLIT').required(),
  workerAmountPaise: Joi.number().min(0).optional(),
  contractorAmountPaise: Joi.number().min(0).optional(),
  notes: Joi.string().max(1000).optional().allow(''),
}).strict();

const hideRatingSchema = Joi.object({
  reason: Joi.string().min(3).max(500).required(),
}).strict();

const incidentNoteSchema = Joi.object({
  note: Joi.string().min(2).max(1000).required(),
}).strict();

const resolveIncidentSchema = Joi.object({
  resolutionType: Joi.string().valid('SELF_SAFE', 'OTHER', 'FALSE_ALARM', 'RESOLVED').required(),
  notes: Joi.string().max(500).optional().allow(''),
}).strict();

// All admin routes require role 'admin'
router.use(auth);
router.use(role('admin'));

const emptyBodySchema = Joi.object({}).unknown(true);

router.get('/disputes', asyncHandler(getAdminDisputes));
router.get('/disputes/:id', validate(idParamSchema, 'params'), asyncHandler(getAdminDisputeDetail));
router.post('/disputes/:id/resolve', validate(idParamSchema, 'params'), validate(resolveDisputeSchema), asyncHandler(resolveAdminDispute));
router.get('/ledger/reconcile', asyncHandler(getReconciliationReport));
router.get('/reconciliation', asyncHandler(getReconciliationReport));
router.post('/reconciliation/run', validate(emptyBodySchema), asyncHandler(getReconciliationReport));
router.get('/stats', asyncHandler(getAdminStats));
router.get('/voice/stats', asyncHandler(getVoiceStats));

// Phase 7: Ratings Moderation
router.get('/ratings', asyncHandler(getAdminRatings));
router.post('/ratings/:id/hide', validate(idParamSchema, 'params'), validate(hideRatingSchema), asyncHandler(hideRatingHandler));
router.post('/ratings/:id/unhide', validate(idParamSchema, 'params'), asyncHandler(unhideRatingHandler));

// Phase 7: Safety & Incidents Queue
router.get('/incidents', asyncHandler(getAdminIncidentsHandler));
router.get('/incidents/:id', validate(idParamSchema, 'params'), asyncHandler(getAdminIncidentDetail));
router.post('/incidents/:id/note', validate(idParamSchema, 'params'), validate(incidentNoteSchema), asyncHandler(postAdminNote));
router.post('/incidents/:id/resolve', validate(idParamSchema, 'params'), validate(resolveIncidentSchema), asyncHandler(postResolve));
router.get('/safety/stats', asyncHandler(getSafetyStats));

router.get('/ledger-groups', asyncHandler(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const groups = await LedgerEntry.find().sort({ createdAt: -1 }).limit(limit).lean();
  return sendSuccess(res, 200, groups);
}));

export default router;
