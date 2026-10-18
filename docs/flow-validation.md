# WorkPulse End-to-End Architectural Flow Validation

This document validates the completeness and integrity of the WorkPulse system specification across 10 critical user journeys. Each step is rigorously mapped to its designated Screen, API Endpoint, MongoDB Collection(s) modified, and Entity State Change.

---

## Flow 1: New Worker Onboarding via Voice

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1.1 | Worker opens PWA, picks Hindi language | Screen W1 | `PATCH /users/profile` | `users` | `languagePreference: "hi"` |
| 1.2 | Enters phone number | Screen W2 | `POST /auth/send-otp` | `otps` | New OTP doc created with hashed value |
| 1.3 | Enters received SMS OTP | Screen W2 | `POST /auth/verify-otp` | `otps`, `users`, `wallets` | `otps.isUsed: true`, new user created with role `worker`, empty wallet created |
| 1.4 | Taps Mic, speaks skills & experience in Hindi | Screen W3 | `POST /voice/onboard` | Microservice proxy | Voice transcribed & entity extracted |
| 1.5 | Reviews extracted skills and taps Save | Screen W3 | `PATCH /users/profile` | `users`, `auditlogs` | `skills: ["masonry"]`, `experienceYears: 5`, `isAvailable: true` |

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

## Flow 8: Emergency SOS Alert During Active Work

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 8.1 | Worker taps persistent red SOS button on site | Screen W4 | `POST /incidents/sos` | `incidents` | Incident created with `type: SOS`, `severity: CRITICAL` |
| 8.2 | Backend identifies job contractor & nearest workers | Background | Socket `sos:alert` | `incidents`, `notifications` | `alertedUsers` array populated; Contractor phone dialed via SMS |
| 8.3 | Contractor & Emergency responder acknowledge alert | Screen C3 | Socket `sos:ack` | `incidents` | Incident updated to `ACKNOWLEDGED` with responder user ID |

---

## Flow 9: Two-Way Rating After Shift Completion

| Step | Action & User Interaction | Screen | API Endpoint | Collections Touched | State Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 9.1 | Escrow reaches terminal state `RELEASED` | System | Post-payment trigger | `notifications` | Both parties prompted to submit review |
| 9.2 | Contractor rates worker 5 stars for skill | Screen C3 | `POST /ratings` | `ratings`, `users` | Rating created (`WORKER_SKILL`). Worker `ratingSummary.workerSkillAvg` recalculated. |
| 9.3 | Worker rates contractor 5 stars for safety & timely pay | Screen W4 | `POST /ratings` | `ratings`, `users` | Rating created (`CONTRACTOR_PAYMENT`). Contractor `ratingSummary.contractorPaymentAvg` recalculated. |

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

During the validation of the 10 flows, the following three architectural gaps were identified and resolved across the specification:

1. **Gap 1: Offline Worker Sign-off on Site**
   - *Problem*: In Flow 10, workers lacking cellular data could not submit GPS coordinates and selfie check-outs.
   - *Fix*: Added `qrToken` and `method: "gps_qr"` into `attendances` collection and created a contractor on-site verification endpoint `POST /attendance/contractor-verify` where the contractor's device captures the GPS coordinates and scans the worker's unique offline QR code.

2. **Gap 2: Split Escrow Ledger Invariant**
   - *Problem*: In Flow 5, a split dispute settlement required distributing the locked escrow between two different recipient wallets (`WORKER_WALLET` and `CONTRACTOR_WALLET`), which could cause double-entry validation errors if not linked.
   - *Fix*: Standardized the multi-legged ledger entry structure with a single shared `groupId` and validated that the sum of debits (85,000 paise from `ESCROW_HOLD`) exactly equals the sum of credits (42,500 to worker + 42,500 to contractor).

3. **Gap 3: Atomic Replay Protection on Auto-Approval**
   - *Problem*: Concurrent execution of system cron and manual contractor signoff could result in dual payouts.
   - *Fix*: Mandated atomic conditional updates (`findOneAndUpdate({ _id, status: "CHECKED_OUT" })`) ensuring only the first caller transitions the status.

---

**All 10 flows pass on paper.**
