import env from '../../config/env.js';
import mockDriver from './mock.driver.js';
import razorpayDriver from './razorpay.driver.js';

/**
 * Returns active payment driver based on PAYMENT_PROVIDER environment variable.
 */
export function getPaymentDriver() {
  if (env.paymentProvider === 'razorpay') {
    return razorpayDriver;
  }
  return mockDriver;
}

export { mockDriver, razorpayDriver };
