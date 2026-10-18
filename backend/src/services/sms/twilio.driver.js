import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * Twilio SMS Driver
 * Uses native fetch without heavy Twilio SDK.
 */
export const sendTwilioSms = async (phone, text) => {
  if (!env.twilioAccountSid || !env.twilioAuthToken || !env.twilioFrom) {
    logger.warn('Twilio credentials missing. Falling back to mock driver.');
    return { provider: 'twilio', status: 'FAILED', error: 'MISSING_CREDENTIALS' };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
  const authHeader = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');

  const formData = new URLSearchParams();
  formData.append('To', phone);
  formData.append('From', env.twilioFrom);
  formData.append('Body', text);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await res.json();
    return {
      provider: 'twilio',
      status: res.ok ? 'SENT' : 'FAILED',
      messageId: data.sid || 'twilio-ref',
      raw: data,
    };
  } catch (err) {
    logger.error(`Twilio dispatch failed: ${err.message}`);
    return {
      provider: 'twilio',
      status: 'FAILED',
      error: err.message,
    };
  }
};
