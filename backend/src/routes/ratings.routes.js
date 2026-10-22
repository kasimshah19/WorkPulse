import { Router } from 'express';
import Joi from 'joi';
import auth from '../middleware/auth.js';
import validate from '../middleware/validate.js';
import { ratingLimiter } from '../middleware/rateLimiter.js';
import {
  submitRating,
  getPending,
  getGivenRatings,
  getReceivedRatings,
  reportRatingHandler,
} from '../controllers/ratings.controller.js';

const router = Router();

const submitRatingSchema = Joi.object({
  jobId: Joi.string().required(),
  toUser: Joi.string().required(),
  score: Joi.number().min(1).max(5).required(),
  comment: Joi.string().max(300).optional().allow(''),
  tags: Joi.array().items(Joi.string()).optional(),
  paymentScore: Joi.number().min(1).max(5).optional(),
  safetyScore: Joi.number().min(1).max(5).optional(),
}).strict();

const reportRatingSchema = Joi.object({
  reason: Joi.string().min(5).max(500).required(),
}).strict();

const idParamSchema = Joi.object({
  id: Joi.string().required(),
}).strict();

// All rating endpoints require authenticated user
router.use(auth);

router.post('/', ratingLimiter, validate(submitRatingSchema), submitRating);
router.get('/pending', getPending);
router.get('/mine/given', getGivenRatings);
router.get('/received', getReceivedRatings);
router.post(
  '/:id/report',
  ratingLimiter,
  validate(idParamSchema, 'params'),
  validate(reportRatingSchema),
  reportRatingHandler
);

export default router;
