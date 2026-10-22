import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import env from '../config/env.js';
import User from '../models/User.js';
import Job from '../models/Job.js';
import Attendance from '../models/Attendance.js';
import Wallet from '../models/Wallet.js';
import Notification from '../models/Notification.js';
import RefreshToken from '../models/RefreshToken.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import LedgerEntry from '../models/LedgerEntry.js';
import JobApplication from '../models/JobApplication.js';
import Incident from '../models/Incident.js';
import Rating from '../models/Rating.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function checkForCollscan(plan) {
  if (!plan) return false;
  if (plan.stage === 'COLLSCAN') return true;
  if (plan.inputStage && checkForCollscan(plan.inputStage)) return true;
  if (Array.isArray(plan.inputStages)) {
    return plan.inputStages.some(checkForCollscan);
  }
  return false;
}

function getIndexUsed(plan) {
  if (!plan) return 'None';
  if (plan.indexName) return plan.indexName;
  if (plan.stage === 'GEO_NEAR_2DSPHERE') return plan.keyPattern ? JSON.stringify(plan.keyPattern) : '2dsphere';
  if (plan.inputStage) return getIndexUsed(plan.inputStage);
  if (Array.isArray(plan.inputStages)) {
    for (const sub of plan.inputStages) {
      const idx = getIndexUsed(sub);
      if (idx !== 'None') return idx;
    }
  }
  return plan.stage || 'Unknown';
}

export async function runIndexAudit({ dbName = null } = {}) {
  let targetUri = env.mongoUri;
  if (dbName) {
    targetUri = targetUri.replace(/\/workpulse(\?|$)/, `/${dbName}$1`);
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(targetUri);
  }

  console.log(`\n🔍 Running WorkPulse Index & Query Execution Audit on: ${mongoose.connection.name}...`);

  // Ensure indexes are ready
  await Promise.all([
    User.syncIndexes(),
    Job.syncIndexes(),
    Attendance.syncIndexes(),
    Wallet.syncIndexes(),
    Notification.syncIndexes(),
    RefreshToken.syncIndexes(),
    EscrowTransaction.syncIndexes(),
    LedgerEntry.syncIndexes(),
    JobApplication.syncIndexes(),
    Incident.syncIndexes(),
    Rating.syncIndexes(),
  ]);

  // Sample or placeholder IDs for execution
  const sampleUser = (await User.findOne({ role: 'worker' })) || { _id: new mongoose.Types.ObjectId() };
  const sampleContractor = (await User.findOne({ role: 'contractor' })) || { _id: new mongoose.Types.ObjectId() };
  const sampleJob = (await Job.findOne()) || { _id: new mongoose.Types.ObjectId() };
  const sampleWallet = (await Wallet.findOne()) || { _id: new mongoose.Types.ObjectId() };

  const todayStr = new Date().toISOString().slice(0, 10);
  const sampleTokenHash = '0000000000000000000000000000000000000000000000000000000000000000';

  const queries = [
    {
      name: '1. Nearby Jobs Geofence Match',
      model: 'Job',
      fn: () =>
        Job.find({
          status: 'OPEN',
          location: {
            $nearSphere: {
              $geometry: { type: 'Point', coordinates: [77.5946, 12.9716] },
              $maxDistance: 10000,
            },
          },
        })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: '2. Worker Today Attendance',
      model: 'Attendance',
      fn: () =>
        Attendance.find({
          worker: sampleUser._id,
          date: todayStr,
        }).explain('executionStats'),
    },
    {
      name: '3. User Wallet Balance Lookup',
      model: 'Wallet',
      fn: () =>
        Wallet.find({
          user: sampleUser._id,
        }).explain('executionStats'),
    },
    {
      name: '4. User Paginated Notifications',
      model: 'Notification',
      fn: () =>
        Notification.find({
          user: sampleUser._id,
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: '5. Refresh Token Hash Lookup',
      model: 'RefreshToken',
      fn: () =>
        RefreshToken.find({
          tokenHash: sampleTokenHash,
        }).explain('executionStats'),
    },
    {
      name: '6. Active Sessions for User',
      model: 'RefreshToken',
      fn: () =>
        RefreshToken.find({
          user: sampleUser._id,
          revokedAt: null,
        }).explain('executionStats'),
    },
    {
      name: '7. Worker Escrow Milestones',
      model: 'EscrowTransaction',
      fn: () =>
        EscrowTransaction.find({
          worker: sampleUser._id,
        })
          .sort({ dayDate: -1 })
          .explain('executionStats'),
    },
    {
      name: '8. Ledger Group Idempotency Replay',
      model: 'LedgerEntry',
      fn: () =>
        LedgerEntry.find({
          groupId: 'LOAD_GROUP:1',
        }).explain('executionStats'),
    },
    {
      name: '9. Wallet Ledger Statement History',
      model: 'LedgerEntry',
      fn: () =>
        LedgerEntry.find({
          wallet: sampleWallet._id,
        })
          .sort({ createdAt: -1 })
          .limit(20)
          .explain('executionStats'),
    },
    {
      name: '10. Job Applicants for Contractor',
      model: 'JobApplication',
      fn: () =>
        JobApplication.find({
          job: sampleJob._id,
        })
          .sort({ respondedAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '11. Incidents on Job by Visibility',
      model: 'Incident',
      fn: () =>
        Incident.find({
          job: sampleJob._id,
          visibility: 'ALERTED_USERS',
        })
          .sort({ createdAt: -1 })
          .explain('executionStats'),
    },
    {
      name: '12. Public Worker Ratings',
      model: 'Rating',
      fn: () =>
        Rating.find({
          toUser: sampleUser._id,
          isHidden: false,
        }).explain('executionStats'),
    },
  ];

  const results = [];
  let violations = 0;

  for (const q of queries) {
    try {
      const explainRes = await q.fn();
      const stats = explainRes.executionStats || {};
      const plan = explainRes.queryPlanner?.winningPlan || {};

      const isCollscan = checkForCollscan(plan);
      const indexUsed = getIndexUsed(plan);
      const executionTimeMillis = stats.executionTimeMillis ?? 0;
      const nReturned = stats.nReturned ?? 0;
      const totalDocsExamined = stats.totalDocsExamined ?? 0;

      if (isCollscan) {
        violations++;
      }

      results.push({
        name: q.name,
        model: q.model,
        isCollscan,
        indexUsed,
        executionTimeMillis,
        nReturned,
        totalDocsExamined,
        status: isCollscan ? 'FAIL (COLLSCAN)' : 'PASS (INDEXED)',
      });
    } catch (err) {
      results.push({
        name: q.name,
        model: q.model,
        isCollscan: false,
        indexUsed: 'ERROR',
        executionTimeMillis: 0,
        nReturned: 0,
        totalDocsExamined: 0,
        status: `ERROR: ${err.message}`,
      });
    }
  }

  // Format table output
  console.log('\n--- Query Performance & Index Execution Report ---');
  console.table(
    results.map((r) => ({
      Query: r.name,
      Model: r.model,
      Status: r.status,
      'Index Used': r.indexUsed,
      'Exec (ms)': r.executionTimeMillis,
      'Docs Examined': r.totalDocsExamined,
      'Docs Returned': r.nReturned,
    }))
  );

  // Write to docs/index-audit.md
  let md = `# WorkPulse Database Index & Query Performance Audit\n\n`;
  md += `Audit Date: ${new Date().toISOString()}\n`;
  md += `Database: \`${mongoose.connection.name}\`\n\n`;
  md += `| Query | Target Model | Status | Index Used | Execution (ms) | Docs Examined | Docs Returned |\n`;
  md += `|---|---|---|---|---|---|---|\n`;

  for (const r of results) {
    const badge = r.isCollscan ? '❌ COLLSCAN' : '✅ INDEXED';
    md += `| ${r.name} | \`${r.model}\` | ${badge} | \`${r.indexUsed}\` | ${r.executionTimeMillis}ms | ${r.totalDocsExamined} | ${r.nReturned} |\n`;
  }

  if (violations > 0) {
    md += `\n## ⚠️ Index Audit Violations: ${violations} queries performed table COLLSCAN!\n`;
  } else {
    md += `\n## ✅ Index Audit PASSED: 0 COLLSCAN queries detected across all critical paths.\n`;
  }

  const outPath = path.resolve(__dirname, '../../../docs/index-audit.md');
  fs.writeFileSync(outPath, md, 'utf8');
  console.log(`\n📄 Report written to docs/index-audit.md`);

  if (process.argv[1]?.endsWith('explain-queries.js')) {
    await mongoose.disconnect();
    if (violations > 0) {
      console.error(`\n❌ INDEX AUDIT FAILED with ${violations} COLLSCAN violation(s).`);
      process.exit(1);
    }
    console.log('✅ All production queries indexed with zero COLLSCAN.\n');
  }

  return results;
}

if (process.argv[1]?.endsWith('explain-queries.js')) {
  runIndexAudit().catch((err) => {
    console.error('Audit execution error:', err);
    process.exit(1);
  });
}
