# WorkPulse REST API & Real-Time Socket Contract

**Base URL**: `/api/v1`  
**Protocol**: HTTPS / WSS  
**Format**: JSON  
**Auth Scheme**: Bearer JWT (`Authorization: Bearer <accessToken>`)

---

## 1. Global Standards & Protocols

### 1.1 Response Envelope Structure

All REST responses strictly follow the standardized envelope:

#### Success Response
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

#### Paginated Success Response
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 142,
    "totalPages": 8
  },
  "error": null
}
```

#### Error Response
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "GEOFENCE_EXCEEDED",
    "message": "Check-in coordinates are 240m away from the job location (allowed: 100m)",
    "details": {
      "distanceMeters": 240,
      "allowedMeters": 100
    }
  }
}
```

---

### 1.2 Standard HTTP Status & Error Codes

| Status | Code | Meaning |
| :--- | :--- | :--- |
| `400` | `VALIDATION_ERROR` | Request body or query parameters failed Joi schema validation |
| `400` | `INVALID_OTP` | OTP is incorrect or expired |
| `400` | `PAYMENT_SIGNATURE_INVALID` | Cryptographic HMAC signature check failed on Razorpay verify or webhook |
| `400` | `INVALID_SPLIT_SUM` | Split dispute resolution sum does not match escrow amount |
| `402` | `INSUFFICIENT_BALANCE` | Wallet balance insufficient to fund job milestone or withdraw |
| `402` | `ESCROW_NOT_FUNDED` | Check-in rejected because today's escrow row is not FUNDED |
| `400` | `GEOFENCE_EXCEEDED` | GPS coordinates exceed allowed geofence boundary |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired access token |
| `401` | `TOKEN_EXPIRED` | Access token expired; use refresh token |
| `403` | `FORBIDDEN` | Role mismatch (e.g., worker accessing contractor route) |
| `404` | `NOT_FOUND` | Resource ID does not exist |
| `409` | `CONFLICT` | Resource already exists or concurrent transition blocked |
| `409` | `INVALID_TRANSITION` | Requested escrow transition is illegal from current state |
| `409` | `JOB_HAS_ACTIVE_WORK` | Job cancellation blocked due to active checked-in shifts |
| `409` | `DISPUTE_ALREADY_RESOLVED` | Dispute has already been arbitrated |
| `409` | `IDEMPOTENCY_CONFLICT` | Action already executed with identical key |
| `400` | `CONSENT_REQUIRED` | DPDP consent not granted for voice processing |
| `400` | `TRANSCRIPT_TOO_LONG` | Transcript input exceeds 500 characters |
| `400` | `INVALID_SKILLS` | Selected skills count must be 1 to 8 and belong to enum |
| `400` | `INVALID_EXPERIENCE_YEARS` | Experience years must be an integer between 0 and 50 |
| `404` | `SESSION_NOT_FOUND` | Voice session does not exist or belongs to another user |
| `409` | `SESSION_ALREADY_CONFIRMED` | Session was previously confirmed with different skills/exp |
| `413` | `AUDIO_TOO_LARGE` | Uploaded audio file exceeds 5MB size limit |
| `415` | `AUDIO_INVALID` | Magic bytes check failed (not valid WAV, WebM, Ogg, MP4, MP3) |
| `422` | `AUDIO_TOO_LONG` | Audio duration exceeds 30 seconds limit |
| `422` | `NO_SPEECH_DETECTED` | Audio contains only silence or hallucinated tokens |
| `502` | `STT_FAILED` | Upstream speech-to-text transcription engine failed |
| `503` | `VOICE_UNAVAILABLE` | Voice service degraded or offline (carries fallback: "icons") |
| `504` | `STT_TIMEOUT` | STT processing exceeded timeout limit |
| `409` | `RATING_NOT_OPEN` | Job has not completed or endDate has not arrived yet |
| `409` | `RATING_WINDOW_CLOSED` | Rating submission window has closed (14 days past job end) |
| `409` | `ALREADY_RATED` | A rating of this type has already been submitted for this counterparty on this job |
| `403` | `NOT_JOB_PARTICIPANT` | User was neither assigned worker nor contractor on this job |
| `404` | `INCIDENT_NOT_FOUND` | Incident with given ID does not exist |
| `409` | `INCIDENT_CLOSED` | Cannot update location or modify already resolved incident |
| `403` | `NOT_ALERTED_USER` | Only alerted responders or admins can acknowledge or resolve an incident |
| `429` | `RATE_LIMIT_EXCEEDED` | Too many requests within rate limit window |
| `500` | `INTERNAL_SERVER_ERROR` | Unhandled server exception |

---

## 2. API Endpoint Groups

### 2.1 Authentication & Session (`/auth`)

#### 1. Send OTP
- **Method & Path**: `POST /auth/send-otp`
- **Auth**: Public
- **Phase**: Phase 3 (Implemented)
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "purpose": "login"
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "phone": "+919876543210",
      "expiresInSeconds": 300,
      "purpose": "login"
    },
    "error": null
  }
  ```
- **Errors**: `400 VALIDATION_ERROR`, `429 RATE_LIMIT_EXCEEDED`

#### 2. Verify OTP
- **Method & Path**: `POST /auth/verify-otp`
- **Auth**: Public
- **Phase**: Phase 3 (Implemented)
- **Request Body**:
  ```json
  {
    "phone": "+919876543210",
    "otp": "482910",
    "name": "Ramesh Kumar",
    "role": "worker"
  }
  ```
- **Success Response (200 OK)**:
  - **Headers**: `Set-Cookie: refreshToken=<token>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800`
  - **Response Body**:
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "652a101bcf12",
        "phone": "+919876543210",
        "role": "worker",
        "name": "Ramesh Kumar",
        "isNewUser": false
      },
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 900,
      "isNewUser": false
    },
    "error": null
  }
  ```
- **Errors**: `400 INVALID_OTP`, `400 OTP_EXPIRED`

#### 3. Refresh Access Token
- **Method & Path**: `POST /auth/refresh`
- **Auth**: Public (Requires `httpOnly` `refreshToken` cookie or body `{ refreshToken }`)
- **Phase**: Phase 8 (Implemented)
- **Success Response (200 OK)**:
  - **Headers**: `Set-Cookie: refreshToken=<newRotatedToken>; HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth; Max-Age=604800`
  - **Response Body**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "eyJhbGciOi...",
      "expiresIn": 900
    },
    "error": null
  }
  ```
- **Errors**: `401 TOKEN_MISSING`, `401 TOKEN_EXPIRED`, `401 TOKEN_REVOKED_REUSE_DETECTED`

#### 4. Logout (Current Session)
- **Method & Path**: `POST /auth/logout`
- **Auth**: Public / Authenticated (Clears `refreshToken` cookie and marks session revoked)
- **Phase**: Phase 8 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Logged out successfully"
    },
    "error": null
  }
  ```

#### 5. Logout All Devices
- **Method & Path**: `POST /auth/logout-all`
- **Auth**: Authenticated (Bearer Token)
- **Phase**: Phase 8 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "revokedCount": 3,
      "message": "All sessions terminated successfully"
    },
    "error": null
  }
  ```

#### 6. List Active Sessions
- **Method & Path**: `GET /auth/sessions`
- **Auth**: Authenticated (Bearer Token)
- **Phase**: Phase 8 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "670f...1a",
        "device": "Mozilla/5.0 (Linux; Android 14; Pixel 7)",
        "ip": "103.21.124.5",
        "createdAt": "2026-10-22T04:30:00.000Z",
        "isCurrent": true
      }
    ],
    "error": null
  }
  ```

#### 7. Revoke Specific Session
- **Method & Path**: `DELETE /auth/sessions/:id`
- **Auth**: Authenticated (Bearer Token)
- **Phase**: Phase 8 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "message": "Session revoked"
    },
    "error": null
  }
  ```

#### 8. Get Current User (`me`)
- **Method & Path**: `GET /auth/me`
- **Auth**: Authenticated (Bearer Token)
- **Phase**: Phase 3 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "id": "652a101bcf12",
      "phone": "+919876543210",
      "role": "worker",
      "name": "Ramesh Kumar",
      "languagePreference": "hi",
      "isAvailable": true
    },
    "error": null
  }
  ```

#### 9. Dev Login & Dev Users (Dev Mode Only)
- **Method & Path**: `POST /auth/dev-login` & `GET /auth/dev-users`
- **Auth**: Public (Mounted only when `OTP_DEV_MODE=true` and `NODE_ENV!=production`)
- **Phase**: Phase 3 (Implemented)

---

### 2.2 Users & Profile (`/users`)

#### 1. Update Profile
- **Method & Path**: `PATCH /users/me`
- **Auth**: Authenticated
- **Phase**: Phase 3 (Implemented)
- **Request Body**:
  ```json
  {
    "name": "Ramesh Babu Kumar",
    "languagePreference": "hi",
    "skills": ["painter"],
    "experienceYears": 6,
    "address": "Shivajinagar, Pune, Maharashtra"
  }
  ```

#### 2. Update Location
- **Method & Path**: `PATCH /users/me/location`
- **Auth**: Authenticated
- **Phase**: Phase 3 (Implemented)
- **Request Body**:
  ```json
  {
    "lat": 18.5204,
    "lng": 73.8567
  }
  ```
- **Note**: Coordinates stored in MongoDB GeoJSON format as `[lng, lat]`.

#### 3. Set Worker Availability
- **Method & Path**: `PATCH /users/me/availability`
- **Auth**: Worker
- **Phase**: Phase 3 (Implemented)
- **Request Body**: `{ "isAvailable": true }`

---

### 2.3 Voice Microservice (`/voice`)

#### 1. Voice Onboard Proxy
- **Method & Path**: `POST /voice/onboard`
- **Auth**: Public or Worker
- **Phase**: Phase 6
- **Body**: `multipart/form-data` (audio file: wav/webm/mp3)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "transcript": "Mera naam Ramesh hai, main 5 saal se mistri ka kaam karta hu",
      "extracted": {
        "name": "Ramesh",
        "skills": ["masonry"],
        "experienceYears": 5,
        "language": "hi"
      },
      "confidence": 0.94
    },
    "error": null
  }
  ```

#### 2. Get Voice Skills Taxonomy
- **Method & Path**: `GET /voice/skills`
- **Auth**: Public
- **Phase**: Phase 6
- **Success Response**: Returns canonical skill names and localized Hindi/Marathi audio prompts.

---

### 2.4 Jobs Management (`/jobs`)

#### 1. Create Job (Draft)
- **Method & Path**: `POST /jobs`
- **Auth**: Contractor
- **Phase**: Phase 3 (Implemented)
- **Request Body**:
  ```json
  {
    "title": "Wall Painting for Residential Villa",
    "description": "2 BHK painting work",
    "skillRequired": "painter",
    "workersNeeded": 2,
    "wagePerDayPaise": 70000,
    "startDate": "2026-10-20T03:30:00.000Z",
    "endDate": "2026-10-22T12:30:00.000Z",
    "workingHours": { "start": "09:00", "end": "18:00" },
    "location": { "lat": 18.5204, "lng": 73.8567 },
    "addressText": "Plot 42, Hinjawadi Phase 2, Pune",
    "geofenceRadiusMeters": 100,
    "matchRadiusKm": 5,
    "requiresSelfie": true
  }
  ```
- **Success Response (201 Created)**: Returns created Job with status `DRAFT`.

#### 2. Update Job
- **Method & Path**: `PATCH /jobs/:id`
- **Auth**: Contractor (Owner only, allowed when DRAFT or OPEN with 0 assigned)
- **Phase**: Phase 3 (Implemented)

#### 3. Publish Job (Triggers Geo-matching Broadcast)
- **Method & Path**: `POST /jobs/:id/publish`
- **Auth**: Contractor (Owner only)
- **Phase**: Phase 3 (Implemented)
- **Success Response**: Returns `{ "job": { ... }, "matching": { "notified": 4, "viaSocket": 2, "viaSms": 2 } }`. Idempotent.

#### 4. Contractor: My Jobs
- **Method & Path**: `GET /jobs/my`
- **Auth**: Contractor
- **Query Params**: `status`, `page`, `limit`
- **Phase**: Phase 3 (Implemented)
- **Success Response**: Paginated array with counts (`notified`, `accepted`, `rejected`).

#### 5. Nearby Jobs for Worker
- **Method & Path**: `GET /jobs/nearby`
- **Auth**: Worker
- **Query Params**: `radiusKm`, `skill`
- **Phase**: Phase 3 (Implemented)
- **Success Response**: Aggregation via `$geoNear` returning nearby open matching jobs with `distanceMeters`.

#### 6. Get Job Details
- **Method & Path**: `GET /jobs/:id`
- **Auth**: Authenticated (Owner, assigned worker, or notified worker)
- **Phase**: Phase 3 (Implemented)

#### 7. Contractor: List Job Applicants
- **Method & Path**: `GET /jobs/:id/applicants`
- **Auth**: Contractor (Owner only)
- **Phase**: Phase 3 (Implemented)

#### 8. Cancel Job
- **Method & Path**: `POST /jobs/:id/cancel`
- **Auth**: Contractor (Owner only)
- **Phase**: Phase 3 (Implemented)

---

### 2.5 Job Applications & Hiring (`/jobs` & `/applications`)

#### 1. Worker Accept Match (Atomic Assignment)
- **Method & Path**: `POST /jobs/:id/accept`
- **Auth**: Worker
- **Phase**: Phase 3 (Implemented)
- **Concurrency**: Guaranteed safe using atomic `$inc: { workersAssignedCount: 1 }` with `$lt: workersNeeded`. Returns `409 JOB_FILLED` if already full. Idempotent.

#### 2. Worker Reject Match
- **Method & Path**: `POST /jobs/:id/reject`
- **Auth**: Worker
- **Phase**: Phase 3 (Implemented)

#### 3. Worker My Applications
- **Method & Path**: `GET /applications/my`
- **Auth**: Worker
- **Phase**: Phase 3 (Implemented)

---

### 2.6 Daily Attendance & Proof-of-Work (`/attendance`, `/jobs/:id/attendance`)

#### 1. Worker Check-in
- **Method & Path**: `POST /jobs/:id/attendance/check-in`
- **Auth**: Worker (Assigned to Job)
- **Phase**: Phase 4 (Implemented)
- **Content-Type**: `multipart/form-data`
- **Request Fields**:
  - `lat`: Number (-90 to 90)
  - `lng`: Number (-180 to 180)
  - `accuracy`: Number (meters, must be >= 0)
  - `clientTimestamp`: ISO Date string
  - `method`: String enum (`gps_selfie` | `gps_qr`)
  - `selfie`: Binary image file (Required when `method=gps_selfie` and `job.requiresSelfie=true`, max 2MB, JPEG/PNG magic bytes verified)
  - `code`: String (6 digits, required when `method=gps_qr`)
  - `deviceInfo`: JSON string (optional: `{ userAgent, platform, screen }`)
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "data": {
      "attendance": {
        "_id": "671230000000000000000006",
        "job": "671230000000000000000004",
        "worker": "671230000000000000000001",
        "date": "2026-10-19",
        "status": "CHECKED_IN",
        "checkInAt": "2026-10-19T03:32:00.000Z",
        "checkInDistanceMeters": 24,
        "checkInAccuracyM": 8,
        "selfieUrl": "/api/v1/attendance/671230000000000000000006/selfie",
        "method": "gps_selfie",
        "flags": [],
        "hoursWorked": 0
      }
    },
    "error": null
  }
  ```
- **Error Codes**:
  - `400 CLOCK_MISMATCH`: Client timestamp differs from server time by >120s
  - `403 NOT_ASSIGNED`: Worker does not have an `ASSIGNED` application for this job
  - `409 JOB_NOT_ACTIVE`: Job status is not `FILLED` or `IN_PROGRESS`
  - `409 OUTSIDE_JOB_DATES`: Today is outside the job's `startDate` and `endDate`
  - `409 OUTSIDE_WORKING_HOURS`: Current time is before `workingHours.start - 30m` or after `workingHours.end`
  - `409 ALREADY_CHECKED_IN`: Worker already checked in today (returns existing `attendanceId` in details)
  - `422 LOW_ACCURACY`: Reported GPS accuracy > 50m
  - `422 SUSPICIOUS_LOCATION`: Implied speed from previous attendance > 150 km/h (impossible jump)
  - `422 OUTSIDE_GEOFENCE`: Distance from site exceeds `job.geofenceRadiusMeters` (returns `{ distanceMeters, allowedMeters }`)
  - `422 INVALID_CODE`: Invalid 6-digit daily code for `gps_qr` method
  - `422 SELFIE_REQUIRED`: Missing selfie file when required
  - `400 INVALID_FILE_TYPE`: Uploaded file is not genuine JPEG/PNG magic bytes or > 2MB

#### 2. Worker Check-out
- **Method & Path**: `POST /jobs/:id/attendance/check-out`
- **Auth**: Worker (Must be currently `CHECKED_IN`)
- **Phase**: Phase 4 (Implemented)
- **Content-Type**: `multipart/form-data`
- **Request Fields**:
  - `lat`: Number
  - `lng`: Number
  - `accuracy`: Number
  - `clientTimestamp`: ISO Date string
  - `selfie`: Binary image file (optional checkout photo)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "attendance": {
        "_id": "671230000000000000000006",
        "status": "CHECKED_OUT",
        "checkOutAt": "2026-10-19T12:35:00.000Z",
        "checkOutDistanceMeters": 28,
        "hoursWorked": 9.05,
        "contractorSignoff": { "status": "PENDING" }
      }
    },
    "error": null
  }
  ```
- **Error Codes**:
  - `409 NOT_CHECKED_IN`: No active `CHECKED_IN` record found for today
  - `409 ALREADY_CHECKED_OUT`: Already checked out today

#### 3. Contractor Attendance Sign-off
- **Method & Path**: `POST /attendance/:id/signoff`
- **Auth**: Contractor (Job owner)
- **Phase**: Phase 4 (Implemented; escrow release triggers in Phase 5)
- **Request Body**:
  ```json
  {
    "decision": "APPROVED"
  }
  ```
  *(Or `{ "decision": "DISPUTED", "reason": "Left 3 hours before shift end" }` with minimum 5 characters reason)*
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "attendance": {
        "_id": "671230000000000000000006",
        "status": "CHECKED_OUT",
        "contractorSignoff": {
          "status": "APPROVED",
          "at": "2026-10-19T13:00:00.000Z",
          "by": "671230000000000000000099"
        }
      }
    },
    "error": null
  }
  ```
- **Error Codes**:
  - `403 NOT_AUTHORIZED`: User is not the contractor of this job
  - `409 SIGNOFF_NOT_PENDING`: Attendance is not in `CHECKED_OUT` state or signoff is already completed

#### 4. Contractor: Get Job Attendance Daily List
- **Method & Path**: `GET /jobs/:id/attendance?date=YYYY-MM-DD&page=1&limit=50`
- **Auth**: Job Contractor or Admin
- **Phase**: Phase 4 (Implemented)
- **Success Response (200 OK)**:
  Returns list of attendances including workers assigned who have not yet checked in (`status: "NOT_STARTED"`).

#### 5. Contractor: Get Job Daily Attendance Code
- **Method & Path**: `GET /jobs/:id/attendance/code`
- **Auth**: Job Contractor
- **Phase**: Phase 4 (Implemented)
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "code": "481923",
      "validForDate": "2026-10-19",
      "expiresAt": "2026-10-19T23:59:59.999+05:30",
      "qrPayload": "workpulse:attendance:671230000000000000000004:481923"
    },
    "error": null
  }
  ```

#### 6. Worker: Get Today's Assigned Jobs & Attendance Status
- **Method & Path**: `GET /attendance/today`
- **Auth**: Worker
- **Phase**: Phase 4 (Implemented)
- **Success Response (200 OK)**:
  Returns active jobs for today with worker's current attendance state (`NOT_STARTED` | `CHECKED_IN` | `CHECKED_OUT` | `MISSED`), site coordinates, geofence radius, and working hours.

#### 7. Worker: Attendance History
- **Method & Path**: `GET /attendance/history?page=1&limit=20`
- **Auth**: Worker
- **Phase**: Phase 4 (Implemented)

#### 8. Attendance Detail & Secure Selfie Serving
- **Method & Path**: `GET /attendance/:id`
  - **Auth**: Worker owner, Job contractor, Admin
- **Method & Path**: `GET /attendance/:id/selfie`
  - **Auth**: Worker owner, Job contractor, Admin (serves raw binary stream with `image/jpeg` or `image/png` and Cache-Control headers; direct static access to disk is prohibited)

---

### 2.7 Escrow & Wallet Operations (`/escrow`, `/wallets`)

#### 1. Get Wallet Balance
- **Method & Path**: `GET /wallets/me`
- **Auth**: Authenticated
- **Phase**: Phase 5
- **Success Response**:
  ```json
  {
    "success": true,
    "data": {
      "balancePaise": 240000,
      "lockedPaise": 85000,
      "currency": "INR",
      "status": "active"
    },
    "error": null
  }
  ```

#### 2. Contractor: Create Razorpay Funding Order
- **Method & Path**: `POST /escrow/create-order`
- **Auth**: Contractor
- **Phase**: Phase 5
- **Request Body**:
  ```json
  {
    "jobId": "652a9010ab34",
    "dayDate": "2026-10-20",
    "workerId": "652a101bcf12"
  }
  ```
- **Success Response**: Returns `razorpayOrderId`, `amountPaise: 85000`, `currency: "INR"`.

#### 3. Verify Razorpay Payment / Fund Escrow
- **Method & Path**: `POST /escrow/verify-payment`
- **Auth**: Contractor
- **Phase**: Phase 5
- **Request Body**:
  ```json
  {
    "razorpayOrderId": "order_OD123",
    "razorpayPaymentId": "pay_PY456",
    "razorpaySignature": "9a8b7c..."
  }
  ```
- **Success Response**: Escrow state transitions to `FUNDED`; Contractor locked ledger updated.

#### 4. Webhook: Razorpay Callback
- **Method & Path**: `POST /escrow/webhook`
- **Auth**: Public (Razorpay HMAC signature verified in header `X-Razorpay-Signature`)
- **Phase**: Phase 5

#### 5. Contractor: Approve Escrow Release
- **Method & Path**: `POST /escrow/:transactionId/approve`
- **Auth**: Contractor
- **Phase**: Phase 5
- **Request Body**: `{ "idempotencyKey": "APPROVE_TX90_USR1" }`
- **Success Response**: Escrow transitions to `RELEASED`; Worker wallet credited.

#### 6. Ledger History
- **Method & Path**: `GET /wallets/ledger`
- **Auth**: Authenticated
- **Phase**: Phase 5
- **Success Response**: Paginated list of user's debit/credit ledger records.

---

### 2.8 Disputes (`/disputes`)

#### 1. Raise Dispute
- **Method & Path**: `POST /disputes`
- **Auth**: Authenticated (Contractor or Worker)
- **Phase**: Phase 6
- **Request Body**:
  ```json
  {
    "escrowTransactionId": "652b1928dd45",
    "reason": "WAGE_MISMATCH",
    "description": "Contractor promised ₹900 but set wage at ₹800",
    "evidence": [
      { "type": "note", "url": "Agreed verbally at gate" }
    ]
  }
  ```
- **Success Response (201 Created)**: Returns dispute ID with status `OPEN`.

#### 2. Admin: Resolve Dispute
- **Method & Path**: `POST /admin/disputes/:id/resolve`
- **Auth**: Admin
- **Phase**: Phase 6
- **Request Body**:
  ```json
  {
    "resolutionType": "SPLIT",
    "workerAmountPaise": 50000,
    "contractorRefundPaise": 35000,
    "notes": "Work partially done, fair split based on 5 hours worked"
  }
  ```
- **Success Response**: Dispute resolved; ledger entries posted; escrow marked `RELEASED`.

---

### 2.9 Ratings (`/ratings`)

#### 1. Submit Rating
- **Method & Path**: `POST /ratings`
- **Auth**: Authenticated
- **Phase**: Phase 6
- **Request Body**:
  ```json
  {
    "jobId": "652a9010ab34",
    "toUser": "652a101bcf12",
    "type": "WORKER_SKILL",
    "score": 5,
    "comment": "Boht badhiya kaam kiya, time pe aaya"
  }
  ```

---

### 2.10 Incidents & SOS (`/incidents`)

#### 1. Trigger Emergency SOS
- **Method & Path**: `POST /incidents/sos`
- **Auth**: Worker / Contractor
- **Phase**: Phase 6
- **Request Body**:
  ```json
  {
    "jobId": "652a9010ab34",
    "longitude": 73.8569,
    "latitude": 18.5205,
    "description": "Site scaffolding collapsed near north gate"
  }
  ```
- **Success Response (201 Created)**: Returns incident ID with `severity: "CRITICAL"`, emits real-time broadcast.

---

### 2.11 Notifications (`/notifications`)

#### 1. List Notifications
- **Method & Path**: `GET /notifications`
- **Auth**: Authenticated
- **Phase**: Phase 3 (Implemented)
- **Success Response**: Paginated notification array.

#### 2. Mark Notification Read
- **Method & Path**: `PATCH /notifications/:id/read`
- **Auth**: Authenticated
- **Phase**: Phase 3 (Implemented)

---

### 2.12 Wallet & Double-Entry Ledger (`/wallet`)

#### 1. Get Wallet Balance
- **Method & Path**: `GET /wallet` (or `GET /wallet/me`)
- **Auth**: Authenticated User
- **Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "balancePaise": 500000,
    "lockedPaise": 80000,
    "totalPaise": 580000,
    "currency": "INR",
    "status": "active"
  }
}
```

#### 2. Get Wallet Ledger Entries
- **Method & Path**: `GET /wallet/ledger?page=1&limit=20`
- **Auth**: Authenticated User
- **Success Response (200)**: Paginated array of immutable `LedgerEntry` items for the user's wallet with human-readable description and balanceAfterPaise.

#### 3. Get Wallet Summary
- **Method & Path**: `GET /wallet/summary`
- **Auth**: Authenticated User
- **Success Response (200)**:
  - Worker: today's earnings, pending (CHECKED_OUT/APPROVED) amount, released total.
  - Contractor: locked in escrow, total spent, available balance.

#### 4. Withdraw Funds to UPI
- **Method & Path**: `POST /wallet/withdraw`
- **Auth**: Role `worker`
- **Body**: `{ "amountPaise": 50000, "idempotencyKey": "uuid-v4" }`
- **Success Response (200)**: Payout record with status `SUCCESS` or `PENDING` and simulated UTR reference.

---

### 2.13 Payments & Gateway Top-ups (`/payments`)

#### 1. Create Top-up Order
- **Method & Path**: `POST /payments/topup-order`
- **Auth**: Role `contractor`
- **Body**: `{ "amountPaise": 500000 }` (min: 10,000, max: 5,000,000 paise)
- **Success Response (200)**:
```json
{
  "success": true,
  "data": {
    "orderId": "order_mock_123456",
    "amountPaise": 500000,
    "currency": "INR",
    "keyId": "rzp_test_public_key",
    "provider": "mock"
  }
}
```

#### 2. Verify Payment Signature
- **Method & Path**: `POST /payments/verify`
- **Auth**: Role `contractor`
- **Body**: `{ "orderId": "order_mock_123456", "paymentId": "pay_mock_789", "signature": "hmac_hex" }`
- **Success Response (200)**: Verifies cryptographic signature server-side and credits contractor wallet once via `TOPUP:<paymentId>` ledger group.

#### 3. Razorpay Webhook
- **Method & Path**: `POST /payments/razorpay/webhook`
- **Auth**: Public route; verified using `X-Razorpay-Signature` HMAC-SHA256 over raw JSON payload.
- **Success Response (200)**: Credits contractor wallet idempotently; returns 200 immediately.

#### 4. List Payment Orders
- **Method & Path**: `GET /payments/orders`
- **Auth**: Authenticated contractor (paginated history of top-up orders).

---

### 2.14 Escrow Operations (`/escrow`)

#### 1. Fund Job Escrow
- **Method & Path**: `POST /escrow/jobs/:id/fund`
- **Auth**: Role `contractor` (job owner)
- **Success Response (200)**: Locks funds for all pending `CREATED` escrow rows of the job in one atomic database transaction. Returns funded rows count and total paise locked.
- **Errors**: `402 INSUFFICIENT_BALANCE` if contractor balance < required.

#### 2. Get Job Funding Quote
- **Method & Path**: `GET /escrow/jobs/:id/funding-quote`
- **Auth**: Role `contractor`, `admin`
- **Success Response (200)**: `{ jobId, pendingDaysCount, wagePerDayPaise, requiredPaise, walletBalancePaise, shortfallPaise, canFund }`.

#### 3. Get Job Escrow Rows
- **Method & Path**: `GET /escrow/jobs/:id`
- **Auth**: Role `contractor`, `admin`
- **Success Response (200)**: All daily escrow rows for the job with status breakdown and financial totals (`totalPaise`, `fundedPaise`, `lockedPaise`, `releasedPaise`, `refundedPaise`, `pendingFundingPaise`).

#### 4. Get My Escrows
- **Method & Path**: `GET /escrow/my` (or `GET /escrow/me`)
- **Auth**: Authenticated worker or contractor
- **Success Response (200)**: Returns user's daily escrow rows with statuses and populated job metadata.

#### 5. Get Escrow Detail
- **Method & Path**: `GET /escrow/:id`
- **Auth**: Participant (worker, contractor) or `admin`
- **Success Response (200)**: Escrow document with full `statusHistory` audit trail.

---

### 2.15 Disputes & Arbitration (`/disputes`)

#### 1. Raise Dispute
- **Method & Path**: `POST /disputes`
- **Auth**: Participant (worker or contractor)
- **Body**: `{ "escrowTransactionId": "...", "reason": "NOT_APPROVED", "description": "..." }`
- **Success Response (201)**: Creates dispute with auto-collected proof (attendance, GPS, selfie, audit logs).

#### 2. Get My Disputes
- **Method & Path**: `GET /disputes/my`
- **Auth**: Authenticated user (disputes where user is raisedBy or against).

#### 3. Get Dispute Detail
- **Method & Path**: `GET /disputes/:id`
- **Auth**: Participant or admin. Returns evidence timeline and arbitration status.

#### 4. Append Dispute Evidence
- **Method & Path**: `POST /disputes/:id/evidence`
- **Auth**: Participant or admin
- **Body**: `{ "type": "note", "refId": "Note text...", "url": "..." }`
- **Success Response (200)**: Appends note or photo evidence to open dispute.

---

### 2.16 Admin Governance (`/admin`)

- `GET /admin/disputes?status=OPEN`: Dispute triage queue sorted by oldest first.
- `GET /admin/disputes/:id`: Complete evidence bundle (attendance, authenticated selfie URL, GPS logs, rejected checkin attempts).
- `POST /admin/disputes/:id/resolve`: Arbitrate dispute (`FOR_WORKER`, `FOR_CONTRACTOR`, `SPLIT`).
- `GET /admin/ledger/reconcile`: 5-invariant double-entry reconciliation report (`PASS` / `FAIL`).
- `GET /admin/stats`: Financial platform KPIs (topups total, locked escrow, released total, open disputes).
- `GET /admin/voice/stats`: Voice onboarding analytics (voice vs icon share, fallback rate, provider latency, precision and recall over confirmed sessions, language breakdown).

---

### 2.17 Dev Endpoints (`/dev`) (NODE_ENV != 'production' only)

- `POST /dev/wallet/topup`: Instant developer credit of ₹5,000 to contractor wallet via double-entry ledger.
- `POST /dev/escrow/:id/expire-approval`: Backdates `autoApprovalAt` to test scheduler auto-approval.
- `POST /dev/scheduler/run`: Manually triggers background cron batch (autoApprove, retryPayouts, expireTopups).

---

### 2.18 Voice Onboarding (`/voice`) - Phase 6 (Implemented)

#### 1. Public Skills Catalog
- **Method & Path**: `GET /voice/skills`
- **Auth**: Public
- **Description**: Returns all 16 canonical skills with English, Hindi, Marathi labels, and Lucide icon mappings.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": [
      {
        "key": "painter",
        "labelEn": "Painter (Rangai)",
        "labelHi": "पेंटर (रंग काम)",
        "labelMr": "रंगारी (पेंटर)",
        "icon": "Paintbrush"
      }
    ],
    "error": null
  }
  ```

#### 2. Client Voice Configuration
- **Method & Path**: `GET /voice/config`
- **Auth**: Authenticated User
- **Description**: Returns client runtime voice configuration, active STT provider, health status, and supported languages.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "enabled": true,
      "serverSttAvailable": true,
      "sttProvider": "mock",
      "maxSeconds": 30,
      "maxBytes": 5242880,
      "languages": [
        { "code": "hi", "label": "हिंदी (Hindi)", "speechLang": "hi-IN" },
        { "code": "mr", "label": "मराठी (Marathi)", "speechLang": "mr-IN" },
        { "code": "en", "label": "English", "speechLang": "en-IN" }
      ],
      "consentVersion": "v1"
    },
    "error": null
  }
  ```

#### 3. Voice Onboarding Audio Ingestion (Server Audio Path)
- **Method & Path**: `POST /voice/onboard`
- **Auth**: Worker Only
- **Content-Type**: `multipart/form-data`
- **Rate Limit**: 10 requests / user / hour
- **Fields**:
  - `audio`: Audio file binary (WAV, WebM, Ogg, MP4, MP3 up to 5MB)
  - `language`: `hi` | `mr` | `en` | `auto`
  - `consent`: `"true"` (DPDP requirement)
  - `durationMs`: Client duration hint in ms (optional)
- **Security & Privacy**: Audio processed entirely in-memory and never written to disk or database.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "671240000000000000000001",
      "transcript": "main painter hoon 5 saal ka experience hai",
      "language": "hi",
      "skills": [{ "key": "painter", "confidence": 0.95, "matchedText": "painter" }],
      "suggestions": [],
      "experienceYears": 5,
      "flags": []
    },
    "error": null
  }
  ```

#### 4. WebSpeech Transcript Extraction (WebSpeech Path)
- **Method & Path**: `POST /voice/extract`
- **Auth**: Worker Only
- **Content-Type**: `application/json`
- **Rate Limit**: 30 requests / user / hour
- **Request Body**:
  ```json
  {
    "transcript": "main painter hoon 5 saal ka experience hai",
    "language": "hi",
    "consent": true,
    "source": "webspeech"
  }
  ```
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "671240000000000000000002",
      "transcript": "main painter hoon 5 saal ka experience hai",
      "language": "hi",
      "skills": [{ "key": "painter", "confidence": 0.95, "matchedText": "painter" }],
      "suggestions": [],
      "experienceYears": 5,
      "flags": []
    },
    "error": null
  }
  ```

#### 5. Confirm Skills & Experience (Draft Finalization)
- **Method & Path**: `POST /voice/confirm`
- **Auth**: Worker Only
- **Description**: The ONLY voice endpoint that writes skills and experience to the `User` document.
- **Request Body**:
  ```json
  {
    "sessionId": "671240000000000000000001", // Optional for icon fallback
    "skills": ["painter"],
    "experienceYears": 5,
    "method": "SERVER_AUDIO" // or "WEBSPEECH_TEXT" or "ICON_FALLBACK"
  }
  ```
- **Idempotency**: Confirming an already confirmed session with the same payload returns identical `200`; different payload returns `409 SESSION_ALREADY_CONFIRMED`.
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "session": { ... },
      "user": {
        "id": "67123...",
        "name": "Test Fresh Worker",
        "skills": ["painter"],
        "experienceYears": 5,
        "profileComplete": false // true once non-zero location is set
      }
    },
    "error": null
  }
  ```

#### 6. Abandon Session
- **Method & Path**: `POST /voice/sessions/:id/abandon`
- **Auth**: Worker Only
- **Success Response (200)**:
  ```json
  {
    "success": true,
    "data": {
      "sessionId": "671240000000000000000001",
      "status": "ABANDONED"
    },
    "error": null
  }
  ```

---

## 3. Real-Time Socket.io Contract

### 3.1 Room Architecture Strategy

| Room Pattern | Description | Who Joins | Phase |
| :--- | :--- | :--- | :--- |
| `user:{userId}` | Private user room for personalized alerts and job matches | Connected User | Phase 3 (Implemented) |
| `role:{role}` | Role channel (worker/contractor) | Connected User by Role | Phase 3 (Implemented) |
| `job:{jobId}` | Active job channel for shift updates | Contractor & Assigned Workers | Phase 4 |
| `geo:{h3OrTileId}` | Geographic dispatch channel | Workers available in that grid tile | Phase 4 |
| `admin:disputes` | Real-time incident & dispute triage | Platform Admins | Phase 6 |

---

### 3.2 Socket Event Catalog

#### Client to Server (`client -> server`)

```typescript
// 1. Acknowledge receipt of new job alert (cancels SMS fallback timer) - Phase 3 (Implemented)
socket.emit("job:received", { jobId: "652a9010ab34" });

// 2. Worker live GPS heartbeat while on active shift - Phase 4
socket.emit("worker:location_update", {
  jobId: "652a9010ab34",
  longitude: 73.8567,
  latitude: 18.5204,
  accuracy: 8.2
});

// 3. Acknowledge incident / SOS broadcast - Phase 7
socket.emit("sos:ack", { incidentId: "652c7890aa" });
```

#### Server to Client (`server -> client`)

```typescript
// 1. New Job Match Broadcast (to room user:<id>) - Phase 3 (Implemented)
socket.on("job:new", {
  jobId: "652a9010ab34",
  title: "Wall Painting for Residential Villa",
  skillRequired: "painter",
  wagePerDayPaise: 70000,
  distanceMeters: 1400,
  startDate: "2026-10-20T03:30:00.000Z",
  endDate: "2026-10-22T12:30:00.000Z",
  addressText: "Plot 42, Hinjawadi Phase 2, Pune"
});

// 2. Worker Assigned Alert (to accepted worker) - Phase 3 (Implemented)
socket.on("job:assigned", { jobId: "652a9010ab34" });

// 3. Job Filled Alert (to expired/unassigned applicants) - Phase 3 (Implemented)
socket.on("job:filled", { jobId: "652a9010ab34" });

// 4. Job Cancelled Alert (to notified/assigned workers) - Phase 3 (Implemented)
socket.on("job:cancelled", { jobId: "652a9010ab34" });

// 5. Applicant Accepted (to contractor room) - Phase 3 (Implemented)
socket.on("applicant:accepted", {
  jobId: "652a9010ab34",
  workerId: "652a101bcf12",
  workerName: "Ramesh Kumar",
  assignedCount: 1,
  workersNeeded: 2
});

// 6. Applicant Rejected Count Update (to contractor room) - Phase 3 (Implemented)
socket.on("applicant:rejected", {
  jobId: "652a9010ab34",
  rejectedCount: 1
});

// 7. Worker Checked In Alert - Phase 4 (Implemented)
socket.on("attendance:checkedIn", {
  attendanceId: "671230000000000000000006",
  jobId: "652a9010ab34",
  workerId: "652a101bcf12",
  workerName: "Ramesh Kumar",
  checkInAt: "2026-10-20T08:58:12Z",
  distanceMeters: 24,
  method: "gps_selfie",
  flags: []
});

// 8. Worker Checked Out Alert - Phase 4 (Implemented)
socket.on("attendance:checkedOut", {
  attendanceId: "671230000000000000000006",
  jobId: "652a9010ab34",
  workerId: "652a101bcf12",
  workerName: "Ramesh Kumar",
  checkOutAt: "2026-10-20T17:58:12Z",
  hoursWorked: 9.0,
  autoCheckout: false
});

// 9. Shift Sign-Off Requested (to Contractor) - Phase 4 (Implemented)
socket.on("signoff:requested", {
  attendanceId: "671230000000000000000006",
  jobId: "652a9010ab34",
  workerName: "Ramesh Kumar",
  hoursWorked: 9.0
});

// 10. Contractor Sign-Off Done (to Worker & Job Room) - Phase 4 (Implemented)
socket.on("signoff:done", {
  attendanceId: "671230000000000000000006",
  jobId: "652a9010ab34",
  decision: "APPROVED" // or "DISPUTED"
});

// 11. Worker Marked Missed / No-Show Alert - Phase 4 (Implemented)
socket.on("attendance:missed", {
  jobId: "652a9010ab34",
  workerId: "652a101bcf12",
  workerName: "Ramesh Kumar",
  date: "2026-10-20"
});

// 12. Escrow Released Notification (to Worker) - Phase 5
socket.on("payment:released", {
  jobId: "652a9010ab34",
  amountPaise: 85000,
  balancePaise: 240000,
  releasedAt: "2026-10-20T18:30:00Z"
});

// 13. Emergency SOS Alert (to Contractor, Coworkers, Admins) - Phase 7
socket.on("sos:alert", {
  incidentId: "671230000000000000000088",
  reporter: { id: "671230000000000000000001", firstName: "Ramesh", phone: "+919000000001" },
  jobId: "671230000000000000000004",
  jobTitle: "Civil Construction",
  location: { lat: 18.5204, lng: 73.8567 },
  locationFlag: "OK",
  accuracy: 12.5,
  createdAt: "2026-10-21T18:00:00.000Z",
  severity: "CRITICAL",
  isEscalation: false
});

// 14. SOS Acknowledged Alert (to Reporter & Responders) - Phase 7
socket.on("sos:acknowledged", {
  incidentId: "671230000000000000000088",
  byName: "Vikram Malhotra",
  byRole: "contractor",
  at: "2026-10-21T18:00:45.000Z"
});

// 15. SOS Live Location Update (to Alerted Rooms) - Phase 7
socket.on("sos:location", {
  incidentId: "671230000000000000000088",
  lat: 18.5205,
  lng: 73.8569,
  accuracy: 9.0,
  at: "2026-10-21T18:01:00.000Z"
});

// 16. SOS Escalated (to Admins & Responders) - Phase 7
socket.on("sos:escalated", {
  incidentId: "671230000000000000000088",
  level: 1
});

// 17. SOS Resolved Alert (to Alerted Rooms) - Phase 7
socket.on("sos:resolved", {
  incidentId: "671230000000000000000088",
  resolutionType: "SELF_SAFE"
});

// 18. Non-SOS Incident New Report (to Contractor & Admins) - Phase 7
socket.on("incident:new", {
  incidentId: "671230000000000000000089",
  type: "INJURY",
  severity: "HIGH",
  jobId: "671230000000000000000004"
});

// 19. Rating Requested (to Worker & Contractor) - Phase 7
socket.on("rating:requested", {
  jobId: "671230000000000000000004",
  counterpartyId: "671230000000000000000001",
  types: ["CONTRACTOR_PAYMENT", "CONTRACTOR_SAFETY"]
});

// 20. Rating Revealed (to Recipient) - Phase 7
socket.on("rating:revealed", {
  jobId: "671230000000000000000004"
});
```

---

## 3. Phase 7: Reputation, Emergency & Incident REST APIs

### 3.1 Two-Way Ratings (`/ratings`)
- `POST /ratings`: Submit rating `{ jobId, toUserId, type, score (1-5), tags[] (max 4), comment? (max 300) }`. Double-blind (`revealedAt: null`). Returns `201 Created`.
- `GET /ratings/pending`: Rateable jobs/counterparties right now for current user.
- `GET /ratings/mine/given?jobId=`: User's submitted ratings (including unrevealed with status `WAITING_FOR_OTHER_SIDE`).
- `GET /ratings/received`: User's received revealed ratings with first-name attribution.
- `GET /users/:id/reputation`: Public reputation scorecard `{ summary, topTags, recentComments, objectiveStats }`. No phone numbers exposed.
- `POST /ratings/:id/report`: Recipient flags rating as unfair `{ reason }` for admin review.
- `GET /admin/ratings`: Admin moderation queue `{ hidden?, reported? }`.
- `POST /admin/ratings/:id/hide`: Admin hides rating with `{ reason }` (min 5 chars); triggers summary recalculation.
- `POST /admin/ratings/:id/unhide`: Admin unhides rating.

### 3.2 Emergency Contact (`/users/me/emergency-contact`)
- `PATCH /users/me/emergency-contact`: Set emergency contact `{ name, phone (E.164) }`. Sends one verification notice SMS via provider mock/DLT template.

### 3.3 Incidents & SOS (`/incidents`)
- `POST /incidents/sos`: Trigger emergency SOS `{ lat?, lng?, accuracy?, locationAgeSec?, idempotencyKey, jobId?, notifyContractor? }`. Never fails on missing GPS or network duplicate. Dispatches SMS & Socket alerts.
- `POST /incidents/:id/location`: Reporter updates breadcrumb trail `{ lat, lng, accuracy }`. Enforces 5s min interval & 50 points cap.
- `POST /incidents/:id/acknowledge`: Alerted responder or admin acknowledges SOS.
- `POST /incidents/:id/resolve`: Resolve SOS/incident `{ resolutionType, notes? }` (reporter can use `SELF_SAFE`).
- `POST /incidents`: Non-SOS report (injury, harassment, dispute, other) with optional multipart photos (max 3, memory storage, magic bytes checked). `HARASSMENT` and `DISPUTE` are strictly `ADMIN_ONLY` (hidden from contractor).
- `GET /incidents/my`: Reporter's incident history.
- `GET /jobs/:id/incidents`: Contractor's job safety list (only `ALERTED_USERS` visibility).
- `GET /incidents/:id`: Incident details with append-only timeline and location trail.
- `GET /incidents/:id/photos/:index`: Secure photo serving.
- `GET /admin/incidents`: Admin incident queue (SOS and CRITICAL prioritized).
- `GET /admin/incidents/:id`: Full incident bundle with reporter context (past SOS and FALSE_ALARM counts).
- `POST /admin/incidents/:id/note`: Append admin internal note.
- `POST /admin/incidents/:id/resolve`: Admin resolve.
- `GET /admin/safety/stats`: Comprehensive safety KPI dashboard.

---

## 4. Razorpay Webhook Signature Verification

All Razorpay webhooks sent to `POST /api/v1/escrow/webhook` must verify authenticity using HMAC SHA256:

```javascript
const crypto = require("crypto");

function verifyRazorpayWebhook(rawBody, signature, webhookSecret) {
  const expectedSignature = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}
```
Any mismatch returns `400 Bad Request` and logs an incident in `auditlogs`.

---

## 5. Voice-Service Internal API (FastAPI)

These endpoints are internal to the WorkPulse infrastructure (called exclusively by `backend` Express service). Direct browser access is forbidden via `ALLOWED_ORIGINS` and blocked without the `X-Internal-Key` shared secret header.

### 5.1 `GET /health`
- **Auth**: Public
- **Response (200)**:
  ```json
  {
    "status": "ok",
    "service": "voice-service",
    "sttProvider": "mock",
    "whisperModelLoaded": false
  }
  ```

### 5.2 `POST /extract`
- **Auth**: Header `X-Internal-Key: <INTERNAL_API_KEY>`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "text": "main painter hoon 5 saal ka experience hai",
    "language": "hi",
    "allowedSkills": ["painter", "plumber", "electrician", ...]
  }
  ```
- **Response (200)**:
  ```json
  {
    "skills": [{ "key": "painter", "confidence": 0.95, "matchedText": "painter" }],
    "suggestions": [],
    "experienceYears": 5,
    "perSkillYears": {},
    "flags": [],
    "normalizedText": "main painter hoon 5 saal ka experience hai"
  }
  ```

### 5.3 `POST /onboard`
- **Auth**: Header `X-Internal-Key: <INTERNAL_API_KEY>`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file`: Audio binary (WAV, WebM, Ogg, MP4, MP3)
  - `language`: `hi` | `mr` | `en` | `auto`
  - `allowedSkills`: JSON array string `["painter", "mason", ...]`
  - `clientDurationMs`: (Optional) duration hint
- **Response (200)**:
  Transcribes audio in-memory and extracts skills in a single pipeline. Returns merged `{ text, language, durationSec, provider, latencyMs, skills, suggestions, experienceYears, perSkillYears, flags, normalizedText }`.
