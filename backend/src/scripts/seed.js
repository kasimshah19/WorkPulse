import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import Notification from '../models/Notification.js';
import Otp from '../models/Otp.js';
import LedgerEntry from '../models/LedgerEntry.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import { LEDGER_ACCOUNT } from '../config/constants.js';
import { destinationPoint, haversineDistance } from '../utils/geo.js';
import { ensureGeoIndexes } from '../services/matching.service.js';

const isReset = process.argv.includes('--reset');

const runSeed = async () => {
  if (env.nodeEnv === 'production') {
    console.error('❌ SEED ABORTED: Cannot run seed script in production environment!');
    process.exit(1);
  }

  await connectDB();
  await ensureGeoIndexes();

  const centerLat = env.seedCenterLat;
  const centerLng = env.seedCenterLng;

  console.log(`\n🌱 WorkPulse Seed Script Starting... (Center: [Lat: ${centerLat}, Lng: ${centerLng}])`);

  if (isReset) {
    console.log('🧹 Wiping existing seed data (users, jobs, applications, notifications, otps, wallets, ledger)...');
    await User.deleteMany({});
    await Wallet.deleteMany({});
    await Job.deleteMany({});
    await JobApplication.deleteMany({});
    await Notification.deleteMany({});
    await Otp.deleteMany({});
    if (LedgerEntry.collection) {
      await LedgerEntry.collection.deleteMany({});
    }
    console.log('✨ Data wiped cleanly.');
  }

  // 1. Create or Update Contractor (+919000000100)
  const contractorPhone = '+919000000100';
  let contractor = await User.findOne({ phone: contractorPhone });
  if (!contractor) {
    contractor = await User.create({
      name: 'Test Contractor',
      phone: contractorPhone,
      role: 'contractor',
      languagePreference: 'hi',
      location: {
        type: 'Point',
        coordinates: [centerLng, centerLat],
      },
      address: 'Central Square, Pune',
      isActive: true,
      kycStatus: 'simulated_verified',
    });

    const cWallet = await Wallet.create({
      user: contractor._id,
      balancePaise: 0,
      lockedPaise: 0,
      currency: 'INR',
      status: 'active',
    });

    await postLedgerGroup({
      groupId: `seed-initial-topup-${contractor._id.toString()}`,
      type: 'TOPUP',
      description: 'Initial seed contractor wallet topup',
      legs: [
        { account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL, amountPaise: -5000000 },
        { account: LEDGER_ACCOUNT.CONTRACTOR_WALLET, userId: contractor._id, amountPaise: 5000000 },
      ],
    });
  }

  // 1b. Create or Update Admin (+919000000900)
  const adminPhone = '+919000000900';
  let admin = await User.findOne({ phone: adminPhone });
  if (!admin) {
    admin = await User.create({
      name: 'WorkPulse Admin',
      phone: adminPhone,
      role: 'admin',
      languagePreference: 'hi',
      isActive: true,
      kycStatus: 'simulated_verified',
    });
    console.log('✅ Created Admin user: +919000000900');
  }

  // 2. Define the 8 Seed Workers
  const workerSpecs = [
    {
      code: 'W1',
      name: 'Ramesh Painter',
      phone: '+919000000001',
      skill: 'painter',
      distKm: 1.0,
      bearing: 0, // North
      direction: 'North',
      isAvailable: true,
    },
    {
      code: 'W2',
      name: 'Suresh Painter',
      phone: '+919000000002',
      skill: 'painter',
      distKm: 3.0,
      bearing: 90, // East
      direction: 'East',
      isAvailable: true,
    },
    {
      code: 'W3',
      name: 'Dinesh Painter',
      phone: '+919000000003',
      skill: 'painter',
      distKm: 4.5,
      bearing: 180, // South
      direction: 'South',
      isAvailable: true,
    },
    {
      code: 'W4',
      name: 'Mahesh Painter (Out of Range)',
      phone: '+919000000004',
      skill: 'painter',
      distKm: 6.0,
      bearing: 270, // West
      direction: 'West (OUTSIDE)',
      isAvailable: true,
    },
    {
      code: 'W5',
      name: 'Ganesh Painter (Far Away)',
      phone: '+919000000005',
      skill: 'painter',
      distKm: 12.0,
      bearing: 0, // North
      direction: 'North (OUTSIDE)',
      isAvailable: true,
    },
    {
      code: 'W6',
      name: 'Vijay Plumber (Wrong Skill)',
      phone: '+919000000006',
      skill: 'plumber',
      distKm: 2.0,
      bearing: 90, // East
      direction: 'East (WRONG SKILL)',
      isAvailable: true,
    },
    {
      code: 'W7',
      name: 'Ajay Painter (Unavailable)',
      phone: '+919000000007',
      skill: 'painter',
      distKm: 2.0,
      bearing: 270, // West
      direction: 'West (UNAVAILABLE)',
      isAvailable: false,
    },
    {
      code: 'W8',
      name: 'Mukesh Painter',
      phone: '+919000000008',
      skill: 'painter',
      distKm: 2.5,
      bearing: 45, // North-East
      direction: 'North-East',
      isAvailable: true,
    },
  ];

  const tableRows = [];

  for (const spec of workerSpecs) {
    const dest = destinationPoint(centerLat, centerLng, spec.distKm, spec.bearing);
    const measuredMeters = haversineDistance(centerLat, centerLng, dest.latitude, dest.longitude);
    const measuredKm = (measuredMeters / 1000).toFixed(2);

    let worker = await User.findOne({ phone: spec.phone });
    if (!worker) {
      worker = await User.create({
        name: spec.name,
        phone: spec.phone,
        role: 'worker',
        languagePreference: 'hi',
        skills: [spec.skill],
        experienceYears: 4,
        isAvailable: spec.isAvailable,
        isActive: true,
        kycStatus: 'simulated_verified',
        location: {
          type: 'Point',
          coordinates: [dest.longitude, dest.latitude],
        },
        address: `${spec.distKm} km ${spec.direction}`,
      });

      await Wallet.create({
        user: worker._id,
        balancePaise: 0,
        lockedPaise: 0,
        currency: 'INR',
        status: 'active',
      });
    } else {
      worker.name = spec.name;
      worker.skills = [spec.skill];
      worker.isAvailable = spec.isAvailable;
      worker.location = {
        type: 'Point',
        coordinates: [dest.longitude, dest.latitude],
      };
      await worker.save();
    }

    const willBeNotified =
      spec.skill === 'painter' &&
      spec.isAvailable &&
      spec.distKm <= 5.0;

    tableRows.push({
      Code: spec.code,
      Phone: spec.phone,
      Name: spec.name,
      Skill: spec.skill,
      'Exact Dist (km)': `${measuredKm} km`,
      Available: spec.isAvailable ? 'YES' : 'NO',
      'Notified (5km Painter)': willBeNotified ? '✅ YES' : '❌ NO',
    });
  }

  console.log('\n================================== SEEDED WORKERS TABLE ==================================');
  console.table(tableRows);
  console.log('==========================================================================================');
  console.log('EXPECTED TO BE NOTIFIED for a painter job at center with 5 km radius: W1, W2, W3, W8 (4 workers)');
  console.log('Contractor Login: +919000000100');
  console.log('Workers Login: +919000000001 to +919000000008\n');

  await mongoose.disconnect();
};

runSeed().catch((err) => {
  console.error('Seed script error:', err);
  process.exit(1);
});
