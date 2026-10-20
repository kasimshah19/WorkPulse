import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import connectDB from '../config/db.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Attendance from '../models/Attendance.js';
import Wallet from '../models/Wallet.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Payout from '../models/Payout.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import { createEscrowForAssignment, fundJob, onCheckIn, onCheckOut, approveAndRelease } from '../services/escrow.service.js';

async function run() {
  await connectDB();
  console.log('\n🚀 Starting Manual Happy Path Walkthrough (PAYMENT_PROVIDER=mock)...\n');

  // 1. Fetch Users
  const contractor = await User.findOne({ phone: '+919000000100' });
  const worker = await User.findOne({ phone: '+919000000001' });
  worker.upiId = 'ramesh@okhdfcbank';
  await worker.save();

  const cWallet = await Wallet.findOne({ user: contractor._id });
  const wWallet = await Wallet.findOne({ user: worker._id });

  console.log(`Contractor: ${contractor.name} (${contractor.phone}) | Initial Balance: ₹${cWallet.balancePaise / 100}`);
  console.log(`Worker: ${worker.name} (${worker.phone}) | Initial Balance: ₹${wWallet.balancePaise / 100}`);

  // Step 1: Contractor Top-up ₹2,000 (200,000 paise) via mock payment
  const paymentId = `walkthrough_pay_${Date.now()}`;
  const topupGroupId = `TOPUP:${paymentId}`;
  await postLedgerGroup({
    groupId: topupGroupId,
    entries: [
      {
        account: 'GATEWAY_EXTERNAL',
        wallet: null,
        entryType: 'DEBIT',
        amountPaise: 200000,
        description: 'Contractor Mock Topup via Razorpay/Mock'
      },
      {
        account: 'CONTRACTOR_WALLET',
        wallet: cWallet._id,
        entryType: 'CREDIT',
        amountPaise: 200000,
        description: 'Topup credited to Contractor Wallet'
      }
    ]
  });
  console.log(`\n✅ Step 1: Contractor topped up ₹2,000 via [${topupGroupId}]`);

  // Step 2: Create a 1-day Job & Assign Worker
  const today = new Date().toISOString().split('T')[0];
  const job = await Job.create({
    contractor: contractor._id,
    title: 'Happy Path Walkthrough Job',
    description: 'Testing full payment cycle',
    skillRequired: 'painter',
    workersNeeded: 1,
    workersAssignedCount: 1,
    wagePerDayPaise: 80000, // ₹800/day
    startDate: new Date(),
    endDate: new Date(),
    location: { type: 'Point', coordinates: [73.8567, 18.5204] },
    geofenceRadiusMeters: 100,
    status: 'OPEN'
  });

  const app = await JobApplication.create({
    job: job._id,
    worker: worker._id,
    status: 'ASSIGNED'
  });

  // Step 3: Create Escrow row (CREATED)
  await createEscrowForAssignment(job, worker);
  const escrowRow = await EscrowTransaction.findOne({ job: job._id, worker: worker._id, dayDate: today });
  console.log(`✅ Step 2 & 3: Job created (${job._id}), Escrow row initialized (status: ${escrowRow.status}, amount: ₹${escrowRow.amountPaise / 100})`);

  // Step 4: Fund Job (Locking ₹800)
  const fundResult = await fundJob(job._id, contractor._id);
  const fundedEscrow = await EscrowTransaction.findById(escrowRow._id);
  console.log(`✅ Step 4: Job funded! Escrow status: ${fundedEscrow.status}, Locked: ₹${fundResult.totalLockedPaise / 100}`);

  // Step 5: Check-in
  const attendance = await Attendance.create({
    job: job._id,
    worker: worker._id,
    date: today,
    checkInAt: new Date(),
    checkInLocation: { type: 'Point', coordinates: [73.8567, 18.5204] },
    checkInDistanceMeters: 5,
    selfieUrl: 'https://storage.workpulse.in/selfies/walkthrough.jpg',
    status: 'CHECKED_IN'
  });
  await onCheckIn(attendance);
  const checkedInEscrow = await EscrowTransaction.findById(escrowRow._id);
  console.log(`✅ Step 5: Worker checked in! Escrow status: ${checkedInEscrow.status}`);

  // Step 6: Check-out
  attendance.checkOutAt = new Date();
  attendance.hoursWorked = 8;
  attendance.status = 'CHECKED_OUT';
  await attendance.save();
  await onCheckOut(attendance);
  const checkedOutEscrow = await EscrowTransaction.findById(escrowRow._id);
  console.log(`✅ Step 6: Worker checked out! Escrow status: ${checkedOutEscrow.status}, AutoApprovalAt: ${checkedOutEscrow.autoApprovalAt.toISOString()}`);

  // Step 7: Contractor Signoff & Release
  attendance.signoffStatus = 'APPROVED';
  attendance.signoffAt = new Date();
  attendance.signoffBy = contractor._id;
  await attendance.save();

  await approveAndRelease(escrowRow._id, contractor._id);
  const releasedEscrow = await EscrowTransaction.findById(escrowRow._id);
  console.log(`✅ Step 7: Contractor approved! Escrow status: ${releasedEscrow.status}, ReleasedAt: ${releasedEscrow.releasedAt.toISOString()}`);

  // Step 8: Simulated UPI Payout
  const payout = await Payout.findOne({ escrowTransaction: escrowRow._id });
  console.log(`✅ Step 8: Simulated UPI payout processed! Status: ${payout?.status}, UTR: ${payout?.providerRef}, Amount: ₹${payout?.amountPaise / 100}`);

  // Fetch all Ledger Entries for this walkthrough
  const relatedGroups = [
    topupGroupId,
    `FUND:${escrowRow._id}`,
    `RELEASE:${escrowRow._id}`,
    payout?.ledgerGroupId || `PAYOUT:${payout?._id}`
  ];

  const entries = await LedgerEntry.find({ groupId: { $in: relatedGroups } }).sort({ createdAt: 1, entryIndex: 1 });

  console.log('\n================================ LEDGER ENTRIES FOR WALKTHROUGH CYCLE ================================');
  console.table(
    entries.map((e) => ({
      groupId: e.groupId,
      idx: e.entryIndex,
      account: e.account,
      type: e.entryType,
      amount: `₹${e.amountPaise / 100}`,
      desc: e.description
    }))
  );
  console.log('=======================================================================================================\n');

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Walkthrough error:', err);
  process.exit(1);
});
