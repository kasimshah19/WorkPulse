import { sendError } from '../utils/apiResponse.js';

/**
 * Joi validation middleware factory.
 * Returns a named function `validateSchema` so route inspection / auditing can identify it.
 *
 * @param {import('joi').Schema} schema - Joi schema to validate against
 * @param {'body'|'query'|'params'} source - Which part of the request to validate
 * @returns {Function} Express middleware
 */
const validate = (schema, source = 'body') => {
  const validateSchema = (req, res, next) => {
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

  validateSchema.isValidator = true;
  return validateSchema;
};

export default validate;
