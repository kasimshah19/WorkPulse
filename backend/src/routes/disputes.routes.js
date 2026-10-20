import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import {
  raiseDispute,
  getMyDisputes,
  getDisputeById,
  addDisputeEvidence,
} from '../controllers/disputes.controller.js';

const router = Router();

router.use(auth);

router.post('/', asyncHandler(raiseDispute));
router.get('/my', asyncHandler(getMyDisputes));
router.get('/:id', asyncHandler(getDisputeById));
router.post('/:id/evidence', asyncHandler(addDisputeEvidence));

export default router;
