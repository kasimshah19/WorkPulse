import { sendError } from '../utils/apiResponse.js';

/**
 * Ratings controller stubs.
 * TODO Phase 6: Implement mutual rating submission and retrieval.
 */

export const submitRating = (_req, res) => {
  sendError(res, 501, 'TODO Phase 6: Implement rating submission', 'NOT_IMPLEMENTED');
};

export const getUserRatings = (_req, res) => {
  sendError(res, 501, 'TODO Phase 6: Implement get ratings for a user', 'NOT_IMPLEMENTED');
};
