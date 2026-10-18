import { sendError } from '../utils/apiResponse.js';

/**
 * Incidents controller stubs.
 * TODO Phase 7: Implement incident reporting, SOS alerts, dispute flow.
 */

export const reportIncident = (_req, res) => {
  sendError(res, 501, 'TODO Phase 7: Implement incident reporting', 'NOT_IMPLEMENTED');
};

export const getIncident = (_req, res) => {
  sendError(res, 501, 'TODO Phase 7: Implement get incident details', 'NOT_IMPLEMENTED');
};

export const updateIncident = (_req, res) => {
  sendError(res, 501, 'TODO Phase 7: Implement incident status update', 'NOT_IMPLEMENTED');
};
