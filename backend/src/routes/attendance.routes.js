import { Router } from 'express';
import { checkIn, checkOut, getAttendanceByJob } from '../controllers/attendance.controller.js';

const router = Router();

router.post('/check-in', checkIn);
router.post('/check-out', checkOut);
router.get('/job/:jobId', getAttendanceByJob);

export default router;
