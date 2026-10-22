# Phase 8 Baseline Report

Date: 2026-10-22
Environment: Windows, Node.js v20+, Python 3.13.7

This document establishes the verified baseline for WorkPulse across backend, frontend, and voice-service prior to Phase 8 hardening. All metrics are recorded directly from executed commands.

---

## 1. Application Scripts Summary

### Backend (`backend/package.json`)
| Script | Command | Purpose |
|---|---|---|
| `dev` | `nodemon src/server.js` | Start local backend development server with hot-reload |
| `start` | `node src/server.js` | Production startup |
| `test` | `node --experimental-vm-modules node_modules/jest/bin/jest.js --runInBand --forceExit --detectOpenHandles` | Run Jest test suite in band |
| `seed` | `node src/scripts/seed.js` | Seed users, jobs, wallets, ratings |
| `seed:reset` | `node src/scripts/seed.js --reset` | Clear database and reseed base data |
| `seed:attendance` | `node src/scripts/seedAttendance.js` | Seed attendance check-in/out records |
| `seed:escrow` | `node src/scripts/seedEscrow.js` | Seed escrow records and transactions |
| `seed:onboarding` | `node src/scripts/seedOnboarding.js` | Seed voice onboarding sessions |
| `seed:safety` | `node src/scripts/seedSafety.js` | Seed SOS incidents and volunteer network |
| `backfill:escrow` | `node src/scripts/backfillEscrow.js` | Backfill escrow states |
| `reconcile` | `node src/scripts/reconcile.js` | Double-entry ledger invariant reconciliation |
| `lint` | `eslint src/` | Code linting |
| `format` | `prettier --write "src/**/*.js"` | Code formatting |

### Frontend (`frontend/package.json`)
| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev -p 3000` | Start Next.js local dev server on port 3000 |
| `build` | `next build` | Next.js production build bundle |
| `start` | `next start -p 3000` | Start production Next.js server |
| `lint` | `next lint` | Run Next.js ESLint checks |

### Voice Service (`voice-service/`)
| Script | Command | Purpose |
|---|---|---|
| `test` | `.\venv\Scripts\python -m pytest -v` | Run FastAPI pytest test suite |
| `start` | `uvicorn app.main:app --host 0.0.0.0 --port 8000` | Start FastAPI voice service |

---

## 2. Test Suites Baseline & Reconciliation

### Backend Tests
- **Command**: `npm test 2>&1` (in `backend/`)
- **Result**:
  - Test Suites: **6 passed, 6 total**
  - Tests: **86 passed, 86 total**
  - Snapshots: 0 total
  - Duration: **126.946 s**

### Voice Service Tests
- **Command**: `.\venv\Scripts\python -m pytest -v 2>&1` (in `voice-service/`)
- **Result**:
  - Tests: **18 passed, 1 skipped, 0 failed** (1 skipped: `test_faster_whisper_transcription` due to optional local model)
  - Duration: **2.23 s**

### Ledger Reconciliation
- **Command**: `npm run reconcile 2>&1` (in `backend/`)
- **Result**: **Overall Status: PASS**
  - Invariant A: sum(DEBIT) == sum(CREDIT) for each groupId: **PASS**
  - Invariant B: Wallet balances match ledger history: **PASS**
  - Invariant C: Contractor lockedPaise matches active escrow rows: **PASS**
  - Invariant D: Global money conservation (External In - Out == System Wallets + Fees): **PASS**
    - `totalGatewayIn`: 11,200,000 paise (₹112,000)
    - `totalPayoutOut`: 0 paise
    - `netExternalIn`: 11,200,000 paise
    - `totalWalletBalances`: 10,235,000 paise
    - `totalWalletLocked`: 965,000 paise
    - `totalPlatformFees`: 0 paise
    - `totalSystemHeld`: 11,200,000 paise
    - `diff`: 0 paise
  - Invariant E: Non-negative balances & valid terminal states: **PASS**

---

## 3. Dependency Vulnerability Audits

### Backend Audit
- **Command**: `npm audit` (in `backend/`)
- **Result**: **36 vulnerabilities (6 moderate, 30 high)**
  - Affected packages: `braces`, `chokidar`, `micromatch`, `@jest/*`, `sprintf-js`, `uuid`

### Frontend Audit
- **Command**: `npm audit` (in `frontend/`)
- **Result**: **18 vulnerabilities (2 moderate, 15 high, 1 critical)**
  - Affected packages: `next`, `postcss`, `postcss-selector-parser`, `glob`, `braces`, `serialize-javascript`

### Voice Service Audit
- **Command**: `.\venv\Scripts\pip-audit` (in `voice-service/` venv)
- **Result**: **13 vulnerabilities in 2 packages**
  - `certifi` (2026.7.22): 1 vulnerability (PYSEC-2026-4320)
  - `pip` (25.2): 12 vulnerabilities (PYSEC-2026-1795, PYSEC-2026-1796, PYSEC-2026-2875, PYSEC-2026-2876, PYSEC-2026-196, PYSEC-2026-3721)

---

## 4. Express Routes Baseline

Examined via router inspection:

### Public Routes
- `GET /api/v1/health`
- `POST /api/v1/auth/send-otp`
- `POST /api/v1/auth/verify-otp`
- `POST /api/v1/payments/razorpay/webhook`
- `GET /api/v1/voice/skills`

### Protected Routes (Require Authentication)
- **Auth**: `GET /api/v1/auth/me`
- **Users**: `GET /api/v1/users/me`, `PATCH /api/v1/users/me`, `GET /api/v1/users/:id/reputation`
- **Jobs**:
  - `POST /api/v1/jobs`
  - `GET /api/v1/jobs`
  - `GET /api/v1/jobs/nearby`
  - `GET /api/v1/jobs/:id`
  - `PATCH /api/v1/jobs/:id`
  - `POST /api/v1/jobs/:id/cancel`
- **Applications**:
  - `POST /api/v1/applications`
  - `GET /api/v1/applications/my`
  - `GET /api/v1/applications/job/:jobId`
  - `PATCH /api/v1/applications/:id`
- **Notifications**:
  - `GET /api/v1/notifications`
  - `PATCH /api/v1/notifications/:id/read`
  - `POST /api/v1/notifications/read-all`
- **Attendance**:
  - `POST /api/v1/attendance/check-in`
  - `POST /api/v1/attendance/check-out`
  - `POST /api/v1/attendance/:id/signoff`
  - `GET /api/v1/attendance/today`
  - `GET /api/v1/attendance/job/:jobId`
  - `GET /api/v1/attendance/:id/selfie`
- **Wallet & Payments**:
  - `GET /api/v1/wallet`
  - `POST /api/v1/wallet/topup-order`
  - `POST /api/v1/wallet/topup-verify`
  - `POST /api/v1/wallet/withdraw`
  - `GET /api/v1/wallet/ledger`
  - `GET /api/v1/payments/payouts`
- **Escrow & Disputes**:
  - `POST /api/v1/escrow/jobs/:jobId/fund`
  - `GET /api/v1/escrow/jobs/:jobId`
  - `POST /api/v1/escrow/:id/approve`
  - `POST /api/v1/escrow/:id/dispute`
  - `GET /api/v1/disputes/my`
  - `GET /api/v1/disputes/:id`
  - `POST /api/v1/disputes/:id/evidence`
- **Ratings**:
  - `POST /api/v1/ratings`
  - `GET /api/v1/ratings/pending`
  - `GET /api/v1/ratings/mine/given`
  - `GET /api/v1/ratings/received`
  - `POST /api/v1/ratings/:id/report`
- **Incidents & Safety**:
  - `POST /api/v1/incidents/sos`
  - `POST /api/v1/incidents/:id/location`
  - `POST /api/v1/incidents/:id/acknowledge`
  - `POST /api/v1/incidents/:id/resolve`
  - `POST /api/v1/incidents`
  - `GET /api/v1/incidents/my`
  - `GET /api/v1/incidents/:id`
  - `GET /api/v1/incidents/:id/photos/:index`
- **Voice Service**:
  - `GET /api/v1/voice/config`
  - `POST /api/v1/voice/onboard`
  - `POST /api/v1/voice/extract`
  - `POST /api/v1/voice/confirm`
  - `POST /api/v1/voice/sessions/:id/abandon`
  - `GET /api/v1/voice/stats`
- **Admin**:
  - `GET /api/v1/admin/disputes`
  - `GET /api/v1/admin/disputes/:id`
  - `POST /api/v1/admin/disputes/:id/resolve`
  - `GET /api/v1/admin/ledger/reconcile`
  - `GET /api/v1/admin/reconciliation`
  - `POST /api/v1/admin/reconciliation/run`
  - `GET /api/v1/admin/stats`
  - `GET /api/v1/admin/voice/stats`
  - `GET /api/v1/admin/ratings`
  - `POST /api/v1/admin/ratings/:id/hide`
  - `POST /api/v1/admin/ratings/:id/unhide`
  - `GET /api/v1/admin/incidents`
  - `GET /api/v1/admin/incidents/:id`
  - `POST /api/v1/admin/incidents/:id/note`
  - `POST /api/v1/admin/incidents/:id/resolve`
  - `GET /api/v1/admin/safety/stats`
  - `GET /api/v1/admin/ledger-groups`

### Development Only Routes (`NODE_ENV !== 'production'`)
- `/api/v1/auth/dev-login` (when `OTP_DEV_MODE=true`)
- `/api/v1/auth/dev-users` (when `OTP_DEV_MODE=true`)
- `/api/v1/dev/wallet/topup`
- `/api/v1/dev/escrow/:id/expire-approval`
- `/api/v1/dev/scheduler/run`
- `/api/v1/dev/incidents/:id/age`
- `/api/v1/dev/jobs/:id/open-rating-window`

---

## 5. Socket Events Baseline

### Client to Server Events
1. `job:received`: Worker client acks new job broadcast (cancels SMS fallback timer)
2. `sos:ack-received`: Worker client stamps delivery of SOS alert
3. `job:join`: Worker joins active job room
4. `disconnect`: Socket disconnect cleanup

### Server to Client Events
1. `job:new`: Broadcast new matched job to workers
2. `job:cancelled`: Job cancelled alert
3. `job:filled`: Job filled alert
4. `job:assigned`: Job assigned alert
5. `applicant:accepted`: Contractor alerted of applicant acceptance
6. `attendance:checkedIn`: Worker checked in inside geofence
7. `attendance:checkedOut`: Worker checked out
8. `signoff:requested`: Worker completed shift and requested signoff
9. `signoff:done`: Contractor completed signoff
10. `attendance:missed`: Worker marked as no-show
11. `escrow:funded`: Escrow funded for job
12. `payment:released`: Payment released to worker wallet
13. `payment:refunded`: Escrow refund to contractor
14. `dispute:opened`: Dispute raised
15. `dispute:resolved`: Admin resolved dispute
16. `wallet:updated`: Wallet balance change
17. `payout:status`: Payout processing/success/failed
18. `rating:requested`: Prompt user to rate counterpart
19. `rating:revealed`: Both ratings submitted, unblinded
20. `sos:alert`: SOS distress broadcast to nearby workers/contractor/admin
21. `sos:location`: Realtime location updates for active SOS incident
22. `sos:acknowledged`: Incident responder acknowledged SOS
23. `sos:resolved`: SOS incident resolved
24. `sos:escalated`: SOS timer escalation
25. `incident:new`: New safety incident filed

---

## 6. Schedulers Baseline

1. **`attendance.scheduler.js`**:
   - Auto-checkout after shift end + grace period
   - No-show detection (if not checked in within grace period)
   - Interval: controlled by `ATTENDANCE_SCHEDULER_INTERVAL_SEC` (default: 60s)

2. **`escrow.scheduler.js`**:
   - 72-hour auto-approval scan for unapproved checkouts
   - Interval: controlled by `ESCROW_SCHEDULER_INTERVAL_SEC` (default: 60s)

3. **`safety.scheduler.js`**:
   - SOS Escalation Tier 1 (60s without responder ack -> broadcast wider)
   - SOS Escalation Tier 2 (300s without resolution -> escalate to admin)
   - 72h auto-resolution of self-safe/safe incidents
   - Rating reminders after 3 days
   - Interval: controlled by `SAFETY_SCHEDULER_INTERVAL_SEC` (default: 30s)

---

## 7. Environment Variables Baseline
All 49 environment variables in `backend/.env.example` are systematically parsed and defaulted in `src/config/env.js`.
None are missing from `env.js`.
