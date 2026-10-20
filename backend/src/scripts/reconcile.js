import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import env from '../config/env.js';
import { runReconciliation } from '../services/reconcile.service.js';

async function main() {
  console.log('🔍 Starting WorkPulse Double-Entry Ledger Reconciliation...\n');
  await connectDB();

  try {
    const report = await runReconciliation();

    console.log(`Timestamp: ${report.timestamp}`);
    console.log(`Overall Status: ${report.pass ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('--- Invariant Checks ---');
    for (const [key, check] of Object.entries(report.checks)) {
      const statusIcon = check.pass ? '✅ PASS' : '❌ FAIL';
      console.log(`${statusIcon} - ${check.name}`);
      if (!check.pass) {
        console.error('   Failure Details:', JSON.stringify(check.failures || check.details, null, 2));
      }
      if (check.details && Object.keys(check.details).length > 0) {
        console.log('   Details:', JSON.stringify(check.details, null, 2));
      }
    }

    if (!report.pass) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('❌ Reconciliation execution error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();
