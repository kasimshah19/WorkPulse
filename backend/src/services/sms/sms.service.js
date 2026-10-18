import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import { sendMockSms } from './mock.driver.js';
import { sendMsg91Sms } from './msg91.driver.js';
import { sendTwilioSms } from './twilio.driver.js';

/**
 * WorkPulse Unified SMS Service
 * Dispatches SMS via configured provider (default: mock).
 * Ensures SMS errors never crash upper workflows like job publishing.
 *
 * @param {string} phone - Target phone in E.164 format (+91...)
 * @param {string} text - Message text
 * @returns {Promise<{ provider: string, status: string, messageId?: string }>}
 */
export const sendSms = async (phone, text) => {
  const provider = (env.smsProvider || 'mock').toLowerCase();

  try {
    switch (provider) {
      case 'msg91':
        return await sendMsg91Sms(phone, text);
      case 'twilio':
        return await sendTwilioSms(phone, text);
      case 'mock':
      default:
        return await sendMockSms(phone, text);
    }
  } catch (err) {
    logger.error(`SMS send error via provider '${provider}': ${err.message}`);
    // Safe fallback to mock in non-production
    if (env.nodeEnv !== 'production' && provider !== 'mock') {
      logger.info('Falling back to mock SMS driver.');
      return await sendMockSms(phone, text);
    }
    return {
      provider,
      status: 'FAILED',
      error: err.message,
    };
  }
};
