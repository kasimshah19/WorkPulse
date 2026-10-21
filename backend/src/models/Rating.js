import mongoose from 'mongoose';
import { RATING_TYPES } from '../config/constants.js';

/**
 * Rating Schema
 * Two-way reputation reviews between workers and contractors.
 * Double-blind: hidden until both sides submit or rating window expires.
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
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    comment: {
      type: String,
      trim: true,
      default: '',
      maxlength: 300,
    },
    revealedAt: {
      type: Date,
      default: null,
      index: true,
    },
    isHidden: {
      type: Boolean,
      default: false,
      index: true,
    },
    hiddenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    hiddenReason: {
      type: String,
      default: null,
    },
    hiddenAt: {
      type: Date,
      default: null,
    },
    reportedByRecipient: {
      type: Boolean,
      default: false,
    },
    reportReason: {
      type: String,
      default: null,
    },
    reportedAt: {
      type: Date,
      default: null,
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
ratingSchema.index({ toUser: 1, revealedAt: 1, isHidden: 1 });
ratingSchema.index({ toUser: 1, score: 1 });

/**
 * Immutability Guard:
 * score, type, job, fromUser, toUser cannot be modified after initial creation.
 */
ratingSchema.pre('save', function (next) {
  if (!this.isNew) {
    if (
      this.isModified('score') ||
      this.isModified('type') ||
      this.isModified('job') ||
      this.isModified('fromUser') ||
      this.isModified('toUser')
    ) {
      return next(new Error('IMMUTABLE_FIELD: Core rating fields cannot be modified after creation'));
    }
  }
  next();
});

const checkImmutable = function (next) {
  const update = this.getUpdate();
  if (!update) return next();
  const modified = { ...update, ...(update.$set || {}) };
  const immutableFields = ['score', 'type', 'job', 'fromUser', 'toUser'];

  for (const field of immutableFields) {
    if (modified[field] !== undefined) {
      return next(new Error(`IMMUTABLE_FIELD: Cannot update immutable field '${field}'`));
    }
  }
  next();
};

ratingSchema.pre('findOneAndUpdate', checkImmutable);
ratingSchema.pre('updateOne', checkImmutable);
ratingSchema.pre('updateMany', checkImmutable);

const Rating = mongoose.model('Rating', ratingSchema);

export default Rating;
