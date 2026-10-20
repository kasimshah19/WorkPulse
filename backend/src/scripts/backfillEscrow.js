import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Job from '../models/Job.js';
import JobApplication from '../models/JobApplication.js';
import { createEscrowForAssignment } from '../services/escrow.service.js';

async function main() {
  console.log('🔄 Starting Escrow Backfill for ASSIGNED workers...\n');
  await connectDB();

  try {
    const assignedApps = await JobApplication.find({ status: 'ASSIGNED' }).populate('job');
    console.log(`Found ${assignedApps.length} ASSIGNED worker applications.`);

    let totalCreated = 0;

    for (const app of assignedApps) {
      if (!app.job) continue;
      const rows = await createEscrowForAssignment(app.job, app.worker);
      totalCreated += rows.length;
      console.log(`  Processed Job "${app.job.title}" for Worker ${app.worker}: ${rows.length} daily rows ensured.`);
    }

    console.log(`\n✅ Backfill complete. Total daily escrow rows processed/ensured: ${totalCreated}`);
  } catch (err) {
    console.error('❌ Backfill failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();
