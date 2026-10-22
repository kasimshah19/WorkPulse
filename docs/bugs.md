# WorkPulse Bug Tracker (Phase 8)

This document tracks all bugs identified during Phase 8 hardening, integration, authorization matrix auditing, chaos simulations, and end-to-end testing.

## Severity Definitions
- **P0**: Money loss, ledger invariant violation, direct security breach / bypass.
- **P1**: Broken core user flow, data corruption, uncaught crash blocking progress.
- **P2**: Annoying behavior, minor validation edge case, UI inconsistency.
- **P3**: Cosmetic, minor styling flaw, non-blocking warning.

---

## Log of Identified & Resolved Bugs

| Bug ID | Severity | Description | How Found | Root Cause | Fix Applied | Test Coverage |
|---|---|---|---|---|---|---|
| BUG-001 | P0 | IDOR vulnerability on Escrow Release endpoint | `authz.matrix.test.js` audit | `releaseEscrow` controller omitted checking `escrow.contractor === req.user._id` for non-admin roles | Added contractor ownership check before calling `approveAndRelease` | `tests/authz.matrix.test.js` |
| BUG-002 | P1 | Route validation deadlock on Dispute creation | `authz.matrix.test.js` audit | Schema strictly required `escrowId` while controller strictly required `escrowTransactionId` | Accepted both `escrowTransactionId` and `escrowId` with optional `description` | `tests/authz.matrix.test.js` |
| BUG-003 | P1 | Sign-off decision enum mismatch | `authz.matrix.test.js` audit | `signoffSchema` validated `APPROVE/REJECT` while service enforced `APPROVED/DISPUTED` | Updated Joi schema to accept `APPROVED/DISPUTED` and support both `notes` and `reason` | `tests/authz.matrix.test.js` |

---

## Unfixed P2 / P3 Items
*(Items identified that are non-critical and documented honestly)*
- *None currently open*
