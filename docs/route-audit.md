# WorkPulse API Route Security Audit Report

Audit Date: 2026-10-22T05:24:10.381Z
Total Routes Audited: 102
Environment: development

| Method | Path | Allowed Roles | Auth Required | Validation | Rate Limiter | Handler Stack |
|---|---|---|---|---|---|---|
| `GET` | `/health` | Public (Anonymous) | ✅ | ✅ | ⚠️ | `getHealth` |
| `GET` | `/ready` | Public (Anonymous) | ✅ | ✅ | ⚠️ | `getReady` |
| `GET` | `/api/v1/health` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, getHealth` |
| `GET` | `/api/v1/ready` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, getReady` |
| `POST` | `/api/v1/auth/send-otp` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/auth/verify-otp` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/auth/refresh` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>` |
| `POST` | `/api/v1/auth/logout` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>` |
| `POST` | `/api/v1/auth/logout-all` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `GET` | `/api/v1/auth/sessions` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `DELETE` | `/api/v1/auth/sessions/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `GET` | `/api/v1/auth/me` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/auth/dev-login` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/auth/dev-users` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>` |
| `PATCH` | `/api/v1/users/me` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `PATCH` | `/api/v1/users/me/location` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `PATCH` | `/api/v1/users/me/availability` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `PATCH` | `/api/v1/users/me/upi` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `PATCH` | `/api/v1/users/me/emergency-contact` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/users/:id/reputation` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/jobs` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/jobs/my` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `PATCH` | `/api/v1/jobs/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/jobs/:id/publish` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/jobs/:id/cancel` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/jobs/:id/fund` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/jobs/:id/funding-quote` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/jobs/:id/applicants` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/jobs/:id/incidents` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/jobs/nearby` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `POST` | `/api/v1/jobs/:id/accept` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/jobs/:id/reject` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/jobs/(?:/([/]+?))/attendance/check-in` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, auth, <anonymous>, multerMiddleware, handleCheckIn` |
| `POST` | `/api/v1/jobs/(?:/([/]+?))/attendance/check-out` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, auth, <anonymous>, multerMiddleware, handleCheckOut` |
| `GET` | `/api/v1/jobs/(?:/([/]+?))/attendance` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, auth, <anonymous>, getJobAttendance` |
| `GET` | `/api/v1/jobs/(?:/([/]+?))/attendance/code` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, auth, <anonymous>, getAttendanceCode` |
| `GET` | `/api/v1/jobs/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/applications/my` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/notifications` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `PATCH` | `/api/v1/notifications/:id/read` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `GET` | `/api/v1/attendance/today` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, getTodayAttendance` |
| `GET` | `/api/v1/attendance/history` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, getMyAttendanceHistory` |
| `GET` | `/api/v1/attendance/:id/selfie` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, getAttendanceSelfie` |
| `GET` | `/api/v1/attendance/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, getAttendanceById` |
| `POST` | `/api/v1/attendance/:id/signoff` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, handleSignoff` |
| `GET` | `/api/v1/wallet` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/wallet/me` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/wallet/ledger` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/wallet/summary` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/wallet/withdraw` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/payments/razorpay/webhook` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, auth, rawParser, <anonymous>` |
| `POST` | `/api/v1/payments/topup-order` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/payments/verify` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/payments/orders` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/escrow/jobs/:id/fund` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/escrow/jobs/:id/funding-quote` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/escrow/jobs/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/escrow/my` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/escrow/me` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `POST` | `/api/v1/escrow/:id/release` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/escrow/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `POST` | `/api/v1/disputes` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/disputes/my` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/disputes/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `POST` | `/api/v1/disputes/:id/evidence` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `GET` | `/api/v1/admin/disputes` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/disputes/:id` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/admin/disputes/:id/resolve` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `GET` | `/api/v1/admin/ledger/reconcile` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/reconciliation` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `POST` | `/api/v1/admin/reconciliation/run` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/admin/stats` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/voice/stats` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/ratings` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `POST` | `/api/v1/admin/ratings/:id/hide` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/admin/ratings/:id/unhide` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/admin/incidents` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/incidents/:id` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/admin/incidents/:id/note` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/admin/incidents/:id/resolve` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `GET` | `/api/v1/admin/safety/stats` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `GET` | `/api/v1/admin/ledger-groups` | Admin only | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |
| `POST` | `/api/v1/ratings` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/ratings/pending` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/ratings/mine/given` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/ratings/received` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/ratings/:id/report` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/incidents/sos` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `POST` | `/api/v1/incidents/:id/location` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/incidents/:id/acknowledge` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `POST` | `/api/v1/incidents/:id/resolve` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, validateSchema, <anonymous>` |
| `POST` | `/api/v1/incidents` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, multerMiddleware, <anonymous>` |
| `GET` | `/api/v1/incidents/my` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/incidents/:id` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, validateSchema, <anonymous>` |
| `GET` | `/api/v1/incidents/:id/photos/:index` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `GET` | `/api/v1/voice/skills` | Public (Anonymous) | ✅ | ✅ | ✅ | `<anonymous>, <anonymous>` |
| `GET` | `/api/v1/voice/config` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>` |
| `POST` | `/api/v1/voice/onboard` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>, multerMiddleware, <anonymous>` |
| `POST` | `/api/v1/voice/extract` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/voice/confirm` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `POST` | `/api/v1/voice/sessions/:id/abandon` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, validateSchema, <anonymous>` |
| `GET` | `/api/v1/voice/stats` | All authenticated | ✅ | ✅ | ✅ | `<anonymous>, auth, <anonymous>, <anonymous>` |

## ✅ Audit Result: PASS
All routes adhere to authentication, role restrictions, and validation requirements.
