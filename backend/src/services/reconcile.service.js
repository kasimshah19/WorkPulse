import LedgerEntry from '../models/LedgerEntry.js';
import Wallet from '../models/Wallet.js';
import EscrowTransaction from '../models/EscrowTransaction.js';
import {
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
  ESCROW_STATUS,
} from '../config/constants.js';

/**
 * Executes a full cryptographic / double-entry audit of all balances, ledger groups, and escrows.
 *
 * @returns {Promise<{ pass: boolean, timestamp: string, checks: Object }>}
 */
export async function runReconciliation() {
  const timestamp = new Date().toISOString();
  const checks = {
    groupBalance: { name: 'Invariant A: sum(DEBIT) == sum(CREDIT) for each groupId', pass: true, failures: [] },
    walletLedgerMatch: { name: 'Invariant B: Wallet balances match ledger history', pass: true, failures: [] },
    contractorEscrowMatch: { name: 'Invariant C: Contractor lockedPaise matches active escrow rows', pass: true, failures: [] },
    globalConservation: { name: 'Invariant D: Global money conservation (External In - Out == System Wallets + Fees)', pass: true, details: {} },
    safetyInvariants: { name: 'Invariant E: Non-negative balances & valid terminal states', pass: true, failures: [] },
  };

  // 1. Invariant A: For every groupId: sum(DEBIT) == sum(CREDIT)
  const groupAgg = await LedgerEntry.aggregate([
    {
      $group: {
        _id: '$groupId',
        debitSum: {
          $sum: { $cond: [{ $eq: ['$entryType', LEDGER_ENTRY_TYPE.DEBIT] }, '$amountPaise', 0] },
        },
        creditSum: {
          $sum: { $cond: [{ $eq: ['$entryType', LEDGER_ENTRY_TYPE.CREDIT] }, '$amountPaise', 0] },
        },
      },
    },
  ]);

  for (const group of groupAgg) {
    if (group.debitSum !== group.creditSum) {
      checks.groupBalance.pass = false;
      checks.groupBalance.failures.push({
        groupId: group._id,
        debitSum: group.debitSum,
        creditSum: group.creditSum,
        diff: group.debitSum - group.creditSum,
      });
    }
  }

  // 2. Invariant B: For every wallet: balancePaise == derived from ledger entries, lockedPaise == derived from ESCROW_HOLD entries
  const allWallets = await Wallet.find().lean();
  for (const wallet of allWallets) {
    const entries = await LedgerEntry.find({ wallet: wallet._id }).lean();

    let computedBalance = 0;
    let computedLocked = 0;

    for (const entry of entries) {
      if (entry.account === LEDGER_ACCOUNT.CONTRACTOR_WALLET || entry.account === LEDGER_ACCOUNT.WORKER_WALLET) {
        if (entry.entryType === LEDGER_ENTRY_TYPE.CREDIT) {
          computedBalance += entry.amountPaise;
        } else {
          computedBalance -= entry.amountPaise;
        }
      } else if (entry.account === LEDGER_ACCOUNT.ESCROW_HOLD) {
        if (entry.entryType === LEDGER_ENTRY_TYPE.CREDIT) {
          computedLocked += entry.amountPaise;
        } else {
          computedLocked -= entry.amountPaise;
        }
      }
    }

    if (wallet.balancePaise !== computedBalance || wallet.lockedPaise !== computedLocked) {
      checks.walletLedgerMatch.pass = false;
      checks.walletLedgerMatch.failures.push({
        walletId: wallet._id,
        user: wallet.user,
        actualBalance: wallet.balancePaise,
        computedBalance,
        actualLocked: wallet.lockedPaise,
        computedLocked,
      });
    }

    // Part of Invariant E: No negative balance
    if (wallet.balancePaise < 0 || wallet.lockedPaise < 0) {
      checks.safetyInvariants.pass = false;
      checks.safetyInvariants.failures.push({
        walletId: wallet._id,
        error: 'NEGATIVE_BALANCE',
        balancePaise: wallet.balancePaise,
        lockedPaise: wallet.lockedPaise,
      });
    }
  }

  // 3. Invariant C: For every contractor: lockedPaise == sum of active escrow rows (FUNDED, CHECKED_IN, CHECKED_OUT, APPROVED, DISPUTED)
  const activeStatuses = [
    ESCROW_STATUS.FUNDED,
    ESCROW_STATUS.CHECKED_IN,
    ESCROW_STATUS.CHECKED_OUT,
    ESCROW_STATUS.APPROVED,
    ESCROW_STATUS.DISPUTED,
  ];

  const contractorEscrowSums = await EscrowTransaction.aggregate([
    { $match: { status: { $in: activeStatuses } } },
    {
      $group: {
        _id: '$contractor',
        activeLockedSum: { $sum: '$amountPaise' },
      },
    },
  ]);

  const activeSumByContractor = new Map();
  for (const item of contractorEscrowSums) {
    activeSumByContractor.set(item._id.toString(), item.activeLockedSum);
  }

  const totalEscrowDocs = await EscrowTransaction.countDocuments();
  if (totalEscrowDocs > 0) {
    for (const wallet of allWallets) {
      const expectedLocked = activeSumByContractor.get(wallet.user.toString()) || 0;
      if (wallet.lockedPaise !== expectedLocked) {
        checks.contractorEscrowMatch.pass = false;
        checks.contractorEscrowMatch.failures.push({
          walletId: wallet._id,
          contractor: wallet.user,
          walletLockedPaise: wallet.lockedPaise,
          escrowActiveSum: expectedLocked,
          diff: wallet.lockedPaise - expectedLocked,
        });
      }
    }
  }

  // 4. Invariant D: Global money conservation
  // sum(GATEWAY_EXTERNAL DEBIT) - sum(PAYOUT_EXTERNAL CREDIT) == sum(all wallet balances) + sum(all locked) + sum(platform fees)
  const gatewayDebits = await LedgerEntry.aggregate([
    {
      $match: {
        account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
      },
    },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  const payoutCredits = await LedgerEntry.aggregate([
    {
      $match: {
        account: LEDGER_ACCOUNT.PAYOUT_EXTERNAL,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
      },
    },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  const platformFees = await LedgerEntry.aggregate([
    {
      $match: {
        account: LEDGER_ACCOUNT.PLATFORM_FEE,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
      },
    },
    { $group: { _id: null, total: { $sum: '$amountPaise' } } },
  ]);

  const totalGatewayIn = gatewayDebits[0]?.total || 0;
  const totalPayoutOut = payoutCredits[0]?.total || 0;
  const netExternalIn = totalGatewayIn - totalPayoutOut;

  const totalWalletBalances = allWallets.reduce((sum, w) => sum + w.balancePaise, 0);
  const totalWalletLocked = allWallets.reduce((sum, w) => sum + w.lockedPaise, 0);
  const totalPlatformFees = platformFees[0]?.total || 0;

  const totalSystemHeld = totalWalletBalances + totalWalletLocked + totalPlatformFees;

  const globalDiff = netExternalIn - totalSystemHeld;
  checks.globalConservation.details = {
    totalGatewayIn,
    totalPayoutOut,
    netExternalIn,
    totalWalletBalances,
    totalWalletLocked,
    totalPlatformFees,
    totalSystemHeld,
    diff: globalDiff,
  };

  if (globalDiff !== 0) {
    checks.globalConservation.pass = false;
  }

  // 5. Invariant E: Terminal state consistency
  // No escrow row is RELEASED without a RELEASE ledger group; no row is both RELEASED and REFUNDED.
  const releasedRows = await EscrowTransaction.find({ status: ESCROW_STATUS.RELEASED }).lean();
  for (const row of releasedRows) {
    if (row.refundedAt && row.releasedAt) {
      checks.safetyInvariants.pass = false;
      checks.safetyInvariants.failures.push({
        escrowId: row._id,
        error: 'BOTH_RELEASED_AND_REFUNDED',
      });
    }

    const releaseGroup = await LedgerEntry.findOne({
      groupId: `RELEASE:${row._id.toString()}`,
    });
    const splitGroup = await LedgerEntry.findOne({
      transaction: row._id,
      referenceType: 'DISPUTE_SETTLEMENT',
    });

    if (!releaseGroup && !splitGroup) {
      checks.safetyInvariants.pass = false;
      checks.safetyInvariants.failures.push({
        escrowId: row._id,
        error: 'RELEASED_WITHOUT_LEDGER_ENTRY',
      });
    }
  }

  const overallPass =
    checks.groupBalance.pass &&
    checks.walletLedgerMatch.pass &&
    checks.contractorEscrowMatch.pass &&
    checks.globalConservation.pass &&
    checks.safetyInvariants.pass;

  const violations = [
    ...checks.groupBalance.failures,
    ...checks.walletLedgerMatch.failures,
    ...checks.contractorEscrowMatch.failures,
    ...checks.safetyInvariants.failures,
  ];

  return {
    pass: overallPass,
    status: overallPass ? 'PASS' : 'FAIL',
    violations,
    summary: {
      totalLedgerGroups: groupAgg.length,
      totalWallets: allWallets.length,
      activeContractors: allWallets.filter((w) => w.lockedPaise > 0 || w.balancePaise > 0).length,
    },
    timestamp,
    checks,
  };
}
