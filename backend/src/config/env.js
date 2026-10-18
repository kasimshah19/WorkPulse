import dotenv from 'dotenv';

dotenv.config();

/**
 * Centralised environment configuration.
 * Validates that required variables are present at startup.
 */
const requiredVars = process.env.NODE_ENV === 'test' ? [] : ['MONGO_URI'];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`⚠️ Warning: Missing env var: ${key}. Using default if available.`);
  }
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/workpulse',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  voiceServiceUrl: process.env.VOICE_SERVICE_URL || 'http://localhost:8000',
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  smsApiKey: process.env.SMS_API_KEY || '',
};

export default env;
