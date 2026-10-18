import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * MSG91 SMS Driver
 * Note: Real MSG91 SMS delivery in India mandates TRAI DLT registration, approved Sender IDs,
 * and pre-approved DLT templates. Mock driver is the default for development and testing.
 */
export const sendMsg91Sms = async (phone, text) => {
  if (!env.msg91AuthKey) {
    logger.warn('MSG91 AuthKey missing. Falling back to mock driver.');
    return { provider: 'msg91', status: 'FAILED', error: 'MISSING_CREDENTIALS' };
  }

  // Format phone without + prefix for MSG91 (e.g. 919876543210)
  const cleanPhone = phone.replace(/^\+/, '');

  try {
    const res = await fetch('https://api.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: {
        'authkey': env.msg91AuthKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        template_id: env.msg91TemplateId,
        sender: env.msg91SenderId,
        short_url: '0',
        mobiles: cleanPhone,
        var1: text,
      }),
    });

    const data = await res.json();
    return {
      provider: 'msg91',
      status: res.ok ? 'SENT' : 'FAILED',
      messageId: data.message || data.request_id || 'msg91-ref',
      raw: data,
    };
  } catch (err) {
    logger.error(`MSG91 dispatch failed: ${err.message}`);
    return {
      provider: 'msg91',
      status: 'FAILED',
      error: err.message,
    };
  }
};
