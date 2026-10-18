import { Router } from 'express';
import { createJob, getJobs, getJob, updateJob, applyToJob } from '../controllers/jobs.controller.js';

const router = Router();

router.post('/', createJob);
router.get('/', getJobs);
router.get('/:id', getJob);
router.patch('/:id', updateJob);
router.post('/:id/apply', applyToJob);

export default router;
