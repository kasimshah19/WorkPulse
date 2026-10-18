import mongoose from 'mongoose';
import { RATING_TYPES } from '../config/constants.js';

/**
 * Rating Schema
 * Two-way reputation reviews between workers and contractors.
 */
const ratingSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(RATING_TYPES),
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating score must be an integer between 1 and 5',
      },
    },
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: 500,
    },
    isHidden: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes
ratingSchema.index(
  { job: 1, fromUser: 1, toUser: 1, type: 1 },
  { unique: true },
);
ratingSchema.index({ toUser: 1, score: 1 });

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
