import { sendError } from '../utils/apiResponse.js';

/**
 * Catch-all for undefined routes.
 */
const notFound = (req, res) => {
  sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`, 'NOT_FOUND');
};

export default notFound;
