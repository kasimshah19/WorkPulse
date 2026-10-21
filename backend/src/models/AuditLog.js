import mongoose from 'mongoose';

/**
 * AuditLog Schema (APPEND-ONLY)
 * Immutable regulatory audit trail for DPDP compliance, escrow events, and state changes.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.Mixed, // ObjectId ref to User or "system" string
      required: true,
      index: true,
    },
    action: {
      type: String, // e.g. ESCROW_RELEASED, ATTENDANCE_OVERRIDDEN
      required: true,
      index: true,
    },
    entityType: {
      type: String, // e.g. EscrowTransaction, Job, Dispute
      required: true,
      index: true,
    },
    entityId: {
      type: String,
      required: true,
      index: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    ip: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    targetModel: {
      type: String,
      default: null,
    },
    target: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // Only createdAt for append-only logs
  },
);

// Fallback hook for target / targetModel
auditLogSchema.pre('validate', function (next) {
  if (!this.entityType && (this.targetModel || this.get('targetModel'))) {
    this.entityType = this.targetModel || this.get('targetModel');
  }
  if (!this.entityId && (this.target || this.get('target'))) {
    const t = this.target || this.get('target');
    this.entityId = t.toString();
  }
  next();
});

// Guard: Enforce append-only invariant
auditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('Audit logs are strictly immutable.'));
  }
  next();
});

// Indexes
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
