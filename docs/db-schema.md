# WorkPulse – Database Schema

## Collections

### users
| Field              | Type          | Constraints              |
|--------------------|---------------|--------------------------|
| name               | String        | required                 |
| phone              | String        | required, unique         |
| role               | String        | enum: worker, contractor, admin |
| skills             | [String]      |                          |
| location           | GeoJSON Point | 2dsphere index           |
| languagePreference | String        | default: "hi"            |
| upiId              | String        |                          |
| isVerified         | Boolean       | default: false           |
| createdAt          | Date          | auto                     |

### jobs
| Field           | Type          | Constraints              |
|-----------------|---------------|--------------------------|
| contractor      | ObjectId ref  | → users                  |
| title           | String        | required                 |
| skillRequired   | String        | required                 |
| workersNeeded   | Number        | required, min: 1         |
| wagePerDay      | Number        | required, min: 0         |
| startDate       | Date          | required                 |
| endDate         | Date          | required                 |
| location        | GeoJSON Point | 2dsphere index           |
| radiusMeters    | Number        | default: 5000            |
| status          | String        | enum: draft, open, in_progress, completed, cancelled |
| assignedWorkers | [ObjectId]    | → users                  |

### attendances
| Field             | Type          | Constraints              |
|-------------------|---------------|--------------------------|
| job               | ObjectId ref  | → jobs                   |
| worker            | ObjectId ref  | → users                  |
| checkInAt         | Date          |                          |
| checkOutAt        | Date          |                          |
| checkInLocation   | GeoJSON Point |                          |
| checkOutLocation  | GeoJSON Point |                          |
| selfieUrl         | String        |                          |
| distanceFromSite  | Number        | meters                   |

### escrowTransactions
| Field           | Type          | Constraints              |
|-----------------|---------------|--------------------------|
| job             | ObjectId ref  | → jobs                   |
| contractor      | ObjectId ref  | → users                  |
| worker          | ObjectId ref  | → users                  |
| amount          | Number        | required, min: 0         |
| status          | String        | enum: see escrow-state-machine.md |
| idempotencyKey  | String        | required, unique         |
| createdAt       | Date          | auto                     |
| updatedAt       | Date          | auto                     |

### ledgerEntries
| Field        | Type          | Constraints              |
|--------------|---------------|--------------------------|
| transaction  | ObjectId ref  | → escrowTransactions     |
| type         | String        | enum: DEBIT, CREDIT      |
| account      | String        | required                 |
| amount       | Number        | required                 |
| balanceAfter | Number        | required                 |
| createdAt    | Date          | auto (append-only)       |

### ratings
| Field    | Type          | Constraints              |
|----------|---------------|--------------------------|
| job      | ObjectId ref  | → jobs                   |
| fromUser | ObjectId ref  | → users                  |
| toUser   | ObjectId ref  | → users                  |
| score    | Number        | min: 1, max: 5           |
| type     | String        | enum: worker_skill, contractor_payment_safety |
| comment  | String        |                          |

### incidents
| Field      | Type          | Constraints              |
|------------|---------------|--------------------------|
| job        | ObjectId ref  | → jobs                   |
| reportedBy | ObjectId ref  | → users                  |
| location   | GeoJSON Point |                          |
| severity   | String        | enum: low, medium, high, critical |
| type       | String        | enum: SOS, injury, dispute |
| status     | String        | enum: open, investigating, resolved, closed |
| notes      | String        |                          |

## Indexes

- `users.phone` — unique
- `users.location` — 2dsphere
- `jobs.location` — 2dsphere
- `escrowTransactions.idempotencyKey` — unique

<!-- TODO: Add compound indexes for query optimization in Phase 2+ -->
