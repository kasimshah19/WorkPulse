import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app.js';
import env from '../src/config/env.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import JobApplication from '../src/models/JobApplication.js';
import Notification from '../src/models/Notification.js';
import Otp from '../src/models/Otp.js';
import Wallet from '../src/models/Wallet.js';
import { destinationPoint } from '../src/utils/geo.js';
import { ensureGeoIndexes } from '../src/services/matching.service.js';

describe('Phase 3: Auth, Jobs, Matching & Applications Test Suite', () => {
  const centerLat = 18.5204;
  const centerLng = 73.8567;

  let contractorToken;
  let contractorId;
  let worker1Token;
  let worker1Id;
  let worker2Token;
  let worker2Id;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest || env.mongoUri);
    }
    await ensureGeoIndexes();
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Clean test data before each suite
    await User.deleteMany({ phone: { $regex: /^\+919000/ } });
    await Job.deleteMany({});
    await JobApplication.deleteMany({});
    await Notification.deleteMany({});
    await Otp.deleteMany({ phone: { $regex: /^\+919000/ } });
    await Wallet.deleteMany({});
  });

  describe('1. Authentication & Session', () => {
    it('should send OTP and return devOtp in dev mode', async () => {
      const res = await request(app).post('/api/v1/auth/send-otp').send({
        phone: '+919000000099',
        purpose: 'login',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.phone).toBe('+919000000099');
      expect(res.body.data.devOtp).toBeDefined();
      expect(res.body.data.devOtp).toHaveLength(6);
    });

    it('should reject invalid OTP with 400 INVALID_OTP', async () => {
      await request(app).post('/api/v1/auth/send-otp').send({
        phone: '+919000000099',
      });

      const res = await request(app).post('/api/v1/auth/verify-otp').send({
        phone: '+919000000099',
        otp: '000000',
        name: 'Invalid Test',
        role: 'worker',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_OTP');
    });

    it('should enforce rate limit of max 3 OTP requests in 10 minutes', async () => {
      const phone = '+919000000088';

      // 3 successful requests
      await request(app).post('/api/v1/auth/send-otp').send({ phone });
      await request(app).post('/api/v1/auth/send-otp').send({ phone });
      await request(app).post('/api/v1/auth/send-otp').send({ phone });

      // 4th request must be rate limited
      const res = await request(app).post('/api/v1/auth/send-otp').send({ phone });
      expect(res.status).toBe(429);
      expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });

    it('should verify OTP, create user and wallet, and return JWT token', async () => {
      const phone = '+919000000077';
      const sendRes = await request(app).post('/api/v1/auth/send-otp').send({ phone });
      const devOtp = sendRes.body.data.devOtp;

      const verifyRes = await request(app).post('/api/v1/auth/verify-otp').send({
        phone,
        otp: devOtp,
        name: 'New Worker Test',
        role: 'worker',
      });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.data.isNewUser).toBe(true);
      expect(verifyRes.body.data.token).toBeDefined();
      expect(verifyRes.body.data.user.name).toBe('New Worker Test');
      expect(verifyRes.body.data.user.role).toBe('worker');

      // Verify wallet was created
      const wallet = await Wallet.findOne({ user: verifyRes.body.data.user.id });
      expect(wallet).toBeDefined();
      expect(wallet.balancePaise).toBe(0);
    });
  });

  describe('2. Job Posting, Matching & Broadcast', () => {
    beforeEach(async () => {
      // 1. Create Contractor
      const cRes = await request(app).post('/api/v1/auth/send-otp').send({ phone: '+919000000100' });
      const cVerify = await request(app).post('/api/v1/auth/verify-otp').send({
        phone: '+919000000100',
        otp: cRes.body.data.devOtp,
        name: 'Test Contractor',
        role: 'contractor',
      });
      contractorToken = cVerify.body.data.token;
      contractorId = cVerify.body.data.user.id;

      // 2. Seed 8 workers with exact destination points
      const workers = [
        { code: 'W1', phone: '+919000000001', name: 'W1 Painter', skill: 'painter', km: 1.0, bearing: 0, avail: true },
        { code: 'W2', phone: '+919000000002', name: 'W2 Painter', skill: 'painter', km: 3.0, bearing: 90, avail: true },
        { code: 'W3', phone: '+919000000003', name: 'W3 Painter', skill: 'painter', km: 4.5, bearing: 180, avail: true },
        { code: 'W4', phone: '+919000000004', name: 'W4 Painter 6km', skill: 'painter', km: 6.0, bearing: 270, avail: true },
        { code: 'W5', phone: '+919000000005', name: 'W5 Painter 12km', skill: 'painter', km: 12.0, bearing: 0, avail: true },
        { code: 'W6', phone: '+919000000006', name: 'W6 Plumber', skill: 'plumber', km: 2.0, bearing: 90, avail: true },
        { code: 'W7', phone: '+919000000007', name: 'W7 Unavailable', skill: 'painter', km: 2.0, bearing: 270, avail: false },
        { code: 'W8', phone: '+919000000008', name: 'W8 Painter', skill: 'painter', km: 2.5, bearing: 45, avail: true },
      ];

      for (const w of workers) {
        const dest = destinationPoint(centerLat, centerLng, w.km, w.bearing);
        const user = await User.create({
          name: w.name,
          phone: w.phone,
          role: 'worker',
          skills: [w.skill],
          isAvailable: w.avail,
          isActive: true,
          location: {
            type: 'Point',
            coordinates: [dest.longitude, dest.latitude],
          },
        });

        if (w.code === 'W1') {
          worker1Id = user._id;
          const loginRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: w.phone });
          worker1Token = loginRes.body.data.token;
        }
        if (w.code === 'W2') {
          worker2Id = user._id;
          const loginRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: w.phone });
          worker2Token = loginRes.body.data.token;
        }
      }
    });

    it('should notify exactly W1, W2, W3, W8 for a 5km painter job, and exclude W4, W5, W6, W7', async () => {
      // 1. Contractor creates job
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          title: 'Boundary Wall Painting',
          skillRequired: 'painter',
          workersNeeded: 2,
          wagePerDayPaise: 80000,
          startDate: tomorrow,
          endDate: dayAfter,
          location: { lat: centerLat, lng: centerLng },
          addressText: 'Pune Center Site',
          matchRadiusKm: 5,
        });

      expect(createRes.status).toBe(201);
      const jobId = createRes.body.data._id;

      // 2. Contractor publishes job
      const pubRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/publish`)
        .set('Authorization', `Bearer ${contractorToken}`);

      expect(pubRes.status).toBe(200);
      expect(pubRes.body.data.matching.notified).toBe(4); // Exactly W1, W2, W3, W8

      // Verify applications in DB
      const apps = await JobApplication.find({ job: jobId }).populate('worker', 'phone');
      const notifiedPhones = apps.map((a) => a.worker.phone);

      expect(notifiedPhones).toContain('+919000000001'); // W1
      expect(notifiedPhones).toContain('+919000000002'); // W2
      expect(notifiedPhones).toContain('+919000000003'); // W3
      expect(notifiedPhones).toContain('+919000000008'); // W8

      expect(notifiedPhones).not.toContain('+919000000004'); // W4 > 5km
      expect(notifiedPhones).not.toContain('+919000000005'); // W5 > 5km
      expect(notifiedPhones).not.toContain('+919000000006'); // W6 wrong skill (plumber)
      expect(notifiedPhones).not.toContain('+919000000007'); // W7 unavailable

      // Verify SMS notification record created for offline workers
      const smsNotifications = await Notification.find({ data: { jobId: new mongoose.Types.ObjectId(jobId) }, channel: 'sms' });
      expect(smsNotifications.length).toBe(4);
    });

    it('should be idempotent: publishing twice does not duplicate applications', async () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const createRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          title: 'Painting Job Idempotency Test',
          skillRequired: 'painter',
          workersNeeded: 1,
          wagePerDayPaise: 75000,
          startDate: tomorrow,
          endDate: dayAfter,
          location: { lat: centerLat, lng: centerLng },
          addressText: 'Site Location',
          matchRadiusKm: 5,
        });

      const jobId = createRes.body.data._id;

      // First publish
      await request(app)
        .post(`/api/v1/jobs/${jobId}/publish`)
        .set('Authorization', `Bearer ${contractorToken}`);

      const count1 = await JobApplication.countDocuments({ job: jobId });
      expect(count1).toBe(4);

      // Second publish (idempotent)
      const secondPubRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/publish`)
        .set('Authorization', `Bearer ${contractorToken}`);

      expect(secondPubRes.status).toBe(200);
      const count2 = await JobApplication.countDocuments({ job: jobId });
      expect(count2).toBe(4); // No duplicates!
    });
  });

  describe('3. Concurrency & Atomic Job Assignment', () => {
    let testJobId;

    beforeEach(async () => {
      // Setup contractor and 2 workers
      const cLogin = await User.create({
        name: 'Test Contractor Concurrency',
        phone: '+919000000100',
        role: 'contractor',
        isActive: true,
      });
      contractorId = cLogin._id;
      const cTokenRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: '+919000000100' });
      contractorToken = cTokenRes.body.data.token;

      const w1 = await User.create({
        name: 'Worker 1',
        phone: '+919000000001',
        role: 'worker',
        skills: ['painter'],
        isAvailable: true,
        isActive: true,
        location: { type: 'Point', coordinates: [centerLng, centerLat] },
      });
      worker1Id = w1._id;
      const w1TokenRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: '+919000000001' });
      worker1Token = w1TokenRes.body.data.token;

      const w2 = await User.create({
        name: 'Worker 2',
        phone: '+919000000002',
        role: 'worker',
        skills: ['painter'],
        isAvailable: true,
        isActive: true,
        location: { type: 'Point', coordinates: [centerLng, centerLat] },
      });
      worker2Id = w2._id;
      const w2TokenRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: '+919000000002' });
      worker2Token = w2TokenRes.body.data.token;

      // Post job with workersNeeded = 1
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const dayAfter = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

      const jobRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          title: 'Single Slot Painting Job',
          skillRequired: 'painter',
          workersNeeded: 1, // Only 1 worker needed!
          wagePerDayPaise: 80000,
          startDate: tomorrow,
          endDate: dayAfter,
          location: { lat: centerLat, lng: centerLng },
          addressText: 'Site Location',
          matchRadiusKm: 5,
        });

      testJobId = jobRes.body.data._id;

      // Publish job
      await request(app)
        .post(`/api/v1/jobs/${testJobId}/publish`)
        .set('Authorization', `Bearer ${contractorToken}`);
    });

    it('with workersNeeded = 1, two simultaneous accepts result in exactly one 200 and one 409', async () => {
      // Execute 2 concurrent accept requests in parallel
      const [res1, res2] = await Promise.all([
        request(app).post(`/api/v1/jobs/${testJobId}/accept`).set('Authorization', `Bearer ${worker1Token}`),
        request(app).post(`/api/v1/jobs/${testJobId}/accept`).set('Authorization', `Bearer ${worker2Token}`),
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);

      // Job must be FILLED and workersAssignedCount must be exactly 1
      const finalJob = await Job.findById(testJobId);
      expect(finalJob.workersAssignedCount).toBe(1);
      expect(finalJob.status).toBe('FILLED');

      // The unassigned worker application must be marked EXPIRED
      const expiredApps = await JobApplication.find({ job: testJobId, status: 'EXPIRED' });
      expect(expiredApps.length).toBe(1);
    });

    it('accepting twice by the assigned worker is idempotent (returns 200, no double increment)', async () => {
      const res1 = await request(app)
        .post(`/api/v1/jobs/${testJobId}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(res1.status).toBe(200);

      // Second accept by the same worker
      const res2 = await request(app)
        .post(`/api/v1/jobs/${testJobId}/accept`)
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(res2.status).toBe(200);

      const job = await Job.findById(testJobId);
      expect(job.workersAssignedCount).toBe(1);
    });
  });

  describe('4. Authorization Controls', () => {
    it('worker cannot post jobs (403 FORBIDDEN)', async () => {
      const wUser = await User.create({
        name: 'Worker Auth Test',
        phone: '+919000000001',
        role: 'worker',
        isActive: true,
      });

      const tokenRes = await request(app).post('/api/v1/auth/dev-login').send({ phone: wUser.phone });
      const workerToken = tokenRes.body.data.token;

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const res = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          title: 'Illegal Job',
          skillRequired: 'painter',
          workersNeeded: 1,
          wagePerDayPaise: 80000,
          startDate: tomorrow,
          endDate: tomorrow,
          location: { lat: centerLat, lng: centerLng },
          addressText: 'Site',
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('contractor cannot publish another contractor job (403 FORBIDDEN)', async () => {
      const c1 = await User.create({ name: 'C1', phone: '+919000000101', role: 'contractor', isActive: true });
      const c2 = await User.create({ name: 'C2', phone: '+919000000102', role: 'contractor', isActive: true });

      const t1 = (await request(app).post('/api/v1/auth/dev-login').send({ phone: c1.phone })).body.data.token;
      const t2 = (await request(app).post('/api/v1/auth/dev-login').send({ phone: c2.phone })).body.data.token;

      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const jobRes = await request(app)
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${t1}`)
        .send({
          title: 'C1 Job',
          skillRequired: 'painter',
          workersNeeded: 1,
          wagePerDayPaise: 80000,
          startDate: tomorrow,
          endDate: tomorrow,
          location: { lat: centerLat, lng: centerLng },
          addressText: 'Site',
        });

      const jobId = jobRes.body.data._id;

      // C2 attempts to publish C1's job
      const pubRes = await request(app)
        .post(`/api/v1/jobs/${jobId}/publish`)
        .set('Authorization', `Bearer ${t2}`);

      expect(pubRes.status).toBe(403);
      expect(pubRes.body.error.code).toBe('FORBIDDEN');
    });
  });
});
