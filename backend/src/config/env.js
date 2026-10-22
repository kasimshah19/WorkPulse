import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralised environment configuration.
 */
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/workpulse',
  mongoUriTest: process.env.MONGO_URI_TEST || process.env.MONGO_URI || 'mongodb://localhost:27017/workpulse_test',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  accessTokenTtlMin: parseInt(process.env.ACCESS_TOKEN_TTL_MIN, 10) || 15,
  refreshTokenTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS, 10) || 30,
  jwtIssuer: process.env.JWT_ISSUER || 'workpulse',
  jwtAudience: process.env.JWT_AUDIENCE || 'workpulse-app',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  appPublicUrl: process.env.APP_PUBLIC_URL || process.env.CLIENT_URL || 'http://localhost:3000',
  voiceServiceUrl: process.env.VOICE_SERVICE_URL || 'http://localhost:8000',
  paymentProvider: process.env.PAYMENT_PROVIDER || 'mock',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  payoutProvider: process.env.PAYOUT_PROVIDER || 'mock',
  payoutMockFailRate: parseFloat(process.env.PAYOUT_MOCK_FAIL_RATE) || 0,
  platformFeePercent: parseInt(process.env.PLATFORM_FEE_PERCENT, 10) || 0,
  attendanceRequireFunding: process.env.ATTENDANCE_REQUIRE_FUNDING !== 'false',
  escrowSchedulerIntervalSec: parseInt(process.env.ESCROW_SCHEDULER_INTERVAL_SEC, 10) || 60,
  escrowAutoApprovalOverrideSec: process.env.ESCROW_AUTO_APPROVAL_OVERRIDE_SEC
    ? parseInt(process.env.ESCROW_AUTO_APPROVAL_OVERRIDE_SEC, 10)
    : null,
  minTopupPaise: parseInt(process.env.MIN_TOPUP_PAISE, 10) || 10000,
  maxTopupPaise: parseInt(process.env.MAX_TOPUP_PAISE, 10) || 5000000,
  minWithdrawPaise: parseInt(process.env.MIN_WITHDRAW_PAISE, 10) || 10000,
  devAllowMockTopup: process.env.DEV_ALLOW_MOCK_TOPUP === 'true' && process.env.NODE_ENV !== 'production',
  smsProvider: process.env.SMS_PROVIDER || 'mock',
  allowMockSmsInProd: process.env.ALLOW_MOCK_SMS_IN_PROD === 'true',
  smsFallbackDelaySec: parseInt(process.env.SMS_FALLBACK_DELAY_SEC, 10) || 15,
  msg91AuthKey: process.env.MSG91_AUTH_KEY || '',
  msg91SenderId: process.env.MSG91_SENDER_ID || '',
  msg91TemplateId: process.env.MSG91_TEMPLATE_ID || '',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFrom: process.env.TWILIO_FROM || '',
  maxWorkersNotifiedPerJob: parseInt(process.env.MAX_WORKERS_NOTIFIED_PER_JOB, 10) || 50,
  seedCenterLat: parseFloat(process.env.SEED_CENTER_LAT) || 18.5204,
  seedCenterLng: parseFloat(process.env.SEED_CENTER_LNG) || 73.8567,
  otpDevMode: process.env.OTP_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production',
  otpLockoutMin: parseInt(process.env.OTP_LOCKOUT_MIN, 10) || 15,
  otpMaxFailedAttempts: parseInt(process.env.OTP_MAX_FAILED_ATTEMPTS, 10) || 5,
  attendanceMaxAccuracyM: parseInt(process.env.ATTENDANCE_MAX_ACCURACY_M, 10) || 50,
  attendanceMaxClockDriftSec: parseInt(process.env.ATTENDANCE_MAX_CLOCK_DRIFT_SEC, 10) || 120,
  attendanceEarlyCheckinMin: parseInt(process.env.ATTENDANCE_EARLY_CHECKIN_MIN, 10) || 30,
  attendanceLateGraceMin: parseInt(process.env.ATTENDANCE_LATE_GRACE_MIN, 10) || 60,
  attendanceMaxSpeedKmh: parseInt(process.env.ATTENDANCE_MAX_SPEED_KMH, 10) || 150,
  selfieMaxBytes: parseInt(process.env.SELFIE_MAX_BYTES, 10) || 2097152,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  devAllowLocationOverride: process.env.DEV_ALLOW_LOCATION_OVERRIDE === 'true' && process.env.NODE_ENV !== 'production',
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  voiceEnabled: process.env.VOICE_ENABLED !== 'false',
  voiceServiceUrl: process.env.VOICE_SERVICE_URL || 'http://localhost:8000',
  voiceServiceApiKey: process.env.VOICE_SERVICE_API_KEY || 'workpulse-internal-voice-key-2026',
  voiceTimeoutMs: parseInt(process.env.VOICE_TIMEOUT_MS, 10) || 30000,
  voiceMaxAudioBytes: parseInt(process.env.VOICE_MAX_AUDIO_BYTES, 10) || 5242880,
  voiceOnboardRatePerHour: parseInt(process.env.VOICE_ONBOARD_RATE_PER_HOUR, 10) || 10,
  voiceExtractRatePerHour: parseInt(process.env.VOICE_EXTRACT_RATE_PER_HOUR, 10) || 30,
  voiceSessionTtlDays: parseInt(process.env.VOICE_SESSION_TTL_DAYS, 10) || 90,
  voiceDegradedCooldownSec: parseInt(process.env.VOICE_DEGRADED_COOLDOWN_SEC, 10) || 60,
  voiceConsentVersion: process.env.VOICE_CONSENT_VERSION || 'v1',

  // Phase 7: Reputation & Safety
  ratingWindowDays: parseInt(process.env.RATING_WINDOW_DAYS, 10) || 14,
  ratingPriorCount: parseFloat(process.env.RATING_PRIOR_COUNT) || 3.0,
  ratingPriorMean: parseFloat(process.env.RATING_PRIOR_MEAN) || 4.0,
  ratingMinCountForBadge: parseInt(process.env.RATING_MIN_COUNT_FOR_BADGE, 10) || 3,
  ratingCommentMax: parseInt(process.env.RATING_COMMENT_MAX, 10) || 300,
  ratingReminderAfterDays: parseInt(process.env.RATING_REMINDER_AFTER_DAYS, 10) || 3,
  devRatingAllowAnytime: process.env.DEV_RATING_ALLOW_ANYTIME === 'true' && process.env.NODE_ENV !== 'production',
  sosEscalationSec: parseInt(process.env.SOS_ESCALATION_SEC, 10) || 60,
  sosSecondEscalationSec: parseInt(process.env.SOS_SECOND_ESCALATION_SEC, 10) || 300,
  sosDedupeWindowSec: parseInt(process.env.SOS_DEDUPE_WINDOW_SEC, 10) || 120,
  sosMaxNewPerHour: parseInt(process.env.SOS_MAX_NEW_PER_HOUR, 10) || 5,
  sosLocationTrailMax: parseInt(process.env.SOS_LOCATION_TRAIL_MAX, 10) || 50,
  sosLocationMinIntervalSec: parseInt(process.env.SOS_LOCATION_MIN_INTERVAL_SEC, 10) || 5,
  sosMaxCoworkersAlerted: parseInt(process.env.SOS_MAX_COWORKERS_ALERTED, 10) || 10,
  sosNearbyVolunteers: process.env.SOS_NEARBY_VOLUNTEERS === 'true',
  sosNearbyRadiusKm: parseFloat(process.env.SOS_NEARBY_RADIUS_KM) || 2.0,
  sosNearbyMax: parseInt(process.env.SOS_NEARBY_MAX, 10) || 5,
  sosSmsEnabled: process.env.SOS_SMS_ENABLED !== 'false',
  incidentPhotoMax: parseInt(process.env.INCIDENT_PHOTO_MAX, 10) || 3,
  safetySchedulerIntervalSec: parseInt(process.env.SAFETY_SCHEDULER_INTERVAL_SEC, 10) || 30,
};

/**
 * Validates that production mode refuses unsafe development flags or weak secrets.
 *
 * @param {Object} [e=env] Configuration object to validate
 * @param {Object} [p=process.env] Underlying process.env
 * @param {Object} [options={ shouldExit: true }]
 * @returns {boolean} true if valid
 * @throws {Error} if validation fails and shouldExit is false
 */
export const validateProductionEnv = (e = env, p = process.env, options = { shouldExit: true }) => {
  const isProd = e.nodeEnv === 'production' || p.NODE_ENV === 'production';
  if (!isProd) {
    return true;
  }

  const violations = [];

  if (p.OTP_DEV_MODE === 'true') {
    violations.push('OTP_DEV_MODE=true is forbidden in production');
  }
  if (p.DEV_ALLOW_MOCK_TOPUP === 'true') {
    violations.push('DEV_ALLOW_MOCK_TOPUP=true is forbidden in production');
  }
  if (p.DEV_ALLOW_LOCATION_OVERRIDE === 'true') {
    violations.push('DEV_ALLOW_LOCATION_OVERRIDE=true is forbidden in production');
  }
  if (p.DEV_RATING_ALLOW_ANYTIME === 'true') {
    violations.push('DEV_RATING_ALLOW_ANYTIME=true is forbidden in production');
  }
  if (p.ESCROW_AUTO_APPROVAL_OVERRIDE_SEC && p.ESCROW_AUTO_APPROVAL_OVERRIDE_SEC.trim() !== '') {
    violations.push('ESCROW_AUTO_APPROVAL_OVERRIDE_SEC is forbidden in production');
  }
  if (e.paymentProvider === 'mock' || p.PAYMENT_PROVIDER === 'mock') {
    violations.push('PAYMENT_PROVIDER cannot be "mock" in production');
  }
  if (e.smsProvider === 'mock' || p.SMS_PROVIDER === 'mock') {
    if (p.ALLOW_MOCK_SMS_IN_PROD !== 'true') {
      violations.push('SMS_PROVIDER cannot be "mock" in production without explicit ALLOW_MOCK_SMS_IN_PROD=true');
    } else {
      console.warn('⚠️ [PRODUCTION WARNING] ALLOW_MOCK_SMS_IN_PROD=true is active. Mock SMS driver in use.');
    }
  }

  const placeholderSecrets = [
    'your-super-secret-jwt-key-change-in-production',
    'dev-secret-change-me',
    'secret',
    'changeme',
    'your-jwt-secret',
    'default-secret',
    'jwt-secret',
    'secretkey',
    '12345678901234567890123456789012',
  ];

  const secretToCheck = p.JWT_SECRET || e.jwtSecret || '';
  if (!secretToCheck || secretToCheck.length < 32 || placeholderSecrets.includes(secretToCheck.toLowerCase())) {
    violations.push('JWT_SECRET must be at least 32 characters and cannot be a placeholder or default');
  }

  const clientUrlToCheck = p.CLIENT_URL || e.clientUrl;
  if (!clientUrlToCheck || clientUrlToCheck === '*' || clientUrlToCheck.trim() === '') {
    violations.push('CLIENT_URL is missing or set to wildcard "*"');
  }

  const mongoUriToCheck = p.MONGO_URI || e.mongoUri || '';
  if (
    mongoUriToCheck.includes('localhost') ||
    mongoUriToCheck.includes('127.0.0.1') ||
    mongoUriToCheck.includes('[::1]')
  ) {
    violations.push('MONGO_URI cannot point to localhost / 127.0.0.1 in production');
  }

  if (violations.length > 0) {
    const errorMsg =
      `\n=======================================================\n` +
      `⛔ CRITICAL: PRODUCTION SAFETY GATE REFUSED STARTUP\n` +
      `Found ${violations.length} fatal configuration violation(s):\n` +
      violations.map((v) => `  ❌ ${v}`).join('\n') +
      `\n=======================================================\n`;

    if (options.shouldExit) {
      console.error(errorMsg);
      process.exit(1);
    } else {
      const err = new Error(errorMsg);
      err.violations = violations;
      throw err;
    }
  }

  return true;
};

// Execute gate check if started in production runtime
if (process.env.NODE_ENV === 'production' && !process.env.JEST_WORKER_ID) {
  validateProductionEnv(env, process.env, { shouldExit: true });
}

export default env;
