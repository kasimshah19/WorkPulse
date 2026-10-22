import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Attendance from '../models/Attendance.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import Dispute from '../models/Dispute.js';
import PaymentOrder from '../models/PaymentOrder.js';
import Payout from '../models/Payout.js';
import Rating from '../models/Rating.js';
import Incident from '../models/Incident.js';
import Notification from '../models/Notification.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import { createRating } from '../services/rating.service.js';
import { runReconciliation } from '../services/reconcile.service.js';
import { getISTDateString } from '../utils/time.js';
import {
  USER_ROLES,
  KYC_STATUS,
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
  JOB_STATUS,
  APPLICATION_STATUS,
  ESCROW_STATUS,
  ATTENDANCE_STATUS,
  SIGNOFF_STATUS,
  DISPUTE_STATUS,
  DISPUTE_REASON,
  RATING_TYPES,
  INCIDENT_TYPES,
  INCIDENT_SEVERITY,
  INCIDENT_STATUS,
} from '../config/constants.js';

const isReset = process.argv.includes('--reset');

async function seedDemo() {
  if (env.nodeEnv === 'production') {
    console.error('❌ SEED ABORTED: Cannot run seed script in production!');
    process.exit(1);
  }

  await connectDB();
  console.log('\n🌟 WorkPulse Full Demo Environment Setup Starting...');

  if (isReset) {
    console.log('🧹 Wiping old demo collections...');
    await Promise.all([
      User.deleteMany({ phone: /^(\+919000000)/ }),
      Job.deleteMany({ title: /^Demo/ }),
      JobApplication.deleteMany({}),
      Attendance.deleteMany({}),
      EscrowTransaction.deleteMany({}),
      Dispute.deleteMany({}),
      PaymentOrder.deleteMany({}),
      Payout.deleteMany({}),
      Rating.deleteMany({}),
      Notification.deleteMany({}),
      Incident.deleteMany({ isTest: true }),
    ]);

    if (Wallet.collection) await Wallet.collection.deleteMany({});
    if (LedgerEntry.collection) await LedgerEntry.collection.deleteMany({});
    console.log('✨ Data wiped cleanly.');
  }

  const centerLat = 18.5204; // Pune
  const centerLng = 73.8567;
  const today = getISTDateString(new Date());

  // 1. Admin
  const admin = await User.findOneAndUpdate(
    { phone: '+919000000900' },
    {
      name: 'WorkPulse Platform Admin',
      phone: '+919000000900',
      role: USER_ROLES.ADMIN,
      isActive: true,
      kycStatus: KYC_STATUS.VERIFIED,
      languagePreference: 'hi',
    },
    { upsert: true, new: true }
  );
  console.log(`✅ Admin ready: ${admin.phone}`);

  // 2. 5 Contractors with realistic funded wallets
  const contractorSpecs = [
    { name: 'Sharma Electricals (Ramesh Sharma)', phone: '+919000000101', trade: 'Electrical' },
    { name: 'Verma Construction (Anil Verma)', phone: '+919000000102', trade: 'Civil' },
    { name: 'Patel Paints & Decor (Bhavin Patel)', phone: '+919000000103', trade: 'Painting' },
    { name: 'Deshmukh Plumbing Works (Sanjay Deshmukh)', phone: '+919000000104', trade: 'Plumbing' },
    { name: 'Khan Infrastructure (Irfan Khan)', phone: '+919000000105', trade: 'General' },
  ];

  const contractors = [];
  for (const spec of contractorSpecs) {
    const c = await User.findOneAndUpdate(
      { phone: spec.phone },
      {
        name: spec.name,
        phone: spec.phone,
        role: USER_ROLES.CONTRACTOR,
        isActive: true,
        kycStatus: KYC_STATUS.VERIFIED,
        languagePreference: 'hi',
        location: { type: 'Point', coordinates: [centerLng, centerLat] },
      },
      { upsert: true, new: true }
    );

    const wallet = await getOrCreateWallet(c._id);
    if (wallet.balancePaise === 0 && wallet.lockedPaise === 0) {
      await postLedgerGroup({
        groupId: `DEMO_TOPUP:${c._id}`,
        entries: [
          {
            account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
            wallet: null,
            entryType: LEDGER_ENTRY_TYPE.DEBIT,
            amountPaise: 5000000, // ₹50,000
            description: `Initial demo balance for ${spec.name}`,
            referenceType: 'GATEWAY_TOPUP',
            referenceId: `DEMO_PAY_${c._id}`,
          },
          {
            account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
            wallet: wallet._id,
            entryType: LEDGER_ENTRY_TYPE.CREDIT,
            amountPaise: 5000000,
            description: `Demo wallet credit for ${spec.name}`,
            referenceType: 'GATEWAY_TOPUP',
            referenceId: `DEMO_PAY_${c._id}`,
          },
        ],
      });
    }

    contractors.push(c);
  }
  console.log(`✅ ${contractors.length} Contractors ready.`);

  // 3. 15 Workers with diverse blue-collar skills
  const workerSpecs = [
    { name: 'Suresh Electrician', skill: 'electrician', phone: '+919000000001', upi: 'suresh@okhdfcbank' },
    { name: 'Mahesh Wireman', skill: 'electrician', phone: '+919000000002', upi: 'mahesh@oksbi' },
    { name: 'Bablu Rajmistri', skill: 'mason', phone: '+919000000003', upi: 'bablu@okaxis' },
    { name: 'Chhotu Mason', skill: 'mason', phone: '+919000000004', upi: 'chhotu@paytm' },
    { name: 'Raju Painter', skill: 'painter', phone: '+919000000005', upi: 'raju@okhdfcbank' },
    { name: 'Deepak Painter', skill: 'painter', phone: '+919000000006', upi: 'deepak@oksbi' },
    { name: 'Sunil Plumber', skill: 'plumber', phone: '+919000000007', upi: 'sunil@ybl' },
    { name: 'Santosh Plumber', skill: 'plumber', phone: '+919000000008', upi: 'santosh@paytm' },
    { name: 'Pappu Carpenter', skill: 'carpenter', phone: '+919000000009', upi: 'pappu@oksbi' },
    { name: 'Vicky Carpenter', skill: 'carpenter', phone: '+919000000010', upi: 'vicky@okhdfcbank' },
    { name: 'Kalu Welder', skill: 'welder', phone: '+919000000011', upi: 'kalu@paytm' },
    { name: 'Manoj Welder', skill: 'welder', phone: '+919000000012', upi: 'manoj@okaxis' },
    { name: 'Shiva Tile Worker', skill: 'tile_worker', phone: '+919000000013', upi: 'shiva@ybl' },
    { name: 'Ramphal Laborer', skill: 'laborer', phone: '+919000000014', upi: 'ramphal@oksbi' },
    { name: 'Kishan Helper', skill: 'helper', phone: '+919000000015', upi: 'kishan@paytm' },
  ];

  const workers = [];
  for (const spec of workerSpecs) {
    const w = await User.findOneAndUpdate(
      { phone: spec.phone },
      {
        name: spec.name,
        phone: spec.phone,
        role: USER_ROLES.WORKER,
        skills: [spec.skill],
        isActive: true,
        kycStatus: KYC_STATUS.VERIFIED,
        languagePreference: 'hi',
        upiId: spec.upi,
        payoutDetails: { upiId: spec.upi, accountHolderName: spec.name },
        location: { type: 'Point', coordinates: [centerLng + 0.005, centerLat + 0.005] },
      },
      { upsert: true, new: true }
    );
    await getOrCreateWallet(w._id);
    workers.push(w);
  }
  console.log(`✅ ${workers.length} Workers ready.`);

  // 4. Create Demo Jobs Across Lifecycle Stages

  // JOB 1: OPEN - Electrician required, ready to match
  const job1 = await Job.create({
    title: 'Demo Job 1: Industrial Wiring (Open for Applications)',
    description: 'Main control panel and warehouse wiring at Hinjewadi Phase 1',
    contractor: contractors[0]._id,
    skillRequired: 'electrician',
    wagePerDayPaise: 85000, // ₹850
    workersNeeded: 2,
    startDate: new Date(),
    endDate: new Date(Date.now() + 86400000 * 3),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Hinjewadi Phase 1, Pune',
    status: JOB_STATUS.OPEN,
  });

  // JOB 2: ASSIGNED & FUNDED - Mason assigned, escrow funded, ready to clock-in
  const job2 = await Job.create({
    title: 'Demo Job 2: Brick Wall Construction (Funded & Ready)',
    description: 'Boundary wall construction and plastering work at Baner',
    contractor: contractors[1]._id,
    skillRequired: 'mason',
    wagePerDayPaise: 90000, // ₹900
    workersNeeded: 1,
    assignedWorkers: [workers[2]._id],
    workersAssignedCount: 1,
    startDate: new Date(),
    endDate: new Date(),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Baner Road, Pune',
    status: JOB_STATUS.IN_PROGRESS,
  });

  await JobApplication.create({
    job: job2._id,
    worker: workers[2]._id,
    status: APPLICATION_STATUS.ASSIGNED,
    respondedAt: new Date(),
  });

  // Escrow for Job 2
  const cWallet2 = await getOrCreateWallet(contractors[1]._id);
  const escrow2 = await EscrowTransaction.create({
    job: job2._id,
    contractor: contractors[1]._id,
    worker: workers[2]._id,
    dayDate: today,
    amountPaise: 90000,
    platformFeePaise: 0,
    status: ESCROW_STATUS.FUNDED,
    idempotencyKey: `DEMO_ESCROW_JOB2:${job2._id}:${workers[2]._id}:${today}`,
  });

  await postLedgerGroup({
    groupId: `FUND:${escrow2._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: cWallet2._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 90000,
        description: 'Escrow hold lock for Demo Job 2',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow2._id.toString(),
        transaction: escrow2._id,
      },
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet2._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 90000,
        description: 'Escrow hold balance locked for Demo Job 2',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow2._id.toString(),
        transaction: escrow2._id,
      },
    ],
  });

  // JOB 3: IN_PROGRESS - Painter checked-in with selfie, shift ongoing
  const job3 = await Job.create({
    title: 'Demo Job 3: Interior Wall Painting (Shift In-Progress)',
    description: '3BHK apartment emulsion paint finishing at Kothrud',
    contractor: contractors[2]._id,
    skillRequired: 'painter',
    wagePerDayPaise: 75000, // ₹750
    workersNeeded: 1,
    assignedWorkers: [workers[4]._id],
    workersAssignedCount: 1,
    startDate: new Date(),
    endDate: new Date(),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Kothrud, Pune',
    status: JOB_STATUS.IN_PROGRESS,
  });

  const cWallet3 = await getOrCreateWallet(contractors[2]._id);
  const escrow3 = await EscrowTransaction.create({
    job: job3._id,
    contractor: contractors[2]._id,
    worker: workers[4]._id,
    dayDate: today,
    amountPaise: 75000,
    platformFeePaise: 0,
    status: ESCROW_STATUS.CHECKED_IN,
    idempotencyKey: `DEMO_ESCROW_JOB3:${job3._id}:${workers[4]._id}:${today}`,
  });

  const att3 = await Attendance.create({
    job: job3._id,
    worker: workers[4]._id,
    date: today,
    status: ATTENDANCE_STATUS.CHECKED_IN,
    checkInAt: new Date(Date.now() - 4 * 3600000), // Checked in 4 hours ago
    checkInLocation: { type: 'Point', coordinates: [centerLng, centerLat] },
    checkInDistanceMeters: 12,
    checkInAccuracyM: 5,
    selfieUrl: 'https://cdn.workpulse.in/selfie_painter_demo.jpg',
  });
  escrow3.attendance = att3._id;
  await escrow3.save();

  await postLedgerGroup({
    groupId: `FUND:${escrow3._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: cWallet3._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 75000,
        description: 'Escrow hold lock for Demo Job 3',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow3._id.toString(),
        transaction: escrow3._id,
      },
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet3._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 75000,
        description: 'Escrow hold balance locked for Demo Job 3',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow3._id.toString(),
        transaction: escrow3._id,
      },
    ],
  });

  // JOB 4: CHECKED_OUT - Plumber completed shift, pending contractor sign-off approval
  const job4 = await Job.create({
    title: 'Demo Job 4: Pipeline Leakage Repair (Checked Out, Awaiting Approval)',
    description: 'Bathroom fittings and mainline leakage fixing at Viman Nagar',
    contractor: contractors[3]._id,
    skillRequired: 'plumber',
    wagePerDayPaise: 80000, // ₹800
    workersNeeded: 1,
    assignedWorkers: [workers[6]._id],
    workersAssignedCount: 1,
    startDate: new Date(),
    endDate: new Date(),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Viman Nagar, Pune',
    status: JOB_STATUS.IN_PROGRESS,
  });

  const cWallet4 = await getOrCreateWallet(contractors[3]._id);
  const escrow4 = await EscrowTransaction.create({
    job: job4._id,
    contractor: contractors[3]._id,
    worker: workers[6]._id,
    dayDate: today,
    amountPaise: 80000,
    platformFeePaise: 0,
    status: ESCROW_STATUS.CHECKED_OUT,
    autoApprovalAt: new Date(Date.now() + 18 * 3600000), // 18h window left
    idempotencyKey: `DEMO_ESCROW_JOB4:${job4._id}:${workers[6]._id}:${today}`,
  });

  const att4 = await Attendance.create({
    job: job4._id,
    worker: workers[6]._id,
    date: today,
    status: ATTENDANCE_STATUS.CHECKED_OUT,
    checkInAt: new Date(Date.now() - 9 * 3600000),
    checkOutAt: new Date(Date.now() - 1 * 3600000),
    hoursWorked: 8,
    contractorSignoff: { status: SIGNOFF_STATUS.PENDING },
    checkInLocation: { type: 'Point', coordinates: [centerLng, centerLat] },
    selfieUrl: 'https://cdn.workpulse.in/selfie_plumber_demo.jpg',
  });
  escrow4.attendance = att4._id;
  await escrow4.save();

  await postLedgerGroup({
    groupId: `FUND:${escrow4._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: cWallet4._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 80000,
        description: 'Escrow hold lock for Demo Job 4',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow4._id.toString(),
        transaction: escrow4._id,
      },
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet4._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 80000,
        description: 'Escrow hold balance locked for Demo Job 4',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow4._id.toString(),
        transaction: escrow4._id,
      },
    ],
  });

  // JOB 5: COMPLETED & RELEASED - Ratings published
  const job5 = await Job.create({
    title: 'Demo Job 5: Modular Kitchen Carpentry (Completed & Released)',
    description: 'Plywood cutting, laminate pasting and cabinet hinges at Wakad',
    contractor: contractors[4]._id,
    skillRequired: 'carpenter',
    wagePerDayPaise: 95000, // ₹950
    workersNeeded: 1,
    assignedWorkers: [workers[8]._id],
    workersAssignedCount: 1,
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() - 86400000),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Wakad, Pune',
    status: JOB_STATUS.COMPLETED,
  });

  const cWallet5 = await getOrCreateWallet(contractors[4]._id);
  const wWallet5 = await getOrCreateWallet(workers[8]._id);

  const escrow5 = await EscrowTransaction.create({
    job: job5._id,
    contractor: contractors[4]._id,
    worker: workers[8]._id,
    dayDate: getISTDateString(new Date(Date.now() - 86400000)),
    amountPaise: 95000,
    platformFeePaise: 0,
    status: ESCROW_STATUS.RELEASED,
    releasedAt: new Date(Date.now() - 3600000),
    idempotencyKey: `DEMO_ESCROW_JOB5:${job5._id}:${workers[8]._id}`,
  });

  const att5 = await Attendance.create({
    job: job5._id,
    worker: workers[8]._id,
    date: getISTDateString(new Date(Date.now() - 86400000)),
    status: ATTENDANCE_STATUS.CHECKED_OUT,
    checkInAt: new Date(Date.now() - 90000000),
    checkOutAt: new Date(Date.now() - 60000000),
    hoursWorked: 8,
    contractorSignoff: {
      status: SIGNOFF_STATUS.APPROVED,
      approvedAt: new Date(Date.now() - 59000000),
    },
    checkInLocation: { type: 'Point', coordinates: [centerLng, centerLat] },
    selfieUrl: 'https://cdn.workpulse.in/selfie_carpenter_demo.jpg',
  });
  escrow5.attendance = att5._id;
  await escrow5.save();

  // Post FUND and RELEASE ledger groups for Job 5
  await postLedgerGroup({
    groupId: `FUND:${escrow5._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: cWallet5._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 95000,
        description: 'Escrow hold lock for Demo Job 5',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow5._id.toString(),
        transaction: escrow5._id,
      },
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet5._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 95000,
        description: 'Escrow hold balance locked for Demo Job 5',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow5._id.toString(),
        transaction: escrow5._id,
      },
    ],
  });

  await postLedgerGroup({
    groupId: `RELEASE:${escrow5._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet5._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 95000,
        description: 'Escrow hold release for Demo Job 5',
        referenceType: 'ESCROW_RELEASE',
        referenceId: escrow5._id.toString(),
        transaction: escrow5._id,
      },
      {
        account: LEDGER_ACCOUNT.WORKER_WALLET,
        wallet: wWallet5._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 95000,
        description: 'Payment released to worker for Demo Job 5',
        referenceType: 'ESCROW_RELEASE',
        referenceId: escrow5._id.toString(),
        transaction: escrow5._id,
      },
    ],
  });

  // Submit two-way ratings for Job 5
  await createRating(workers[8]._id, {
    jobId: job5._id.toString(),
    toUserId: contractors[4]._id.toString(),
    type: RATING_TYPES.CONTRACTOR_PAYMENT,
    score: 5,
    comment: 'Paisa samay par release kiya, badhiya thekedar!',
  });

  await createRating(contractors[4]._id, {
    jobId: job5._id.toString(),
    toUserId: workers[8]._id.toString(),
    type: RATING_TYPES.WORKER_SKILL,
    score: 5,
    comment: 'Kam bahut safai se kiya, finish badhiya thi.',
  });

  // JOB 6: DISPUTED - Wage mismatch dispute open for Admin arbitration
  const job6 = await Job.create({
    title: 'Demo Job 6: Warehouse Fabrication (Open Dispute for Demo)',
    description: 'Structural MS pipe welding and cutting at Bhosari MIDC',
    contractor: contractors[0]._id,
    skillRequired: 'welder',
    wagePerDayPaise: 80000,
    workersNeeded: 1,
    assignedWorkers: [workers[10]._id],
    workersAssignedCount: 1,
    startDate: new Date(Date.now() - 86400000),
    endDate: new Date(Date.now() - 86400000),
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    addressText: 'Bhosari MIDC, Pune',
    status: JOB_STATUS.IN_PROGRESS,
  });

  const cWallet6 = await getOrCreateWallet(contractors[0]._id);
  const escrow6 = await EscrowTransaction.create({
    job: job6._id,
    contractor: contractors[0]._id,
    worker: workers[10]._id,
    dayDate: getISTDateString(new Date(Date.now() - 86400000)),
    amountPaise: 80000,
    platformFeePaise: 0,
    status: ESCROW_STATUS.DISPUTED,
    idempotencyKey: `DEMO_ESCROW_JOB6:${job6._id}:${workers[10]._id}`,
  });

  await postLedgerGroup({
    groupId: `FUND:${escrow6._id}`,
    entries: [
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: cWallet6._id,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: 80000,
        description: 'Escrow hold lock for Demo Job 6',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow6._id.toString(),
        transaction: escrow6._id,
      },
      {
        account: LEDGER_ACCOUNT.ESCROW_HOLD,
        wallet: cWallet6._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: 80000,
        description: 'Escrow hold balance locked for Demo Job 6',
        referenceType: 'ESCROW_FUND',
        referenceId: escrow6._id.toString(),
        transaction: escrow6._id,
      },
    ],
  });

  await Dispute.create({
    escrowTransaction: escrow6._id,
    job: job6._id,
    raisedBy: workers[10]._id,
    against: contractors[0]._id,
    reason: DISPUTE_REASON.WAGE_MISMATCH,
    description: 'Contractor asked to work 2 hours overtime without agreeing to extra wage.',
    status: DISPUTE_STATUS.OPEN,
  });

  // 5. Active SOS Incident for Live Safety Alert Demo
  await Incident.create({
    type: INCIDENT_TYPES.SOS,
    reportedBy: workers[0]._id,
    job: job1._id,
    severity: INCIDENT_SEVERITY.HIGH,
    status: INCIDENT_STATUS.OPEN,
    location: { type: 'Point', coordinates: [centerLng, centerLat] },
    description: 'Worker reported scaffolding instability on site.',
    isTest: true,
  });
  console.log('✅ Active demo SOS incident created.');

  // 6. Verify Ledger Reconciliation
  console.log('🔍 Running final ledger reconciliation verification...');
  const report = await runReconciliation();
  if (!report.pass) {
    console.error('❌ RECONCILIATION VIOLATION IN SEED:', JSON.stringify(report.violations, null, 2));
    process.exit(1);
  }

  console.log(`\n🎉 WORKPULSE DEMO SEED COMPLETED SUCCESSFULLY!`);
  console.log(`  Contractors: 5 | Workers: 15 | Jobs: 6 | Escrows: 5 | Disputes: 1 | SOS: 1`);
  console.log(`  Reconciliation: ✅ PASS (diff = 0)`);
  process.exit(0);
}

seedDemo().catch((err) => {
  console.error('Fatal seed demo error:', err);
  process.exit(1);
});
