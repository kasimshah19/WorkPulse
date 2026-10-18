import clock from './clock.js';

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current or given date formatted as YYYY-MM-DD in Asia/Kolkata (IST).
 * @param {Date|string|number} [dateInput]
 * @returns {string} YYYY-MM-DD
 */
export function getISTDateString(dateInput) {
  const d = dateInput ? new Date(dateInput) : clock.now();
  // Using Intl.DateTimeFormat for accurate timezone conversion
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d); // en-CA gives YYYY-MM-DD format
}

/**
 * Returns current hours and minutes in IST as total minutes from midnight (0..1439).
 * @param {Date} [dateInput]
 * @returns {number}
 */
export function getISTMinutesFromMidnight(dateInput) {
  const d = dateInput ? new Date(dateInput) : clock.now();
  const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = timeFormatter.format(d).split(':');
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  return hours * 60 + minutes;
}

/**
 * Parses "HH:mm" string to minutes from midnight.
 * @param {string} timeStr "09:00"
 * @returns {number}
 */
export function parseTimeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map((v) => parseInt(v, 10));
  return (h || 0) * 60 + (m || 0);
}

/**
 * Checks if current time is within permitted check-in window.
 * Allowed window: [workingHours.start - earlyCheckInMin, workingHours.end]
 *
 * @param {Object} workingHours - { start: "09:00", end: "17:00" }
 * @param {number} earlyCheckInMin - e.g. 30
 * @param {Date} [currentDate]
 * @returns {{ allowed: boolean, reason?: string, currentMinutes: number, allowedStart: number, allowedEnd: number }}
 */
export function isCheckInWindowOpen(workingHours, earlyCheckInMin = 30, currentDate) {
  const currentMinutes = getISTMinutesFromMidnight(currentDate);
  const startMinutes = parseTimeStringToMinutes(workingHours?.start || '09:00');
  const endMinutes = parseTimeStringToMinutes(workingHours?.end || '17:00');

  const allowedStart = Math.max(0, startMinutes - earlyCheckInMin);
  const allowedEnd = endMinutes;

  if (currentMinutes < allowedStart) {
    return {
      allowed: false,
      reason: 'TOO_EARLY',
      currentMinutes,
      allowedStart,
      allowedEnd,
    };
  }

  if (currentMinutes > allowedEnd) {
    return {
      allowed: false,
      reason: 'SHIFT_ENDED',
      currentMinutes,
      allowedStart,
      allowedEnd,
    };
  }

  return {
    allowed: true,
    currentMinutes,
    allowedStart,
    allowedEnd,
  };
}

/**
 * Calculate hours worked between checkIn and checkOut as decimal rounded to 2 decimals.
 * Minimum 0 hours.
 * @param {Date} checkInAt
 * @param {Date} checkOutAt
 * @returns {number}
 */
export function calculateHoursWorked(checkInAt, checkOutAt) {
  if (!checkInAt || !checkOutAt) return 0;
  const start = new Date(checkInAt).getTime();
  const end = new Date(checkOutAt).getTime();
  if (end <= start) return 0;
  const diffMs = end - start;
  const hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 100) / 100;
}
