import crypto from 'crypto';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';

/**
 * Razorpay Payment Driver
 * Uses native fetch and crypto (no external SDK dependency).
 */
export const razorpayDriver = {
  name: 'razorpay',

  /**
   * Calls Razorpay Orders API via fetch.
   */
  async createOrder({ amountPaise, receipt = '', notes = {} }) {
    if (!env.razorpayKeyId || !env.razorpayKeySecret) {
      throw new Error('RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are not configured.');
    }

    const authHeader = 'Basic ' + Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64');

    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: receipt || `rcpt_${Date.now()}`,
        notes,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.error(`Razorpay createOrder failed with ${res.status}: ${errText}`);
      throw new Error(`Razorpay API error: ${errText}`);
    }

    const data = await res.json();
    return {
      providerOrderId: data.id,
      amountPaise: data.amount,
      currency: data.currency,
      keyId: env.razorpayKeyId,
      provider: 'razorpay',
      receipt: data.receipt,
    };
  },

  /**
   * Verifies client-side payment completion signature:
   * HMAC-SHA256(orderId + "|" + paymentId, RAZORPAY_KEY_SECRET)
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature || !env.razorpayKeySecret) return false;
    const expected = crypto
      .createHmac('sha256', env.razorpayKeySecret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (_e) {
      return false;
    }
  },

  /**
   * Verifies webhook signature against raw request body:
   * HMAC-SHA256(rawBody, RAZORPAY_WEBHOOK_SECRET)
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature || !env.razorpayWebhookSecret) return false;
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
    const expected = crypto
      .createHmac('sha256', env.razorpayWebhookSecret)
      .update(bodyBuffer)
      .digest('hex');

    try {
      const sigBuf = Buffer.from(signature, 'utf8');
      const expBuf = Buffer.from(expected, 'utf8');
      if (sigBuf.length !== expBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expBuf);
    } catch (_e) {
      return false;
    }
  },
};

export default razorpayDriver;
