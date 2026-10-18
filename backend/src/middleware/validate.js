import { sendError } from '../utils/apiResponse.js';

/**
 * Joi validation middleware factory.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against
 * @param {'body'|'query'|'params'} source - Which part of the request to validate
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const messages = error.details.map((d) => d.message).join(', ');
      return sendError(res, 400, messages, 'VALIDATION_ERROR');
    }

    req[source] = value;
    next();
  };
};

export default validate;
