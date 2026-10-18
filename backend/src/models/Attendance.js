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
    selfieUrl: {
      type: String,
      default: '',
    },
    qrToken: {
      type: String,
      default: '',
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
    },
    deviceInfo: {
      platform: { type: String, default: '' },
      batteryLevel: { type: Number, default: null },
      accuracy: { type: Number, default: null },
    },
  },
  {
    timestamps: true,
  },
);

// Unique compound index: One attendance record per worker per job per day
attendanceSchema.index({ job: 1, worker: 1, date: 1 }, { unique: true });
attendanceSchema.index({ worker: 1, date: 1 });

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
