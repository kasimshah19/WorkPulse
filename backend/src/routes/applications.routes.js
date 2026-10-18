import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import { getMyApplications } from '../controllers/jobs.controller.js';

const router = Router();

router.use(auth);
router.get('/my', role('worker'), asyncHandler(getMyApplications));

export default router;
