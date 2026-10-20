import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Attendance from '../models/Attendance.js';
import { destinationPoint } from '../utils/geo.js';
import { getISTDateString } from '../utils/time.js';
import { generateAttendanceCode } from '../services/attendance.service.js';
import { JOB_STATUS, APPLICATION_STATUS, LEDGER_ACCOUNT } from '../config/constants.js';
import env from '../config/env.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import { createEscrowForAssignment, fundJob } from '../services/escrow.service.js';
import EscrowTransaction from '../models/EscrowTransaction.js';

const CENTER_LAT = env.seedCenterLat || 18.5204;
const CENTER_LNG = env.seedCenterLng || 73.8567;

async function seedAttendance() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Cannot run seed script in production!');
    process.exit(1);
  }

  await connectDB();
  console.log('\n🌱 Seeding Phase 4 Attendance Environment...');

  // 1. Ensure Contractor exists
  let contractor = await User.findOne({ phone: '+919000000100' });
  if (!contractor) {
    contractor = await User.create({
      phone: '+919000000100',
      role: 'contractor',
      name: 'Test Contractor',
      languagePreference: 'hi',
      location: { type: 'Point', coordinates: [CENTER_LNG, CENTER_LAT] },
    });
  }

  // 2. Ensure Workers W1, W2, W8 exist
  const workerPhones = ['+919000000001', '+919000000002', '+919000000008'];
  const workers = {};
  for (const phone of workerPhones) {
    let w = await User.findOne({ phone });
    if (!w) {
      w = await User.create({
        phone,
        role: 'worker',
        name: phone === '+919000000001' ? 'Ramesh Painter' : phone === '+919000000002' ? 'Suresh Painter' : 'Mukesh Painter',
        skills: ['painter'],
        isAvailable: true,
        languagePreference: 'hi',
        location: { type: 'Point', coordinates: [CENTER_LNG, CENTER_LAT] },
      });
    }
    workers[phone] = w;
  }

  const todayStr = getISTDateString();
  const today = new Date();
  const twoDaysLater = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

  // 3. Create Job 1: "Phase4 Test Job" (Selfie Required, 100m geofence)
  await Job.deleteMany({ title: { $in: ['Phase4 Test Job', 'Phase4 QR Test Job'] } });

  const job1 = await Job.create({
    contractor: contractor._id,
    title: 'Phase4 Test Job',
    description: 'Phase 4 Geofence and Selfie Proof-of-Work Verification Job',
    skillRequired: 'painter',
    workersNeeded: 2,
    workersAssignedCount: 2,
    wagePerDayPaise: 80000,
    startDate: today,
    endDate: twoDaysLater,
    totalDays: 3,
    workingHours: { start: '00:00', end: '23:59' }, // Works anytime
    location: { type: 'Point', coordinates: [CENTER_LNG, CENTER_LAT] },
    addressText: 'Pune City Center Work Site',
    geofenceRadiusMeters: 100,
    matchRadiusKm: 5,
    status: JOB_STATUS.FILLED,
    requiresSelfie: true,
  });

  // Assign W1 and W2 to Job 1
  await JobApplication.deleteMany({ job: job1._id });
  await JobApplication.create([
    {
      job: job1._id,
      worker: workers['+919000000001']._id,
      status: APPLICATION_STATUS.ASSIGNED,
    },
    {
      job: job1._id,
      worker: workers['+919000000002']._id,
      status: APPLICATION_STATUS.ASSIGNED,
    },
  ]);

  // 4. Create Job 2: "Phase4 QR Test Job" (Selfie False, QR Code verification)
  const job2 = await Job.create({
    contractor: contractor._id,
    title: 'Phase4 QR Test Job',
    description: 'Phase 4 Daily QR / Attendance Code Verification Job',
    skillRequired: 'painter',
    workersNeeded: 1,
    workersAssignedCount: 1,
    wagePerDayPaise: 75000,
    startDate: today,
    endDate: twoDaysLater,
    totalDays: 3,
    workingHours: { start: '00:00', end: '23:59' },
    location: { type: 'Point', coordinates: [CENTER_LNG, CENTER_LAT] },
    addressText: 'Pune City Center QR Site',
    geofenceRadiusMeters: 100,
    matchRadiusKm: 5,
    status: JOB_STATUS.FILLED,
    requiresSelfie: false,
  });

  await JobApplication.deleteMany({ job: job2._id });
  await JobApplication.create({
    job: job2._id,
    worker: workers['+919000000008']._id,
    status: APPLICATION_STATUS.ASSIGNED,
  });

  // Clean test attendances and escrows for these jobs
  await Attendance.deleteMany({ job: { $in: [job1._id, job2._id] } });
  await EscrowTransaction.deleteMany({ job: { $in: [job1._id, job2._id] } });

  // Ensure contractor wallet has sufficient funds
  await getOrCreateWallet(contractor._id);
  try {
    await postLedgerGroup({
      groupId: `seed-attendance-contractor-topup-${Date.now()}`,
      type: 'TOPUP',
      description: 'Seed Attendance Contractor Topup',
      legs: [
        { account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL, amountPaise: -5000000, currency: 'INR' },
        { account: LEDGER_ACCOUNT.CONTRACTOR_WALLET, userId: contractor._id, amountPaise: 5000000, currency: 'INR' },
      ],
      metadata: { seeded: true },
    });
  } catch (err) {
    // Ignore if topup already done
  }

  // Create & Fund Escrows for Job 1
  for (const phone of ['+919000000001', '+919000000002']) {
    await createEscrowForAssignment({
      jobId: job1._id,
      workerId: workers[phone]._id,
      contractorId: contractor._id,
      wagePerDayPaise: job1.wagePerDayPaise,
      startDate: job1.startDate,
      endDate: job1.endDate,
    });
  }
  await fundJob(job1._id, contractor._id);

  // Create & Fund Escrows for Job 2
  await createEscrowForAssignment({
    jobId: job2._id,
    workerId: workers['+919000000008']._id,
    contractorId: contractor._id,
    wagePerDayPaise: job2.wagePerDayPaise,
    startDate: job2.startDate,
    endDate: job2.endDate,
  });
  await fundJob(job2._id, contractor._id);
  console.log('✅ Created and funded escrows for Job 1 and Job 2.');

  // 5. Compute test coordinate points relative to the site
  const insidePt = destinationPoint(CENTER_LAT, CENTER_LNG, 0.05, 0); // 50m North
  const edgePt = destinationPoint(CENTER_LAT, CENTER_LNG, 0.095, 90); // 95m East
  const justOutsidePt = destinationPoint(CENTER_LAT, CENTER_LNG, 0.13, 180); // 130m South
  const farOutsidePt = destinationPoint(CENTER_LAT, CENTER_LNG, 0.3, 270); // 300m West

  // Retrieve attendanceCode
  const loadedJob1 = await Job.findById(job1._id).select('+attendanceCodeSecret');
  const codeInfo1 = generateAttendanceCode(loadedJob1.attendanceCodeSecret, todayStr, job1._id);

  console.log('\n============================= PHASE 4 TEST COORDINATES =============================');
  console.table([
    {
      Label: 'INSIDE',
      Relative: '50 m North (0°)',
      Lat: insidePt.latitude.toFixed(6),
      Lng: insidePt.longitude.toFixed(6),
      Expected: '✅ 201 ACCEPTED (within 100m geofence)',
    },
    {
      Label: 'EDGE',
      Relative: '95 m East (90°)',
      Lat: edgePt.latitude.toFixed(6),
      Lng: edgePt.longitude.toFixed(6),
      Expected: '✅ 201 ACCEPTED (within 100m geofence)',
    },
    {
      Label: 'JUST OUTSIDE',
      Relative: '130 m South (180°)',
      Lat: justOutsidePt.latitude.toFixed(6),
      Lng: justOutsidePt.longitude.toFixed(6),
      Expected: '❌ 422 OUTSIDE_GEOFENCE (Exceeds 100m)',
    },
    {
      Label: 'FAR OUTSIDE',
      Relative: '300 m West (270°)',
      Lat: farOutsidePt.latitude.toFixed(6),
      Lng: farOutsidePt.longitude.toFixed(6),
      Expected: '❌ 422 OUTSIDE_GEOFENCE (Exceeds 100m)',
    },
  ]);
  console.log('=====================================================================================');
  console.log(`📌 Primary Job ID (Selfie): ${job1._id}`);
  console.log(`📌 Assigned Workers: W1 (+919000000001) & W2 (+919000000002)`);
  console.log(`📌 Daily 6-Digit Code for Today (${todayStr}): ${codeInfo1.code}`);
  console.log(`📌 Secondary Job ID (QR): ${job2._id} (Assigned to W8)`);
  console.log('✅ Phase 4 Seed Complete.\n');

  process.exit(0);
}

seedAttendance().catch((err) => {
  console.error('Seed attendance failed:', err);
  process.exit(1);
});
