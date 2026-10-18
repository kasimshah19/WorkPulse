import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import JobApplication from '../src/models/JobApplication.js';
import Attendance from '../src/models/Attendance.js';
import AuditLog from '../src/models/AuditLog.js';
import Notification from '../src/models/Notification.js';
import env from '../src/config/env.js';
import clock from '../src/utils/clock.js';
import { destinationPoint } from '../src/utils/geo.js';
import { getISTDateString } from '../src/utils/time.js';
import { generateAttendanceCode } from '../src/services/attendance.service.js';
import { autoCheckoutForgotten, markMissed } from '../src/services/attendance.scheduler.js';
import { JOB_STATUS, APPLICATION_STATUS, ATTENDANCE_STATUS } from '../src/config/constants.js';

// Minimal 1x1 valid JPEG Buffer
const VALID_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
  0x00, 0xbf, 0x00, 0xff, 0xd9,
]);

// Fake text buffer pretending to be jpeg
const FAKE_JPEG = Buffer.from('This is a text file not a JPEG image');

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: '1d',
  });

describe('WorkPulse Phase 4: Attendance, Proof-of-Work, Geofencing & Sign-Off Suite', () => {
  let contractor, worker1, worker2, workerUnassigned;
  let contractorToken, worker1Token, worker2Token, unassignedToken;
  let job, qrJob;
  const siteLat = 18.5204;
  const siteLng = 73.8567;

  jest.setTimeout(30000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }
  }, 30000);

  afterAll(async () => {
    clock.reset();
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    clock.reset();
    await User.deleteMany({});
    await Job.deleteMany({});
    await JobApplication.deleteMany({});
    await Attendance.deleteMany({});
    await AuditLog.deleteMany({});
    await Notification.deleteMany({});

    contractor = await User.create({
      phone: '+919000000100',
      role: 'contractor',
      name: 'Test Contractor',
      languagePreference: 'hi',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
    });
    contractorToken = signToken(contractor);

    worker1 = await User.create({
      phone: '+919000000001',
      role: 'worker',
      name: 'Worker One',
      skills: ['painter'],
      isAvailable: true,
      languagePreference: 'hi',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
    });
    worker1Token = signToken(worker1);

    worker2 = await User.create({
      phone: '+919000000002',
      role: 'worker',
      name: 'Worker Two',
      skills: ['painter'],
      isAvailable: true,
      languagePreference: 'hi',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
    });
    worker2Token = signToken(worker2);

    workerUnassigned = await User.create({
      phone: '+919000000099',
      role: 'worker',
      name: 'Worker Unassigned',
      skills: ['painter'],
      isAvailable: true,
      languagePreference: 'hi',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
    });
    unassignedToken = signToken(workerUnassigned);

    const today = new Date();
    const twoDaysLater = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

    job = await Job.create({
      contractor: contractor._id,
      title: 'Geofence Test Job',
      skillRequired: 'painter',
      workersNeeded: 2,
      workersAssignedCount: 2,
      wagePerDayPaise: 80000,
      startDate: today,
      endDate: twoDaysLater,
      totalDays: 3,
      workingHours: { start: '00:00', end: '23:59' },
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
      addressText: 'Pune Test Site',
      geofenceRadiusMeters: 100,
      matchRadiusKm: 5,
      status: JOB_STATUS.FILLED,
      requiresSelfie: true,
    });

    await JobApplication.create([
      { job: job._id, worker: worker1._id, status: APPLICATION_STATUS.ASSIGNED },
      { job: job._id, worker: worker2._id, status: APPLICATION_STATUS.ASSIGNED },
    ]);

    qrJob = await Job.create({
      contractor: contractor._id,
      title: 'QR Test Job',
      skillRequired: 'painter',
      workersNeeded: 1,
      workersAssignedCount: 1,
      wagePerDayPaise: 75000,
      startDate: today,
      endDate: twoDaysLater,
      totalDays: 3,
      workingHours: { start: '00:00', end: '23:59' },
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
      addressText: 'Pune QR Site',
      geofenceRadiusMeters: 100,
      matchRadiusKm: 5,
      status: JOB_STATUS.FILLED,
      requiresSelfie: false,
    });

    await JobApplication.create({
      job: qrJob._id,
      worker: worker1._id,
      status: APPLICATION_STATUS.ASSIGNED,
    });
  });

  describe('1. Check-in inside geofence with selfie', () => {
    it('successfully checks in inside geofence (50m) with selfie and creates notification', async () => {
      const inside = destinationPoint(siteLat, siteLng, 0.05, 0); // 50m North

      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', inside.latitude)
        .field('lng', inside.longitude)
        .field('accuracy', 12)
        .field('clientTimestamp', clock.now().toISOString())
        .field('method', 'gps_selfie')
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ATTENDANCE_STATUS.CHECKED_IN);
      expect(res.body.data.checkInDistanceMeters).toBeLessThanOrEqual(60);
      expect(res.body.data.selfieUrl).toContain(`/api/v1/attendance/`);

      // Check job transitioned to IN_PROGRESS
      const updatedJob = await Job.findById(job._id);
      expect(updatedJob.status).toBe(JOB_STATUS.IN_PROGRESS);

      // Check notification created
      const notif = await Notification.findOne({ user: contractor._id });
      expect(notif).toBeDefined();
    });
  });

  describe('2. Geofence rejection and AuditLog trail', () => {
    it('rejects check-in outside geofence (150m) with 422, creates NO attendance, and writes auditlog', async () => {
      const outside = destinationPoint(siteLat, siteLng, 0.15, 180); // 150m South

      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', outside.latitude)
        .field('lng', outside.longitude)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('OUTSIDE_GEOFENCE');
      expect(res.body.error.details.distanceMeters).toBeGreaterThan(100);

      // Verify NO attendance document was created
      const att = await Attendance.findOne({ worker: worker1._id });
      expect(att).toBeNull();

      // Verify auditlogs entry exists
      const audit = await AuditLog.findOne({
        actor: worker1._id,
        action: 'ATTENDANCE_CHECKIN_REJECTED',
      });
      expect(audit).toBeDefined();
      expect(audit.after.reason).toBe('OUTSIDE_GEOFENCE');
    });
  });

  describe('3. Validation checks: Accuracy, Clock Drift, Impossible Jump', () => {
    it('rejects check-in with poor GPS accuracy (>50m)', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 75) // > 50m
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('LOW_ACCURACY');
    });

    it('rejects check-in with stale client clock (>120s drift)', async () => {
      const staleTime = new Date(Date.now() - 300 * 1000).toISOString(); // 5 min ago

      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', staleTime)
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('CLOCK_MISMATCH');
    });

    it('rejects impossible jump heuristic when speed > 150 km/h', async () => {
      // Create previous attendance 10 minutes ago in Mumbai (120 km away from Pune)
      const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
      await Attendance.create({
        job: job._id,
        worker: worker1._id,
        date: '2026-10-17',
        status: ATTENDANCE_STATUS.CHECKED_OUT,
        checkInAt: tenMinsAgo,
        checkInLocation: { type: 'Point', coordinates: [72.8777, 19.076] }, // Mumbai
        createdAt: tenMinsAgo,
      });

      // Try check-in in Pune 10 mins later (speed ~700 km/h)
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SUSPICIOUS_LOCATION');
    });
  });

  describe('4. Authorization, Dates, and Working Hours', () => {
    it('rejects unassigned worker with 403 NOT_ASSIGNED', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${unassignedToken}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_ASSIGNED');
    });

    it('rejects check-in outside working hours when hours are restricted', async () => {
      await Job.findByIdAndUpdate(job._id, {
        workingHours: { start: '10:00', end: '16:00' },
      });

      // Mock time to 06:00 IST (well before 10:00 - 30m)
      const earlyMorning = new Date();
      earlyMorning.setUTCHours(0, 30, 0, 0); // 06:00 IST
      clock.setMockTime(earlyMorning);

      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('OUTSIDE_WORKING_HOURS');
    });
  });

  describe('5. Magic-byte verification and file validation', () => {
    it('rejects a fake text file renamed as .jpg with magic byte error', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', FAKE_JPEG, 'fake.jpg');

      expect(res.status).toBe(500); // Storage service throws magic bytes validation error
    });
  });

  describe('6. Duplicate and concurrent check-in handling', () => {
    it('handles duplicate check-in with 409 ALREADY_CHECKED_IN', async () => {
      // First check-in succeeds
      await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      // Second check-in on same day
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_CHECKED_IN');
    });
  });

  describe('7. Check-out and hoursWorked computation', () => {
    it('computes hoursWorked correctly using mocked clock', async () => {
      // Check-in at 09:00 IST
      const startTime = new Date('2026-10-18T03:30:00.000Z'); // 09:00 IST
      clock.setMockTime(startTime);

      await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      // Advance clock by 8.5 hours (17:30 IST)
      const endTime = new Date(startTime.getTime() + 8.5 * 60 * 60 * 1000);
      clock.setMockTime(endTime);

      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-out`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe(ATTENDANCE_STATUS.CHECKED_OUT);
      expect(res.body.data.hoursWorked).toBe(8.5);

      // Double check-out should fail
      const doubleRes = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-out`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString());

      expect(doubleRes.status).toBe(409);
      expect(doubleRes.body.error.code).toBe('ALREADY_CHECKED_OUT');
    });
  });

  describe('8. Immutability guards', () => {
    it('throws error when attempting to modify checkInAt or hoursWorked on a closed attendance', async () => {
      const att = await Attendance.create({
        job: job._id,
        worker: worker1._id,
        date: '2026-10-18',
        status: ATTENDANCE_STATUS.CHECKED_OUT,
        checkInAt: new Date(),
        hoursWorked: 8.0,
      });

      // Direct save mutation should throw error from pre-save guard
      att.hoursWorked = 12.0;
      await expect(att.save()).rejects.toThrow(/immutable/i);
    });
  });

  describe('9. Contractor Signoff and Dispute handling', () => {
    let attendanceRecord;

    beforeEach(async () => {
      attendanceRecord = await Attendance.create({
        job: job._id,
        worker: worker1._id,
        date: '2026-10-18',
        status: ATTENDANCE_STATUS.CHECKED_OUT,
        checkInAt: new Date(),
        checkOutAt: new Date(),
        hoursWorked: 8,
        'contractorSignoff.status': 'PENDING',
      });
    });

    it('allows contractor to APPROVE attendance', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/${attendanceRecord._id}/signoff`)
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({ decision: 'APPROVED' });

      expect(res.status).toBe(200);
      expect(res.body.data.contractorSignoff.status).toBe('APPROVED');
    });

    it('rejects DISPUTED without a reason of at least 5 chars', async () => {
      const res = await request(app)
        .post(`/api/v1/attendance/${attendanceRecord._id}/signoff`)
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({ decision: 'DISPUTED', reason: 'bad' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('REASON_REQUIRED');
    });
  });

  describe('10. Daily Code / QR punch fallback', () => {
    it('successfully checks in with correct daily code for QR job', async () => {
      const todayStr = getISTDateString();
      const codeInfo = generateAttendanceCode(qrJob.attendanceCodeSecret, todayStr, qrJob._id);

      const res = await request(app)
        .post(`/api/v1/jobs/${qrJob._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .field('method', 'gps_qr')
        .field('code', codeInfo.code);

      expect(res.status).toBe(201);
      expect(res.body.data.qrUsed).toBe(true);
    });

    it('rejects wrong daily code with 422 INVALID_CODE', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${qrJob._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .field('method', 'gps_qr')
        .field('code', '000000'); // Wrong code

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('INVALID_CODE');
    });
  });

  describe('11. Selfie Access Control', () => {
    let checkedInAtt;

    beforeEach(async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/${job._id}/attendance/check-in`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .field('lat', siteLat)
        .field('lng', siteLng)
        .field('accuracy', 10)
        .field('clientTimestamp', clock.now().toISOString())
        .attach('selfie', VALID_JPEG, 'selfie.jpg');

      checkedInAtt = res.body.data;
    });

    it('allows worker owner and contractor to fetch selfie image', async () => {
      const wRes = await request(app)
        .get(`/api/v1/attendance/${checkedInAtt._id}/selfie`)
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(wRes.status).toBe(200);
      expect(wRes.headers['content-type']).toContain('image/jpeg');

      const cRes = await request(app)
        .get(`/api/v1/attendance/${checkedInAtt._id}/selfie`)
        .set('Authorization', `Bearer ${contractorToken}`);

      expect(cRes.status).toBe(200);
    });

    it('rejects another worker from fetching selfie with 403 FORBIDDEN', async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/${checkedInAtt._id}/selfie`)
        .set('Authorization', `Bearer ${worker2Token}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  describe('12. Scheduler: autoCheckoutForgotten and markMissed', () => {
    it('automatically checks out open attendances past working hours and grace period', async () => {
      const yesterday = '2026-10-17';
      const att = await Attendance.create({
        job: job._id,
        worker: worker1._id,
        date: yesterday,
        status: ATTENDANCE_STATUS.CHECKED_IN,
        checkInAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      });

      const updatedList = await autoCheckoutForgotten();
      expect(updatedList.length).toBeGreaterThanOrEqual(1);

      const refreshed = await Attendance.findById(att._id);
      expect(refreshed.status).toBe(ATTENDANCE_STATUS.CHECKED_OUT);
      expect(refreshed.autoCheckout).toBe(true);
      expect(refreshed.flags).toContain('AUTO_CHECKOUT');
    });

    it('marks no-show workers as MISSED after working hours and grace period', async () => {
      // Set workingHours to 08:00 - 10:00 and advance clock to 12:00 IST
      await Job.findByIdAndUpdate(job._id, {
        workingHours: { start: '08:00', end: '10:00' },
      });

      const noonTime = new Date();
      noonTime.setUTCHours(6, 30, 0, 0); // 12:00 IST
      clock.setMockTime(noonTime);

      const missedList = await markMissed();
      expect(missedList.length).toBeGreaterThanOrEqual(1);

      const missedAtt = await Attendance.findOne({
        job: job._id,
        worker: worker1._id,
        status: ATTENDANCE_STATUS.MISSED,
      });
      expect(missedAtt).toBeDefined();
      expect(missedAtt.rejectionReason).toBe('NO_SHOW');
    });
  });
});
