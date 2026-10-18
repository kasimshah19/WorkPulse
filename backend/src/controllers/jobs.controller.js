import { sendError } from '../utils/apiResponse.js';

/**
 * Jobs controller stubs.
 * TODO Phase 2: Implement job CRUD, geo-search, and worker assignment.
 */

export const createJob = (_req, res) => {
  sendError(res, 501, 'TODO Phase 2: Implement job creation', 'NOT_IMPLEMENTED');
};

export const getJobs = (_req, res) => {
  sendError(res, 501, 'TODO Phase 2: Implement job listing with geo-search', 'NOT_IMPLEMENTED');
};

export const getJob = (_req, res) => {
  sendError(res, 501, 'TODO Phase 2: Implement get job by ID', 'NOT_IMPLEMENTED');
};

export const updateJob = (_req, res) => {
  sendError(res, 501, 'TODO Phase 2: Implement job update', 'NOT_IMPLEMENTED');
};

export const applyToJob = (_req, res) => {
  sendError(res, 501, 'TODO Phase 2: Implement worker job application', 'NOT_IMPLEMENTED');
};
