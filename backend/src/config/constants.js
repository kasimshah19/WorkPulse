/**
 * WorkPulse System Constants and Enums
 * Phase 1 Blueprint
 */

/** User Roles */
export const USER_ROLES = Object.freeze({
  WORKER: 'worker',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
});

/** Supported Languages */
export const LANGUAGE_PREFERENCE = Object.freeze({
  HINDI: 'hi',
  MARATHI: 'mr',
  ENGLISH: 'en',
});

/** Standard Blue-Collar Skills Enum */
export const SKILLS = Object.freeze([
  'mason', // राजमिस्त्री
  'carpenter', // बढ़ई
  'plumber', // प्लंबर
  'electrician', // इलेक्ट्रीशियन
  'painter', // पेंटर
  'welder', // वेल्डर
  'tile_worker', // टाइल कारीगर
  'laborer', // सामान्य मजदूर / हेल्पर
  'bar_bender', // सरिया बांधने वाला
  'concrete_worker', // ढलाई कारीगर
  'driver', // ड्राइवर
  'cleaner', // सफाई कर्मचारी
  'gardener', // माली
  'cook', // रसोइया
]);

/** KYC Status */
export const KYC_STATUS = Object.freeze({
  NONE: 'none',
  SIMULATED_VERIFIED: 'simulated_verified',
});

/** OTP Purposes */
export const OTP_PURPOSE = Object.freeze({
  LOGIN: 'login',
  REGISTER: 'register',
});

/** Wallet Status */
export const WALLET_STATUS = Object.freeze({
  ACTIVE: 'active',
  FROZEN: 'frozen',
});

/** Job Statuses */
export const JOB_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  OPEN: 'OPEN',
  FILLED: 'FILLED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
});

/** Job Creation Channel */
export const JOB_CREATED_VIA = Object.freeze({
  APP: 'app',
  VOICE: 'voice',
  SMS: 'sms',
});

/** Job Application Status */
export const APPLICATION_STATUS = Object.freeze({
  NOTIFIED: 'NOTIFIED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
  ASSIGNED: 'ASSIGNED',
});

/** Notification Channels */
export const NOTIFICATION_CHANNEL = Object.freeze({
  SOCKET: 'socket',
  SMS: 'sms',
  PUSH: 'push',
});

/** Attendance Status */
export const ATTENDANCE_STATUS = Object.freeze({
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  MISSED: 'MISSED',
  REJECTED: 'REJECTED',
});

/** Attendance Verification Method */
export const ATTENDANCE_METHOD = Object.freeze({
  GPS_SELFIE: 'gps_selfie',
  GPS_QR: 'gps_qr',
});

/** Contractor Signoff Status */
export const SIGNOFF_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  DISPUTED: 'DISPUTED',
});

/** Escrow Transaction Statuses */
export const ESCROW_STATUS = Object.freeze({
  CREATED: 'CREATED',
  FUNDED: 'FUNDED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  APPROVED: 'APPROVED',
  RELEASED: 'RELEASED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
});

/**
 * Escrow State Machine Transitions Map
 * Defines valid next states for each escrow state.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [ESCROW_STATUS.CREATED]: [ESCROW_STATUS.FUNDED, ESCROW_STATUS.CANCELLED],
  [ESCROW_STATUS.FUNDED]: [
    ESCROW_STATUS.CHECKED_IN,
    ESCROW_STATUS.CANCELLED,
    ESCROW_STATUS.REFUNDED,
    ESCROW_STATUS.DISPUTED,
  ],
  [ESCROW_STATUS.CHECKED_IN]: [ESCROW_STATUS.CHECKED_OUT, ESCROW_STATUS.DISPUTED],
  [ESCROW_STATUS.CHECKED_OUT]: [ESCROW_STATUS.APPROVED, ESCROW_STATUS.DISPUTED],
  [ESCROW_STATUS.APPROVED]: [ESCROW_STATUS.RELEASED],
  [ESCROW_STATUS.DISPUTED]: [
    ESCROW_STATUS.APPROVED,
    ESCROW_STATUS.REFUNDED,
    ESCROW_STATUS.RELEASED,
  ],
  [ESCROW_STATUS.RELEASED]: [], // Terminal State
  [ESCROW_STATUS.REFUNDED]: [], // Terminal State
  [ESCROW_STATUS.CANCELLED]: [], // Terminal State
});

/** Ledger Entry Types */
export const LEDGER_ENTRY_TYPE = Object.freeze({
  DEBIT: 'DEBIT',
  CREDIT: 'CREDIT',
});

/** Double-Entry Ledger Accounts */
export const LEDGER_ACCOUNT = Object.freeze({
  CONTRACTOR_WALLET: 'CONTRACTOR_WALLET',
  ESCROW_HOLD: 'ESCROW_HOLD',
  WORKER_WALLET: 'WORKER_WALLET',
  PLATFORM_FEE: 'PLATFORM_FEE',
  REFUND: 'REFUND',
});

/** Rating Types */
export const RATING_TYPES = Object.freeze({
  WORKER_SKILL: 'WORKER_SKILL',
  CONTRACTOR_PAYMENT: 'CONTRACTOR_PAYMENT',
  CONTRACTOR_SAFETY: 'CONTRACTOR_SAFETY',
});

/** Incident Types */
export const INCIDENT_TYPES = Object.freeze({
  SOS: 'SOS',
  INJURY: 'INJURY',
  DISPUTE: 'DISPUTE',
  HARASSMENT: 'HARASSMENT',
  OTHER: 'OTHER',
});

/** Incident Severity */
export const INCIDENT_SEVERITY = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

/** Incident Status */
export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
});

/** Dispute Reasons */
export const DISPUTE_REASON = Object.freeze({
  NOT_APPROVED: 'NOT_APPROVED',
  WAGE_MISMATCH: 'WAGE_MISMATCH',
  ATTENDANCE_DENIED: 'ATTENDANCE_DENIED',
  WORK_QUALITY: 'WORK_QUALITY',
  OTHER: 'OTHER',
});

/** Dispute Status */
export const DISPUTE_STATUS = Object.freeze({
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED_FOR_WORKER: 'RESOLVED_FOR_WORKER',
  RESOLVED_FOR_CONTRACTOR: 'RESOLVED_FOR_CONTRACTOR',
  SPLIT: 'SPLIT',
  CLOSED: 'CLOSED',
});

/** Dispute Evidence Types */
export const DISPUTE_EVIDENCE_TYPE = Object.freeze({
  SELFIE: 'selfie',
  GPS_LOG: 'gps_log',
  ATTENDANCE: 'attendance',
  PHOTO: 'photo',
  NOTE: 'note',
});

/** Notification Types */
export const NOTIFICATION_TYPE = Object.freeze({
  JOB_MATCH: 'JOB_MATCH',
  JOB_ASSIGNED: 'JOB_ASSIGNED',
  CHECKIN_CONFIRMED: 'CHECKIN_CONFIRMED',
  SIGNOFF_REQUEST: 'SIGNOFF_REQUEST',
  SIGNOFF_DONE: 'SIGNOFF_DONE',
  PAYMENT_RELEASED: 'PAYMENT_RELEASED',
  DISPUTE_UPDATE: 'DISPUTE_UPDATE',
  SOS: 'SOS',
  RATING_REQUEST: 'RATING_REQUEST',
  SYSTEM: 'SYSTEM',
});

/** Notification Delivery Status */
export const NOTIFICATION_STATUS = Object.freeze({
  PENDING: 'PENDING',
  SENT: 'SENT',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  READ: 'READ',
});
