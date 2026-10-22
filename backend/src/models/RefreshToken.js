import mongoose from 'mongoose';

/**
 * RefreshToken Schema (17th collection in WorkPulse)
 *
 * Implements rotating refresh token pattern with cryptographic hashing,
 * family revocation for token reuse detection, and TTL expiration.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    familyId: {
      type: String,
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedBy: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// TTL index to automatically purge expired refresh tokens from database
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound index for active session lookups and revocations
refreshTokenSchema.index({ user: 1, revokedAt: 1 });

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema, 'refreshtokens');

export default RefreshToken;
