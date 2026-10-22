import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../src/app.js';
import { validateProductionEnv } from '../src/config/env.js';

describe('Phase 8: Production Safety Gate & Route Guards', () => {
  jest.setTimeout(30000);
  const safeProdEnv = {
    nodeEnv: 'production',
    paymentProvider: 'razorpay',
    smsProvider: 'msg91',
    jwtSecret: 'a-very-long-production-grade-secret-key-with-64-characters-random-string',
    clientUrl: 'https://app.workpulse.in',
    mongoUri: 'mongodb+srv://user:pass@cluster0.workpulse.net/workpulse_prod',
  };

  const safeProcessEnv = {
    NODE_ENV: 'production',
    OTP_DEV_MODE: 'false',
    DEV_ALLOW_MOCK_TOPUP: 'false',
    DEV_ALLOW_LOCATION_OVERRIDE: 'false',
    DEV_RATING_ALLOW_ANYTIME: 'false',
    ESCROW_AUTO_APPROVAL_OVERRIDE_SEC: '',
    PAYMENT_PROVIDER: 'razorpay',
    SMS_PROVIDER: 'msg91',
    JWT_SECRET: 'a-very-long-production-grade-secret-key-with-64-characters-random-string',
    CLIENT_URL: 'https://app.workpulse.in',
    MONGO_URI: 'mongodb+srv://user:pass@cluster0.workpulse.net/workpulse_prod',
  };

  test('Safe production environment passes validation', () => {
    expect(() => {
      validateProductionEnv(safeProdEnv, safeProcessEnv, { shouldExit: false });
    }).not.toThrow();
  });

  describe('Unsafe flags refused individually', () => {
    test('Refuses OTP_DEV_MODE=true', () => {
      expect(() => {
        validateProductionEnv(safeProdEnv, { ...safeProcessEnv, OTP_DEV_MODE: 'true' }, { shouldExit: false });
      }).toThrow(/OTP_DEV_MODE=true is forbidden in production/);
    });

    test('Refuses DEV_ALLOW_MOCK_TOPUP=true', () => {
      expect(() => {
        validateProductionEnv(safeProdEnv, { ...safeProcessEnv, DEV_ALLOW_MOCK_TOPUP: 'true' }, { shouldExit: false });
      }).toThrow(/DEV_ALLOW_MOCK_TOPUP=true is forbidden in production/);
    });

    test('Refuses DEV_ALLOW_LOCATION_OVERRIDE=true', () => {
      expect(() => {
        validateProductionEnv(safeProdEnv, { ...safeProcessEnv, DEV_ALLOW_LOCATION_OVERRIDE: 'true' }, { shouldExit: false });
      }).toThrow(/DEV_ALLOW_LOCATION_OVERRIDE=true is forbidden in production/);
    });

    test('Refuses DEV_RATING_ALLOW_ANYTIME=true', () => {
      expect(() => {
        validateProductionEnv(safeProdEnv, { ...safeProcessEnv, DEV_RATING_ALLOW_ANYTIME: 'true' }, { shouldExit: false });
      }).toThrow(/DEV_RATING_ALLOW_ANYTIME=true is forbidden in production/);
    });

    test('Refuses ESCROW_AUTO_APPROVAL_OVERRIDE_SEC when set', () => {
      expect(() => {
        validateProductionEnv(safeProdEnv, { ...safeProcessEnv, ESCROW_AUTO_APPROVAL_OVERRIDE_SEC: '30' }, { shouldExit: false });
      }).toThrow(/ESCROW_AUTO_APPROVAL_OVERRIDE_SEC is forbidden in production/);
    });

    test('Refuses PAYMENT_PROVIDER=mock', () => {
      expect(() => {
        validateProductionEnv({ ...safeProdEnv, paymentProvider: 'mock' }, { ...safeProcessEnv, PAYMENT_PROVIDER: 'mock' }, { shouldExit: false });
      }).toThrow(/PAYMENT_PROVIDER cannot be "mock" in production/);
    });

    test('Refuses SMS_PROVIDER=mock without ALLOW_MOCK_SMS_IN_PROD', () => {
      expect(() => {
        validateProductionEnv({ ...safeProdEnv, smsProvider: 'mock' }, { ...safeProcessEnv, SMS_PROVIDER: 'mock' }, { shouldExit: false });
      }).toThrow(/SMS_PROVIDER cannot be "mock" in production without explicit ALLOW_MOCK_SMS_IN_PROD=true/);
    });

    test('Allows SMS_PROVIDER=mock with explicit ALLOW_MOCK_SMS_IN_PROD=true', () => {
      expect(() => {
        validateProductionEnv(
          { ...safeProdEnv, smsProvider: 'mock' },
          { ...safeProcessEnv, SMS_PROVIDER: 'mock', ALLOW_MOCK_SMS_IN_PROD: 'true' },
          { shouldExit: false }
        );
      }).not.toThrow();
    });

    test('Refuses JWT_SECRET shorter than 32 characters', () => {
      expect(() => {
        validateProductionEnv(
          { ...safeProdEnv, jwtSecret: 'short-secret' },
          { ...safeProcessEnv, JWT_SECRET: 'short-secret' },
          { shouldExit: false }
        );
      }).toThrow(/JWT_SECRET must be at least 32 characters/);
    });

    test('Refuses known placeholder JWT_SECRET', () => {
      expect(() => {
        validateProductionEnv(
          { ...safeProdEnv, jwtSecret: 'your-super-secret-jwt-key-change-in-production' },
          { ...safeProcessEnv, JWT_SECRET: 'your-super-secret-jwt-key-change-in-production' },
          { shouldExit: false }
        );
      }).toThrow(/placeholder/);
    });

    test('Refuses wildcard CLIENT_URL "*"', () => {
      expect(() => {
        validateProductionEnv({ ...safeProdEnv, clientUrl: '*' }, { ...safeProcessEnv, CLIENT_URL: '*' }, { shouldExit: false });
      }).toThrow(/CLIENT_URL is missing or set to wildcard "\*"/);
    });

    test('Refuses missing CLIENT_URL', () => {
      expect(() => {
        validateProductionEnv({ ...safeProdEnv, clientUrl: '' }, { ...safeProcessEnv, CLIENT_URL: '' }, { shouldExit: false });
      }).toThrow(/CLIENT_URL is missing or set to wildcard "\*"/);
    });

    test('Refuses MONGO_URI pointing to localhost or 127.0.0.1', () => {
      expect(() => {
        validateProductionEnv(
          { ...safeProdEnv, mongoUri: 'mongodb://localhost:27017/prod' },
          { ...safeProcessEnv, MONGO_URI: 'mongodb://localhost:27017/prod' },
          { shouldExit: false }
        );
      }).toThrow(/MONGO_URI cannot point to localhost/);
    });
  });

  describe('Route Guards: /dev/* and /auth/dev-* in Production', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeAll(() => {
      process.env.NODE_ENV = 'production';
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    test('POST /api/v1/auth/dev-login returns 404 in production', async () => {
      const res = await request(app).post('/api/v1/auth/dev-login').send({ phone: '+919000000001' });
      expect(res.status).toBe(404);
    });

    test('GET /api/v1/auth/dev-users returns 404 in production', async () => {
      const res = await request(app).get('/api/v1/auth/dev-users');
      expect(res.status).toBe(404);
    });

    test('POST /api/v1/dev/wallet/topup returns 404 in production', async () => {
      const res = await request(app).post('/api/v1/dev/wallet/topup').send({ amountPaise: 10000 });
      expect(res.status).toBe(404);
    });

    test('POST /api/v1/dev/scheduler/run returns 404 in production', async () => {
      const res = await request(app).post('/api/v1/dev/scheduler/run');
      expect(res.status).toBe(404);
    });
  });
});
