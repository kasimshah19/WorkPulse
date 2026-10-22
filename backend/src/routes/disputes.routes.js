import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { disputeLimiter } from '../middleware/rateLimiter.js';
import {
  raiseDispute,
  getMyDisputes,
  getDisputeById,
  addDisputeEvidence,
} from '../controllers/disputes.controller.js';

const router = Router();

const raiseDisputeSchema = Joi.object({
  escrowId: Joi.string().optional(),
  escrowTransactionId: Joi.string().optional(),
  reason: Joi.string().min(3).max(1000).required(),
  description: Joi.string().max(1000).optional().allow(''),
}).or('escrowId', 'escrowTransactionId').strict();

const addEvidenceSchema = Joi.object({
  description: Joi.string().min(5).max(1000).required(),
  files: Joi.array().items(Joi.string()).optional(),
}).strict();

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

router.use(auth);

router.post('/', disputeLimiter, validate(raiseDisputeSchema), asyncHandler(raiseDispute));
router.get('/my', asyncHandler(getMyDisputes));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getDisputeById));
router.post(
  '/:id/evidence',
  disputeLimiter,
  validate(idParamSchema, 'params'),
  validate(addEvidenceSchema),
  asyncHandler(addDisputeEvidence)
);

export default router;
