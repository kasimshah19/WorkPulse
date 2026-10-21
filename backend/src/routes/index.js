import { Router } from 'express';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import jobsRoutes from './jobs.routes.js';
import applicationsRoutes from './applications.routes.js';
import notificationsRoutes from './notifications.routes.js';
import attendanceRoutes from './attendance.routes.js';
import escrowRoutes from './escrow.routes.js';
import walletRoutes from './wallet.routes.js';
import paymentsRoutes from './payments.routes.js';
import disputesRoutes from './disputes.routes.js';
import adminRoutes from './admin.routes.js';
import devRoutes from './dev.routes.js';
import ratingsRoutes from './ratings.routes.js';
import incidentsRoutes from './incidents.routes.js';
import voiceRoutes from './voice.routes.js';
import env from '../config/env.js';

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
router.use('/wallet', walletRoutes);
router.use('/payments', paymentsRoutes);
router.use('/escrow', escrowRoutes);
router.use('/disputes', disputesRoutes);
router.use('/admin', adminRoutes);
router.use('/ratings', ratingsRoutes);
router.use('/incidents', incidentsRoutes);
router.use('/voice', voiceRoutes);

// Dev testing routes (disabled in production)
if (env.nodeEnv !== 'production') {
  router.use('/dev', devRoutes);
}

export default router;
