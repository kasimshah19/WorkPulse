import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import env from '../src/config/env.js';
import { runSimulation } from '../src/scripts/simulate.js';

describe('Phase 8: Chaos Invariant Simulation Test (Deterministic)', () => {
  jest.setTimeout(120000); // 2 minutes

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(env.mongoUriTest);
    }
  });

  test('Runs 200 random stochastic actions with fixed seed 42 and asserts Invariants A-E PASS with 0 money discrepancies', async () => {
    const result = await runSimulation({
      usersCount: 12,
      actionsCount: 200,
      seed: 42,
      concurrency: 4,
      reset: false,
    });

    expect(result.simPassed).toBe(true);
    expect(result.stats.unhandledErrors).toBe(0);
    expect(result.reconciliationReport.pass).toBe(true);
    expect(result.reconciliationReport.checks.groupBalance.pass).toBe(true);
    expect(result.reconciliationReport.checks.walletLedgerMatch.pass).toBe(true);
    expect(result.reconciliationReport.checks.contractorEscrowMatch.pass).toBe(true);
    expect(result.reconciliationReport.checks.globalConservation.pass).toBe(true);
    expect(result.reconciliationReport.checks.safetyInvariants.pass).toBe(true);
  });
});
