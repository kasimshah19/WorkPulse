import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import jobsRoutes from './jobs.routes.js';
import applicationsRoutes from './applications.routes.js';
import notificationsRoutes from './notifications.routes.js';
import attendanceRoutes from './attendance.routes.js';
import escrowRoutes from './escrow.routes.js';
import ratingsRoutes from './ratings.routes.js';
import incidentsRoutes from './incidents.routes.js';

const router = Router();

// GET /api/v1/health - Working health check endpoint
router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'workpulse-backend',
    time: new Date().toISOString(),
  });
});

// Mount feature routes
router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/jobs', jobsRoutes);
router.use('/applications', applicationsRoutes);
router.use('/notifications', notificationsRoutes);
router.use('/attendance', attendanceRoutes);
router.use('/escrow', escrowRoutes);
router.use('/ratings', ratingsRoutes);
router.use('/incidents', incidentsRoutes);

export default router;
