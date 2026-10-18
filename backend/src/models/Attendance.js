import mongoose from 'mongoose';
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_METHOD,
  SIGNOFF_STATUS,
} from '../config/constants.js';

/**
 * Attendance Schema
 * Immutable proof-of-work records with GPS telemetry and selfie verification.
 */
const attendanceSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD'],
    },
    checkInAt: {
      type: Date,
      default: null,
    },
    checkOutAt: {
      type: Date,
      default: null,
    },
    checkInLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lon, lat]
      },
    },
    checkOutLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [lon, lat]
      },
    },
    checkInDistanceMeters: {
      type: Number,
      default: null,
    },
    checkOutDistanceMeters: {
      type: Number,
      default: null,
    },
    checkInAccuracyM: {
      type: Number,
      default: null,
    },
    checkOutAccuracyM: {
      type: Number,
      default: null,
    },
    clientTimestamp: {
      type: Date,
      default: null,
    },
    selfieUrl: {
      type: String,
      default: '',
    },
    selfieCheckoutUrl: {
      type: String,
      default: '',
    },
    qrToken: {
      type: String,
      default: '',
    },
    qrUsed: {
      type: Boolean,
      default: false,
    },
    autoCheckout: {
      type: Boolean,
      default: false,
    },
    flags: {
      type: [String],
      default: [],
    },
    method: {
      type: String,
      enum: Object.values(ATTENDANCE_METHOD),
      default: ATTENDANCE_METHOD.GPS_SELFIE,
    },
    hoursWorked: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.CHECKED_IN,
      index: true,
    },
    rejectionReason: {
      type: String,
      default: '',
    },
    contractorSignoff: {
      status: {
        type: String,
        enum: Object.values(SIGNOFF_STATUS),
        default: SIGNOFF_STATUS.PENDING,
      },
      at: {
        type: Date,
        default: null,
      },
      by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      reason: {
        type: String,
        default: '',
      },
    },
    deviceInfo: {
      platform: { type: String, default: '' },
      batteryLevel: { type: Number, default: null },
      accuracy: { type: Number, default: null },
      userAgent: { type: String, default: '' },
      screen: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
  },
);

// Unique compound index: One attendance record per worker per job per day
attendanceSchema.index({ job: 1, worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ worker: 1, date: 1 });

const IMMUTABLE_FIELDS = [
  'checkInAt',
  'checkInLocation',
  'checkInDistanceMeters',
  'selfieUrl',
  'checkOutAt',
  'checkOutLocation',
  'hoursWorked',
];

const TERMINAL_STATUSES = [
  ATTENDANCE_STATUS.CHECKED_OUT,
  ATTENDANCE_STATUS.MISSED,
  ATTENDANCE_STATUS.REJECTED,
];

attendanceSchema.post('init', function () {
  this._originalStatus = this.status;
});

attendanceSchema.post('save', function () {
  this._originalStatus = this.status;
});

// Guard: Prevent modification of core proof-of-work fields once checked out / closed
attendanceSchema.pre('save', function (next) {
  if (!this.isNew) {
    const isAlreadyClosed = this._originalStatus
      ? TERMINAL_STATUSES.includes(this._originalStatus)
      : (!this.isModified('status') && TERMINAL_STATUSES.includes(this.status));

    if (isAlreadyClosed) {
      for (const field of IMMUTABLE_FIELDS) {
        if (this.isModified(field)) {
          return next(
            new Error(`Field '${field}' is immutable once attendance status is ${this.status}. Only contractor sign-off may be updated.`),
          );
        }
      }
    }
  }
  next();
});

attendanceSchema.pre(['findOneAndUpdate', 'updateOne'], async function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  const doc = await this.model.findOne(this.getQuery());
  if (doc && TERMINAL_STATUSES.includes(doc.status)) {
    const updates = {
      ...(update.$set || {}),
      ...(update.$unset || {}),
      ...update,
    };
    for (const field of IMMUTABLE_FIELDS) {
      if (updates[field] !== undefined) {
        return next(
          new Error(`Field '${field}' is immutable once attendance status is ${doc.status}. Only contractor sign-off may be updated.`),
        );
      }
    }
  }
  next();
});

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
