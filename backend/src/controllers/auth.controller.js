import { sendError } from '../utils/apiResponse.js';

/**
 * Auth controller stubs.
 * TODO Phase 1: Implement phone/OTP registration, login, and token refresh.
 */

export const register = (_req, res) => {
  sendError(res, 501, 'TODO Phase 1: Implement user registration with phone/OTP', 'NOT_IMPLEMENTED');
};

export const login = (_req, res) => {
  sendError(res, 501, 'TODO Phase 1: Implement phone/OTP login', 'NOT_IMPLEMENTED');
};

export const refreshToken = (_req, res) => {
  sendError(res, 501, 'TODO Phase 1: Implement JWT token refresh', 'NOT_IMPLEMENTED');
};
