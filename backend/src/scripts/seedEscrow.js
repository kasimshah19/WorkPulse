import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Dispute from '../models/Dispute.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import {
  createEscrowForAssignment,
  fundJob,
  transition,
} from '../services/escrow.service.js';
import { runReconciliation } from '../services/reconcile.service.js';
import {
  USER_ROLES,
  KYC_STATUS,
  LEDGER_ACCOUNT,
  ESCROW_STATUS,
  APPLICATION_STATUS,
  JOB_STATUS,
  DISPUTE_STATUS,
  DISPUTE_OPENED_FROM,
} from '../config/constants.js';
import { getISTDateString } from '../utils/time.js';

async function seedEscrow() {
  if (env.nodeEnv === 'production') {
    console.error('❌ Cannot run seed script in production!');
    process.exit(1);
  }

  await connectDB();
  console.log('\n🌱 [seedEscrow] Seeding Phase 5 Escrow & Payments Environment...');

  // 1. Ensure Admin exists
  const adminPhone = '+919000000900';
  let admin = await User.findOne({ phone: adminPhone });
  if (!admin) {
    admin = await User.create({
      phone: adminPhone,
      role: USER_ROLES.ADMIN,
      name: 'WorkPulse Admin',
      languagePreference: 'hi',
      isActive: true,
      kycStatus: KYC_STATUS.VERIFIED,
    });
    console.log(`✅ Created Admin user: ${adminPhone}`);
  } else {
    admin.role = USER_ROLES.ADMIN;
    await admin.save();
    console.log(`ℹ️ Admin user verified: ${adminPhone}`);
  }

  // 2. Ensure Contractor exists & Wallet has ₹10,000 topped up via ledger
  const contractorPhone = '+919000000100';
  let contractor = await User.findOne({ phone: contractorPhone });
  if (!contractor) {
    contractor = await User.create({
      phone: contractorPhone,
      role: USER_ROLES.CONTRACTOR,
      name: 'Test Contractor',
      languagePreference: 'hi',
      isActive: true,
      kycStatus: KYC_STATUS.VERIFIED,
      location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] },
    });
  }

  const contractorWallet = await getOrCreateWallet(contractor._id);
  const targetTopupPaise = 1000000; // ₹10,000

  // Post topup via double-entry if not already seeded
  const topupGroupId = `seed-contractor-topup-${contractor._id.toString()}`;
  try {
    await postLedgerGroup({
      groupId: topupGroupId,
      type: 'TOPUP',
      description: 'Seed initial contractor topup (₹10,000)',
      legs: [
        {
          account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
          amountPaise: -targetTopupPaise,
          currency: 'INR',
        },
        {
          account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
          userId: contractor._id,
          amountPaise: targetTopupPaise,
          currency: 'INR',
        },
      ],
      metadata: { seeded: true },
    });
    console.log(`✅ Topped up Contractor wallet with ₹10,000 via double-entry ledger (${topupGroupId})`);
  } catch (err) {
    console.log(`ℹ️ Topup ledger group already exists or processed: ${err.message}`);
  }

  // 3. Ensure Workers W1 and W2 have UPI IDs
  const w1 = await User.findOne({ phone: '+919000000001' });
  if (w1) {
    w1.upiId = 'ramesh@okhdfcbank';
    await w1.save();
    await getOrCreateWallet(w1._id);
    console.log('✅ Updated W1 UPI ID: ramesh@okhdfcbank');
  }

  const w2 = await User.findOne({ phone: '+919000000002' });
  if (w2) {
    w2.upiId = 'suresh@oksbi';
    await w2.save();
    await getOrCreateWallet(w2._id);
    console.log('✅ Updated W2 UPI ID: suresh@oksbi');
  }

  // 4. Create/fund Escrow rows for Phase 4 jobs if present
  const jobs = await Job.find({ contractor: contractor._id });
  for (const job of jobs) {
    const apps = await JobApplication.find({
      job: job._id,
      status: { $in: [APPLICATION_STATUS.ASSIGNED, APPLICATION_STATUS.ACCEPTED] },
    });
    for (const app of apps) {
      await createEscrowForAssignment({
        jobId: job._id,
        workerId: app.worker,
        contractorId: contractor._id,
        wagePerDayPaise: job.wagePerDayPaise,
        startDate: job.startDate,
        endDate: job.endDate,
      });
    }

    // Fund the job if there are CREATED escrows
    const createdCount = await EscrowTransaction.countDocuments({
      job: job._id,
      status: ESCROW_STATUS.CREATED,
    });
    if (createdCount > 0) {
      try {
        await fundJob(job._id, contractor._id);
        console.log(`✅ Funded job ${job.title} (${job._id}) - ${createdCount} escrow rows funded.`);
      } catch (err) {
        console.log(`⚠️ Funding job ${job._id} note: ${err.message}`);
      }
    }
  }

  // 5. Seed a dedicated Dispute Demo Job so Admin & Parties have active dispute to test
  let disputeJob = await Job.findOne({ title: 'Dispute & Arbitration Test Job' });
  const todayStr = getISTDateString();
  const today = new Date();
  if (!disputeJob && w1) {
    disputeJob = await Job.create({
      contractor: contractor._id,
      title: 'Dispute & Arbitration Test Job',
      description: 'Job for demonstrating admin dispute arbitration and split payouts',
      skillRequired: 'painter',
      workersNeeded: 1,
      workersAssignedCount: 1,
      wagePerDayPaise: 80000,
      startDate: today,
      endDate: today,
      totalDays: 1,
      workingHours: { start: '09:00', end: '18:00' },
      location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] },
      addressText: 'Demo Arbitration Site, Pune',
      geofenceRadiusMeters: 100,
      matchRadiusKm: 5,
      status: JOB_STATUS.FILLED,
      requiresSelfie: false,
    });

    await JobApplication.create({
      job: disputeJob._id,
      worker: w1._id,
      status: APPLICATION_STATUS.ASSIGNED,
    });

    await createEscrowForAssignment({
      jobId: disputeJob._id,
      workerId: w1._id,
      contractorId: contractor._id,
      wagePerDayPaise: disputeJob.wagePerDayPaise,
      startDate: disputeJob.startDate,
      endDate: disputeJob.endDate,
    });

    await fundJob(disputeJob._id, contractor._id);

    // Transition this escrow row through HELD -> DISPUTED
    const escrow = await EscrowTransaction.findOne({
      job: disputeJob._id,
      worker: w1._id,
      workDate: todayStr,
    });

    if (escrow && escrow.status === ESCROW_STATUS.FUNDED) {
      await transition(escrow, ESCROW_STATUS.HELD, { reason: 'Check-in simulated' });
      await transition(escrow, ESCROW_STATUS.DISPUTED, { reason: 'Contractor contested work quality' });

      // Create matching Dispute doc
      await Dispute.create({
        escrowTransaction: escrow._id,
        job: disputeJob._id,
        worker: w1._id,
        contractor: contractor._id,
        openedBy: contractor._id,
        openedFrom: DISPUTE_OPENED_FROM.CONTRACTOR_SIGNOFF,
        reason: 'Work was partially incomplete. Wall painting was left unfinished on west side.',
        evidenceUrls: [],
        status: DISPUTE_STATUS.OPEN,
        amountPaise: escrow.amountPaise,
      });

      console.log(`✅ Created Open Dispute Demo on Escrow ${escrow._id}`);
    }
  }

  // 6. Run Reconciliation
  console.log('\n📊 Running Financial Ledger Reconciliation...');
  const recon = await runReconciliation();
  console.log(`Status: ${recon.status}`);
  console.log(`Summary:`, recon.summary);
  if (recon.violations.length > 0) {
    console.error('❌ Reconciliation Violations:', recon.violations);
  } else {
    console.log('✅ ALL 5 INVARIANTS PASS PERFECTLY (A, B, C, D, E)');
  }

  console.log('\n🎉 Escrow Seed Completed Successfully!\n');
  await mongoose.disconnect();
}

seedEscrow().catch((err) => {
  console.error('❌ Escrow seed failed:', err);
  process.exit(1);
});
