import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import {
  fundJobEscrow,
  getJobFundingQuote,
  getJobEscrows,
  getMyWorkerEscrows,
  getEscrowById,
  releaseEscrow,
} from '../controllers/escrow.controller.js';

const router = Router();

import Joi from 'joi';
import validate from '../middleware/validate.js';

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

router.use(auth);

router.post('/jobs/:id/fund', role('contractor'), validate(idParamSchema, 'params'), asyncHandler(fundJobEscrow));
router.get('/jobs/:id/funding-quote', role('contractor', 'admin'), validate(idParamSchema, 'params'), asyncHandler(getJobFundingQuote));
router.get('/jobs/:id', role('contractor', 'admin'), validate(idParamSchema, 'params'), asyncHandler(getJobEscrows));
router.get('/my', role('worker', 'contractor', 'admin'), asyncHandler(getMyWorkerEscrows));
router.get('/me', role('worker', 'contractor', 'admin'), asyncHandler(getMyWorkerEscrows));
router.post('/:id/release', role('contractor', 'admin'), validate(idParamSchema, 'params'), asyncHandler(releaseEscrow));
router.get('/:id', validate(idParamSchema, 'params'), asyncHandler(getEscrowById));

export default router;
