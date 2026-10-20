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
  devAllowMockTopup: process.env.DEV_ALLOW_MOCK_TOPUP !== 'false' && process.env.NODE_ENV !== 'production',
  smsProvider: process.env.SMS_PROVIDER || 'mock',
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
  attendanceMaxAccuracyM: parseInt(process.env.ATTENDANCE_MAX_ACCURACY_M, 10) || 50,
  attendanceMaxClockDriftSec: parseInt(process.env.ATTENDANCE_MAX_CLOCK_DRIFT_SEC, 10) || 120,
  attendanceEarlyCheckinMin: parseInt(process.env.ATTENDANCE_EARLY_CHECKIN_MIN, 10) || 30,
  attendanceLateGraceMin: parseInt(process.env.ATTENDANCE_LATE_GRACE_MIN, 10) || 60,
  attendanceMaxSpeedKmh: parseInt(process.env.ATTENDANCE_MAX_SPEED_KMH, 10) || 150,
  selfieMaxBytes: parseInt(process.env.SELFIE_MAX_BYTES, 10) || 2097152,
  uploadDir: process.env.UPLOAD_DIR || './uploads',
  attendanceSchedulerIntervalSec: parseInt(process.env.ATTENDANCE_SCHEDULER_INTERVAL_SEC, 10) || 60,
  devAllowLocationOverride: process.env.DEV_ALLOW_LOCATION_OVERRIDE === 'true' && process.env.NODE_ENV !== 'production',
};

export default env;
