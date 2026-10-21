import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import {
  getAdminDisputes,
  getAdminDisputeDetail,
  resolveAdminDispute,
  getReconciliationReport,
  getAdminStats,
} from '../controllers/admin.controller.js';
import { getVoiceStats } from '../controllers/voice.controller.js';
import {
  getAdminRatings,
  hideRatingHandler,
  unhideRatingHandler,
} from '../controllers/ratings.controller.js';
import {
  getAdminIncidentsHandler,
  getAdminIncidentDetail,
  postAdminNote,
  postResolve,
  getSafetyStats,
} from '../controllers/incidents.controller.js';

import LedgerEntry from '../models/LedgerEntry.js';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

// All admin routes require role 'admin'
router.use(auth);
router.use(role('admin'));

router.get('/disputes', asyncHandler(getAdminDisputes));
router.get('/disputes/:id', asyncHandler(getAdminDisputeDetail));
router.post('/disputes/:id/resolve', asyncHandler(resolveAdminDispute));
router.get('/ledger/reconcile', asyncHandler(getReconciliationReport));
router.get('/reconciliation', asyncHandler(getReconciliationReport));
router.post('/reconciliation/run', asyncHandler(getReconciliationReport));
router.get('/stats', asyncHandler(getAdminStats));
router.get('/voice/stats', asyncHandler(getVoiceStats));

// Phase 7: Ratings Moderation
router.get('/ratings', asyncHandler(getAdminRatings));
router.post('/ratings/:id/hide', asyncHandler(hideRatingHandler));
router.post('/ratings/:id/unhide', asyncHandler(unhideRatingHandler));

// Phase 7: Safety & Incidents Queue
router.get('/incidents', asyncHandler(getAdminIncidentsHandler));
router.get('/incidents/:id', asyncHandler(getAdminIncidentDetail));
router.post('/incidents/:id/note', asyncHandler(postAdminNote));
router.post('/incidents/:id/resolve', asyncHandler(postResolve));
router.get('/safety/stats', asyncHandler(getSafetyStats));

router.get('/ledger-groups', asyncHandler(async (req, res) => {
  const limit = Math.min(100, parseInt(req.query.limit, 10) || 20);
  const groups = await LedgerEntry.find().sort({ createdAt: -1 }).limit(limit).lean();
  return sendSuccess(res, 200, groups);
}));

export default router;
