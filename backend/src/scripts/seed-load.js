import mongoose from 'mongoose';
import env from '../config/env.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import Wallet from '../models/Wallet.js';
import { SKILLS, JOB_STATUS, ESCROW_STATUS, LEDGER_ACCOUNT, LEDGER_ENTRY_TYPE } from '../config/constants.js';

const BATCH_SIZE = 1000;

function getRandomLocation(centerLng = 77.5946, centerLat = 12.9716, radiusDegrees = 0.15) {
  const u = Math.random();
  const v = Math.random();
  const w = radiusDegrees * Math.sqrt(u);
  const t = 2 * Math.PI * v;
  const x = w * Math.cos(t);
  const y = w * Math.sin(t);
  return [Number((centerLng + x).toFixed(6)), Number((centerLat + y).toFixed(6))];
}

async function bulkInsert(Model, docs, label) {
  const startTime = Date.now();
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    await Model.insertMany(chunk, { ordered: false });
    inserted += chunk.length;
    process.stdout.write(`\r  ${label}: ${inserted}/${docs.length} inserted...`);
  }
  const dur = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\r  ✅ ${label}: ${inserted} inserted in ${dur}s.`);
}

export async function seedLoadData({ reset = false, dbName = 'workpulse_load' } = {}) {
  console.log(`\n🚀 Starting WorkPulse Load Test Data Generator (Target DB: ${dbName})...`);

  // Target database
  let targetUri = env.mongoUri;
  if (targetUri.includes('/workpulse')) {
    targetUri = targetUri.replace(/\/workpulse(\?|$)/, `/${dbName}$1`);
  } else if (targetUri.includes('/workpulse_test')) {
    targetUri = targetUri.replace(/\/workpulse_test(\?|$)/, `/${dbName}$1`);
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  await mongoose.connect(targetUri);
  console.log(`  Connected to MongoDB: ${mongoose.connection.name}`);

  // Auto-build indexes on connected DB
  console.log('  Ensuring database indexes are synced...');
  await Promise.all([
    User.syncIndexes(),
    Job.syncIndexes(),
    EscrowTransaction.syncIndexes(),
    LedgerEntry.syncIndexes(),
    Wallet.syncIndexes(),
  ]);

  if (reset) {
    console.log('  Resetting existing load collections...');
    await Promise.all([
      User.deleteMany({}),
      Job.deleteMany({}),
      EscrowTransaction.deleteMany({}),
      LedgerEntry.deleteMany({}),
      Wallet.deleteMany({}),
    ]);
  }

  const existingCount = await User.countDocuments();
  if (existingCount >= 5000 && !reset) {
    console.log(`  ⚠️ Database already contains ${existingCount} users. Pass --reset to re-seed.`);
    await mongoose.disconnect();
    return;
  }

  const overallStart = Date.now();

  // 1. Generate 5,000 Users (4,500 workers + 500 contractors)
  console.log('\n[1/4] Generating 5,000 Users...');
  const userDocs = [];
  const walletDocs = [];
  const workerIds = [];
  const contractorIds = [];

  for (let i = 1; i <= 5000; i++) {
    const isContractor = i > 4500;
    const role = isContractor ? 'contractor' : 'worker';
    const userId = new mongoose.Types.ObjectId();
    const phone = `+9198${String(i).padStart(8, '0')}`;
    const skill = SKILLS[i % SKILLS.length];

    if (isContractor) {
      contractorIds.push(userId);
    } else {
      workerIds.push(userId);
    }

    userDocs.push({
      _id: userId,
      phone,
      name: isContractor ? `Contractor Load ${i - 4500}` : `Worker Load ${i}`,
      role,
      skills: isContractor ? [] : [skill],
      location: {
        type: 'Point',
        coordinates: getRandomLocation(),
      },
      isActive: true,
      kycStatus: 'simulated_verified',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    walletDocs.push({
      user: userId,
      balancePaise: isContractor ? 5000000 : 50000,
      lockedPaise: 0,
      currency: 'INR',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  await bulkInsert(User, userDocs, 'Users (4500 Workers, 500 Contractors)');
  await bulkInsert(Wallet, walletDocs, 'Wallets');

  // 2. Generate 2,000 Jobs
  console.log('\n[2/4] Generating 2,000 Jobs...');
  const jobDocs = [];
  const jobIds = [];
  const jobStatuses = [JOB_STATUS.OPEN, JOB_STATUS.FILLED, JOB_STATUS.IN_PROGRESS, JOB_STATUS.COMPLETED];

  const now = new Date();
  for (let i = 1; i <= 2000; i++) {
    const jobId = new mongoose.Types.ObjectId();
    jobIds.push(jobId);
    const contractorId = contractorIds[i % contractorIds.length];
    const skill = SKILLS[i % SKILLS.length];
    const status = jobStatuses[i % jobStatuses.length];

    jobDocs.push({
      _id: jobId,
      contractor: contractorId,
      title: `Construction Project Load #${i}`,
      description: `Civil structural & masonry development site #${i}`,
      skillRequired: skill,
      wagePerDayPaise: 50000,
      workersNeeded: 2,
      workersAssignedCount: status === JOB_STATUS.OPEN ? 0 : 2,
      startDate: new Date(now.getTime() - 86400000 * 5),
      endDate: new Date(now.getTime() + 86400000 * 5),
      totalDays: 10,
      workingHours: { start: '09:00', end: '18:00' },
      location: {
        type: 'Point',
        coordinates: getRandomLocation(),
      },
      addressText: `Site Sector ${i}, Urban Corridor`,
      geofenceRadiusMeters: 150,
      matchRadiusKm: 10,
      status,
      createdAt: now,
      updatedAt: now,
    });
  }

  await bulkInsert(Job, jobDocs, 'Jobs (2000 multi-status)');

  // 3. Generate 20,000 Escrow rows
  console.log('\n[3/4] Generating 20,000 Escrow Rows...');
  const escrowDocs = [];
  const escrowStatuses = [
    ESCROW_STATUS.FUNDED,
    ESCROW_STATUS.CHECKED_IN,
    ESCROW_STATUS.CHECKED_OUT,
    ESCROW_STATUS.APPROVED,
    ESCROW_STATUS.RELEASED,
  ];

  for (let i = 1; i <= 20000; i++) {
    const jobIdx = i % jobDocs.length;
    const workerIdx = i % workerIds.length;
    const contractorId = jobDocs[jobIdx].contractor;
    const workerId = workerIds[workerIdx];
    const status = escrowStatuses[i % escrowStatuses.length];

    const dayOffset = (i % 10) - 5;
    const dayDate = new Date(now.getTime() + dayOffset * 86400000).toISOString().slice(0, 10);
    const idempotencyKey = `ESCROW_LOAD:${jobDocs[jobIdx]._id}:${workerId}:${dayDate}:${i}`;

    escrowDocs.push({
      _id: new mongoose.Types.ObjectId(),
      job: jobDocs[jobIdx]._id,
      contractor: contractorId,
      worker: workerId,
      dayDate,
      amountPaise: 50000,
      platformFeePaise: 0,
      status,
      idempotencyKey,
      autoApprovalAt: status === ESCROW_STATUS.CHECKED_OUT ? new Date(now.getTime() + 3600000 * 12) : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await bulkInsert(EscrowTransaction, escrowDocs, 'Escrow Transactions (20,000)');

  // 4. Generate 50,000 Ledger Entries (25,000 Balanced Pairs)
  console.log('\n[4/4] Generating 50,000 Double-Entry Ledger Entries (25,000 pairs)...');
  const ledgerDocs = [];

  for (let i = 1; i <= 25000; i++) {
    const groupId = `LOAD_GROUP:${i}`;
    const amountPaise = 50000;
    const contractorWallet = walletDocs[4500 + (i % 500)];
    const workerWallet = walletDocs[i % 4500];

    // Debit entry
    ledgerDocs.push({
      account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
      wallet: contractorWallet._id,
      entryType: LEDGER_ENTRY_TYPE.DEBIT,
      amountPaise,
      description: `Load simulation transfer debit #${i}`,
      referenceType: 'ESCROW_FUNDING',
      referenceId: groupId,
      groupId,
      entryIndex: 0,
      createdAt: now,
    });

    // Credit entry
    ledgerDocs.push({
      account: LEDGER_ACCOUNT.WORKER_WALLET,
      wallet: workerWallet._id,
      entryType: LEDGER_ENTRY_TYPE.CREDIT,
      amountPaise,
      description: `Load simulation transfer credit #${i}`,
      referenceType: 'ESCROW_RELEASE',
      referenceId: groupId,
      groupId,
      entryIndex: 1,
      createdAt: now,
    });
  }

  await bulkInsert(LedgerEntry, ledgerDocs, 'Ledger Entries (50,000 append-only)');

  const totalTime = ((Date.now() - overallStart) / 1000).toFixed(2);
  console.log(`\n🎉 Seed Load Complete! Generated 5k users, 2k jobs, 20k escrows, 50k ledger entries in ${totalTime}s.`);
  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('seed-load.js')) {
  const reset = process.argv.includes('--reset');
  seedLoadData({ reset }).catch((err) => {
    console.error('❌ seed-load failed:', err);
    process.exit(1);
  });
}
