import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  triggerSos,
  updateSosLocation,
  acknowledgeSos,
  resolveSos,
} from '../services/sos.service.js';
import {
  createIncident,
  getMyIncidents,
  getJobIncidents,
  getIncidentById,
  getIncidentPhotoPath,
  addAdminNote,
  getAdminIncidents,
  getAdminSafetyStats,
} from '../services/incident.service.js';
import Incident from '../models/Incident.js';
import { INCIDENT_TYPES, INCIDENT_SEVERITY } from '../config/constants.js';

// Joi Schemas
const sosSchema = Joi.object({
  lat: Joi.number().allow(null).optional(),
  lng: Joi.number().allow(null).optional(),
  accuracy: Joi.number().allow(null).optional(),
  locationAgeSec: Joi.number().allow(null).optional(),
  idempotencyKey: Joi.string().required(),
  jobId: Joi.string().allow(null, '').optional(),
  notifyContractor: Joi.boolean().default(true),
  clientTimestamp: Joi.date().optional(),
});

const locationUpdateSchema = Joi.object({
  lat: Joi.number().required(),
  lng: Joi.number().required(),
  accuracy: Joi.number().allow(null).optional(),
});

const resolveSchema = Joi.object({
  resolutionType: Joi.string().required(),
  notes: Joi.string().allow('').default(''),
});

const createIncidentSchema = Joi.object({
  type: Joi.string()
    .valid(...Object.values(INCIDENT_TYPES))
    .required(),
  severity: Joi.string()
    .valid(...Object.values(INCIDENT_SEVERITY))
    .default(INCIDENT_SEVERITY.MEDIUM),
  description: Joi.string().min(10).required(),
  jobId: Joi.string().allow(null, '').optional(),
  accusedUserId: Joi.string().allow(null, '').optional(),
  lat: Joi.number().allow(null).optional(),
  lng: Joi.number().allow(null).optional(),
});

/**
 * POST /api/v1/incidents/sos
 * Worker triggers SOS. Never fails for missing GPS or duplicate retries.
 */
export const postSos = asyncHandler(async (req, res) => {
  if (req.user.role !== 'worker') {
    return sendError(res, 403, 'Only workers can trigger SOS', 'FORBIDDEN');
  }

  const { error, value } = sosSchema.validate(req.body);
  if (error) {
    return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
  }

  const result = await triggerSos(req.user._id, value);
  return sendSuccess(res, 201, result);
});

/**
 * POST /api/v1/incidents/:id/location
 * Reporter appends location update during active SOS.
 */
export const postLocationUpdate = asyncHandler(async (req, res) => {
  const { error, value } = locationUpdateSchema.validate(req.body);
  if (error) {
    return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
  }

  const result = await updateSosLocation(req.params.id, req.user._id, value);
  return sendSuccess(res, 200, result);
});

/**
 * POST /api/v1/incidents/:id/acknowledge
 * Alerted user or admin acknowledges the incident.
 */
export const postAcknowledge = asyncHandler(async (req, res) => {
  const updated = await acknowledgeSos(req.params.id, req.user._id, req.user.role);
  return sendSuccess(res, 200, {
    message: 'Incident acknowledged',
    incident: updated,
  });
});

/**
 * POST /api/v1/incidents/:id/resolve
 * Reporter, job contractor, or admin marks incident RESOLVED.
 */
export const postResolve = asyncHandler(async (req, res) => {
  const { error, value } = resolveSchema.validate(req.body);
  if (error) {
    return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
  }

  const updated = await resolveSos(req.params.id, req.user._id, req.user.role, value);
  return sendSuccess(res, 200, {
    message: 'Incident resolved',
    incident: updated,
  });
});

/**
 * POST /api/v1/incidents
 * Non-SOS report (injury, harassment, dispute, other) with optional photos.
 */
export const postIncident = asyncHandler(async (req, res) => {
  const { error, value } = createIncidentSchema.validate(req.body);
  if (error) {
    return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
  }

  const files = req.files || [];
  const incident = await createIncident(req.user._id, req.user.role, value, files);
  return sendSuccess(res, 201, { incident });
});

/**
 * GET /api/v1/incidents/my
 * Returns incidents reported by the logged-in user.
 */
export const getMy = asyncHandler(async (req, res) => {
  const result = await getMyIncidents(req.user._id, req.query);
  return sendSuccess(res, 200, result);
});

/**
 * GET /api/v1/jobs/:id/incidents
 * Returns incidents on a contractor's job (excluding ADMIN_ONLY).
 */
export const getJobIncidentsHandler = asyncHandler(async (req, res) => {
  const incidents = await getJobIncidents(req.user._id, req.params.id);
  return sendSuccess(res, 200, { incidents });
});

/**
 * GET /api/v1/incidents/:id
 * Incident detail with timeline and trail, honoring visibility rules.
 */
export const getIncident = asyncHandler(async (req, res) => {
  const incident = await getIncidentById(req.params.id, req.user);
  return sendSuccess(res, 200, { incident });
});

/**
 * GET /api/v1/incidents/:id/photos/:index
 * Authenticated photo download.
 */
export const getIncidentPhoto = asyncHandler(async (req, res) => {
  const photoPath = await getIncidentPhotoPath(req.params.id, req.params.index, req.user);
  return res.sendFile(photoPath);
});

/**
 * GET /api/v1/admin/incidents
 * Admin queue: SOS/Critical first.
 */
export const getAdminIncidentsHandler = asyncHandler(async (req, res) => {
  const result = await getAdminIncidents(req.query);
  return sendSuccess(res, 200, result);
});

/**
 * GET /api/v1/admin/incidents/:id
 * Admin: Full incident bundle including context history.
 */
export const getAdminIncidentDetail = asyncHandler(async (req, res) => {
  const incident = await getIncidentById(req.params.id, req.user);

  // Context: Previous SOS count and false alarms by reporter
  const reporterId = incident.reportedBy?._id || incident.reportedBy;
  const [reporterSosCount, falseAlarmCount] = await Promise.all([
    Incident.countDocuments({ reportedBy: reporterId, type: INCIDENT_TYPES.SOS }),
    Incident.countDocuments({ reportedBy: reporterId, resolutionType: 'FALSE_ALARM' }),
  ]);

  return sendSuccess(res, 200, {
    incident,
    reporterContext: {
      totalSosReported: reporterSosCount,
      falseAlarmCount,
    },
  });
});

/**
 * POST /api/v1/admin/incidents/:id/note
 * Admin adds note to timeline.
 */
export const postAdminNote = asyncHandler(async (req, res) => {
  const { text } = req.body;
  const updated = await addAdminNote(req.params.id, req.user._id, text);
  return sendSuccess(res, 200, { message: 'Note added', incident: updated });
});

/**
 * GET /api/v1/admin/safety/stats
 * Admin safety metrics & SLA dashboard.
 */
export const getSafetyStats = asyncHandler(async (_req, res) => {
  const stats = await getAdminSafetyStats();
  return sendSuccess(res, 200, stats);
});
