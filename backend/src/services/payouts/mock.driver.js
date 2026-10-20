import env from '../../config/env.js';

/**
 * Mock UPI Payout Driver
 * Simulates real-time bank transfers to VPA (UPI ID).
 * Note: In production, a licensed partner API (e.g. RazorpayX / RBI Payment Aggregator)
 * would be used here.
 */
export const mockPayoutDriver = {
  name: 'mock',

  async executePayout({ amountPaise, upiId, payoutId }) {
    // Check simulated failure rate (for dev/test retries)
    if (env.payoutMockFailRate > 0 && Math.random() < env.payoutMockFailRate) {
      return {
        success: false,
        error: 'SIMULATED_GATEWAY_TIMEOUT',
      };
    }

    // Generate simulated 12-digit UPI UTR reference
    const random12Digits = Math.floor(100000000000 + Math.random() * 900000000000);
    const providerRef = `MOCKUTR${random12Digits}`;

    return {
      success: true,
      providerRef,
    };
  },
};

export default mockPayoutDriver;
