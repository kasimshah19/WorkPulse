import { jest } from '@jest/globals';
import request from 'supertest';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/app.js';
import env from '../src/config/env.js';
import { issueAccessToken } from '../src/services/session.service.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import JobApplication from '../src/models/JobApplication.js';
import EscrowTransaction from '../src/models/EscrowTransaction.js';
import Attendance from '../src/models/Attendance.js';
import Dispute from '../src/models/Dispute.js';
import Incident from '../src/models/Incident.js';
import Rating from '../src/models/Rating.js';
import PaymentOrder from '../src/models/PaymentOrder.js';
import Wallet from '../src/models/Wallet.js';
import { getOrCreateWallet } from '../src/services/wallet.service.js';
import { ESCROW_STATUS, ATTENDANCE_STATUS, SIGNOFF_STATUS, INCIDENT_VISIBILITY } from '../src/config/constants.js';

describe('Phase 8: Comprehensive Authorization Matrix & IDOR Security Audit', () => {
  jest.setTimeout(60000);

  let workerA, workerB;
  let contractorA, contractorB;
  let adminUser;

  let tokenWorkerA, tokenWorkerB;
  let tokenContractorA, tokenContractorB;
  let tokenAdmin;

  let testJobA;
  let testEscrowA;
  let testAttendanceA;
  let testDisputeA;
  let testIncidentA;
  let testRatingA;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }

    // 1. Setup 5 distinct users (representing 6 actors including Anonymous)
    workerA = await User.findOneAndUpdate(
      { phone: '+919876500001' },
      {
        name: 'Worker Alpha',
        phone: '+919876500001',
        role: 'worker',
        skills: ['mason'],
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    workerB = await User.findOneAndUpdate(
      { phone: '+919876500002' },
      {
        name: 'Worker Beta (Attacker/Other)',
        phone: '+919876500002',
        role: 'worker',
        skills: ['mason'],
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    contractorA = await User.findOneAndUpdate(
      { phone: '+919876500003' },
      {
        name: 'Contractor Alpha',
        phone: '+919876500003',
        role: 'contractor',
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    contractorB = await User.findOneAndUpdate(
      { phone: '+919876500004' },
      {
        name: 'Contractor Beta (Attacker/Other)',
        phone: '+919876500004',
        role: 'contractor',
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    adminUser = await User.findOneAndUpdate(
      { phone: '+919876500005' },
      {
        name: 'System Admin',
        phone: '+919876500005',
        role: 'admin',
        isActive: true,
        kycStatus: 'simulated_verified',
      },
      { upsert: true, new: true }
    );

    // 2. Issue valid access tokens for all actors
    tokenWorkerA = issueAccessToken(workerA, uuidv4(), uuidv4());
    tokenWorkerB = issueAccessToken(workerB, uuidv4(), uuidv4());
    tokenContractorA = issueAccessToken(contractorA, uuidv4(), uuidv4());
    tokenContractorB = issueAccessToken(contractorB, uuidv4(), uuidv4());
    tokenAdmin = issueAccessToken(adminUser, uuidv4(), uuidv4());

    // 3. Setup Test Artifacts owned by Contractor A & Worker A
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    testJobA = await Job.create({
      title: 'Matrix Audit Masonry Work',
      description: 'Brickwork construction for auth matrix testing',
      contractor: contractorA._id,
      skillRequired: 'mason',
      wagePerDayPaise: 50000,
      workersNeeded: 1,
      workersAssignedCount: 1,
      startDate: now,
      endDate: new Date(now.getTime() + 86400000 * 2),
      status: 'OPEN',
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      addressText: 'MG Road, Bangalore',
      geofenceRadiusMeters: 100,
      matchRadiusKm: 5,
      attendanceCodeSecret: 'matrix_secret_123',
    });

    await JobApplication.create({
      job: testJobA._id,
      worker: workerA._id,
      status: 'ASSIGNED',
      respondedAt: now,
    });

    testEscrowA = await EscrowTransaction.create({
      job: testJobA._id,
      contractor: contractorA._id,
      worker: workerA._id,
      dayDate: todayStr,
      amountPaise: 50000,
      platformFeePaise: 0,
      status: ESCROW_STATUS.CHECKED_OUT,
      idempotencyKey: `ESCROW_TEST:${testJobA._id}:${workerA._id}:${todayStr}`,
    });

    testAttendanceA = await Attendance.create({
      job: testJobA._id,
      worker: workerA._id,
      date: todayStr,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
      checkInAt: new Date(now.getTime() - 8 * 3600000),
      checkOutAt: now,
      hoursWorked: 8,
      checkInLocation: { type: 'Point', coordinates: [77.5946, 12.9716] },
      checkInDistanceMeters: 10,
      checkInAccuracyM: 5,
      selfieUrl: 'test_selfie.jpg',
      contractorSignoff: {
        status: SIGNOFF_STATUS.PENDING,
      },
    });

    testDisputeA = await Dispute.create({
      job: testJobA._id,
      escrowTransaction: testEscrowA._id,
      attendance: testAttendanceA._id,
      raisedBy: workerA._id,
      against: contractorA._id,
      openedFrom: 'WORKER_CLAIM',
      reason: 'WAGE_MISMATCH',
      description: 'Contractor withheld partial day payout',
      status: 'OPEN',
    });

    testIncidentA = await Incident.create({
      reportedBy: workerA._id,
      job: testJobA._id,
      type: 'HARASSMENT',
      severity: 'HIGH',
      description: 'Harassment reported by worker A - sensitive administrative report',
      visibility: INCIDENT_VISIBILITY.ADMIN_ONLY,
      idempotencyKey: `INCIDENT_TEST_${Date.now()}_${uuidv4()}`,
      status: 'OPEN',
      timeline: [{ event: 'CREATED', at: now, by: workerA._id }],
    });

    testRatingA = await Rating.create({
      job: testJobA._id,
      fromUser: contractorA._id,
      toUser: workerA._id,
      type: 'WORKER_SKILL',
      score: 5,
      comment: 'Excellent mason work',
      status: 'PUBLISHED',
      isVisible: true,
    });
  });

  afterAll(async () => {
    // Clean up test records
    if (testJobA) await Job.findByIdAndDelete(testJobA._id);
    if (testEscrowA) await EscrowTransaction.findByIdAndDelete(testEscrowA._id);
    if (testAttendanceA) await Attendance.findByIdAndDelete(testAttendanceA._id);
    if (testDisputeA) await Dispute.findByIdAndDelete(testDisputeA._id);
    if (testRatingA) await Rating.findByIdAndDelete(testRatingA._id);
    await JobApplication.deleteMany({ job: testJobA?._id });
  });

  describe('1. Table-driven Admin Endpoints RBAC Matrix', () => {
    const adminEndpoints = [
      { path: '/api/v1/admin/stats', method: 'get' },
      { path: '/api/v1/admin/disputes', method: 'get' },
      { path: '/api/v1/admin/reconciliation', method: 'get' },
      { path: '/api/v1/admin/ratings', method: 'get' },
      { path: '/api/v1/admin/incidents', method: 'get' },
      { path: '/api/v1/admin/safety/stats', method: 'get' },
    ];

    test.each(adminEndpoints)('Endpoint $method $path rejects Anonymous with 401', async ({ path, method }) => {
      const res = await request(app)[method](path);
      expect(res.status).toBe(401);
    });

    test.each(adminEndpoints)('Endpoint $method $path rejects Worker with 403', async ({ path, method }) => {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenWorkerA}`);
      expect(res.status).toBe(403);
    });

    test.each(adminEndpoints)('Endpoint $method $path rejects Contractor with 403', async ({ path, method }) => {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenContractorA}`);
      expect(res.status).toBe(403);
    });

    test.each(adminEndpoints)('Endpoint $method $path allows Admin with 200', async ({ path, method }) => {
      const res = await request(app)[method](path).set('Authorization', `Bearer ${tokenAdmin}`);
      expect(res.status).toBe(200);
    });
  });

  describe('2. Job Ownership & IDOR Protection', () => {
    test('Worker cannot create a job (role restriction)', async () => {
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${tokenWorkerA}`)
        .send({
          title: 'Illegal Worker Job',
          skillRequired: 'mason',
          wagePerDayPaise: 50000,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          location: { lat: 12.97, lng: 77.59 },
          addressText: 'Bangalore Central',
        });
      expect(res.status).toBe(403);
    });

    test('Contractor B cannot edit Contractor A job (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .patch(`/api/v1/jobs/${testJobA._id}`)
        .set('Authorization', `Bearer ${tokenContractorB}`)
        .send({ title: 'Hijacked Job Title' });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('Contractor B cannot publish Contractor A job (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJobA._id}/publish`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor B cannot cancel Contractor A job (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJobA._id}/cancel`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor A can update their own job (200)', async () => {
      const draftJob = await Job.create({
        title: 'Draft Job For Update Test',
        contractor: contractorA._id,
        skillRequired: 'mason',
        wagePerDayPaise: 50000,
        workersNeeded: 1,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
        location: { type: 'Point', coordinates: [77.5946, 12.9716] },
        addressText: 'MG Road, Bangalore',
        status: 'DRAFT',
      });

      const res = await request(app)
        .patch(`/api/v1/jobs/${draftJob._id}`)
        .set('Authorization', `Bearer ${tokenContractorA}`)
        .send({ description: 'Updated valid job description' });

      expect(res.status).toBe(200);
      await Job.findByIdAndDelete(draftJob._id);
    });
  });

  describe('3. Application & Applicant Pool IDOR Protection', () => {
    test('Worker B (not notified / not matched) cannot accept Contractor A job', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJobA._id}/accept`)
        .set('Authorization', `Bearer ${tokenWorkerB}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('NOT_NOTIFIED');
    });

    test('Contractor B cannot view applicants of Contractor A job (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJobA._id}/applicants`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('Contractor A can view their job applicants (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJobA._id}/applicants`)
        .set('Authorization', `Bearer ${tokenContractorA}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test('Admin can view job applicants (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJobA._id}/applicants`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(res.status).toBe(200);
    });
  });

  describe('4. Escrow & Milestones IDOR Protection', () => {
    test('Contractor B cannot fund Contractor A job escrow (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/escrow/jobs/${testJobA._id}/fund`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor B cannot view Contractor A job escrows (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .get(`/api/v1/escrow/jobs/${testJobA._id}`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Worker B cannot inspect single escrow details between Worker A and Contractor A (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/escrow/${testEscrowA._id}`)
        .set('Authorization', `Bearer ${tokenWorkerB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor B cannot inspect single escrow details between Worker A and Contractor A (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/escrow/${testEscrowA._id}`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Worker A and Contractor A can view escrow details (200)', async () => {
      const resWorker = await request(app)
        .get(`/api/v1/escrow/${testEscrowA._id}`)
        .set('Authorization', `Bearer ${tokenWorkerA}`);
      expect(resWorker.status).toBe(200);

      const resContractor = await request(app)
        .get(`/api/v1/escrow/${testEscrowA._id}`)
        .set('Authorization', `Bearer ${tokenContractorA}`);
      expect(resContractor.status).toBe(200);
    });

    test('Contractor B cannot release Contractor A escrow row (IDOR blocked with 403)', async () => {
      const res = await request(app)
        .post(`/api/v1/escrow/${testEscrowA._id}/release`)
        .set('Authorization', `Bearer ${tokenContractorB}`)
        .send({ reason: 'Malicious release attempt' });

      expect(res.status).toBe(403);
    });
  });

  describe('5. Attendance & Geofencing IDOR Protection', () => {
    test('Worker B (unassigned) cannot check-in to Contractor A job (403 NOT_ASSIGNED)', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${testJobA._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${tokenWorkerB}`)
        .send({
          lat: 12.9716,
          lng: 77.5946,
          accuracy: 10,
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('NOT_ASSIGNED');
    });

    test('Contractor B cannot sign-off on Contractor A job attendance (403 FORBIDDEN)', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/${testAttendanceA._id}/signoff`)
        .set('Authorization', `Bearer ${tokenContractorB}`)
        .send({ decision: 'APPROVE', notes: 'Unauthorized signoff attempt' });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('Contractor B cannot view attendance QR/code for Contractor A job (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJobA._id}/attendance/code`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor A can view attendance QR/code (200)', async () => {
      const res = await request(app)
        .get(`/api/v1/jobs/${testJobA._id}/attendance/code`)
        .set('Authorization', `Bearer ${tokenContractorA}`);

      expect(res.status).toBe(200);
      expect(res.body.data?.code).toBeDefined();
    });
  });

  describe('6. Wallet & Ledger Strict User Isolation', () => {
    test('GET /api/v1/wallet strictly returns current user wallet without cross-account leakage', async () => {
      const resWorkerA = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${tokenWorkerA}`);
      expect(resWorkerA.status).toBe(200);
      expect(resWorkerA.body.data?.walletId).toBeDefined();

      const resWorkerB = await request(app)
        .get('/api/v1/wallet')
        .set('Authorization', `Bearer ${tokenWorkerB}`);
      expect(resWorkerB.status).toBe(200);
      expect(resWorkerB.body.data?.walletId).toBeDefined();

      // Verify that worker B received their own wallet, distinct from worker A
      expect(resWorkerA.body.data.walletId.toString()).not.toEqual(resWorkerB.body.data.walletId.toString());
    });

    test('Contractor cannot initiate worker funds withdrawal (role rejection 403)', async () => {
      const res = await request(app)
        .post('/api/v1/wallet/withdraw')
        .set('Authorization', `Bearer ${tokenContractorA}`)
        .send({
          amountPaise: 10000,
          idempotencyKey: `WITHDRAW_${Date.now()}`,
        });

      expect(res.status).toBe(403);
    });
  });

  describe('7. Disputes IDOR & Moderation Protection', () => {
    test('Worker B cannot raise dispute on an escrow milestone they do not participate in (403)', async () => {
      const res = await request(app)
        .post('/api/v1/disputes')
        .set('Authorization', `Bearer ${tokenWorkerB}`)
        .send({
          escrowTransactionId: testEscrowA._id.toString(),
          reason: 'OTHER',
          description: 'Intruder dispute attempt',
        });

      expect(res.status).toBe(403);
      expect(res.body.error?.code).toBe('FORBIDDEN');
    });

    test('Worker B cannot inspect dispute details between Worker A and Contractor A (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/disputes/${testDisputeA._id}`)
        .set('Authorization', `Bearer ${tokenWorkerB}`);

      expect(res.status).toBe(403);
    });

    test('Contractor B cannot inspect dispute details between Worker A and Contractor A (403)', async () => {
      const res = await request(app)
        .get(`/api/v1/disputes/${testDisputeA._id}`)
        .set('Authorization', `Bearer ${tokenContractorB}`);

      expect(res.status).toBe(403);
    });

    test('Non-admin users cannot resolve disputes (403)', async () => {
      const resWorker = await request(app)
        .post(`/api/v1/admin/disputes/${testDisputeA._id}/resolve`)
        .set('Authorization', `Bearer ${tokenWorkerA}`)
        .send({ decision: 'RELEASE_WORKER', notes: 'Self resolve' });
      expect(resWorker.status).toBe(403);

      const resContractor = await request(app)
        .post(`/api/v1/admin/disputes/${testDisputeA._id}/resolve`)
        .set('Authorization', `Bearer ${tokenContractorA}`)
        .send({ decision: 'REFUND_CONTRACTOR', notes: 'Self resolve' });
      expect(resContractor.status).toBe(403);
    });
  });

  describe('8. Incidents Visibility & Safety Moderation IDOR', () => {
    test('Worker B and Contractor B cannot view ADMIN_ONLY incident (403 or 404)', async () => {
      const resWorker = await request(app)
        .get(`/api/v1/incidents/${testIncidentA._id}`)
        .set('Authorization', `Bearer ${tokenWorkerB}`);
      expect([403, 404]).toContain(resWorker.status);

      const resContractor = await request(app)
        .get(`/api/v1/incidents/${testIncidentA._id}`)
        .set('Authorization', `Bearer ${tokenContractorB}`);
      expect([403, 404]).toContain(resContractor.status);
    });

    test('Worker A (reporter) and Admin can view the incident (200)', async () => {
      const resReporter = await request(app)
        .get(`/api/v1/incidents/${testIncidentA._id}`)
        .set('Authorization', `Bearer ${tokenWorkerA}`);
      expect(resReporter.status).toBe(200);

      const resAdmin = await request(app)
        .get(`/api/v1/incidents/${testIncidentA._id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(resAdmin.status).toBe(200);
    });

    test('Non-admin cannot add internal admin notes to incidents (403)', async () => {
      const res = await request(app)
        .post(`/api/v1/admin/incidents/${testIncidentA._id}/note`)
        .set('Authorization', `Bearer ${tokenContractorA}`)
        .send({ note: 'Illegal note by contractor' });

      expect(res.status).toBe(403);
    });
  });

  describe('9. Ratings Moderation IDOR', () => {
    test('Non-admin users cannot hide or unhide ratings (403)', async () => {
      const resWorker = await request(app)
        .post(`/api/v1/admin/ratings/${testRatingA._id}/hide`)
        .set('Authorization', `Bearer ${tokenWorkerA}`)
        .send({ reason: 'Worker tried to hide' });
      expect(resWorker.status).toBe(403);

      const resContractor = await request(app)
        .post(`/api/v1/admin/ratings/${testRatingA._id}/hide`)
        .set('Authorization', `Bearer ${tokenContractorA}`)
        .send({ reason: 'Contractor tried to hide' });
      expect(resContractor.status).toBe(403);
    });

    test('Admin can hide ratings (200)', async () => {
      const resAdmin = await request(app)
        .post(`/api/v1/admin/ratings/${testRatingA._id}/hide`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ reason: 'Moderated due to offensive language policy' });

      expect(resAdmin.status).toBe(200);
    });
  });

  describe('10. Razorpay Webhook Signature Verification & Payload Tampering', () => {
    let mockOrder;

    beforeAll(async () => {
      mockOrder = await PaymentOrder.create({
        user: contractorA._id,
        purpose: 'WALLET_TOPUP',
        amountPaise: 50000,
        currency: 'INR',
        provider: 'razorpay',
        providerOrderId: `order_audit_${Date.now()}`,
        status: 'CREATED',
      });
    });

    afterAll(async () => {
      if (mockOrder) await PaymentOrder.findByIdAndDelete(mockOrder._id);
    });

    test('Webhook request missing x-razorpay-signature is rejected with 400', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_missing_sig',
              order_id: mockOrder.providerOrderId,
              amount: 50000,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
    });

    test('Webhook request with invalid/forged signature is rejected with 400', async () => {
      const payload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_test_bad_sig',
              order_id: mockOrder.providerOrderId,
              amount: 50000,
            },
          },
        },
      });

      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', '0000000000000000000000000000000000000000000000000000000000000000')
        .send(payload);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/signature/i);
    });

    test('Webhook request with tampered amount is safely rejected / not credited', async () => {
      const tamperedPayload = JSON.stringify({
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: `pay_tampered_${Date.now()}`,
              order_id: mockOrder.providerOrderId,
              amount: 99999999, // Tampered higher amount!
            },
          },
        },
      });

      const validSecret = env.razorpayWebhookSecret || 'mock_webhook_secret';
      const validHmac = crypto
        .createHmac('sha256', validSecret)
        .update(Buffer.from(tamperedPayload, 'utf8'))
        .digest('hex');

      const walletBefore = await getOrCreateWallet(contractorA._id);

      const res = await request(app)
        .post('/api/v1/payments/razorpay/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', validHmac)
        .send(tamperedPayload);

      // Verify contractor wallet was NOT credited with tampered money
      const walletAfter = await getOrCreateWallet(contractorA._id);
      expect(walletAfter.balancePaise).toBe(walletBefore.balancePaise);
    });
  });
});
