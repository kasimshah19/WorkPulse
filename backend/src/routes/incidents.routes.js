import { Router } from 'express';
import Joi from 'joi';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { upload } from '../services/storage.service.js';
import { incidentLimiter } from '../middleware/rateLimiter.js';
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

const sosSchema = Joi.object({
  location: Joi.object({
    lat: Joi.number().min(-90).max(90).required(),
    lng: Joi.number().min(-180).max(180).required(),
    accuracy: Joi.number().optional(),
  }).optional(),
  jobId: Joi.string().optional(),
}).strict();

const locationUpdateSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
  accuracy: Joi.number().optional(),
}).strict();

const resolveIncidentSchema = Joi.object({
  resolutionType: Joi.string().valid('SELF_SAFE', 'OTHER', 'FALSE_ALARM', 'RESOLVED').required(),
  notes: Joi.string().max(500).optional().allow(''),
}).strict();

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

// All incident routes require authentication
router.use(auth);

// SOS Endpoints (SOS is EXEMPT from rate limiting!)
router.post('/sos', validate(sosSchema), postSos);
router.post('/:id/location', validate(idParamSchema, 'params'), validate(locationUpdateSchema), postLocationUpdate);
router.post('/:id/acknowledge', validate(idParamSchema, 'params'), postAcknowledge);
router.post('/:id/resolve', validate(idParamSchema, 'params'), validate(resolveIncidentSchema), postResolve);

// Non-SOS Incidents (subject to incidentLimiter)
router.post('/', incidentLimiter, upload.array('photos', 3), postIncident);
router.get('/my', getMy);
router.get('/:id', validate(idParamSchema, 'params'), getIncident);
router.get('/:id/photos/:index', getIncidentPhoto);

export default router;
