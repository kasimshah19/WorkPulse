import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  createRating,
  getPendingRatings,
  reportRating,
  hideRating,
  unhideRating,
} from '../services/rating.service.js';
import Rating from '../models/Rating.js';
import { RATING_TYPES } from '../config/constants.js';

// Schema for creating rating
const createRatingSchema = Joi.object({
  jobId: Joi.string().required(),
  toUserId: Joi.string().required(),
  type: Joi.string()
    .valid(...Object.values(RATING_TYPES))
    .required(),
  score: Joi.number().integer().min(1).max(5).required(),
  tags: Joi.array().items(Joi.string().trim()).max(4).default([]),
  comment: Joi.string().max(300).allow('').default(''),
});

/**
 * POST /api/v1/ratings
 * Worker or Contractor submits a rating.
 */
export const submitRating = asyncHandler(async (req, res) => {
  const { error, value } = createRatingSchema.validate(req.body);
  if (error) {
    return sendError(res, 400, error.details[0].message, 'VALIDATION_ERROR');
  }

  const result = await createRating(req.user._id, value);
  return sendSuccess(res, 201, result);
});

/**
 * GET /api/v1/ratings/pending
 * Returns list of rateable items currently open for the user.
 */
export const getPending = asyncHandler(async (req, res) => {
  const pending = await getPendingRatings(req.user._id);
  return sendSuccess(res, 200, { pending });
});

/**
 * GET /api/v1/ratings/mine/given?jobId=
 * Returns author's own submitted ratings (revealed or waiting for other side).
 */
export const getGivenRatings = asyncHandler(async (req, res) => {
  const { jobId } = req.query;
  const filter = { fromUser: req.user._id };
  if (jobId) filter.job = jobId;

  const ratings = await Rating.find(filter)
    .populate('toUser', 'name role')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .lean();

  const formatted = ratings.map((r) => ({
    ...r,
    status: r.revealedAt ? 'REVEALED' : 'WAITING_FOR_OTHER_SIDE',
  }));

  return sendSuccess(res, 200, { ratings: formatted });
});

/**
 * GET /api/v1/ratings/received
 * Returns recipient's revealed, non-hidden ratings.
 */
export const getReceivedRatings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const filter = {
    toUser: req.user._id,
    revealedAt: { $ne: null },
    isHidden: false,
  };

  const ratings = await Rating.find(filter)
    .populate('fromUser', 'name')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const total = await Rating.countDocuments(filter);

  // Mask author name to first name + initial ("Ramesh K.")
  const formatted = ratings.map((r) => {
    const fullName = r.fromUser?.name || 'Verified User';
    const parts = fullName.split(' ');
    const maskedName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];

    return {
      _id: r._id,
      job: r.job,
      author: maskedName,
      type: r.type,
      score: r.score,
      tags: r.tags || [],
      comment: r.comment,
      revealedAt: r.revealedAt,
      createdAt: r.createdAt,
      reportedByRecipient: r.reportedByRecipient,
    };
  });

  return sendSuccess(res, 200, {
    ratings: formatted,
    total,
    page: parseInt(page, 10),
  });
});

/**
 * POST /api/v1/ratings/:id/report
 * Recipient flags an unfair rating for admin review.
 */
export const reportRatingHandler = asyncHandler(async (req, res) => {
  const { reason = '' } = req.body;
  const rating = await reportRating(req.params.id, req.user._id, reason);
  return sendSuccess(res, 200, {
    message: 'Rating reported for administrative review',
    ratingId: rating._id,
  });
});

/**
 * GET /api/v1/admin/ratings
 * Admin: List ratings with optional filters.
 */
export const getAdminRatings = asyncHandler(async (req, res) => {
  const { hidden, reported, page = 1, limit = 20 } = req.query;
  const filter = {};

  if (hidden === 'true') filter.isHidden = true;
  if (hidden === 'false') filter.isHidden = false;
  if (reported === 'true') filter.reportedByRecipient = true;

  const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
  const ratings = await Rating.find(filter)
    .populate('fromUser', 'name phone role')
    .populate('toUser', 'name phone role')
    .populate('job', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit, 10))
    .lean();

  const total = await Rating.countDocuments(filter);
  return sendSuccess(res, 200, { ratings, total, page: parseInt(page, 10) });
});

/**
 * POST /api/v1/admin/ratings/:id/hide
 * Admin: Hide a rating with a required reason.
 */
export const hideRatingHandler = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const rating = await hideRating(req.params.id, req.user._id, reason);
  return sendSuccess(res, 200, { message: 'Rating hidden', rating });
});

/**
 * POST /api/v1/admin/ratings/:id/unhide
 * Admin: Unhide a hidden rating.
 */
export const unhideRatingHandler = asyncHandler(async (req, res) => {
  const rating = await unhideRating(req.params.id, req.user._id);
  return sendSuccess(res, 200, { message: 'Rating unhidden', rating });
});
