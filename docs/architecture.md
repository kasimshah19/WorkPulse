# WorkPulse – Architecture Blueprint (Phase 1)

---

## 1. System Overview & Monorepo Topology

WorkPulse is a direct micro-contracting, proof-of-work, and escrow payment platform designed for daily-wage and blue-collar workers in India. The system comprises three independent micro-applications, a document database with geospatial indexing, and external fintech/telecom gateways.

### 1.1 Mermaid Component Diagram

```mermaid
flowchart TB
    subgraph ClientLayer [Client Layer - Mobile First PWA]
        WorkerPWA["Worker PWA (Next.js 14)<br/>• 360px Mobile-first UI<br/>• Devanagari/Latin Typography<br/>• Service Worker Offline Cache"]
        ContractorWeb["Contractor Web App<br/>• Real-time Socket Monitor<br/>• Razorpay Checkout SDK<br/>• Geofence Pin Selector"]
        
        BrowserAPIs["Browser Hardware APIs<br/>• Geolocation API (GPS)<br/>• MediaDevices (Camera API)<br/>• Web Speech / MediaStream"]
        WorkerPWA -.-> BrowserAPIs
    end

    subgraph GatewayLayer [Edge & Security Gateway]
        Nginx["Reverse Proxy & Edge Gateway<br/>• SSL/TLS Termination<br/>• Rate Limiting (100 req/15m)<br/>• Static Asset CDN Caching"]
    end

    subgraph ServiceLayer [Application Microservices]
        BackendAPI["Core Backend API (Node.js/Express)<br/>• REST Endpoints under /api/v1<br/>• Socket.io Gateway (WebSockets)<br/>• Escrow State Machine Engine<br/>• JWT & RBAC Middleware"]
        
        VoiceMicroservice["Voice Microservice (Python FastAPI)<br/>• OpenAI Whisper STT<br/>• Hindi/Marathi Skill Extractor<br/>• Port 8000 (Internal Only)"]
    end

    subgraph DataLayer [Data Persistence & State]
        MongoDB[("MongoDB 7.0 Cluster<br/>• 13 Normalized Collections<br/>• 2dsphere GeoJSON Indexes<br/>• Immutable Audit & Ledger Collections")]
    end

    subgraph ExternalGateways [External Cloud Services]
        RazorpayGateway["Razorpay / RazorpayX (Test Mode)<br/>• Escrow Deposit Capture<br/>• Automated UPI Payout Disbursals<br/>• Webhook Signature Verification"]
        
        SMSProvider["SMS Gateway (MSG91 / Twilio)<br/>• Phone OTP Delivery<br/>• Critical SMS Fallback Notifications<br/>• Emergency SOS SMS with Map Link"]
        
        CloudStorage["Cloud Object Storage (S3 / R2 / GCS)<br/>• Geo-tagged Selfie Attendance Photos<br/>• Dispute Inspection Evidence"]
    end

    ClientLayer -->|HTTPS / WSS| GatewayLayer
    GatewayLayer -->|Reverse Proxy /api/v1| BackendAPI
    GatewayLayer -->|WebSocket Upgrade /socket.io| BackendAPI
    
    BackendAPI <-->|Internal REST (JSON/Audio)| VoiceMicroservice
    BackendAPI <-->|Mongoose ODM / TCP Connection Pool| MongoDB
    
    BackendAPI -->|Payment Capture & UPI Transfers| RazorpayGateway
    BackendAPI -->|Transactional SMS| SMSProvider
    BackendAPI -->|Signed Multipart Upload URLs| CloudStorage
```

---

## 2. Core Operational Sequence Diagrams

### 2.1 Sequence A: Phone OTP Login

```mermaid
sequenceDiagram
    autonumber
    actor U as User (Worker / Contractor)
    participant F as Next.js PWA
    participant B as Express API Backend
    participant SMS as SMS Gateway (MSG91)
    participant DB as MongoDB (otps, users)

    U->>F: Enters 10-digit mobile number (+91...)
    F->>B: POST /api/v1/auth/send-otp { phone, purpose: 'login' }
    
    B->>B: Generate secure 4-digit OTP & bcrypt hash
    B->>DB: Upsert Otp doc { phone, otpHash, expiresAt: now+5m, attempts: 0 }
    B->>SMS: Dispatch SMS with OTP ("Your WorkPulse code is 4821")
    SMS-->>U: Receives SMS
    B-->>F: 200 OK { message: "OTP sent successfully" }

    U->>F: Enters 4-digit code (or Android SMS Auto-Retriever fills)
    F->>B: POST /api/v1/auth/verify-otp { phone, otp: '4821' }
    
    B->>DB: Find active Otp by phone
    B->>B: Verify bcrypt(otp, otpHash) & check attempts < 5
    
    alt Invalid OTP or Max Attempts Exceeded
        B-->>F: 400 Bad Request { code: 'INVALID_OTP', message: 'Incorrect OTP' }
    else Valid OTP
        B->>DB: Mark Otp as isUsed = true
        B->>DB: Find or create User document
        B->>B: Generate Access Token (15m) + Refresh Token (7d)
        B-->>F: 200 OK { accessToken, refreshToken, user }
        F->>F: Save accessToken in memory & refreshToken in secure cookie
        F-->>U: Navigate to Role Dashboard
    end
```

---

### 2.2 Sequence B: Job Posting -> Geo-Matching -> Broadcast -> Worker Acceptance

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant F as Contractor Web
    participant B as Backend API
    participant DB as MongoDB (jobs, users, jobapplications)
    participant WS as Socket.io Gateway
    participant SMS as SMS Gateway
    actor W as Nearby Worker

    C->>F: Enters job requirements (Mason, 2 workers, ₹800/day, GPS, 100m geofence, 5km match radius)
    F->>B: POST /api/v1/jobs { title, skillRequired: 'mason', location, wagePerDayPaise: 80000, ... }
    B->>DB: Insert Job doc (status: 'DRAFT')
    B-->>F: 201 Created { jobId, escrowRequiredPaise: 160000 }

    Note over C,B: Contractor funds escrow via Razorpay (Sequence D)
    B->>DB: Update Job (status: 'OPEN')

    B->>DB: MongoDB 2dsphere query: Find Workers where role='worker' AND isAvailable=true AND skills='mason' AND location $near { maxDistance: 5000m }
    DB-->>B: Return eligible matched workers list [Worker_A, Worker_B, ...]

    loop For each matched worker
        B->>DB: Create JobApplication { job, worker, status: 'NOTIFIED', notifiedVia: 'socket' }
        alt Worker has active WebSocket
            B->>WS: Emit 'job:new' to room user:{workerId}
            WS-->>W: In-app audio chime + Big Job Notification Card
        else Worker is offline
            B->>SMS: Send SMS Fallback ("WorkPulse: New Mason job 1.2km away, ₹800/day. Reply YES to accept")
            SMS-->>W: Receives SMS
        end
    end

    W->>F: Clicks "स्वीकार करें" (Accept Job)
    F->>B: POST /api/v1/applications/:id/accept
    B->>DB: Atomic update: findOneAndUpdate Job if workersAssignedCount < workersNeeded
    
    alt Job already filled
        B-->>F: 409 Conflict { code: 'JOB_FILLED', message: 'Job has already been filled' }
    else Slot available
        B->>DB: Increment workersAssignedCount += 1
        B->>DB: Update JobApplication (status: 'ASSIGNED')
        B->>WS: Emit 'job:assigned' to contractor & worker
        B-->>F: 200 OK { status: 'ASSIGNED', jobDetails }
    end
```

---

### 2.3 Sequence C: Geo-Fenced Check-In and Check-Out

```mermaid
sequenceDiagram
    autonumber
    actor W as Worker
    participant App as Worker Mobile PWA
    participant B as Backend API
    participant CS as Object Storage
    participant DB as MongoDB (attendances, escrowtransactions)
    participant WS as Socket.io Gateway
    actor C as Contractor

    W->>App: Clicks "हाजिरी लगाएं" (Check In)
    App->>App: Fetch browser GPS coordinates & prompt live camera
    W->>App: Captures real-time selfie photo
    App->>B: POST /api/v1/attendance/check-in { jobId, coords: [lon, lat], selfieBlob, accuracy }

    B->>DB: Fetch Job document (location, geofenceRadiusMeters)
    B->>B: Server-side Haversine distance validation (Worker GPS vs Job GPS)

    alt Distance > Job geofenceRadiusMeters (e.g. 100m)
        B-->>App: 400 Bad Request { code: 'GEOFENCE_VIOLATION', distanceMeters: 450, allowedMeters: 100 }
        App-->>W: Alert: "आप काम की जगह से 450 मीटर दूर हैं।"
    else Distance <= geofenceRadiusMeters (Inside Boundary)
        B->>CS: Upload selfie image (tagged with timestamp & coords)
        CS-->>B: Return permanent selfieUrl
        
        B->>DB: Insert Attendance doc { job, worker, date: '2026-10-18', checkInAt, checkInLocation, checkInDistanceMeters, selfieUrl, status: 'CHECKED_IN' }
        B->>DB: Update EscrowTransaction (status: 'CHECKED_IN', attendance: attendanceId)
        
        B->>WS: Emit 'attendance:checkedIn' to room job:{jobId}
        WS-->>C: Live site dashboard ping ("Ramesh checked in at 08:05 AM with selfie")
        B-->>App: 200 OK { status: 'CHECKED_IN', checkInAt }
        App-->>W: Green checkmark & shift timer activated
    end

    Note over W,C: Worker completes work shift...

    W->>App: Clicks "काम समाप्त" (Check Out)
    App->>B: POST /api/v1/attendance/check-out { attendanceId, coords: [lon, lat] }
    B->>B: Server-side distance check & calculate hoursWorked
    B->>DB: Update Attendance doc { checkOutAt, checkOutLocation, hoursWorked, status: 'CHECKED_OUT' }
    B->>DB: Update EscrowTransaction { status: 'CHECKED_OUT', autoApprovalAt: now + job.autoApprovalHours }
    B->>WS: Emit 'attendance:checkedOut' to room job:{jobId}
    WS-->>C: Alert: "Shift completed. Please sign off to release ₹800."
    B-->>App: 200 OK { status: 'CHECKED_OUT', hoursWorked }
```

---

### 2.4 Sequence D: Escrow Fund -> Approve -> Release

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant F as Contractor Web
    participant B as Backend API
    participant R as Razorpay Gateway
    participant DB as MongoDB (wallets, escrowtransactions, ledgerentries)
    actor W as Worker

    C->>F: Clicks "Fund Escrow" for Job (Total: ₹1,600 for 2 workers)
    F->>B: POST /api/v1/escrow/order { jobId }
    B->>R: POST /v1/orders { amount: 160000, currency: 'INR' }
    R-->>B: Return Razorpay Order ID (order_xyz123)
    B-->>F: 200 OK { orderId: 'order_xyz123', amountPaise: 160000 }

    F->>C: Opens Razorpay Checkout Modal
    C->>R: Authorizes payment via UPI / Netbanking
    R-->>F: Payment Successful { razorpayPaymentId, razorpaySignature }

    F->>B: POST /api/v1/escrow/verify { jobId, orderId, paymentId, signature }
    B->>B: Cryptographic signature verification using RAZORPAY_KEY_SECRET
    
    B->>DB: Create/Update EscrowTransaction (status: 'FUNDED', razorpayPaymentId)
    B->>DB: Update Wallet (contractor lockedPaise += 160000)
    B->>DB: Append LedgerEntry (groupId: G1, Debit: CONTRACTOR_WALLET 160000, Credit: ESCROW_HOLD 160000)
    B-->>F: 200 OK { status: 'FUNDED' }

    Note over C,W: Worker completes shift & clocks out (Sequence C)

    C->>F: Clicks "Approve & Pay" on Contractor Dashboard
    F->>B: POST /api/v1/escrow/:txnId/approve
    B->>DB: Atomic update findOneAndUpdate status: 'CHECKED_OUT' -> 'APPROVED'
    
    B->>R: POST /v1/payouts { account_number: worker.upiId, amount: 80000, mode: 'UPI' }
    R-->>B: Payout Accepted (Reference: pay_out_8899)
    
    B->>DB: Update EscrowTransaction { status: 'RELEASED', releasedAt: now, payoutReference: 'pay_out_8899' }
    B->>DB: Update Wallets (Contractor lockedPaise -= 80000, Worker balancePaise += 80000)
    
    Note over B,DB: Double-Entry Immutable Ledger Recording
    B->>DB: Insert LedgerEntry { groupId: G2, entryType: 'DEBIT', account: 'ESCROW_HOLD', amountPaise: 80000 }
    B->>DB: Insert LedgerEntry { groupId: G2, entryType: 'CREDIT', account: 'WORKER_WALLET', amountPaise: 80000 }
    
    B-->>F: 200 OK { status: 'RELEASED' }
    B->>W: SMS / Push Alert ("WorkPulse: ₹800.00 credited to your UPI ID!")
```

---

### 2.5 Sequence E: Dispute Raise -> Admin Resolution

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant B as Backend API
    participant DB as MongoDB (disputes, escrowtransactions, ledgerentries)
    actor A as Admin Arbitrator
    actor W as Worker

    C->>B: POST /api/v1/disputes { escrowTransactionId, reason: 'WORK_QUALITY', description: 'Wall masonry unfinished', evidence: [photos] }
    B->>DB: Update EscrowTransaction (status: 'DISPUTED')
    B->>DB: Insert Dispute doc (status: 'OPEN', raisedBy: contractor, against: worker)
    B->>W: Notify worker of dispute via SMS / Push
    B-->>C: 201 Created { disputeId, status: 'OPEN' }

    A->>B: GET /api/v1/admin/disputes/:id
    B->>DB: Fetch Dispute + Attendance (GPS checkin/out logs + selfies) + Job specs
    B-->>A: Render Evidence Portal: Worker arrived on time (08:00 AM), left at 05:00 PM (8 hrs), contractor uploaded photo of partial mortar work

    A->>B: POST /api/v1/admin/disputes/:id/resolve { decision: 'SPLIT', workerAmountPaise: 50000, contractorRefundPaise: 30000, notes: '5/8th work completed satisfactorily' }
    
    B->>B: Invariant Check: workerAmountPaise (50000) + contractorRefundPaise (30000) == totalEscrow (80000)
    B->>DB: Update Dispute (status: 'SPLIT', resolution: {...})
    B->>DB: Update EscrowTransaction (status: 'RELEASED')
    
    B->>DB: Ledger: Debit ESCROW_HOLD (80000)
    B->>DB: Ledger: Credit WORKER_WALLET (50000)
    B->>DB: Ledger: Credit REFUND (to contractor) (30000)
    
    B->>W: Payout ₹500 via UPI & send SMS with resolution notes
    B->>C: Refund ₹300 via Razorpay & send SMS notification
    B-->>A: 200 OK { disputeStatus: 'RESOLVED', resolutionSummary }
```

---

### 2.6 Sequence F: Voice Onboarding (Audio -> Voice-Service -> Skills -> Profile)

```mermaid
sequenceDiagram
    autonumber
    actor W as Worker
    participant App as Mobile PWA
    participant B as Express API Backend
    participant VS as FastAPI Voice Service (Port 8000)
    participant DB as MongoDB (users)

    W->>App: Taps Big Mic Button & speaks: "मेरा नाम रमेश है, मैं 5 साल से प्लंबर और मिस्त्री का काम करता हूँ"
    App->>App: MediaRecorder records audio/webm or audio/wav stream
    App->>B: POST /api/v1/voice/onboard (multipart audio file)
    
    B->>VS: POST /transcribe (forward audio buffer)
    VS->>VS: Run Whisper STT (detect language: 'hi', transcribe speech)
    VS->>VS: NLP Entity & Skill Extractor matches tokens with SKILLS enum
    VS-->>B: Return JSON: { text: "...", language: "hi", skills: ["plumber", "mason"], experienceYears: 5 }
    
    B-->>App: 200 OK { extractedData: { skills: ["plumber", "mason"], experienceYears: 5 } }
    App-->>W: Visual Audio Confirmation Cards displayed with trade icons 🔧 🧱
    
    W->>App: Taps "हाँ, यह सही है" (Confirm Profile)
    App->>B: PATCH /api/v1/users/me { skills: ["plumber", "mason"], experienceYears: 5 }
    B->>DB: Update User document
    B-->>App: 200 OK { profileComplete: true }
```

---

### 2.7 Sequence G: SOS Emergency Alert

```mermaid
sequenceDiagram
    autonumber
    actor W as Worker in Distress
    participant App as Worker Mobile PWA
    participant B as Backend API
    participant WS as Socket.io Gateway
    participant SMS as SMS Gateway
    participant DB as MongoDB (incidents)
    actor C as Contractor / Site Lead
    actor Team as Platform Safety Officers

    W->>App: Long-presses red SOS button for 2 seconds
    App->>App: Obtain high-precision GPS coordinates
    App->>B: POST /api/v1/incidents { type: 'SOS', severity: 'CRITICAL', coords: [lon, lat] }
    
    B->>DB: Insert Incident doc { type: 'SOS', severity: 'CRITICAL', status: 'OPEN', location }
    
    par Real-Time Dashboard Siren
        B->>WS: Emit 'incident:sos' to room job:{jobId} & room admin:safety
        WS-->>C: Screen flashes red with persistent high-pitch siren alarm
        WS-->>Team: Immediate incident pop-up on Admin Safety Console
    and Emergency SMS Broadcast
        B->>SMS: Dispatch SMS to Contractor and Worker Emergency Contact
        Note over SMS,C: "EMERGENCY: Worker Ramesh triggered SOS at site! Live GPS Map: https://maps.google.com/?q=28.5355,77.3910"
    and Platform Incident Ticket
        B->>DB: Update Incident (alertedUsers logged with sentAt)
    end

    B-->>App: 201 Created { incidentId, status: 'ACKNOWLEDGED' }
    App-->>W: Screen updates: "सुरक्षा टीम और ठेकेदार को सूचित कर दिया गया है। मदद आ रही है।"
```

---

## 3. Technology Decisions

| Area | Choice | Rationale | Alternatives Considered |
|---|---|---|---|
| **Frontend Framework** | **Next.js 14 (App Router)** | Mobile-first PWA readiness, fast server-rendered initial viewports on 2G/3G, unified API routing. | React + Vite (SPA lacks built-in SEO and requires separate SSR server), Flutter Web (heavy canvas bundle, poor performance on low-end Android). |
| **Backend Stack** | **Node.js (Express + Socket.io)** | High concurrency for real-time WebSocket attendance/job broadcasts, lightweight I/O, massive ecosystem for Indian fintech SDKs. | Django/Python (heavier memory footprint for WebSockets), Go/Gin (slower prototyping and fewer pre-built Razorpay community wrappers). |
| **Database** | **MongoDB (Mongoose ODM)** | Native GeoJSON `2dsphere` queries for geospatial radius matching (`$near`, `$geoWithin`), flexible document model for audit trails and attendance photos. | PostgreSQL + PostGIS (excellent geo capabilities, but JSON document flexibility and rapid schema evolution favored MongoDB for Phase 1-3). |
| **Voice Processing** | **Python (FastAPI + Whisper)** | Python is the definitive ecosystem for speech-to-text (OpenAI Whisper) and Indic language NLP; separated as an isolated microservice to prevent blocking Express event loops. | Native browser Web Speech API (inconsistent support across budget Android Chrome browsers and poor regional Hindi/Marathi dialect accuracy). |
| **State Management** | **Zustand** | Minimal boilerplate (under 3KB bundle), direct localStorage persistence, zero provider hell. | Redux Toolkit (overly complex for simple role switching and auth), Context API (re-renders entire component tree on mobile). |
| **Styling & Design** | **Tailwind CSS** | Guaranteed low CSS bundle size, atomic utility classes, strict enforcement of minimum 48px touch targets for blue-collar mobile accessibility. | Styled-components (runtime CSS-in-JS overhead on budget CPUs), Material UI (heavy bundle size and complex customization). |

---

## 4. Security Architecture

1. **JWT & Refresh Strategy**:
   - Access Token: Short-lived (15 minutes), passed via `Authorization: Bearer <token>` header. Contains `{ id, role, phone }`.
   - Refresh Token: Long-lived (7 days), stored in an `HttpOnly`, `SameSite=Strict`, `Secure` cookie. Used exclusively at `/api/v1/auth/refresh-token`.
2. **Server-Side GPS Validation (Zero Client Trust)**:
   - The server never trusts client-reported distances.
   - The worker sends raw GPS coordinates `[longitude, latitude]` and accuracy radius.
   - The backend recalculates Haversine distance on the server against the canonical job coordinates in MongoDB.
   - Any check-in with GPS accuracy > 30 meters or distance > `geofenceRadiusMeters` is rejected.
3. **Rate Limiting & Anti-Bruteforce**:
   - Global rate limit: 100 requests per 15-minute window per IP.
   - OTP endpoints: Strict 3 attempts per 10 minutes per phone number to prevent SMS bombing and brute-forcing.
4. **Input Validation (Joi Middleware)**:
   - All incoming payloads are validated and sanitized using Joi schemas before hitting controllers.
   - Strips unknown fields (`stripUnknown: true`) to prevent prototype pollution and parameter injection.
5. **Selfie Image Upload Integrity**:
   - Direct multipart uploads capped at 5MB.
   - Enforced MIME-types: `image/jpeg`, `image/png`, `image/webp`.
   - EXIF metadata inspected for capture timestamp to prevent replaying stale photos.
6. **Data Protection & DPDP Act 2023 Compliance**:
   - Explicit consent logged at registration for geolocation tracking during active job shifts only.
   - Tracking is terminated immediately upon checkout.
   - Phone numbers masked in public contractor listings until worker assignment is confirmed.
   - Immutable audit logs record all administrative access to worker PII.

---

## 5. Non-Functional & Reliability Requirements

1. **Low-Bandwidth & 2G/3G Network Resilience**:
   - Total frontend initial bundle < 120KB gzip.
   - Next.js static asset optimization with aggressive HTTP caching.
   - High contrast UI avoids decorative images, relying on lightweight Lucide vector icons.
2. **PWA Offline Behavior**:
   - Service worker caches application shell, Hindi localization strings, and offline job cards.
   - Background sync queues check-ins if connection drops momentarily at remote construction sites.
3. **Idempotency Safeguards**:
   - All financial operations (`/escrow/order`, `/escrow/release`, `/escrow/refund`) require a unique `idempotencyKey` UUID.
   - Prevents duplicate debiting if network retries occur.
4. **Immutable Audit Logging**:
   - Every financial state transition and admin intervention creates an append-only document in `auditlogs` and `ledgerentries`.
   - MongoDB pre-save hooks prevent document modification or deletion.

---

## 6. Out-of-Scope (Phase 1 Blueprint Boundaries)

* **RBI-Licensed Escrow Banking**: Production escrow will interface with Razorpay in Test Mode + an internal double-entry ledger. Real escrow trustee accounts (e.g. ICICI Trustee / Escrowpay) will be integrated in future phases.
* **Aadhaar eKYC Biometrics**: Real UIDAI Aadhaar biometrics are excluded. Simulated OTP verification and phone validation are utilized.
* **Native Mobile Apps (Android APK / iOS)**: The system is designed and deployed as a responsive, installable Progressive Web App (PWA). Native wrappers (React Native / Capacitor) remain out of current scope.
