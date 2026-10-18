import mongoose from 'mongoose';

/**
 * Attendance schema – proof-of-work check-in/check-out records.
 * TODO Phase 4: Add selfie verification, distance validation, anti-spoofing.
 */
const attendanceSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    worker: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    checkInAt: {
      type: Date,
    },
    checkOutAt: {
      type: Date,
    },
    checkInLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    checkOutLocation: {
      type: {
        type: String,
        enum: ['Point'],
      },
      coordinates: {
        type: [Number],
      },
    },
    selfieUrl: {
      type: String,
      default: '',
    },
    distanceFromSite: {
      type: Number, // in metres
    },
  },
  {
    timestamps: true,
  },
);

const Attendance = mongoose.model('Attendance', attendanceSchema);

export default Attendance;
