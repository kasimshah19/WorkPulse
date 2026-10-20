import crypto from 'crypto';

const MOCK_SECRET = 'workpulse_mock_payment_secret_2026';

/**
 * Mock Payment Driver
 * Fully functional offline driver for payment testing without Razorpay credentials.
 */
export const mockPaymentDriver = {
  name: 'mock',

  /**
   * Generates a simulated order.
   */
  async createOrder({ amountPaise, receipt = '', notes = {} }) {
    const randomHex = crypto.randomBytes(8).toString('hex');
    const providerOrderId = `order_mock_${randomHex}`;

    return {
      providerOrderId,
      amountPaise,
      currency: 'INR',
      keyId: 'rzp_test_mock_public_key',
      provider: 'mock',
      receipt,
      notes,
    };
  },

  /**
   * Helper to generate a valid mock payment signature (used by frontend / tests).
   */
  generateMockSignature({ orderId, paymentId }) {
    return crypto
      .createHmac('sha256', MOCK_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
  },

  /**
   * Helper to generate a valid mock payment response with signature (used by frontend / tests).
   */
  generatePaymentResponse(orderOrOrderId) {
    const orderId =
      typeof orderOrOrderId === 'object' && orderOrOrderId !== null
        ? orderOrOrderId.providerOrderId || orderOrOrderId.gatewayOrderId || orderOrOrderId.id
        : String(orderOrOrderId);
    const paymentId = `pay_mock_${crypto.randomBytes(8).toString('hex')}`;
    const signature = this.generateMockSignature({ orderId, paymentId });

    return {
      gatewayOrderId: orderId,
      gatewayPaymentId: paymentId,
      gatewaySignature: signature,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    };
  },

  /**
   * Verifies signature of client payment return.
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    if (!orderId || !paymentId || !signature) return false;
    const expected = crypto
      .createHmac('sha256', MOCK_SECRET)
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
   * Verifies webhook payload signature.
   */
  verifyWebhookSignature(rawBody, signature) {
    if (!rawBody || !signature) return false;
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const expected = crypto
      .createHmac('sha256', MOCK_SECRET)
      .update(bodyStr)
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

export default mockPaymentDriver;
