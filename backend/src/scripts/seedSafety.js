import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import {
  createEscrowForAssignment,
  fundJob,
  transition,
  approveAndRelease,
} from '../services/escrow.service.js';
import { runReconciliation } from '../services/reconcile.service.js';
import {
  USER_ROLES,
  KYC_STATUS,
  LEDGER_ACCOUNT,
  ESCROW_STATUS,
  JOB_STATUS,
  ATTENDANCE_STATUS,
  SIGNOFF_STATUS,
} from '../config/constants.js';
import { getISTDateString } from '../utils/time.js';

async function seedSafety() {
  if (env.nodeEnv === 'production') {
    console.error('❌ Cannot run seed script in production!');
    process.exit(1);
  }

  await connectDB();
  console.log('\n🌱 [seedSafety] Seeding Phase 7 Reputation & Safety Environment...');

  // 1. Ensure Admin exists
  const adminPhone = '+919000000900';
  let admin = await User.findOne({ phone: adminPhone });
  if (!admin) {
    admin = await User.create({
      phone: adminPhone,
      role: USER_ROLES.ADMIN,
      name: 'Platform Admin',
      languagePreference: 'hi',
      isActive: true,
      kycStatus: KYC_STATUS.VERIFIED,
    });
  } else {
    admin.role = USER_ROLES.ADMIN;
    await admin.save();
  }
  console.log(`✅ Verified Admin: ${admin.phone}`);

  // 2. Ensure Contractor exists & Wallet has funds
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
  const targetTopupPaise = 2000000; // ₹20,000

  if (contractorWallet.balancePaise < 500000) {
    const topupGroupId = `seed-safety-topup-${contractor._id.toString()}-${Date.now()}`;
    await postLedgerGroup({
      groupId: topupGroupId,
      type: 'TOPUP',
      description: 'Seed initial contractor topup for Phase 7 safety testing',
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
    console.log(`✅ Topped up Contractor wallet with ₹20,000 via double-entry ledger`);
  }

  // 3. Workers W1, W2, W8
  const w1Phone = '+919000000001';
  let w1 = await User.findOne({ phone: w1Phone });
  if (!w1) {
    w1 = await User.create({
      phone: w1Phone,
      role: USER_ROLES.WORKER,
      name: 'Ramesh Kumar',
      skills: ['painter'],
      experienceYears: 5,
      languagePreference: 'hi',
      isActive: true,
      isAvailable: true,
      kycStatus: KYC_STATUS.VERIFIED,
      location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] },
    });
  }
  // Set Emergency Contact on W1
  w1.emergencyContact = {
    name: 'Test Family',
    phone: '+919000000777',
    verifiedNoticeSentAt: new Date(),
  };
  await w1.save();
  await getOrCreateWallet(w1._id);
  console.log(`✅ Updated W1 (${w1.name}) with Emergency Contact: Test Family (+919000000777)`);

  const w2Phone = '+919000000002';
  let w2 = await User.findOne({ phone: w2Phone });
  if (!w2) {
    w2 = await User.create({
      phone: w2Phone,
      role: USER_ROLES.WORKER,
      name: 'Suresh Singh',
      skills: ['mason'],
      experienceYears: 4,
      languagePreference: 'hi',
      isActive: true,
      isAvailable: true,
      kycStatus: KYC_STATUS.VERIFIED,
      location: { type: 'Point', coordinates: [env.seedCenterLng + 0.005, env.seedCenterLat + 0.005] },
    });
  }
  await w2.save();
  await getOrCreateWallet(w2._id);
  console.log(`✅ Verified Coworker W2: ${w2.name} (${w2.phone})`);

  const w8Phone = '+919000000008';
  let w8 = await User.findOne({ phone: w8Phone });
  if (!w8) {
    w8 = await User.create({
      phone: w8Phone,
      role: USER_ROLES.WORKER,
      name: 'Test Worker 8',
      skills: ['electrician'],
      experienceYears: 3,
      languagePreference: 'hi',
      isActive: true,
      isAvailable: true,
      kycStatus: KYC_STATUS.VERIFIED,
      location: { type: 'Point', coordinates: [env.seedCenterLng - 0.005, env.seedCenterLat - 0.005] },
    });
  }
  await w8.save();
  await getOrCreateWallet(w8._id);
  console.log(`✅ Verified W8: ${w8.name} (${w8.phone})`);

  const todayStr = getISTDateString();
  const today = new Date();
  today.setHours(9, 0, 0, 0);

  // -------------------------------------------------------------
  // Scenario A: "Phase7 Rating Job"
  // Full cycle completed: Funded -> Checked In -> Checked Out -> Approved & Released
  // -------------------------------------------------------------
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = getISTDateString(yesterday);

  let ratingJob = await Job.findOne({ title: 'Phase7 Rating Job', contractor: contractor._id });
  if (!ratingJob) {
    ratingJob = await Job.create({
      contractor: contractor._id,
      title: 'Phase7 Rating Job',
      description: 'Completed 1-day painting project for rating verification.',
      skillRequired: 'painter',
      workersNeeded: 2,
      wagePerDayPaise: 80000, // ₹800
      startDate: yesterday,
      endDate: yesterday,
      location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] },
      addressText: 'Phase 7 Site A, Pune',
      status: JOB_STATUS.COMPLETED,
      assignedWorkers: [w1._id, w2._id],
    });

    // Create escrow rows
    await createEscrowForAssignment(ratingJob, w1._id);
    await createEscrowForAssignment(ratingJob, w2._id);

    // Fund Job
    await fundJob(ratingJob._id, contractor._id);

    // Create Checked Out Attendance for W1 and W2
    const attW1 = await Attendance.create({
      job: ratingJob._id,
      worker: w1._id,
      date: yesterdayStr,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
      checkIn: { time: new Date(yesterday.getTime() + 10 * 60 * 1000), location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] } },
      checkOut: { time: new Date(yesterday.getTime() + 8 * 60 * 60 * 1000), location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] } },
      contractorSignoff: { status: SIGNOFF_STATUS.APPROVED, signedOffAt: new Date() },
    });

    const attW2 = await Attendance.create({
      job: ratingJob._id,
      worker: w2._id,
      date: yesterdayStr,
      status: ATTENDANCE_STATUS.CHECKED_OUT,
      checkIn: { time: new Date(yesterday.getTime() + 15 * 60 * 1000), location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] } },
      checkOut: { time: new Date(yesterday.getTime() + 8 * 60 * 60 * 1000), location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] } },
      contractorSignoff: { status: SIGNOFF_STATUS.APPROVED, signedOffAt: new Date() },
    });

    // Move escrow to CHECKED_IN -> CHECKED_OUT and Release
    const escrowW1 = await EscrowTransaction.findOne({ job: ratingJob._id, worker: w1._id });
    if (escrowW1) {
      escrowW1.attendance = attW1._id;
      await escrowW1.save();
      await transition(escrowW1._id, ESCROW_STATUS.CHECKED_IN);
      await transition(escrowW1._id, ESCROW_STATUS.CHECKED_OUT);
      await approveAndRelease(escrowW1._id, contractor._id, 'contractor', 'Seeded release for rating test');
    }

    const escrowW2 = await EscrowTransaction.findOne({ job: ratingJob._id, worker: w2._id });
    if (escrowW2) {
      escrowW2.attendance = attW2._id;
      await escrowW2.save();
      await transition(escrowW2._id, ESCROW_STATUS.CHECKED_IN);
      await transition(escrowW2._id, ESCROW_STATUS.CHECKED_OUT);
      await approveAndRelease(escrowW2._id, contractor._id, 'contractor', 'Seeded release for rating test');
    }
  }

  // -------------------------------------------------------------
  // Scenario B: "Phase7 SOS Job"
  // Job in progress today: W1 is CHECKED_IN, W2 is ASSIGNED (coworker)
  // -------------------------------------------------------------
  let sosJob = await Job.findOne({ title: 'Phase7 SOS Job', contractor: contractor._id });
  if (!sosJob) {
    sosJob = await Job.create({
      contractor: contractor._id,
      title: 'Phase7 SOS Job',
      description: 'Active masonry project today for SOS alerting.',
      skillRequired: 'mason',
      workersNeeded: 2,
      wagePerDayPaise: 90000, // ₹900
      startDate: today,
      endDate: today,
      location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] },
      addressText: 'Phase 7 Site B, Pune',
      status: JOB_STATUS.IN_PROGRESS,
      assignedWorkers: [w1._id, w2._id],
    });

    await createEscrowForAssignment(sosJob, w1._id);
    await createEscrowForAssignment(sosJob, w2._id);
    await fundJob(sosJob._id, contractor._id);

    // W1 is CHECKED_IN today
    const attW1 = await Attendance.create({
      job: sosJob._id,
      worker: w1._id,
      date: todayStr,
      status: ATTENDANCE_STATUS.CHECKED_IN,
      checkIn: { time: new Date(), location: { type: 'Point', coordinates: [env.seedCenterLng, env.seedCenterLat] } },
    });

    const escrowW1 = await EscrowTransaction.findOne({ job: sosJob._id, worker: w1._id });
    if (escrowW1) {
      escrowW1.attendance = attW1._id;
      await escrowW1.save();
      await transition(escrowW1._id, ESCROW_STATUS.CHECKED_IN);
    }
  }

  // 4. Verify Ledger Reconciliation
  console.log('\n🔍 Running Double-Entry Ledger Reconciliation check...');
  const reconcileReport = await runReconciliation();
  console.log(`Reconciliation status: ${reconcileReport.status}`);
  if (!reconcileReport.pass) {
    console.error('❌ RECONCILIATION FAILED AFTER SEEDING!', JSON.stringify(reconcileReport.violations, null, 2));
    process.exit(1);
  }

  // 5. Print Scenario Summary Table
  console.log('\n================================================================================');
  console.log('PHASE 7 SAFETY & REPUTATION SEED COMPLETED SUCCESSFULLY');
  console.log('================================================================================');
  console.log('\nSCENARIO A: TWO-WAY RATINGS');
  console.log(`  Job:                 ${ratingJob.title} (${ratingJob._id})`);
  console.log(`  Contractor:          ${contractor.name} (${contractor.phone})`);
  console.log(`  Worker W1:           ${w1.name} (${w1.phone})`);
  console.log(`  Worker W2:           ${w2.name} (${w2.phone})`);
  console.log(`  Escrow Status:       RELEASED (Eligible for CONTRACTOR_PAYMENT & SAFETY)`);
  console.log(`  Attendance Status:   CHECKED_OUT (Eligible for WORKER_SKILL)`);
  console.log(`  Test URL (Contractor): /contractor/ratings/${ratingJob._id}`);
  console.log(`  Test URL (Worker):     /worker/ratings/${ratingJob._id}`);

  console.log('\nSCENARIO B: EMERGENCY SOS ALERTS');
  console.log(`  Job:                 ${sosJob.title} (${sosJob._id})`);
  console.log(`  Reporter Worker:     ${w1.name} (${w1.phone}) [Status: CHECKED_IN today]`);
  console.log(`  Expected Alert Recipients for SOS from W1:`);
  console.log(`    1. Contractor:         ${contractor.name} (${contractor.phone}) -> Socket & SMS`);
  console.log(`    2. Coworker on Site:   ${w2.name} (${w2.phone}) -> Socket`);
  console.log(`    3. Emergency Contact:  Test Family (+919000000777) -> Mock SMS with Maps link`);
  console.log(`    4. Platform Admin:     ${admin.name} (${admin.phone}) -> Socket role:admin`);
  console.log('================================================================================\n');

  process.exit(0);
}

seedSafety().catch((err) => {
  console.error('Seed safety failed:', err);
  process.exit(1);
});
