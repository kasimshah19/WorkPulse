import { sendError } from '../utils/apiResponse.js';

/**
 * Attendance controller stubs.
 * TODO Phase 4: Implement GPS check-in/out, selfie upload, distance validation.
 */

export const checkIn = (_req, res) => {
  sendError(res, 501, 'TODO Phase 4: Implement GPS + selfie check-in', 'NOT_IMPLEMENTED');
};

export const checkOut = (_req, res) => {
  sendError(res, 501, 'TODO Phase 4: Implement GPS check-out', 'NOT_IMPLEMENTED');
};

export const getAttendanceByJob = (_req, res) => {
  sendError(res, 501, 'TODO Phase 4: Implement attendance listing for a job', 'NOT_IMPLEMENTED');
};
