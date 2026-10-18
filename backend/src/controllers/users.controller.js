import { sendError } from '../utils/apiResponse.js';

/**
 * Users controller stubs.
 * TODO Phase 1: Implement profile retrieval and update.
 */

export const getMe = (_req, res) => {
  sendError(res, 501, 'TODO Phase 1: Implement get current user profile', 'NOT_IMPLEMENTED');
};

export const updateMe = (_req, res) => {
  sendError(res, 501, 'TODO Phase 1: Implement update user profile', 'NOT_IMPLEMENTED');
};
