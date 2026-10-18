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
| `400` | `ESCROW_NOT_FUNDED` | Check-in attempted on an un-funded escrow day |
| `400` | `GEOFENCE_EXCEEDED` | GPS coordinates exceed allowed geofence boundary |
| `401` | `UNAUTHORIZED` | Missing, malformed, or expired access token |
| `401` | `TOKEN_EXPIRED` | Access token expired; use refresh token |
| `403` | `FORBIDDEN` | Role mismatch (e.g., worker accessing contractor route) |
| `404` | `NOT_FOUND` | Resource ID does not exist |
| `409` | `CONFLICT` | Resource already exists or concurrent transition blocked |
| `409` | `IDEMPOTENCY_CONFLICT` | Action already executed with identical key |
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
      "token": "eyJhbGciOi...",
      "isNewUser": false
    },
    "error": null
  }
  ```
- **Errors**: `400 INVALID_OTP`, `400 OTP_EXPIRED`

#### 3. Refresh Access Token
- **Method & Path**: `POST /auth/refresh-token`
- **Auth**: Public
- **Phase**: Phase 5

#### 4. Logout
- **Method & Path**: `POST /auth/logout`
- **Auth**: Authenticated (Any role)
- **Phase**: Phase 5

#### 5. Get Current User (`me`)
- **Method & Path**: `GET /auth/me`
- **Auth**: Authenticated
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

#### 6. Dev Login & Dev Users (Dev Mode Only)
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

### 2.12 Admin Operations (`/admin`)

- `GET /admin/users` (List users with status and verification filters)
- `POST /admin/users/:id/verify` (Manually verify KYC or flag accounts)
- `GET /admin/disputes` (Queue of unresolved disputes)
- `GET /admin/stats` (Platform KPIs: active jobs, funds in escrow, daily releases)

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

// 10. Emergency SOS Broadcast - Phase 7
socket.on("sos:alert", {
  incidentId: "652c7890aa",
  jobId: "652a9010ab34",
  reportedBy: "Ramesh Kumar",
  location: { type: "Point", coordinates: [73.8569, 18.5205] },
  description: "Scaffolding collapsed"
});
```

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
