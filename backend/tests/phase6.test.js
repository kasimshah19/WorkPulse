import request from 'supertest';
import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import jwt from 'jsonwebtoken';

import app from '../src/app.js';
import env from '../src/config/env.js';
import User from '../src/models/User.js';
import Wallet from '../src/models/Wallet.js';
import VoiceSession, {
  VOICE_SESSION_METHOD,
  VOICE_SESSION_STATUS,
} from '../src/models/VoiceSession.js';
import { SKILLS } from '../src/config/constants.js';
import { SKILLS_CATALOG, SKILLS_MAP } from '../src/config/skills.catalog.js';
import voiceClient from '../src/services/voice.client.js';

function createMinimalWav() {
  const sampleRate = 8000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const dataSize = 1600;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

describe('Phase 6: Voice Onboarding Test Suite', () => {
  let stubServer;
  let stubPort;
  let originalBaseUrl;
  let originalTimeout;

  let workerToken;
  let workerId;
  let worker2Token;
  let worker2Id;
  let contractorToken;
  let adminToken;

  let stubResponses = {
    healthStatus: 200,
    healthBody: {
      status: 'ok',
      service: 'voice-service',
      sttProvider: 'mock',
      whisperModelLoaded: false,
    },
    extractStatus: 200,
    extractBody: {
      skills: [
        { key: 'painter', confidence: 0.95, matchedText: 'painter' },
        { key: 'unknown_fake_skill', confidence: 0.8 },
      ],
      suggestions: [{ key: 'mason', confidence: 0.5, matchedText: 'mistri' }],
      experienceYears: 5,
      perSkillYears: {},
      flags: [],
      normalizedText: 'main painter hoon 5 saal ka experience hai',
    },
    onboardStatus: 200,
    onboardBody: {
      text: 'main painter hoon 5 saal ka experience hai',
      language: 'hi',
      durationSec: 2.5,
      provider: 'mock',
      latencyMs: 110,
      skills: [
        { key: 'painter', confidence: 0.95, matchedText: 'painter' },
        { key: 'unknown_fake_skill', confidence: 0.8 },
      ],
      suggestions: [{ key: 'mason', confidence: 0.5, matchedText: 'mistri' }],
      experienceYears: 5,
      perSkillYears: {},
      flags: [],
      normalizedText: 'main painter hoon 5 saal ka experience hai',
    },
  };

  jest.setTimeout(30000);

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest || env.mongoUri);
    }

    // Start local in-test HTTP stub server for voice-service
    await new Promise((resolve) => {
      stubServer = http.createServer((req, res) => {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });

        req.on('end', () => {
          const authKey = req.headers['x-internal-key'];

          if (req.url === '/health') {
            res.writeHead(stubResponses.healthStatus, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stubResponses.healthBody));
            return;
          }

          if (authKey !== env.voiceServiceApiKey) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ detail: 'Invalid or missing X-Internal-Key' }));
            return;
          }

          if (req.url === '/extract') {
            res.writeHead(stubResponses.extractStatus, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stubResponses.extractBody));
            return;
          }

          if (req.url === '/onboard') {
            res.writeHead(stubResponses.onboardStatus, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(stubResponses.onboardBody));
            return;
          }

          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ detail: 'Not found' }));
        });
      });

      stubServer.listen(0, '127.0.0.1', () => {
        stubPort = stubServer.address().port;
        originalBaseUrl = voiceClient.baseUrl;
        voiceClient.baseUrl = `http://127.0.0.1:${stubPort}`;
        resolve();
      });
    });
  }, 30000);

  afterAll(async () => {
    voiceClient.baseUrl = originalBaseUrl;
    if (stubServer) {
      await new Promise((resolve) => stubServer.close(resolve));
    }
  });

  beforeEach(async () => {
    // Reset stub responses and degraded states
    stubResponses.healthStatus = 200;
    stubResponses.extractStatus = 200;
    stubResponses.onboardStatus = 200;
    voiceClient.consecutiveFailures = 0;
    voiceClient.degradedUntil = null;
    voiceClient.healthCache = null;
    voiceClient.healthCacheExpiry = 0;

    await User.deleteMany({ phone: { $regex: /^\+919000/ } });
    await Wallet.deleteMany({});
    await VoiceSession.deleteMany({});

    // Create Test Worker 1
    const worker1 = await User.create({
      name: 'Test Fresh Worker',
      phone: '+919000000009',
      role: 'worker',
      languagePreference: 'hi',
      skills: [],
      experienceYears: 0,
      location: { type: 'Point', coordinates: [0, 0] },
      isActive: true,
    });
    workerId = worker1._id;
    workerToken = jwt.sign(
      { id: worker1._id, role: worker1.role, phone: worker1.phone },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // Create Test Worker 2
    const worker2 = await User.create({
      name: 'Another Worker',
      phone: '+919000000008',
      role: 'worker',
      languagePreference: 'hi',
      skills: ['mason'],
      experienceYears: 3,
      location: { type: 'Point', coordinates: [73.85, 18.52] },
      isActive: true,
    });
    worker2Id = worker2._id;
    worker2Token = jwt.sign(
      { id: worker2._id, role: worker2.role, phone: worker2.phone },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // Create Test Contractor
    const contractor = await User.create({
      name: 'Test Contractor',
      phone: '+919000000100',
      role: 'contractor',
      languagePreference: 'hi',
      isActive: true,
    });
    contractorToken = jwt.sign(
      { id: contractor._id, role: contractor.role, phone: contractor.phone },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    // Create Test Admin
    const admin = await User.create({
      name: 'Test Admin',
      phone: '+919000000900',
      role: 'admin',
      languagePreference: 'hi',
      isActive: true,
    });
    adminToken = jwt.sign(
      { id: admin._id, role: admin.role, phone: admin.phone },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  describe('1. Catalog & Lexicon Parity', () => {
    it('skills.catalog.js covers exactly the SKILLS enum', () => {
      const catalogKeys = Object.keys(SKILLS_MAP).sort();
      const enumKeys = [...SKILLS].sort();
      expect(catalogKeys).toEqual(enumKeys);
      expect(SKILLS_CATALOG.length).toBe(SKILLS.length);
    });

    it('voice-service lexicon covers every SKILLS enum key', () => {
      const lexiconPath = path.resolve('../voice-service/app/data/lexicon.json');
      const raw = fs.readFileSync(lexiconPath, 'utf8');
      const lexicon = JSON.parse(raw);
      const lexiconKeys = Object.keys(lexicon.skills).sort();
      const enumKeys = [...SKILLS].sort();
      expect(lexiconKeys).toEqual(enumKeys);
    });
  });

  describe('2. Endpoint Auth, Role, & Consent Guards', () => {
    it('GET /api/v1/voice/skills should be public', async () => {
      const res = await request(app).get('/api/v1/voice/skills');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(SKILLS.length);
    });

    it('GET /api/v1/voice/config requires auth and returns serverSttAvailable', async () => {
      const unauthRes = await request(app).get('/api/v1/voice/config');
      expect(unauthRes.status).toBe(401);

      const authRes = await request(app)
        .get('/api/v1/voice/config')
        .set('Authorization', `Bearer ${workerToken}`);

      expect(authRes.status).toBe(200);
      expect(authRes.body.data).toHaveProperty('enabled');
      expect(authRes.body.data).toHaveProperty('serverSttAvailable', true);
      expect(authRes.body.data.languages.length).toBe(3);
    });

    it('POST /api/v1/voice/extract requires worker role and consent', async () => {
      // 1. Unauthenticated -> 401
      const unauth = await request(app).post('/api/v1/voice/extract').send({
        transcript: 'main painter hoon',
        consent: true,
      });
      expect(unauth.status).toBe(401);

      // 2. Contractor role -> 403
      const contractorRes = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${contractorToken}`)
        .send({ transcript: 'main painter hoon', consent: true });
      expect(contractorRes.status).toBe(403);

      // 3. Worker without consent -> 400 CONSENT_REQUIRED
      const noConsent = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ transcript: 'main painter hoon', consent: false });
      expect(noConsent.status).toBe(400);
      expect(noConsent.body.error.code).toBe('CONSENT_REQUIRED');
    });
  });

  describe('3. Voice Extraction & Draft Isolation (WebSpeech path)', () => {
    it('creates a session with method WEBSPEECH_TEXT and DOES NOT modify user profile', async () => {
      const res = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          transcript: 'main painter hoon, 5 saal ka experience hai',
          language: 'hi',
          consent: true,
          source: 'webspeech',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data.skills.map((s) => s.key)).toContain('painter');
      // Unknown fake skill from stub should be dropped!
      expect(res.body.data.skills.map((s) => s.key)).not.toContain('unknown_fake_skill');

      // Verify session created in DB
      const session = await VoiceSession.findById(res.body.data.sessionId);
      expect(session).toBeDefined();
      expect(session.method).toBe(VOICE_SESSION_METHOD.WEBSPEECH_TEXT);
      expect(session.status).toBe(VOICE_SESSION_STATUS.EXTRACTED);

      // Verify User is NOT modified
      const user = await User.findById(workerId);
      expect(user.skills).toHaveLength(0);
      expect(user.experienceYears).toBe(0);
    });

    it('rejects transcripts exceeding 500 characters', async () => {
      const longText = 'a'.repeat(501);
      const res = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          transcript: longText,
          consent: true,
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TRANSCRIPT_TOO_LONG');
    });
  });

  describe('4. Server Audio Path (POST /voice/onboard) & Audio Validation', () => {
    it('accepts valid WAV audio buffer and returns draft result without disk files', async () => {
      const wavBuffer = createMinimalWav();

      const tmpBefore = fs.readdirSync(os.tmpdir());

      const res = await request(app)
        .post('/api/v1/voice/onboard')
        .set('Authorization', `Bearer ${workerToken}`)
        .field('consent', 'true')
        .field('language', 'hi')
        .field('durationMs', '2500')
        .attach('audio', wavBuffer, 'test.wav');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('sessionId');
      expect(res.body.data.skills.map((s) => s.key)).toContain('painter');
      expect(res.body.data.skills.map((s) => s.key)).not.toContain('unknown_fake_skill');

      // Check DB session
      const session = await VoiceSession.findById(res.body.data.sessionId);
      expect(session.method).toBe(VOICE_SESSION_METHOD.SERVER_AUDIO);
      expect(session.status).toBe(VOICE_SESSION_STATUS.EXTRACTED);

      // Verify no new temp files leaked to disk
      const tmpAfter = fs.readdirSync(os.tmpdir());
      const newFiles = tmpAfter.filter((f) => !tmpBefore.includes(f) && f.startsWith('workpulse'));
      expect(newFiles.length).toBe(0);
    });

    it('rejects fake audio (text file renamed .webm) with 415 AUDIO_INVALID', async () => {
      const fakeBuffer = Buffer.from('this is plain text and definitely not webm');

      const res = await request(app)
        .post('/api/v1/voice/onboard')
        .set('Authorization', `Bearer ${workerToken}`)
        .field('consent', 'true')
        .attach('audio', fakeBuffer, 'fake.webm');

      expect(res.status).toBe(415);
      expect(res.body.error.code).toBe('AUDIO_INVALID');
    });

    it('rejects oversized audio with 413 AUDIO_TOO_LARGE', async () => {
      const hugeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB > 5MB limit
      // Provide valid WAV header so magic check wouldn't be the failure
      hugeBuffer.write('RIFF', 0);
      hugeBuffer.write('WAVE', 8);

      const res = await request(app)
        .post('/api/v1/voice/onboard')
        .set('Authorization', `Bearer ${workerToken}`)
        .field('consent', 'true')
        .attach('audio', hugeBuffer, 'huge.wav');

      expect(res.status).toBe(413);
      expect(res.body.error.code).toBe('AUDIO_TOO_LARGE');
    });
  });

  describe('5. Voice Service Degraded & Fallback Mode', () => {
    it('returns 503 with fallback "icons" when service is unavailable and enters degraded cooldown after 3 failures', async () => {
      stubResponses.extractStatus = 500;
      stubResponses.extractBody = { detail: 'Internal failure' };

      // Call 1
      const res1 = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ transcript: 'test', consent: true });
      expect(res1.status).toBe(503);
      expect(res1.body.error.code).toBe('VOICE_UNAVAILABLE');
      expect(res1.body.error.fallback).toBe('icons');

      // Call 2
      const res2 = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ transcript: 'test', consent: true });
      expect(res2.status).toBe(503);

      // Call 3
      const res3 = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ transcript: 'test', consent: true });
      expect(res3.status).toBe(503);

      // 4th call should fail immediately via degraded mode without even reaching the stub
      expect(voiceClient.isDegraded()).toBe(true);
      const res4 = await request(app)
        .post('/api/v1/voice/extract')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ transcript: 'test', consent: true });
      expect(res4.status).toBe(503);
      expect(res4.body.error.code).toBe('VOICE_UNAVAILABLE');
      expect(res4.body.error.fallback).toBe('icons');
    });
  });

  describe('6. Confirm Skills & Idempotency', () => {
    let testSessionId;

    beforeEach(async () => {
      const session = await VoiceSession.create({
        user: workerId,
        method: VOICE_SESSION_METHOD.SERVER_AUDIO,
        transcript: 'main painter hoon',
        extractedSkills: [{ key: 'painter', confidence: 0.95 }],
        extractedExperienceYears: 5,
        status: VOICE_SESSION_STATUS.EXTRACTED,
      });
      testSessionId = session._id.toString();
    });

    it('confirms session, saves skills/experience to User, and calculates profileComplete', async () => {
      const res = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['painter'],
          experienceYears: 5,
          method: 'SERVER_AUDIO',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.skills).toEqual(['painter']);
      expect(res.body.data.user.experienceYears).toBe(5);
      // Fresh worker has coordinates [0, 0] so profileComplete is still false until location is set!
      expect(res.body.data.user.profileComplete).toBe(false);

      // Verify User in DB
      const user = await User.findById(workerId);
      expect(user.skills).toEqual(['painter']);
      expect(user.experienceYears).toBe(5);

      // Verify Session in DB
      const session = await VoiceSession.findById(testSessionId);
      expect(session.status).toBe(VOICE_SESSION_STATUS.CONFIRMED);
      expect(session.finalSkills).toEqual(['painter']);
      expect(session.finalExperienceYears).toBe(5);
    });

    it('rejects invalid skill keys and experience > 50', async () => {
      // Invalid skill
      const badSkillRes = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['astronaut_rocket'],
          experienceYears: 5,
        });
      expect(badSkillRes.status).toBe(400);
      expect(badSkillRes.body.error.code).toBe('INVALID_SKILLS');

      // Invalid experienceYears (51)
      const badYearsRes = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['painter'],
          experienceYears: 51,
        });
      expect(badYearsRes.status).toBe(400);
      expect(badYearsRes.body.error.code).toBe('INVALID_EXPERIENCE_YEARS');
    });

    it('cannot confirm another user’s session (404 SESSION_NOT_FOUND)', async () => {
      const res = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({
          sessionId: testSessionId,
          skills: ['painter'],
          experienceYears: 5,
        });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('SESSION_NOT_FOUND');
    });

    it('idempotent confirm: identical payload returns 200, different payload returns 409', async () => {
      // First confirm
      const res1 = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['painter'],
          experienceYears: 5,
        });
      expect(res1.status).toBe(200);

      // Identical re-confirm -> 200
      const res2 = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['painter'],
          experienceYears: 5,
        });
      expect(res2.status).toBe(200);

      // Different payload -> 409 SESSION_ALREADY_CONFIRMED
      const res3 = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          sessionId: testSessionId,
          skills: ['plumber'],
          experienceYears: 2,
        });
      expect(res3.status).toBe(409);
      expect(res3.body.error.code).toBe('SESSION_ALREADY_CONFIRMED');
    });

    it('icon fallback path (no sessionId) creates an ICON_FALLBACK session and saves skills', async () => {
      const res = await request(app)
        .post('/api/v1/voice/confirm')
        .set('Authorization', `Bearer ${workerToken}`)
        .send({
          skills: ['electrician'],
          experienceYears: 4,
          method: 'ICON_FALLBACK',
        });

      expect(res.status).toBe(200);
      expect(res.body.data.user.skills).toEqual(['electrician']);

      const session = await VoiceSession.findById(res.body.data.session._id);
      expect(session.method).toBe(VOICE_SESSION_METHOD.ICON_FALLBACK);
      expect(session.status).toBe(VOICE_SESSION_STATUS.CONFIRMED);
    });

    it('marks session as ABANDONED via /voice/sessions/:id/abandon', async () => {
      const res = await request(app)
        .post(`/api/v1/voice/sessions/${testSessionId}/abandon`)
        .set('Authorization', `Bearer ${workerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(VOICE_SESSION_STATUS.ABANDONED);

      const session = await VoiceSession.findById(testSessionId);
      expect(session.status).toBe(VOICE_SESSION_STATUS.ABANDONED);
    });
  });

  describe('7. Profile Completeness Logic', () => {
    it('profileComplete is false when skills or location are missing, true when both exist', async () => {
      const user = await User.findById(workerId);
      // Case 1: no skills, no location
      let meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(meRes.body.data.profileComplete).toBe(false);

      // Case 2: skills added, location still [0, 0]
      user.skills = ['painter'];
      await user.save();
      meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(meRes.body.data.profileComplete).toBe(false);

      // Case 3: location set, coordinates non-zero
      user.location = { type: 'Point', coordinates: [73.8567, 18.5204] };
      await user.save();
      meRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(meRes.body.data.profileComplete).toBe(true);

      // Case 4: contractor is always true
      const contractorRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${contractorToken}`);
      expect(contractorRes.body.data.profileComplete).toBe(true);
    });
  });

  describe('8. Admin Voice Stats & Accuracy Calculation', () => {
    it('requires admin role and calculates exact precision/recall across confirmed sessions', async () => {
      // Worker trying to access admin stats -> 403
      const workerRes = await request(app)
        .get('/api/v1/admin/voice/stats')
        .set('Authorization', `Bearer ${workerToken}`);
      expect(workerRes.status).toBe(403);

      // Seed 2 confirmed sessions with known sets:
      // Session 1: extracted: ['painter', 'plumber'], final: ['painter']
      // intersection = 1, precision = 1/2 = 0.5, recall = 1/1 = 1.0
      await VoiceSession.create({
        user: workerId,
        method: VOICE_SESSION_METHOD.SERVER_AUDIO,
        sttProvider: 'faster_whisper',
        languageRequested: 'hi',
        extractedSkills: [
          { key: 'painter', confidence: 0.9 },
          { key: 'plumber', confidence: 0.8 },
        ],
        finalSkills: ['painter'],
        status: VOICE_SESSION_STATUS.CONFIRMED,
        latencyMs: 300,
      });

      // Session 2: extracted: ['mason'], final: ['mason', 'helper']
      // intersection = 1, precision = 1/1 = 1.0, recall = 1/2 = 0.5
      await VoiceSession.create({
        user: workerId,
        method: VOICE_SESSION_METHOD.WEBSPEECH_TEXT,
        sttProvider: 'webspeech',
        languageRequested: 'hi',
        extractedSkills: [{ key: 'mason', confidence: 0.95 }],
        finalSkills: ['mason', 'helper'],
        status: VOICE_SESSION_STATUS.CONFIRMED,
        latencyMs: 150,
      });

      // Session 3: Icon fallback (should NOT be included in precision/recall)
      await VoiceSession.create({
        user: workerId,
        method: VOICE_SESSION_METHOD.ICON_FALLBACK,
        finalSkills: ['carpenter'],
        status: VOICE_SESSION_STATUS.CONFIRMED,
      });

      const res = await request(app)
        .get('/api/v1/admin/voice/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const stats = res.body.data;
      expect(stats.totalSessions).toBe(3);
      expect(stats.methods.serverAudio).toBe(1);
      expect(stats.methods.webspeech).toBe(1);
      expect(stats.methods.iconFallback).toBe(1);

      // Precision: (0.5 + 1.0) / 2 = 0.75
      // Recall: (1.0 + 0.5) / 2 = 0.75
      expect(stats.accuracy.evaluatedSessions).toBe(2);
      expect(stats.accuracy.precision).toBeCloseTo(0.75, 2);
      expect(stats.accuracy.recall).toBeCloseTo(0.75, 2);
    });
  });
});
