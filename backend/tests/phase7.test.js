import { jest } from '@jest/globals';
import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import env from '../src/config/env.js';
import clock from '../src/utils/clock.js';
import User from '../src/models/User.js';
import Job from '../src/models/Job.js';
import Rating from '../src/models/Rating.js';
import Incident from '../src/models/Incident.js';
import Attendance from '../src/models/Attendance.js';
import EscrowTransaction from '../src/models/EscrowTransaction.js';
import Notification from '../src/models/Notification.js';
import {
  RATING_TYPES,
  INCIDENT_TYPES,
  INCIDENT_STATUS,
  INCIDENT_SEVERITY,
  ATTENDANCE_STATUS,
  ESCROW_STATUS,
  RESOLUTION_TYPE,
  LOCATION_FLAG,
} from '../src/config/constants.js';
import { getISTDateString } from '../src/utils/time.js';
import {
  escalateUnacknowledgedSos,
  sendRatingRequests,
  revealClosedWindows,
} from '../src/services/safety.scheduler.js';
import { recomputeRatingSummary } from '../src/services/rating.service.js';

describe('Phase 7: Reputation & Safety Integration Tests', () => {
  jest.setTimeout(45000);

  let contractorToken, worker1Token, worker2Token, strangerToken, adminToken;
  let contractorId, worker1Id, worker2Id, strangerId, adminId;
  let testJob;

  beforeAll(async () => {
    // Connect to test db if not connected
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }

    // Clean test collections
    await Promise.all([
      User.deleteMany({ phone: { $regex: /^\+919977/ } }),
      Job.deleteMany({ title: { $regex: /^Phase7Test/ } }),
      Rating.deleteMany({}),
      Incident.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Create Test Users with unique phones
    const contractor = await User.create({
      phone: '+919977000100',
      role: 'contractor',
      name: 'Contractor Sharma',
      languagePreference: 'hi',
      isActive: true,
      location: { type: 'Point', coordinates: [73.8567, 18.5204] },
    });
    contractorId = contractor._id.toString();

    const worker1 = await User.create({
      phone: '+919977000001',
      role: 'worker',
      name: 'Worker Raju',
      skills: ['painter'],
      experienceYears: 4,
      languagePreference: 'hi',
      isActive: true,
      emergencyContact: {
        name: 'Papa Raju',
        phone: '+919977000999',
        verifiedNoticeSentAt: new Date(),
      },
      location: { type: 'Point', coordinates: [73.8567, 18.5204] },
    });
    worker1Id = worker1._id.toString();

    const worker2 = await User.create({
      phone: '+919977000002',
      role: 'worker',
      name: 'Worker Mohan',
      skills: ['painter'],
      experienceYears: 2,
      languagePreference: 'hi',
      isActive: true,
      location: { type: 'Point', coordinates: [73.857, 18.521] },
    });
    worker2Id = worker2._id.toString();

    const stranger = await User.create({
      phone: '+919977000003',
      role: 'worker',
      name: 'Stranger Anil',
      skills: ['electrician'],
      languagePreference: 'hi',
      isActive: true,
      location: { type: 'Point', coordinates: [73.858, 18.522] },
    });
    strangerId = stranger._id.toString();

    const admin = await User.create({
      phone: '+919977000900',
      role: 'admin',
      name: 'Safety Admin',
      isActive: true,
    });
    adminId = admin._id.toString();

    // Generate JWT tokens
    const makeToken = (user) =>
      jwt.sign({ id: user._id.toString(), role: user.role, phone: user.phone }, env.jwtSecret, {
        expiresIn: '2h',
      });

    contractorToken = makeToken(contractor);
    worker1Token = makeToken(worker1);
    worker2Token = makeToken(worker2);
    strangerToken = makeToken(stranger);
    adminToken = makeToken(admin);

    // Create completed Job with W1 & W2 assigned
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    testJob = await Job.create({
      contractor: contractorId,
      title: 'Phase7Test Painting Job',
      skillRequired: 'painter',
      workersNeeded: 2,
      wagePerDayPaise: 80000,
      startDate: yesterday,
      endDate: yesterday,
      status: 'COMPLETED',
      assignedWorkers: [worker1Id, worker2Id],
      location: { type: 'Point', coordinates: [73.8567, 18.5204] },
      addressText: 'Phase 7 Site, Pune',
    });

    // W1 has checked out attendance and released escrow
    const yesterdayDateStr = getISTDateString(yesterday);
    await Attendance.create({
      job: testJob._id,
      worker: worker1Id,
      date: yesterdayDateStr,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
    });

    await EscrowTransaction.create({
      job: testJob._id,
      worker: worker1Id,
      contractor: contractorId,
      amountPaise: 80000,
      dayDate: yesterday,
      idempotencyKey: `test-escrow-${testJob._id}-${worker1Id}`,
      status: ESCROW_STATUS.RELEASED,
    });
  });

  afterAll(async () => {
    await Promise.all([
      User.deleteMany({ phone: { $regex: /^\+919977/ } }),
      Job.deleteMany({ title: { $regex: /^Phase7Test/ } }),
      Rating.deleteMany({}),
      Incident.deleteMany({}),
      Notification.deleteMany({}),
      EscrowTransaction.deleteMany({ idempotencyKey: { $regex: /^test-escrow/ } }),
    ]);
  });

  // ==========================================
  // RATINGS TESTS
  // ==========================================
  describe('Ratings & Double-Blind Mechanism', () => {
    it('rejects self-rating with 409', async () => {
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker1Id,
          type: RATING_TYPES.CONTRACTOR_PAYMENT,
          score: 5,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('SELF_RATING_BLOCKED');
    });

    it('rejects ratings from a stranger not connected to the job (403)', async () => {
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${strangerToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: contractorId,
          type: RATING_TYPES.CONTRACTOR_PAYMENT,
          score: 5,
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('NOT_JOB_PARTICIPANT');
    });

    it('rejects rating if worker has no CHECKED_OUT attendance', async () => {
      // W2 has no attendance doc
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker2Id,
          type: RATING_TYPES.WORKER_SKILL,
          score: 4,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_CHECKED_OUT_ATTENDANCE');
    });

    it('validates rating score, tags, and sanitizes HTML comments', async () => {
      // Invalid score 6
      const resBadScore = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker1Id,
          type: RATING_TYPES.WORKER_SKILL,
          score: 6,
        });
      expect(resBadScore.status).toBe(400);

      // Invalid tag for WORKER_SKILL
      const resBadTag = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker1Id,
          type: RATING_TYPES.WORKER_SKILL,
          score: 5,
          tags: ['PAID_ON_TIME'], // Belongs to CONTRACTOR_PAYMENT
        });
      expect(resBadTag.status).toBe(400);

      // Valid rating with HTML in comment
      const resOk = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker1Id,
          type: RATING_TYPES.WORKER_SKILL,
          score: 5,
          tags: ['GOOD_WORK', 'ON_TIME'],
          comment: '<script>alert("hack")</script>Bahut badhiya kaam kiya!<b>Bold</b>',
        });

      expect(resOk.status).toBe(201);
      expect(resOk.body.data.rating.revealedAt).toBeNull(); // Double-blind!
      expect(resOk.body.data.rating.comment).not.toContain('<script>');
      expect(resOk.body.data.rating.comment).toContain('Bahut badhiya kaam kiya!');
    });

    it('enforces double-blind: worker cannot see contractor rating until worker submits rating', async () => {
      // Worker 1 checks received ratings
      const resWorkerReceived = await request(app)
        .get('/api/v1/ratings/received')
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(resWorkerReceived.status).toBe(200);
      expect(resWorkerReceived.body.data.ratings).toHaveLength(0); // Still hidden!

      // Worker 1 checks reputation
      const resRepBefore = await request(app)
        .get(`/api/v1/users/${worker1Id}/reputation`)
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(resRepBefore.body.data.summary.workerSkillCount).toBe(0);

      // Worker 1 submits rating for Contractor (CONTRACTOR_PAYMENT)
      const resWorkerRate = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: contractorId,
          type: RATING_TYPES.CONTRACTOR_PAYMENT,
          score: 4,
          tags: ['PAID_ON_TIME', 'PAID_FULL_AMOUNT'],
          comment: 'Poora paisa waqt par mila.',
        });

      expect(resWorkerRate.status).toBe(201);
      expect(resWorkerRate.body.data.isRevealed).toBe(true); // Both sides submitted -> REVEALED!

      // Now both ratings must be revealed!
      const resWorkerReceivedAfter = await request(app)
        .get('/api/v1/ratings/received')
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(resWorkerReceivedAfter.body.data.ratings).toHaveLength(1);
      expect(resWorkerReceivedAfter.body.data.ratings[0].score).toBe(5);

      // Verify Bayesian Smoothing math on Worker 1:
      // Rating: [5], PRIOR_COUNT=3.0, PRIOR_MEAN=4.0
      // expected score = (3*4.0 + 5) / (3 + 1) = 17 / 4 = 4.25
      const resRepAfter = await request(app)
        .get(`/api/v1/users/${worker1Id}/reputation`)
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(resRepAfter.body.data.summary.workerSkillAvg).toBe(5);
      expect(resRepAfter.body.data.summary.workerSkillCount).toBe(1);
      expect(resRepAfter.body.data.summary.workerSkillScore).toBe(4.25);
    });

    it('rejects duplicate ratings with 409 ALREADY_RATED', async () => {
      const res = await request(app)
        .post('/api/v1/ratings')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({
          jobId: testJob._id.toString(),
          toUserId: worker1Id,
          type: RATING_TYPES.WORKER_SKILL,
          score: 4,
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('ALREADY_RATED');
    });

    it('enforces rating immutability: attempting to update score throws', async () => {
      const existingRating = await Rating.findOne({
        job: testJob._id,
        fromUser: contractorId,
      });

      expect(existingRating).toBeDefined();

      await expect(
        Rating.findByIdAndUpdate(existingRating._id, { score: 1 })
      ).rejects.toThrow('IMMUTABLE_FIELD');
    });

    it('allows recipient to report rating after reveal; non-recipient is rejected', async () => {
      const rating = await Rating.findOne({ toUser: worker1Id, revealedAt: { $ne: null } });

      // Non-recipient tries to report
      const resForbidden = await request(app)
        .post(`/api/v1/ratings/${rating._id}/report`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ reason: 'Not fair' });
      expect(resForbidden.status).toBe(403);

      // Recipient reports
      const resOk = await request(app)
        .post(`/api/v1/ratings/${rating._id}/report`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ reason: 'Unfair low score' });
      expect(resOk.status).toBe(200);

      // Cannot report twice
      const resDup = await request(app)
        .post(`/api/v1/ratings/${rating._id}/report`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ reason: 'Second report' });
      expect(resDup.status).toBe(409);
    });

    it('admin can hide a rating with reason and unhide it, recomputing summaries', async () => {
      const rating = await Rating.findOne({ toUser: worker1Id, revealedAt: { $ne: null } });

      // Hide without reason -> 400
      const resBad = await request(app)
        .post(`/api/v1/admin/ratings/${rating._id}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'no' });
      expect(resBad.status).toBe(400);

      // Hide with valid reason
      const resHide = await request(app)
        .post(`/api/v1/admin/ratings/${rating._id}/hide`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Contains offensive personal attacks' });
      expect(resHide.status).toBe(200);

      // Worker 1 summary recomputed (excluded hidden rating)
      const w1 = await User.findById(worker1Id);
      expect(w1.ratingSummary.workerSkillCount).toBe(0);

      // Unhide
      const resUnhide = await request(app)
        .post(`/api/v1/admin/ratings/${rating._id}/unhide`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resUnhide.status).toBe(200);

      const w1Restored = await User.findById(worker1Id);
      expect(w1Restored.ratingSummary.workerSkillCount).toBe(1);
    });
  });

  // ==========================================
  // SOS & SAFETY TESTS
  // ==========================================
  describe('Emergency SOS Alerts & Lifecycle', () => {
    let activeSosId;

    it('creates SOS without GPS coordinates setting locationFlag to STALE or MISSING', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/sos')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          idempotencyKey: 'sos-key-1',
          lat: null,
          lng: null,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.incident.type).toBe(INCIDENT_TYPES.SOS);
      expect(res.body.data.incident.severity).toBe(INCIDENT_SEVERITY.CRITICAL);
      expect([LOCATION_FLAG.STALE, LOCATION_FLAG.MISSING]).toContain(
        res.body.data.incident.locationFlag
      );
      expect(res.body.data.alerted.emergencyContact).toBe(true); // W1 has emergency contact
      expect(res.body.data.alerted.admins).toBe(true);

      activeSosId = res.body.data.incident._id;
    });

    it('enforces idempotency: same idempotencyKey returns existing incident without re-alerting', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/sos')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          idempotencyKey: 'sos-key-1',
          lat: 18.5204,
          lng: 73.8567,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.alreadyExists).toBe(true);
      expect(res.body.data.incident._id).toBe(activeSosId);
    });

    it('deduplicates calls within SOS_DEDUPE_WINDOW_SEC', async () => {
      const res = await request(app)
        .post('/api/v1/incidents/sos')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          idempotencyKey: 'sos-key-another',
          lat: 18.5205,
          lng: 73.8568,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.alreadyExists).toBe(true);
      expect(res.body.data.incident._id).toBe(activeSosId);
    });

    it('appends location trail updates and ignores updates faster than 5s', async () => {
      const res1 = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/location`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ lat: 18.521, lng: 73.857, accuracy: 10 });

      expect(res1.status).toBe(200);

      // Fast update (<5s) ignored
      const res2 = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/location`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ lat: 18.5212, lng: 73.8572, accuracy: 8 });

      expect(res2.status).toBe(200);
      expect(res2.body.data.ignored).toBe(true);
    });

    it('alerted contractor acknowledges SOS -> status moves to ACKNOWLEDGED', async () => {
      const res = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/acknowledge`)
        .set('Authorization', `Bearer ${adminToken}`); // Admin is always authorized

      expect(res.status).toBe(200);
      expect(res.body.data.incident.status).toBe(INCIDENT_STATUS.ACKNOWLEDGED);

      // Stranger cannot acknowledge
      const resStranger = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/acknowledge`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(resStranger.status).toBe(403);
    });

    it('reporter resolves incident with SELF_SAFE; cannot use HELP_PROVIDED', async () => {
      // Reporter tries invalid resolution type HELP_PROVIDED
      const resBad = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/resolve`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ resolutionType: RESOLUTION_TYPE.HELP_PROVIDED });
      expect(resBad.status).toBe(400);

      // Reporter resolves with SELF_SAFE
      const resOk = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/resolve`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ resolutionType: RESOLUTION_TYPE.SELF_SAFE, notes: 'Sab theek hai ab' });

      expect(resOk.status).toBe(200);
      expect(resOk.body.data.incident.status).toBe(INCIDENT_STATUS.RESOLVED);

      // Double resolve is idempotent
      const resDup = await request(app)
        .post(`/api/v1/incidents/${activeSosId}/resolve`)
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ resolutionType: RESOLUTION_TYPE.SELF_SAFE });
      expect(resDup.status).toBe(200);
    });

    it('incidents cannot be deleted (immutability guard)', async () => {
      await expect(Incident.findByIdAndDelete(activeSosId)).rejects.toThrow('IMMUTABLE_INCIDENT');
    });
  });

  // ==========================================
  // PRIVACY & VISIBILITY TESTS
  // ==========================================
  describe('Incident Reporting Privacy & Visibility', () => {
    let harassmentIncidentId;

    it('HARASSMENT reports are ADMIN_ONLY and hidden from contractor', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({
          type: INCIDENT_TYPES.HARASSMENT,
          severity: INCIDENT_SEVERITY.HIGH,
          description: 'Contractor ne gaali-galoch ki aur dhamkaya.',
          jobId: testJob._id.toString(),
          accusedUserId: contractorId,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.incident.visibility).toBe('ADMIN_ONLY');
      harassmentIncidentId = res.body.data.incident._id;

      // Contractor attempts to view -> 404 (hidden)
      const resContractor = await request(app)
        .get(`/api/v1/incidents/${harassmentIncidentId}`)
        .set('Authorization', `Bearer ${contractorToken}`);
      expect(resContractor.status).toBe(404);

      // Does not appear in contractor's job incidents
      const resJobIncidents = await request(app)
        .get(`/api/v1/jobs/${testJob._id}/incidents`)
        .set('Authorization', `Bearer ${contractorToken}`);
      expect(resJobIncidents.status).toBe(200);
      expect(resJobIncidents.body.data.incidents).toHaveLength(0);

      // Admin can view
      const resAdmin = await request(app)
        .get(`/api/v1/incidents/${harassmentIncidentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.data.incident.type).toBe(INCIDENT_TYPES.HARASSMENT);
    });
  });

  // ==========================================
  // EMERGENCY CONTACT & USER ENDPOINTS
  // ==========================================
  describe('Emergency Contact Setup', () => {
    it('validates E.164 phone and rejects own phone', async () => {
      // Own phone
      const resOwn = await request(app)
        .patch('/api/v1/users/me/emergency-contact')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ name: 'Self', phone: '+919977000001' });
      expect(resOwn.status).toBe(400);

      // Valid contact
      const resOk = await request(app)
        .patch('/api/v1/users/me/emergency-contact')
        .set('Authorization', `Bearer ${worker1Token}`)
        .send({ name: 'Chacha Ji', phone: '+919977000888' });

      expect(resOk.status).toBe(200);
      expect(resOk.body.data.emergencyContact.phone).toBe('+919977000888');

      // Check /auth/me exposes hasEmergencyContact
      const resMe = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${worker1Token}`);

      expect(resMe.status).toBe(200);
      expect(resMe.body.data.user.hasEmergencyContact).toBe(true);
    });
  });

  // ==========================================
  // REGRESSION GUARD: NO FINANCIAL CODE TOUCHED
  // ==========================================
  describe('Financial Code Invariant Check', () => {
    it('proves no Phase 7 file touches balancePaise or lockedPaise directly', async () => {
      const fs = await import('fs');
      const phase7Files = [
        'src/services/rating.service.js',
        'src/services/sos.service.js',
        'src/services/incident.service.js',
        'src/services/safety.scheduler.js',
        'src/controllers/ratings.controller.js',
        'src/controllers/incidents.controller.js',
      ];

      for (const file of phase7Files) {
        const content = fs.readFileSync(`src/${file.replace('src/', '')}`, 'utf8');
        // Must never write to balancePaise or lockedPaise
        expect(content).not.toMatch(/\$inc:\s*{\s*(balancePaise|lockedPaise)/);
        expect(content).not.toMatch(/balancePaise\s*[-+]=/);
      }
    });
  });
});
