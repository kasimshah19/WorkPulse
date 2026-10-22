# WorkPulse Database Index & Query Performance Audit

Audit Date: 2026-10-22T05:27:32.146Z
Database: `workpulse`

| Query | Target Model | Status | Index Used | Execution (ms) | Docs Examined | Docs Returned |
|---|---|---|---|---|---|---|
| 1. Nearby Jobs Geofence Match | `Job` | ✅ INDEXED | `location_2dsphere` | 1ms | 0 | 0 |
| 2. Worker Today Attendance | `Attendance` | ✅ INDEXED | `worker_1_date_1` | 1ms | 0 | 0 |
| 3. User Wallet Balance Lookup | `Wallet` | ✅ INDEXED | `user_1` | 1ms | 1 | 1 |
| 4. User Paginated Notifications | `Notification` | ✅ INDEXED | `user_1_createdAt_-1` | 2ms | 0 | 0 |
| 5. Refresh Token Hash Lookup | `RefreshToken` | ✅ INDEXED | `tokenHash_1` | 0ms | 0 | 0 |
| 6. Active Sessions for User | `RefreshToken` | ✅ INDEXED | `user_1_revokedAt_1` | 0ms | 0 | 0 |
| 7. Worker Escrow Milestones | `EscrowTransaction` | ✅ INDEXED | `worker_1_dayDate_-1` | 2ms | 0 | 0 |
| 8. Ledger Group Idempotency Replay | `LedgerEntry` | ✅ INDEXED | `groupId_1` | 1ms | 0 | 0 |
| 9. Wallet Ledger Statement History | `LedgerEntry` | ✅ INDEXED | `wallet_1_createdAt_-1` | 1ms | 20 | 20 |
| 10. Job Applicants for Contractor | `JobApplication` | ✅ INDEXED | `job_1_respondedAt_-1` | 2ms | 2 | 2 |
| 11. Incidents on Job by Visibility | `Incident` | ✅ INDEXED | `job_1_createdAt_-1` | 1ms | 0 | 0 |
| 12. Public Worker Ratings | `Rating` | ✅ INDEXED | `toUser_1` | 1ms | 0 | 0 |

## ✅ Index Audit PASSED: 0 COLLSCAN queries detected across all critical paths.
