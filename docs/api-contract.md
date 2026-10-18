# WorkPulse – API Contract

## Base URL

```
Development: http://localhost:5000/api/v1
Production:  TBD
```

## Authentication

All protected routes require:
```
Authorization: Bearer <jwt_token>
```

---

## Endpoints

### Health

| Method | Path           | Auth | Description         |
|--------|----------------|------|---------------------|
| GET    | `/health`      | No   | Service health check|

### Auth (Phase 1)

| Method | Path               | Auth | Description              |
|--------|--------------------|------|--------------------------|
| POST   | `/auth/register`   | No   | Register with phone/OTP  |
| POST   | `/auth/login`      | No   | Login with phone/OTP     |
| POST   | `/auth/refresh`    | Yes  | Refresh JWT token        |

### Users (Phase 1)

| Method | Path               | Auth | Description              |
|--------|--------------------|------|--------------------------|
| GET    | `/users/me`        | Yes  | Get current user profile |
| PATCH  | `/users/me`        | Yes  | Update profile           |

### Jobs (Phase 2)

| Method | Path               | Auth | Description              |
|--------|--------------------|------|--------------------------|
| POST   | `/jobs`            | Yes  | Create a job posting     |
| GET    | `/jobs`            | Yes  | List/search jobs         |
| GET    | `/jobs/:id`        | Yes  | Get job details          |
| PATCH  | `/jobs/:id`        | Yes  | Update job               |
| POST   | `/jobs/:id/apply`  | Yes  | Worker applies to job    |

### Attendance (Phase 4)

| Method | Path                        | Auth | Description              |
|--------|-----------------------------|------|--------------------------|
| POST   | `/attendance/check-in`      | Yes  | GPS + selfie check-in    |
| POST   | `/attendance/check-out`     | Yes  | GPS check-out            |
| GET    | `/attendance/job/:jobId`    | Yes  | Attendance for a job     |

### Escrow (Phase 3)

| Method | Path                        | Auth | Description              |
|--------|-----------------------------|------|--------------------------|
| POST   | `/escrow/fund`              | Yes  | Fund escrow for job      |
| POST   | `/escrow/release/:txnId`    | Yes  | Release payment          |
| POST   | `/escrow/dispute/:txnId`    | Yes  | Raise dispute            |
| GET    | `/escrow/status/:txnId`     | Yes  | Check escrow status      |

### Ratings (Phase 6)

| Method | Path               | Auth | Description              |
|--------|--------------------|------|--------------------------|
| POST   | `/ratings`         | Yes  | Submit a rating          |
| GET    | `/ratings/user/:id`| Yes  | Get ratings for a user   |

### Incidents (Phase 7)

| Method | Path               | Auth | Description              |
|--------|--------------------|------|--------------------------|
| POST   | `/incidents`       | Yes  | Report an incident       |
| GET    | `/incidents/:id`   | Yes  | Get incident details     |
| PATCH  | `/incidents/:id`   | Yes  | Update incident status   |

---

## Standard Response Format

```json
{
  "success": true,
  "data": {},
  "message": "Description",
  "timestamp": "ISO-8601"
}
```

## Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  },
  "timestamp": "ISO-8601"
}
```

<!-- TODO: Add request/response body schemas per endpoint in Phase 1+ -->
