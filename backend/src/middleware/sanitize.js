import mongoose from 'mongoose';
import { sendError } from '../utils/apiResponse.js';

/**
 * Strips HTML and script tags from text.
 * Pure native regex implementation without external dependencies.
 */
export const stripHtml = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

/**
 * Recursively inspects an object to detect NoSQL injection patterns:
 * - Keys starting with "$" (MongoDB query operators like $ne, $gt, $where)
 * - Keys containing "." (path traversal / prototype pollution)
 * - Objects passed where scalar values are expected in query strings
 */
const detectNoSqlInjection = (target, path = '') => {
  if (target === null || target === undefined) return null;

  if (typeof target === 'object') {
    for (const key of Object.keys(target)) {
      if (key.startsWith('$')) {
        return `Prohibited operator "${key}" detected at ${path ? path + '.' : ''}${key}`;
      }
      if (key.includes('.')) {
        return `Prohibited dot notation in key "${key}" detected at ${path ? path + '.' : ''}${key}`;
      }
      const deepViolation = detectNoSqlInjection(target[key], path ? `${path}.${key}` : key);
      if (deepViolation) return deepViolation;
    }
  }

  return null;
};

/**
 * Recursively cleans free-text strings by stripping HTML.
 */
const sanitizeObjectStrings = (target) => {
  if (!target || typeof target !== 'object') return target;

  for (const [key, val] of Object.entries(target)) {
    if (typeof val === 'string') {
      target[key] = stripHtml(val);
    } else if (typeof val === 'object' && val !== null) {
      sanitizeObjectStrings(val);
    }
  }
  return target;
};

/**
 * Middleware: Rejects NoSQL injection attempts and strips HTML from user inputs.
 */
export const sanitizeInput = (req, res, next) => {
  // Check params, query, and body for NoSQL operators
  const bodyViolation = detectNoSqlInjection(req.body, 'body');
  if (bodyViolation) {
    return sendError(res, 400, `Invalid input: ${bodyViolation}`, 'INVALID_INPUT');
  }

  const queryViolation = detectNoSqlInjection(req.query, 'query');
  if (queryViolation) {
    return sendError(res, 400, `Invalid input: ${queryViolation}`, 'INVALID_INPUT');
  }

  const paramsViolation = detectNoSqlInjection(req.params, 'params');
  if (paramsViolation) {
    return sendError(res, 400, `Invalid input: ${paramsViolation}`, 'INVALID_INPUT');
  }

  // Sanitize free-text fields in body
  if (req.body && typeof req.body === 'object') {
    sanitizeObjectStrings(req.body);
  }

  next();
};

/**
 * Middleware: HTTP Parameter Pollution protection.
 * Rejects unexpected array values where scalar query/body parameters are expected.
 */
export const preventParamPollution = (expectedScalarFields = []) => {
  return (req, res, next) => {
    for (const field of expectedScalarFields) {
      if (req.query && Array.isArray(req.query[field])) {
        return sendError(res, 400, `Parameter "${field}" cannot be an array`, 'INVALID_INPUT');
      }
      if (req.body && Array.isArray(req.body[field])) {
        return sendError(res, 400, `Field "${field}" cannot be an array`, 'INVALID_INPUT');
      }
    }
    next();
  };
};

/**
 * Middleware: Validates that a route param (e.g. :id, :jobId) is a valid MongoDB ObjectId.
 * Prevents CastError crashes (500) and returns 400 INVALID_ID immediately.
 */
export const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const value = req.params[paramName];
    if (value && !mongoose.Types.ObjectId.isValid(value)) {
      return sendError(res, 400, `Invalid identifier format for parameter "${paramName}"`, 'INVALID_ID');
    }
    next();
  };
};

/**
 * Global param validator: automatically checks any param ending with "Id" or named "id".
 */
export const validateAllIdParams = (req, res, next) => {
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      if (key === 'id' || key.toLowerCase().endsWith('id')) {
        // Exclude non-mongo id parameters like phone, index, code if any
        if (value && !mongoose.Types.ObjectId.isValid(value)) {
          return sendError(res, 400, `Invalid ObjectId in route parameter :${key}`, 'INVALID_ID');
        }
      }
    }
  }
  next();
};

export default {
  stripHtml,
  sanitizeInput,
  preventParamPollution,
  validateObjectId,
  validateAllIdParams,
};
