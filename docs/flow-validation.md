# WorkPulse End-to-End Architectural Flow Validation

This document validates the completeness and integrity of the WorkPulse system specification across 10 critical user journeys. Each step is rigorously mapped to its designated Screen, API Endpoint, MongoDB Collection(s) modified, and Entity State Change.

---

## Flow 1: New Worker Onboarding via Voice (Re-validated Phase 6)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change & Data Integrity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | Worker selects language (हिंदी / मराठी / English) | Screen V1 | `PATCH /users/me` | `users` | `languagePreference: "hi"` (or `"mr"` / `"en"`) |
| 1.2 | Worker reviews DPDP voice privacy notice and taps "Theek hai" | Screen V2 | Client Consent state | None (client memory) | `consent: true` captured in wizard session |
| 1.3 | **WebSpeech Path**: Worker taps mic, speaks trade & experience | Screen V3 | `POST /voice/extract` | `voicesessions` | Browser produces transcript; voice-service extracts skills. `voicesessions` created (`status: EXTRACTED`, `method: WEBSPEECH_TEXT`). **`User` profile is UNCHANGED (Draft Isolation).** |
| 1.3b | **Server Audio Path**: Worker records audio via MediaRecorder | Screen V3 | `POST /voice/onboard` | `voicesessions` | In-memory multipart buffer forwarded to Whisper STT. `voicesessions` created (`status: EXTRACTED`, `method: SERVER_AUDIO`). **Zero audio saved to disk/DB.** |
| 1.4 | **Icon Fallback Path**: If voice fails, mic denied, or user chooses | Screen V5 | Client Fallback state | None | Worker selects from 16-skill icon grid with +/- experience stepper. |
| 1.5 | Worker reviews chips, adjusts experience years, taps "Sahi hai" | Screen V4 / V5 | `POST /voice/confirm` | `voicesessions`, `users` | **Only here skills are saved!** `users.skills: ["painter"]`, `experienceYears: 5`. `voicesessions.status: CONFIRMED`. |
| 1.6 | Worker saves GPS location coordinates and optional UPI ID | Screen V6 | `PATCH /users/me/location`<br>`PATCH /users/me/upi` | `users` | `users.location: { type: "Point", coordinates: [lng, lat] }`. Worker **`profileComplete` becomes `true`**. Redirected to `/worker/dashboard`. |

> **Architectural Gaps Found & Resolved (Phase 6)**:
> 1. *Gap*: Original Phase 1 draft assumed skills were saved immediately during voice upload. *Fix*: In Phase 6, voice output is strictly a DRAFT. Neither `/voice/onboard` nor `/voice/extract` touches the `User` document; skills and years are committed solely when the worker taps "Sahi hai" on `/voice/confirm`.
> 2. *Gap*: Original design had no privacy-preserving audio handling. *Fix*: Compliant with DPDP Act 2023, audio bytes are never written to disk or DB (memory-only BytesIO/Multer buffers), and session metadata is auto-deleted after 90 days via MongoDB TTL index.
> 3. *Gap*: No fallback if speech recognition fails. *Fix*: Guaranteed 16-skill icon-grid fallback automatically engages on mic denial, offline voice service (`503 VOICE_UNAVAILABLE`), or user choice.

---

## Flow 2: Contractor Posts Job -> Geo-Match -> Worker Acceptance

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2.1 | Contractor logs in & completes 4-step job posting | Screen C1 | `POST /jobs` | `jobs` | Job created with status `DRAFT` |
| 2.2 | Contractor clicks Publish | Screen C1 | `POST /jobs/:id/publish` | `jobs`, `notifications` | Job status -> `OPEN`. Geo-matching query triggers notifications |
| 2.3 | Available workers within 5km receive socket alert | Background | Socket `job:new` | `jobapplications` | New `jobapplications` record created with status `NOTIFIED` |
| 2.4 | Worker reviews job details and taps "Swikar / Accept" | Screen W4 | `POST /applications/:jobId/accept` | `jobapplications`, `notifications` | Application status -> `ACCEPTED`. Contractor notified |
| 2.5 | Contractor assigns worker | Screen C1 | `POST /applications/:jobId/assign` | `jobs`, `jobapplications`, `escrowtransactions` | Application status -> `ASSIGNED`, `jobs.workersAssignedCount: 1`, `escrowtransactions` created (`CREATED`) |

---

## Flow 3: Happy Path (Fund -> Check-in -> Check-out -> Approve -> Release)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change & Ledger Invariant |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 3.1 | Contractor funds day shift via Razorpay test | Screen C2 | `POST /escrow/create-order`<br>`POST /escrow/verify-payment` | `escrowtransactions`, `wallets`, `ledgerentries` | **Escrow**: `CREATED` -> `FUNDED`.<br>**Ledger**: DEBIT `CONTRACTOR_WALLET` 85,000 paise, CREDIT `ESCROW_HOLD` 85,000 paise. |
| 3.2 | Worker arrives on site, captures selfie & GPS | Screen W5 | `POST /attendance/check-in` | `attendances`, `escrowtransactions` | **Attendance**: `CHECKED_IN` (distance 24m <= 100m).<br>**Escrow**: `FUNDED` -> `CHECKED_IN`. |
| 3.3 | Worker departs at shift end | Screen W4 | `POST /attendance/check-out` | `attendances`, `escrowtransactions` | **Attendance**: `CHECKED_OUT`, `hoursWorked: 9`.<br>**Escrow**: `CHECKED_IN` -> `CHECKED_OUT`. Auto-approval countdown set. |
| 3.4 | Contractor reviews attendance & taps "Approve" | Screen C3 | `POST /attendance/:id/signoff` | `attendances`, `escrowtransactions` | **Attendance**: `contractorSignoff.status: APPROVED`.<br>**Escrow**: `CHECKED_OUT` -> `APPROVED`. |
| 3.5 | System automatically releases payout | Background | `POST /escrow/:id/approve` | `escrowtransactions`, `wallets`, `ledgerentries`, `notifications` | **Escrow**: `APPROVED` -> `RELEASED`.<br>**Ledger**: DEBIT `ESCROW_HOLD` 85,000 paise, CREDIT `WORKER_WALLET` 85,000 paise. Worker balance increases. |

---

## Flow 4: Auto-Approval Path (Contractor Silent / Inactive)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 4.1 | Worker checks out at 18:00; escrow status is `CHECKED_OUT` | Screen W4 | `POST /attendance/check-out` | `escrowtransactions` | `autoApprovalAt` set to 06:00 AM next day (12h window) |
| 4.2 | 12 hours elapse with no response from contractor | System Cron | Internal Escrow Job | `escrowtransactions` | Cron query finds `status == CHECKED_OUT` and `autoApprovalAt <= now()` |
| 4.3 | Cron marks signoff approved and releases funds | System Cron | Internal State Engine | `escrowtransactions`, `wallets`, `ledgerentries`, `attendances` | **Attendance**: `signoff.status: APPROVED` (`by: system`).<br>**Escrow**: `RELEASED`.<br>**Ledger**: Escrow released to worker wallet. |
| 4.4 | Worker receives SMS & socket alert | Device | Socket `payment:released` | `notifications` | Notification logged, worker alerted |

---

## Flow 5: Dispute Path (Admin Arbitrates & Resolves Split)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 5.1 | Shift completed; contractor alleges worker left early | Screen C3 | `POST /attendance/:id/signoff` | `attendances`, `escrowtransactions`, `disputes` | `signoff.status: DISPUTED`. Escrow status -> `DISPUTED`. Dispute record created (`OPEN`). |
| 5.2 | Worker receives dispute alert, uploads photo proof | Screen W4 | `POST /disputes/:id/evidence` | `disputes` | Evidence added to array (`type: "photo"`) |
| 5.3 | Admin inspects dispute queue and reviews GPS logs | Screen A1, A2 | `GET /admin/disputes/:id` | `disputes`, `attendances` | Admin reviews: 5 hours verified on site out of 8 scheduled |
| 5.4 | Admin orders 50/50 Split Settlement | Screen A2 | `POST /admin/disputes/:id/resolve` | `disputes`, `escrowtransactions`, `wallets`, `ledgerentries` | **Dispute**: `RESOLVED` (`SPLIT`).<br>**Escrow**: `RELEASED`.<br>**Ledger**: DEBIT `ESCROW_HOLD` 85,000. CREDIT `WORKER_WALLET` 42,500. CREDIT `CONTRACTOR_WALLET` 42,500. |

---

## Flow 6: No-Show Worker -> Auto-Refund

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 6.1 | Contractor funds daily escrow; worker assigned | System | System State | `escrowtransactions` | Status is `FUNDED` |
| 6.2 | Shift window passes; no check-in logged by 23:59 | System Cron | Midnight Reconciliation | `attendances`, `escrowtransactions` | New attendance created with status `MISSED`. Escrow status -> `REFUNDED`. |
| 6.3 | System returns held money to contractor | System Cron | Internal Ledger Engine | `wallets`, `ledgerentries`, `notifications` | **Ledger**: DEBIT `ESCROW_HOLD` 85,000. CREDIT `CONTRACTOR_WALLET` 85,000. Contractor wallet unlocked. |

---

## Flow 7: Contractor Cancels Job Before Shift Starts

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 7.1 | Heavy rains cause contractor to cancel tomorrow's job | Screen C1 | `POST /jobs/:id/cancel` | `jobs`, `escrowtransactions`, `ledgerentries` | **Job**: `CANCELLED`.<br>**Escrow**: `CANCELLED`. |
| 7.2 | System refunds locked escrow to contractor wallet | Background | Internal Wallet Engine | `wallets`, `ledgerentries`, `notifications` | **Ledger**: Locked balance refunded to contractor wallet. |
| 7.3 | Assigned workers notified of cancellation | Device | SMS + Socket `job:cancelled` | `notifications`, `jobapplications` | Applications set to `WITHDRAWN`. |

---

## Flow 8: Emergency SOS Alert During Active Work (Re-validated Phase 7)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change & Data Integrity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 8.1 | Worker presses & holds `<SosButton>` for 2s (progress ring + vibration pulses) | Screen S1 | Client timer state | None (client memory) | Accidental taps prevented. 5-second cancel overlay triggered. |
| 8.2 | 5-second countdown overlay with optional "Contractor ko bhi batayein" toggle | Screen S2 | Client countdown | None | Worker can cancel before send. Can uncheck contractor if contractor is the threat. |
| 8.3 | Countdown ends; PWA dispatches SOS (with 4s GPS timeout fallback) | Screen S3 | `POST /incidents/sos` | `incidents`, `notifications` | Incident created (`type: "SOS"`, `severity: "CRITICAL"`, `status: "OPEN"`). **Never fails on missing GPS (`locationFlag: MISSING`)**. Idempotency key deduplicates network retries. |
| 8.4 | Instant multi-channel alert dispatch | Device / Sockets | Sockets & SMS | `incidents` | Socket `sos:alert` to Contractor, same-job Coworkers, Admins. SMS to Emergency Contact with Google Maps link. |
| 8.5 | Background location breadcrumbs stream every 15s | Screen S3 | `POST /incidents/:id/location` | `incidents` | Appends to `locationTrail` (capped at 50, min 5s interval). Responders receive `sos:location` live updates. |
| 8.6 | Escalation scheduler fires if unacknowledged | System Cron | Safety Scheduler | `incidents` | At 60s: `escalationLevel: 1`, timeline `ESCALATED_1`, re-sends SMS with latest map link. At 300s: `escalationLevel: 2`. |
| 8.7 | Alerted responder acknowledges | Screen S4 | `POST /incidents/:id/acknowledge` | `incidents`, `notifications` | Status `OPEN` -> `ACKNOWLEDGED`. Reporter notified via socket `sos:acknowledged`. |
| 8.8 | Worker reaches safety and resolves | Screen S3 | `POST /incidents/:id/resolve` | `incidents`, `auditlogs` | Status -> `RESOLVED` (`resolutionType: "SELF_SAFE"`). Socket `sos:resolved`. Immutable timeline stamped. |

---

## Flow 9: Two-Way Rating After Shift Completion (Re-validated Phase 7)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change & Data Integrity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 9.1 | Job completed or end date passed; Safety scheduler creates prompts | Background | Safety Scheduler | `notifications` | Schedulers create `RATING_REQUEST` with dedupe key `RATING_REQ:<jobId>:<userId>:<counterpartyId>`. |
| 9.2 | Contractor rates worker's trade skill (1-5 stars + tags + comment) | Screen R2 | `POST /ratings` | `ratings`, `auditlogs` | Eligibility verified (worker has >= 1 `CHECKED_OUT`). Rating created with `revealedAt: null`. **Remains blind.** |
| 9.3 | Worker checks profile / received ratings | Screen W4 | `GET /ratings/received` | None | **Zero data leak**: Unrevealed ratings omitted; recipient cannot see contractor's rating or score. |
| 9.4 | Worker rates contractor on Payment and Safety | Screen R1 | `POST /ratings` | `ratings`, `auditlogs` | Eligibility verified (settled escrow row exists). Rating created. |
| 9.5 | Atomic Double-Blind Reveal & Bayesian Smoothing | Backend | `revealIfReady()` | `ratings`, `users`, `notifications` | Both sides rated -> `revealedAt: now()`. Idempotent recalculation updates `users.ratingSummary` using Bayesian formula $(3 \times 4.0 + \sum R) / (3 + N)$. Socket `rating:revealed`. |
| 9.6 | Public Reputation Scorecard viewable | Profile / Job | `GET /users/:id/reputation` | None (read aggregation) | Displays smoothed score, badge (`NEW`/`GOOD`/`OK`/`LOW`), top tags, and escrow-backed objective payment stats. |

---

## Flow 10: Worker with Feature Phone / No Smartphone Data (SMS Fallback)

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 10.1 | Worker matches job but loses internet connection | Offline | SMS Gateway Webhook | `notifications` | Push notification fails; MSG91/Twilio fallback sends SMS: "Kaam mila Hinjawadi mein. Swikar ke liye reply karein YES 101" |
| 10.2 | Worker replies "YES 101" via basic SMS | Offline | `POST /sms/inbound` | `jobapplications` | Inbound SMS webhook parsed. Status updated to `ACCEPTED` (`notifiedVia: "sms"`) |
| 10.3 | On-site attendance verified by Contractor QR/GPS | Contractor Screen | `POST /attendance/contractor-verify` | `attendances` | Contractor scans worker offline QR token; proof logged under `method: "gps_qr"` |
| 10.4 | Payment release notification delivered via SMS | Offline | SMS Gateway | `notifications` | SMS sent: "Aapke bank account/wallet mein ₹850 jama ho gaye hain." |

---

## 11. Gaps Discovered and Fixed

During the validation of the 10 flows, the following architectural gaps were identified and resolved across the specification:

1. **Gap 1: Retaliatory Ratings in Direct Contracting**
   - *Problem*: In traditional platforms, workers hesitate to report delayed pay or safety violations because contractors immediately leave a 1-star retaliatory review.
   - *Fix (Phase 7)*: Implemented a strict **Double-Blind Rating** mechanism (`revealedAt: null`). Neither party can inspect the other's score until both have rated or the 14-day window closes.

2. **Gap 2: Small Sample Rating Inflation / Deflation**
   - *Problem*: A single 5-star rating gave a new worker a 5.0 score, ranking them above a veteran with forty 4.8-star jobs.
   - *Fix (Phase 7)*: Implemented **Bayesian Smoothing** with prior parameters $C=3$ and $M=4.0$. Aggregate score $= (3 \times 4.0 + \sum R) / (3 + N)$, and workers with $<3$ ratings are badged as `NEW`.

3. **Gap 3: Emergency SOS Failure from GPS Dropout or Network Glitches**
   - *Problem*: In basement sites or remote areas, strict GPS validation would reject SOS requests, or rapid panicked double-taps would trigger duplicate incidents.
   - *Fix (Phase 7)*: Guaranteed SOS execution with zero location prerequisites (`locationFlag: MISSING` / `STALE`). Client assigns a persistent UUID `idempotencyKey` per SOS, and server dedupes requests within 120 seconds. Offline client renders fallback `sms:` and `tel:112` links.

4. **Gap 4: Safety Reporting Against an Abusive Contractor**
   - *Problem*: If a worker is harassed by the site contractor, alerting the contractor about an SOS or incident escalates danger.
   - *Fix (Phase 7)*: Added `notifyContractor: false` toggle on SOS, and established strict `ADMIN_ONLY` visibility for `HARASSMENT` and `DISPUTE` reports so contractors never receive notifications or access to those complaints.

5. **Gap 5: Split Escrow Ledger Invariant**
   - *Problem*: In Flow 5, a split dispute settlement required distributing the locked escrow between two different recipient wallets (`WORKER_WALLET` and `CONTRACTOR_WALLET`), which could cause double-entry validation errors if not linked.
   - *Fix*: Standardized the multi-legged ledger entry structure with a single shared `groupId` and validated that the sum of debits (85,000 paise from `ESCROW_HOLD`) exactly equals the sum of credits (42,500 to worker + 42,500 to contractor).

---

**All 10 flows pass on paper and in code.**
