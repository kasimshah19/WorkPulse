import { Router } from 'express';
import auth from '../middleware/auth.js';
import { upload } from '../services/storage.service.js';
import {
  postSos,
  postLocationUpdate,
  postAcknowledge,
  postResolve,
  postIncident,
  getMy,
  getIncident,
  getIncidentPhoto,
} from '../controllers/incidents.controller.js';

const router = Router();

// All incident routes require authentication
router.use(auth);

// SOS Endpoints
router.post('/sos', postSos);
router.post('/:id/location', postLocationUpdate);
router.post('/:id/acknowledge', postAcknowledge);
router.post('/:id/resolve', postResolve);

// Non-SOS Incidents
router.post('/', upload.array('photos', 3), postIncident);
router.get('/my', getMy);
router.get('/:id', getIncident);
router.get('/:id/photos/:index', getIncidentPhoto);

export default router;
