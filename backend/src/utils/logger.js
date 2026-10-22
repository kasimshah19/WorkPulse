import env from '../config/env.js';

/**
 * Mask sensitive Indian phone numbers: +919876543210 -> +91XXXXX43210 or +91XXXXX3210
 */
export const maskPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const last4 = digits.slice(-4);
    return `+91XXXXX${last4}`;
  }
  return '[MASKED_PHONE]';
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'cookies',
  'token',
  'accesstoken',
  'refreshtoken',
  'tokenhash',
  'password',
  'jwtsecret',
  'razorpaykeysecret',
  'razorpaywebhooksecret',
  'razorpay_key_secret',
  'razorpay_signature',
  'msg91authkey',
  'twilioauthtoken',
  'voiceserviceapikey',
  'selfie',
  'photo',
  'photos',
  'audio',
  'audiocontent',
  'buffer',
  'data',
]);

/**
 * Recursively redact sensitive values from objects or strings before logging
 */
export const redact = (data, depth = 0) => {
  if (depth > 6 || data == null) return data;

  if (typeof data === 'string') {
    // Redact JWT tokens
    let sanitized = data.replace(
      /Bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/gi,
      'Bearer [REDACTED_TOKEN]'
    );
    // Redact raw tokens
    sanitized = sanitized.replace(
      /(token["']?\s*[:=]\s*["']?)[A-Za-z0-9-_]{20,}(["']?)/gi,
      '$1[REDACTED_TOKEN]$2'
    );
    // Redact phone numbers (10-12 digits with optional +91)
    sanitized = sanitized.replace(/(\+?91)?[6-9]\d{9}/g, (match) => maskPhone(match));
    // Redact 6-digit OTPs in production
    if (env.nodeEnv === 'production') {
      sanitized = sanitized.replace(/(otp["']?\s*[:=]\s*["']?)\d{6}(["']?)/gi, '$1[REDACTED_OTP]$2');
      sanitized = sanitized.replace(/(transcript["']?\s*[:=]\s*["']?)[^"'\n]+(["']?)/gi, '$1[REDACTED_TRANSCRIPT]$2');
    }
    return sanitized;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redact(item, depth + 1));
  }

  if (typeof data === 'object') {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();

      if (SENSITIVE_KEYS.has(lowerKey)) {
        cleaned[key] = '[REDACTED]';
      } else if (lowerKey === 'phone' || lowerKey.endsWith('phone')) {
        cleaned[key] = typeof value === 'string' ? maskPhone(value) : '[REDACTED_PHONE]';
      } else if (lowerKey === 'otp' || lowerKey === 'code') {
        if (env.nodeEnv === 'production') {
          cleaned[key] = '[REDACTED_OTP]';
        } else {
          cleaned[key] = value; // allow viewing in dev console for testing
        }
      } else if (lowerKey === 'transcript' && env.nodeEnv === 'production') {
        cleaned[key] = '[REDACTED_TRANSCRIPT]';
      } else {
        cleaned[key] = redact(value, depth + 1);
      }
    }
    return cleaned;
  }

  return data;
};

// Storage for test capture
let logCaptureDestination = null;

export const setLogCapture = (dest) => {
  logCaptureDestination = dest;
};

/**
 * Format and write structured log entry
 */
const writeLog = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    message: typeof message === 'string' ? redact(message) : redact(message),
    ...(meta.requestId ? { requestId: meta.requestId } : {}),
    ...(meta.userId ? { userId: typeof meta.userId === 'object' ? meta.userId.toString() : meta.userId } : {}),
    ...(meta.route ? { route: meta.route } : {}),
    ...(meta.status ? { status: meta.status } : {}),
    ...(meta.duration ? { durationMs: meta.duration } : {}),
    ...(Object.keys(meta).length > 0 ? { meta: redact(meta) } : {}),
  };

  const jsonString = JSON.stringify(entry);

  if (logCaptureDestination && Array.isArray(logCaptureDestination)) {
    logCaptureDestination.push(entry);
  }

  if (env.nodeEnv === 'test') {
    // Keep test output clean unless explicit debug
    return;
  }

  if (level === 'ERROR') {
    console.error(jsonString);
  } else if (level === 'WARN') {
    console.warn(jsonString);
  } else {
    console.log(jsonString);
  }
};

/**
 * WorkPulse Structured Logger
 */
const logger = {
  info: (message, meta) => writeLog('INFO', message, meta),
  warn: (message, meta) => writeLog('WARN', message, meta),
  error: (message, meta) => writeLog('ERROR', message, meta),
  debug: (message, meta) => {
    if (env.nodeEnv === 'development') {
      writeLog('DEBUG', message, meta);
    }
  },
  redact,
  maskPhone,
  setLogCapture,
};

export default logger;
