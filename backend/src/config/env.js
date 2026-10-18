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
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
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
};

export default env;
