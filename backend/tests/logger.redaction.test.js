import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';
import logger, { redact, maskPhone, setLogCapture } from '../src/utils/logger.js';

describe('Phase 8: Structured JSON Logger & Sensitive Data Redaction', () => {
  jest.setTimeout(15000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }
  });

  afterAll(async () => {
    // Keep connection alive across shared in-band test execution
  });

  test('maskPhone masks middle digits of Indian phone numbers', () => {
    expect(maskPhone('+919876543210')).toBe('+91XXXXX3210');
    expect(maskPhone('9876543210')).toBe('+91XXXXX3210');
  });

  test('redact replaces tokens, passwords, cookies, and secrets with [REDACTED]', () => {
    const sensitivePayload = {
      phone: '+919876543210',
      password: 'super-secret-password-123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc',
      cookie: 'workpulse_refresh=c6d7e8f9a0b1c2d3e4f5',
      razorpay_signature: '9a8b7c6d5e4f3a2b1c',
      selfie: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...',
      audio: 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=',
    };

    const cleaned = redact(sensitivePayload);

    expect(cleaned.phone).toBe('+91XXXXX3210');
    expect(cleaned.password).toBe('[REDACTED]');
    expect(cleaned.token).toBe('[REDACTED]');
    expect(cleaned.authorization).toBe('[REDACTED]');
    expect(cleaned.cookie).toBe('[REDACTED]');
    expect(cleaned.razorpay_signature).toBe('[REDACTED]');
    expect(cleaned.selfie).toBe('[REDACTED]');
    expect(cleaned.audio).toBe('[REDACTED]');
  });

  test('Log output redaction during HTTP request processing', async () => {
    const capturedLogs = [];
    setLogCapture(capturedLogs);

    const secretPassword = 'my-ultra-secret-test-password';
    const rawSecretToken = 'secret-auth-token-xyz-1234567890';
    const testPhone = '+919876543210';

    await request(app)
      .post('/api/v1/auth/send-otp')
      .set('Authorization', `Bearer ${rawSecretToken}`)
      .set('Cookie', [`workpulse_refresh=${rawSecretToken}`])
      .send({
        phone: testPhone,
        password: secretPassword,
      });

    // Check all captured logs for this request
    const logsString = JSON.stringify(capturedLogs);

    // Assert that raw secrets never appear in the logged data
    expect(logsString).not.toContain(secretPassword);
    expect(logsString).not.toContain(rawSecretToken);
    expect(logsString).not.toContain('9876543210'); // full raw digits without masking
    expect(logsString).toContain('+91XXXXX3210');

    // Clean up
    setLogCapture(null);
  });
});
