import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import {
  devWalletTopup,
  devExpireApproval,
  devRunScheduler,
  devAgeIncident,
  devOpenRatingWindow,
} from '../controllers/dev.controller.js';

const router = Router();

// Dev routes require auth for user context
router.use(auth);

router.post('/wallet/topup', asyncHandler(devWalletTopup));
router.post('/escrow/:id/expire-approval', asyncHandler(devExpireApproval));
router.post('/scheduler/run', asyncHandler(devRunScheduler));
router.post('/incidents/:id/age', asyncHandler(devAgeIncident));
router.post('/jobs/:id/open-rating-window', asyncHandler(devOpenRatingWindow));

export default router;
