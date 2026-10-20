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

router.use(auth);

router.post('/jobs/:id/fund', role('contractor'), asyncHandler(fundJobEscrow));
router.get('/jobs/:id/funding-quote', role('contractor', 'admin'), asyncHandler(getJobFundingQuote));
router.get('/jobs/:id', role('contractor', 'admin'), asyncHandler(getJobEscrows));
router.get('/my', role('worker', 'contractor', 'admin'), asyncHandler(getMyWorkerEscrows));
router.get('/me', role('worker', 'contractor', 'admin'), asyncHandler(getMyWorkerEscrows));
router.post('/:id/release', role('contractor', 'admin'), asyncHandler(releaseEscrow));
router.get('/:id', asyncHandler(getEscrowById));

export default router;
