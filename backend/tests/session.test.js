import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import env from '../src/config/env.js';
import User from '../src/models/User.js';
import RefreshToken from '../src/models/RefreshToken.js';
import AuditLog from '../src/models/AuditLog.js';
import mongoose from 'mongoose';
import sessionService from '../src/services/session.service.js';

describe('Phase 8: Sessions, Access Tokens & Rotating Refresh Tokens', () => {
  jest.setTimeout(45000);

  let workerUser;
  let contractorUser;
  let deactivatedUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }
    // Setup test users
    workerUser = await User.findOneAndUpdate(
      { phone: '+919999900001' },
      {
        name: 'Session Test Worker',
        phone: '+919999900001',
        role: 'worker',
        skills: ['mason'],
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    contractorUser = await User.findOneAndUpdate(
      { phone: '+919999900002' },
      {
        name: 'Session Test Contractor',
        phone: '+919999900002',
        role: 'contractor',
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    deactivatedUser = await User.findOneAndUpdate(
      { phone: '+919999900003' },
      {
        name: 'Deactivated User',
        phone: '+919999900003',
        role: 'worker',
        isActive: false,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );
  });

  afterAll(async () => {
    if (workerUser && contractorUser && deactivatedUser) {
      await RefreshToken.deleteMany({ user: { $in: [workerUser._id, contractorUser._id, deactivatedUser._id] } });
    }
    await mongoose.connection.close();
  });

  test('Access token validation: valid token grants access to /auth/me', async () => {
    const session = await sessionService.createSession(workerUser, { headers: {}, ip: '127.0.0.1' }, { cookie: () => {} });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.phone).toBe(workerUser.phone);
  });

  test('Security: Token with alg="none" is strictly rejected', async () => {
    // Unsigned / none algorithm token
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ sub: workerUser._id.toString(), role: workerUser.role, iss: 'workpulse', aud: 'workpulse-app' })
    ).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${noneToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Security: Tampered token payload is rejected', async () => {
    const session = await sessionService.createSession(workerUser, { headers: {}, ip: '127.0.0.1' }, { cookie: () => {} });
    const parts = session.accessToken.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ sub: contractorUser._id.toString(), role: 'admin' })
    ).toString('base64url');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tamperedToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Security: Token with wrong audience is rejected', async () => {
    const wrongAudToken = jwt.sign(
      { sub: workerUser._id.toString(), role: workerUser.role },
      env.jwtSecret,
      {
        algorithm: 'HS256',
        issuer: 'workpulse',
        audience: 'malicious-third-party-app',
      }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${wrongAudToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('Security: Deactivated user is rejected even with valid token signature', async () => {
    const session = await sessionService.createSession(deactivatedUser, { headers: {}, ip: '127.0.0.1' }, { cookie: () => {} });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${session.accessToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('USER_DEACTIVATED');
  });

  test('Security: Expired token returns 401 TOKEN_EXPIRED', async () => {
    const expiredToken = jwt.sign(
      { sub: workerUser._id.toString(), role: workerUser.role },
      env.jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '-10s',
        issuer: 'workpulse',
        audience: 'workpulse-app',
      }
    );

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  describe('Refresh Token Rotation & Reuse Detection', () => {
    test('Refresh fails without X-Requested-With: workpulse header', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: workerUser.phone });

      expect(loginRes.status).toBe(200);
      const cookies = loginRes.headers['set-cookie'];
      expect(cookies).toBeDefined();

      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookies);

      expect(refreshRes.status).toBe(403);
      expect(refreshRes.body.error.code).toBe('CSRF_VALIDATION_FAILED');
    });

    test('Successful refresh rotates token and issues new access token', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: workerUser.phone });

      const cookie1 = loginRes.headers['set-cookie'];

      const refreshRes1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie1)
        .set('X-Requested-With', 'workpulse');

      expect(refreshRes1.status).toBe(200);
      expect(refreshRes1.body.success).toBe(true);
      expect(refreshRes1.body.data.accessToken).toBeDefined();

      const cookie2 = refreshRes1.headers['set-cookie'];
      expect(cookie2).toBeDefined();
      expect(cookie2).not.toEqual(cookie1);
    });

    test('10-second grace window allows concurrent refresh re-issue without logout', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: workerUser.phone });

      const cookie = loginRes.headers['set-cookie'];

      // First refresh
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'workpulse');
      expect(refresh1.status).toBe(200);

      // Second immediate refresh with same (now revoked) token within 10s grace window
      const refresh2 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'workpulse');

      expect(refresh2.status).toBe(200);
      expect(refresh2.body.data.accessToken).toBeDefined();
    });

    test('Reuse detection revokes entire token family when old token used after grace window', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: workerUser.phone });

      const cookie = loginRes.headers['set-cookie'];

      // Refresh 1
      const refresh1 = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'workpulse');
      expect(refresh1.status).toBe(200);

      // Simulate token presented AFTER grace window (set revokedAt to 30s ago in DB)
      const rawToken = cookie[0].split(';')[0].split('=')[1];
      const tokenHash = sessionService.hashToken(rawToken);

      await RefreshToken.updateOne(
        { tokenHash },
        { $set: { revokedAt: new Date(Date.now() - 30000) } }
      );

      // Present the stolen/reused token
      const reuseRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'workpulse');

      expect(reuseRes.status).toBe(401);
      expect(reuseRes.body.error.code).toBe('SESSION_REVOKED');

      // Assert that AuditLog recorded SECURITY_REFRESH_REUSE
      const audit = await AuditLog.findOne({ action: 'SECURITY_REFRESH_REUSE', actor: workerUser._id });
      expect(audit).not.toBeNull();
    });

    test('Logout revokes the token family and clears the cookie', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: workerUser.phone });

      const cookie = loginRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookie);

      expect(logoutRes.status).toBe(200);

      // Attempting to refresh with that cookie must now fail
      const postLogoutRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', cookie)
        .set('X-Requested-With', 'workpulse');

      expect(postLogoutRefresh.status).toBe(401);
    });

    test('Session management: GET /auth/sessions lists active sessions and DELETE /auth/sessions/:id revokes', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/dev-login')
        .send({ phone: contractorUser.phone });

      const token = loginRes.body.data.token;
      const sessionId = loginRes.body.data.sessionId;

      const sessionsRes = await request(app)
        .get('/api/v1/auth/sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(sessionsRes.status).toBe(200);
      expect(Array.isArray(sessionsRes.body.data)).toBe(true);
      expect(sessionsRes.body.data.some((s) => s.id === sessionId)).toBe(true);

      // Delete session
      const deleteRes = await request(app)
        .delete(`/api/v1/auth/sessions/${sessionId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(deleteRes.status).toBe(200);
    });
  });
});
