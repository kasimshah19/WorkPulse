import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import User from '../models/User.js';
import Wallet from '../models/Wallet.js';
import VoiceSession from '../models/VoiceSession.js';

const runSeedOnboarding = async () => {
  if (env.nodeEnv === 'production') {
    console.error('❌ Cannot run seed script in production!');
    process.exit(1);
  }

  await connectDB();

  console.log('\n🌱 WorkPulse Seeding Test Fresh Worker for Voice Onboarding...');

  const freshWorkerPhone = '+919000000009';

  let worker = await User.findOne({ phone: freshWorkerPhone });
  if (!worker) {
    worker = await User.create({
      name: 'Test Fresh Worker',
      phone: freshWorkerPhone,
      role: 'worker',
      languagePreference: 'hi',
      skills: [],
      experienceYears: 0,
      location: {
        type: 'Point',
        coordinates: [0, 0],
      },
      address: '',
      isActive: true,
      isAvailable: true,
      kycStatus: 'simulated_verified',
    });

    await Wallet.create({
      user: worker._id,
      balancePaise: 0,
      lockedPaise: 0,
      currency: 'INR',
      status: 'active',
    });
    console.log(`✅ Created fresh worker: ${worker.name} (${freshWorkerPhone})`);
  } else {
    // Reset existing user
    worker.name = 'Test Fresh Worker';
    worker.skills = [];
    worker.experienceYears = 0;
    worker.languagePreference = 'hi';
    worker.location = {
      type: 'Point',
      coordinates: [0, 0],
    };
    worker.address = '';
    worker.isActive = true;
    worker.isAvailable = true;
    await worker.save();
    console.log(`🔄 Reset fresh worker: ${worker.name} (${freshWorkerPhone}) to empty skills & zero location`);
  }

  // Clear all past voice sessions for this test worker
  const deletedSessions = await VoiceSession.deleteMany({ user: worker._id });
  console.log(`🧹 Deleted ${deletedSessions.deletedCount} past voice sessions for ${freshWorkerPhone}`);

  console.log('\n================================================================');
  console.log('✅ FRESH WORKER SEEDED SUCCESSFULLY');
  console.log('Name: Test Fresh Worker');
  console.log('Phone: +919000000009');
  console.log('Skills: [] (Empty - profileComplete is false)');
  console.log('Location: [0, 0]');
  console.log('================================================================\n');

  await mongoose.disconnect();
};

runSeedOnboarding().catch((err) => {
  console.error('Seed onboarding error:', err);
  process.exit(1);
});
