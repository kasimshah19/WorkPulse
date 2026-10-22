import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import request from 'supertest';
import app from '../src/app.js';
import env from '../src/config/env.js';
import clock from '../src/utils/clock.js';
import User from '../src/models/User.js';
import Wallet from '../src/models/Wallet.js';
import Job from '../src/models/Job.js';
import JobApplication from '../src/models/JobApplication.js';
import Attendance from '../src/models/Attendance.js';
import EscrowTransaction from '../src/models/EscrowTransaction.js';
import Dispute from '../src/models/Dispute.js';
import LedgerEntry from '../src/models/LedgerEntry.js';
import PaymentOrder from '../src/models/PaymentOrder.js';
import Payout from '../src/models/Payout.js';
import Rating from '../src/models/Rating.js';
import Incident from '../src/models/Incident.js';
import Notification from '../src/models/Notification.js';

import { postLedgerGroup } from '../src/services/ledger.service.js';
import { getOrCreateWallet } from '../src/services/wallet.service.js';
import {
  createEscrowForAssignment,
  fundJob,
  onCheckIn,
  onCheckOut,
  approveAndRelease,
} from '../src/services/escrow.service.js';
import { withdrawToUPI } from '../src/services/payouts/payout.service.js';
import { createRating } from '../src/services/rating.service.js';
import { runEscrowSchedulerOnce } from '../src/services/escrow.scheduler.js';
import { runReconciliation } from '../src/services/reconcile.service.js';
import sessionService from '../src/services/session.service.js';
import { getISTDateString } from '../src/utils/time.js';

import {
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
  ESCROW_STATUS,
  ATTENDANCE_STATUS,
  SIGNOFF_STATUS,
  JOB_STATUS,
  APPLICATION_STATUS,
  PAYMENT_ORDER_STATUS,
  PAYOUT_STATUS,
  RATING_TYPES,
} from '../src/config/constants.js';

describe('Phase 8: Full Micro-Contracting Lifecycle & Deterministic Scheduler Suite', () => {
  jest.setTimeout(60000);

  let contractor, worker, admin;
  let contractorToken, workerToken, adminToken;
  const siteLat = 18.5204;
  const siteLng = 73.8567;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }
  });

  afterAll(async () => {
    clock.reset();
  });

  beforeEach(async () => {
    clock.reset();

    // Clean test collections bypassing mongoose hooks where needed
    await Promise.all([
      User.deleteMany({ phone: { $regex: /^\+919988/ } }),
      Job.deleteMany({ title: { $regex: /^LifecycleJob/ } }),
      JobApplication.deleteMany({}),
      EscrowTransaction.deleteMany({}),
      Attendance.deleteMany({}),
      Dispute.deleteMany({}),
      PaymentOrder.deleteMany({}),
      Payout.deleteMany({}),
      Rating.deleteMany({}),
      Notification.deleteMany({}),
    ]);

    // Clean wallets and ledger collections directly
    if (Wallet.collection) await Wallet.collection.deleteMany({});
    if (LedgerEntry.collection) await LedgerEntry.collection.deleteMany({});

    // 1. Setup Test Users
    contractor = await User.create({
      phone: '+919988000001',
      role: 'contractor',
      name: 'Ramesh Contractor',
      isActive: true,
      kycStatus: 'simulated_verified',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
    });

    worker = await User.create({
      phone: '+919988000002',
      role: 'worker',
      name: 'Suresh Electrician',
      skills: ['electrician'],
      isActive: true,
      kycStatus: 'simulated_verified',
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
      upiId: 'suresh@okhdfcbank',
      payoutDetails: { upiId: 'suresh@okhdfcbank', accountHolderName: 'Suresh' },
    });

    admin = await User.create({
      phone: '+919988000099',
      role: 'admin',
      name: 'System Admin',
      isActive: true,
      kycStatus: 'simulated_verified',
    });

    contractorToken = sessionService.issueAccessToken(contractor, 'test-sess-c1', 'test-fam-c1');
    workerToken = sessionService.issueAccessToken(worker, 'test-sess-w1', 'test-fam-w1');
    adminToken = sessionService.issueAccessToken(admin, 'test-sess-a1', 'test-fam-a1');
  });

  test('Complete End-to-End Micro-Contracting Lifecycle: Onboard -> Topup -> Job -> Match -> Escrow -> Clock -> Approve -> Payout -> Ratings -> Invariant Audit', async () => {
    const today = getISTDateString(clock.now());

    // ----------------------------------------------------
    // STEP 1: Contractor Wallet Top-up (₹5,000 / 500,000 paise)
    // ----------------------------------------------------
    const contractorWallet = await getOrCreateWallet(contractor._id);
    const workerWallet = await getOrCreateWallet(worker._id);

    const topupAmountPaise = 500000;
    await postLedgerGroup({
      groupId: `TOPUP:LC_${Date.now()}`,
      entries: [
        {
          account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
          wallet: null,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amountPaise: topupAmountPaise,
          description: 'Gateway clearing for simulated topup',
          referenceType: 'GATEWAY_TOPUP',
          referenceId: 'MOCK_LC_PAYMENT_1',
        },
        {
          account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
          wallet: contractorWallet._id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: topupAmountPaise,
          description: 'Contractor wallet credit topup',
          referenceType: 'GATEWAY_TOPUP',
          referenceId: 'MOCK_LC_PAYMENT_1',
        },
      ],
    });

    const refreshedCWallet = await Wallet.findById(contractorWallet._id);
    expect(refreshedCWallet.balancePaise).toBe(500000);
    expect(refreshedCWallet.lockedPaise).toBe(0);

    // ----------------------------------------------------
    // STEP 2: Job Creation
    // ----------------------------------------------------
    const wagePerDayPaise = 80000; // ₹800
    const job = await Job.create({
      title: 'LifecycleJob 1 - Electrician Wiring',
      description: 'Commercial wiring work in Pune',
      contractor: contractor._id,
      skillRequired: 'electrician',
      wagePerDayPaise,
      workersNeeded: 1,
      startDate: clock.now(),
      endDate: clock.now(),
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
      addressText: 'MG Road, Pune',
      status: JOB_STATUS.OPEN,
    });

    expect(job.status).toBe(JOB_STATUS.OPEN);

    // ----------------------------------------------------
    // STEP 3: Worker Application & Contractor Acceptance
    // ----------------------------------------------------
    const application = await JobApplication.create({
      job: job._id,
      worker: worker._id,
      status: APPLICATION_STATUS.ASSIGNED,
      respondedAt: clock.now(),
    });

    await Job.findByIdAndUpdate(job._id, {
      $addToSet: { assignedWorkers: worker._id },
      $inc: { workersAssignedCount: 1 },
    });

    // ----------------------------------------------------
    // STEP 4: Escrow Funding
    // ----------------------------------------------------
    await createEscrowForAssignment(job, worker._id);
    const fundResult = await fundJob(job._id, contractor._id);
    expect(fundResult.fundedCount).toBeGreaterThan(0);

    const escrow = await EscrowTransaction.findOne({ job: job._id, worker: worker._id });
    expect(escrow).toBeTruthy();
    expect(escrow.status).toBe(ESCROW_STATUS.FUNDED);
    expect(escrow.amountPaise).toBe(wagePerDayPaise);

    const postFundWallet = await Wallet.findById(contractorWallet._id);
    expect(postFundWallet.balancePaise).toBe(topupAmountPaise - escrow.amountPaise);
    expect(postFundWallet.lockedPaise).toBe(escrow.amountPaise);

    // ----------------------------------------------------
    // STEP 5: Worker Check-In (Clock In)
    // ----------------------------------------------------
    const att = await Attendance.create({
      job: job._id,
      worker: worker._id,
      date: escrow.dayDate,
      status: ATTENDANCE_STATUS.CHECKED_IN,
      checkInAt: clock.now(),
      checkInLocation: { type: 'Point', coordinates: [siteLng, siteLat] },
      checkInDistanceMeters: 15,
      checkInAccuracyM: 5,
      selfieUrl: 'https://cdn.workpulse.in/selfie-worker-lc.jpg',
    });

    await onCheckIn(att);
    const postCheckInEscrow = await EscrowTransaction.findById(escrow._id);
    expect(postCheckInEscrow.status).toBe(ESCROW_STATUS.CHECKED_IN);

    // ----------------------------------------------------
    // STEP 6: Worker Check-Out (Clock Out)
    // ----------------------------------------------------
    att.status = ATTENDANCE_STATUS.CHECKED_OUT;
    att.checkOutAt = new Date(clock.now().getTime() + 8 * 3600000);
    att.hoursWorked = 8;
    att.contractorSignoff = { status: SIGNOFF_STATUS.PENDING };
    await att.save();

    await onCheckOut(att);
    const postCheckOutEscrow = await EscrowTransaction.findById(escrow._id);
    expect(postCheckOutEscrow.status).toBe(ESCROW_STATUS.CHECKED_OUT);
    expect(postCheckOutEscrow.autoApprovalAt).toBeTruthy();

    // ----------------------------------------------------
    // STEP 7: Contractor Sign-Off & Escrow Release
    // ----------------------------------------------------
    const releaseRes = await approveAndRelease(escrow._id, contractor._id, 'contractor', 'Excellent electrical work');
    expect(releaseRes.escrow.status).toBe(ESCROW_STATUS.RELEASED);
    expect(releaseRes.escrow.releasedAt).toBeTruthy();

    const postReleaseWorkerWallet = await Wallet.findById(workerWallet._id);
    expect(postReleaseWorkerWallet.balancePaise).toBe(wagePerDayPaise);

    const postReleaseContractorWallet = await Wallet.findById(contractorWallet._id);
    expect(postReleaseContractorWallet.lockedPaise).toBe(0);

    // ----------------------------------------------------
    // STEP 8: Worker UPI Withdrawal / Payout
    // ----------------------------------------------------
    const withdrawAmountPaise = 50000; // ₹500
    const withdrawRes = await withdrawToUPI({
      workerId: worker._id,
      amountPaise: withdrawAmountPaise,
      idempotencyKey: `WITHDRAW:LC_${Date.now()}`,
    });

    expect(withdrawRes.status).toBe(PAYOUT_STATUS.SUCCESS);
    const postWithdrawWorkerWallet = await Wallet.findById(workerWallet._id);
    expect(postWithdrawWorkerWallet.balancePaise).toBe(wagePerDayPaise - withdrawAmountPaise);

    // ----------------------------------------------------
    // STEP 9: Double-Blind Ratings & Reputation Reveal
    // ----------------------------------------------------
    // Worker rates contractor: revealedAt should be null (hidden)
    const workerRatingRes = await createRating(worker._id, {
      jobId: job._id.toString(),
      toUserId: contractor._id.toString(),
      type: RATING_TYPES.CONTRACTOR_PAYMENT,
      score: 5,
      comment: 'Contractor was supportive and paid on time.',
    });

    expect(workerRatingRes.isRevealed).toBe(false);
    expect(workerRatingRes.rating.revealedAt).toBeNull();

    // Contractor checks received ratings: Worker rating must NOT be revealed
    const contractorPreReveal = await Rating.find({ toUser: contractor._id, revealedAt: { $ne: null } });
    expect(contractorPreReveal.length).toBe(0);

    // Contractor rates worker: Both ratings must reveal
    const contractorRatingRes = await createRating(contractor._id, {
      jobId: job._id.toString(),
      toUserId: worker._id.toString(),
      type: RATING_TYPES.WORKER_SKILL,
      score: 5,
      comment: 'Great worker, very skilled electrician.',
    });

    expect(contractorRatingRes.isRevealed).toBe(true);

    const refreshedWorkerRating = await Rating.findById(workerRatingRes.rating._id);
    expect(refreshedWorkerRating.revealedAt).not.toBeNull();

    // Check user reputation stats updated
    const updatedWorker = await User.findById(worker._id);
    expect(updatedWorker.ratingSummary.workerSkillAvg).toBe(5);
    expect(updatedWorker.ratingSummary.workerSkillCount).toBe(1);

    const updatedContractor = await User.findById(contractor._id);
    expect(updatedContractor.ratingSummary.contractorPaymentAvg).toBe(5);
    expect(updatedContractor.ratingSummary.contractorPaymentCount).toBe(1);

    // ----------------------------------------------------
    // STEP 10: Reconciliation Verification
    // ----------------------------------------------------
    const reconReport = await runReconciliation();
    expect(reconReport.pass).toBe(true);
    expect(reconReport.violations.length).toBe(0);
    expect(reconReport.checks.globalConservation.pass).toBe(true);
    expect(reconReport.checks.globalConservation.details.diff).toBe(0);
  });

  test('Scheduler Tests with Mocked Clock: Auto-Approves Shift After 24h & Expires Stale Topups', async () => {
    const contractorWallet = await getOrCreateWallet(contractor._id);
    const workerWallet = await getOrCreateWallet(worker._id);

    // Topup contractor
    await postLedgerGroup({
      groupId: `TOPUP:SCHED_${Date.now()}`,
      entries: [
        {
          account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
          wallet: null,
          entryType: LEDGER_ENTRY_TYPE.DEBIT,
          amountPaise: 200000,
          description: 'Topup for scheduler test',
          referenceType: 'GATEWAY_TOPUP',
          referenceId: 'MOCK_SCHED_1',
        },
        {
          account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
          wallet: contractorWallet._id,
          entryType: LEDGER_ENTRY_TYPE.CREDIT,
          amountPaise: 200000,
          description: 'Topup credit',
          referenceType: 'GATEWAY_TOPUP',
          referenceId: 'MOCK_SCHED_1',
        },
      ],
    });

    const job = await Job.create({
      title: 'LifecycleJob 2 - Scheduler Test',
      contractor: contractor._id,
      skillRequired: 'electrician',
      wagePerDayPaise: 60000,
      workersNeeded: 1,
      startDate: clock.now(),
      endDate: clock.now(),
      location: { type: 'Point', coordinates: [siteLng, siteLat] },
      addressText: 'Shivajinagar, Pune',
      status: JOB_STATUS.OPEN,
    });

    await JobApplication.create({
      job: job._id,
      worker: worker._id,
      status: APPLICATION_STATUS.ASSIGNED,
      respondedAt: clock.now(),
    });

    await createEscrowForAssignment(job, worker._id);
    await fundJob(job._id, contractor._id);

    const escrow = await EscrowTransaction.findOne({ job: job._id, worker: worker._id });
    expect(escrow.status).toBe(ESCROW_STATUS.FUNDED);

    // Fast-forward worker attendance
    const att = await Attendance.create({
      job: job._id,
      worker: worker._id,
      date: escrow.dayDate,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
      checkInAt: clock.now(),
      checkOutAt: new Date(clock.now().getTime() + 8 * 3600000),
      hoursWorked: 8,
      contractorSignoff: { status: SIGNOFF_STATUS.PENDING },
      checkInLocation: { type: 'Point', coordinates: [siteLng, siteLat] },
      selfieUrl: 'https://cdn.workpulse.in/selfie.jpg',
    });

    await onCheckIn(att);
    await onCheckOut(att);

    const checkedOutEscrow = await EscrowTransaction.findById(escrow._id);
    expect(checkedOutEscrow.status).toBe(ESCROW_STATUS.CHECKED_OUT);
    expect(checkedOutEscrow.autoApprovalAt).toBeTruthy();

    // Create a pending PaymentOrder to verify expiry
    const staleOrder = await PaymentOrder.create({
      orderId: 'order_test_stale_123',
      providerOrderId: 'order_test_stale_123',
      user: contractor._id,
      amountPaise: 100000,
      currency: 'INR',
      status: PAYMENT_ORDER_STATUS.CREATED,
      createdAt: clock.now(),
    });

    // Advance clock by 25 hours
    const futureTime = new Date(clock.now().getTime() + 25 * 3600 * 1000);
    clock.setMockTime(futureTime);

    // Execute scheduler once
    const schedulerResult = await runEscrowSchedulerOnce();
    expect(schedulerResult.autoApprovedCount).toBeGreaterThanOrEqual(1);
    expect(schedulerResult.expiredTopupsCount).toBeGreaterThanOrEqual(1);

    // Escrow must now be RELEASED
    const autoApprovedEscrow = await EscrowTransaction.findById(escrow._id);
    expect(autoApprovedEscrow.status).toBe(ESCROW_STATUS.RELEASED);

    // Stale order must now be EXPIRED
    const refreshedOrder = await PaymentOrder.findById(staleOrder._id);
    expect(refreshedOrder.status).toBe(PAYMENT_ORDER_STATUS.EXPIRED);

    // Reset clock back
    clock.reset();

    // Final reconciliation audit
    const report = await runReconciliation();
    expect(report.pass).toBe(true);
    expect(report.violations.length).toBe(0);
  });

  test('Timezone Invariance: Date Calculations Remain Invariant Across Timezones', () => {
    // Test date calculation across UTC midnight and IST midnight
    const utcMidnight = new Date('2026-10-22T00:00:00.000Z');
    const istDate = getISTDateString(utcMidnight);
    // UTC 00:00 is 05:30 IST on the same day
    expect(istDate).toBe('2026-10-22');

    const utcLateNight = new Date('2026-10-22T23:30:00.000Z');
    const istNextDay = getISTDateString(utcLateNight);
    // UTC 23:30 is 05:00 IST on 2026-10-23
    expect(istNextDay).toBe('2026-10-23');
  });
});
