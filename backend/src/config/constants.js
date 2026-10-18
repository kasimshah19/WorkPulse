/**
 * Application-wide constants.
 */

/** Escrow transaction statuses */
export const ESCROW_STATUS = Object.freeze({
  CREATED: 'CREATED',
  FUNDED: 'FUNDED',
  CHECKED_IN: 'CHECKED_IN',
  CHECKED_OUT: 'CHECKED_OUT',
  APPROVED: 'APPROVED',
  RELEASED: 'RELEASED',
  DISPUTED: 'DISPUTED',
  CANCELLED: 'CANCELLED',
});

/**
 * Allowed state transitions for the escrow state machine.
 * Key = current status, Value = array of valid next statuses.
 */
export const ALLOWED_TRANSITIONS = Object.freeze({
  [ESCROW_STATUS.CREATED]: [ESCROW_STATUS.FUNDED, ESCROW_STATUS.CANCELLED],
  [ESCROW_STATUS.FUNDED]: [ESCROW_STATUS.CHECKED_IN, ESCROW_STATUS.CANCELLED, ESCROW_STATUS.DISPUTED],
  [ESCROW_STATUS.CHECKED_IN]: [ESCROW_STATUS.CHECKED_OUT, ESCROW_STATUS.DISPUTED],
  [ESCROW_STATUS.CHECKED_OUT]: [ESCROW_STATUS.APPROVED, ESCROW_STATUS.DISPUTED],
  [ESCROW_STATUS.APPROVED]: [ESCROW_STATUS.RELEASED],
  [ESCROW_STATUS.DISPUTED]: [ESCROW_STATUS.APPROVED, ESCROW_STATUS.CANCELLED],
  [ESCROW_STATUS.RELEASED]: [],
  [ESCROW_STATUS.CANCELLED]: [],
});

/** User roles */
export const USER_ROLES = Object.freeze({
  WORKER: 'worker',
  CONTRACTOR: 'contractor',
  ADMIN: 'admin',
});

/** Job statuses */
export const JOB_STATUS = Object.freeze({
  DRAFT: 'draft',
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

/** Incident types */
export const INCIDENT_TYPES = Object.freeze({
  SOS: 'SOS',
  INJURY: 'injury',
  DISPUTE: 'dispute',
});

/** Incident severity */
export const INCIDENT_SEVERITY = Object.freeze({
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical',
});

/** Rating types */
export const RATING_TYPES = Object.freeze({
  WORKER_SKILL: 'worker_skill',
  CONTRACTOR_PAYMENT_SAFETY: 'contractor_payment_safety',
});
