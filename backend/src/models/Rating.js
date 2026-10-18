import mongoose from 'mongoose';
import { RATING_TYPES } from '../config/constants.js';

/**
 * Rating schema – mutual ratings between workers and contractors.
 * TODO Phase 6: Add trust score aggregation, abuse detection.
 */
const ratingSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    fromUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    score: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    type: {
      type: String,
      enum: Object.values(RATING_TYPES),
      required: true,
    },
    comment: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  },
);

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
