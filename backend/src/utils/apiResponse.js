/**
 * Standardised API response helpers conforming to docs/api-contract.md
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {*} data
 * @param {object} [pagination]
 */
export const sendSuccess = (res, statusCode = 200, data = null, pagination = null) => {
  const payload = {
    success: true,
    data,
    error: null,
  };

  if (pagination) {
    payload.pagination = pagination;
  }

  return res.status(statusCode).json(payload);
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [code]
 * @param {*} [details]
 */
export const sendError = (res, statusCode = 400, message = 'An error occurred', code = 'ERROR', details = null) => {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
};

/**
 * Object-style helper for controllers that construct responses directly
 */
export const apiResponse = {
  success: (data = null, pagination = null) => ({
    success: true,
    data,
    error: null,
    ...(pagination ? { pagination } : {}),
  }),
  error: (code = 'ERROR', message = 'An error occurred', details = null) => ({
    success: false,
    data: null,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  }),
};

