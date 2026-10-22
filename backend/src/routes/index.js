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
import { getHealth, getReady } from '../controllers/health.controller.js';

const router = Router();

// Liveness and Readiness probes
router.get('/health', getHealth);
router.get('/ready', getReady);

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

// Dev testing routes (strictly disabled in production, returns 404)
router.use('/dev', (req, res, next) => {
  if (process.env.NODE_ENV === 'production' || env.nodeEnv === 'production') {
    return res.status(404).json({
      success: false,
      data: null,
      error: { code: 'NOT_FOUND', message: 'Cannot ' + req.method + ' ' + req.originalUrl },
    });
  }
  return devRoutes(req, res, next);
});

export default router;
