/**
 * Standardised API response helpers.
 */

/**
 * Send a success response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {*} data
 */
export const sendSuccess = (res, statusCode, message, data = null) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Send an error response.
 * @param {import('express').Response} res
 * @param {number} statusCode
 * @param {string} message
 * @param {string} [code]
 */
export const sendError = (res, statusCode, message, code = 'ERROR') => {
  return res.status(statusCode).json({
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  });
};
