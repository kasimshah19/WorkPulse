# WorkPulse – Complete Workflows & Sequence Diagrams

---

## 1. End-to-End Master Lifecycle Workflow

This flowchart illustrates the complete lifecycle of a job—from contractor creation and escrow deposit to worker matching, GPS proof-of-work, and instant UPI payout.

```mermaid
flowchart TD
    Start([Contractor needs workers]) --> Step1[1. Job Post & Geofence Definition]
    Step1 --> Step2[2. Escrow Pre-funding via Razorpay]
    
    Step2 --> LockFunds[(Escrow Locked: ₹ Wage x Workers)]
    LockFunds --> Step3[3. Broadcast to Nearby Workers via Socket.io / Geo-Radius]
    
    Step3 --> Step4{Worker Discovery}
    Step4 -->|Voice Search in Hindi/Marathi| VoiceEngine[Voice Service: Whisper STT]
    VoiceEngine --> Step4
    Step4 -->|App Feed| Apply[Worker Applies / Accepts Job]
    
    Apply --> MatchConfirm[Contractor Confirms Worker]
    MatchConfirm --> Travel[Worker arrives at Site]
    
    Travel --> Step5[4. Proof-of-Work: Geofence Check]
    Step5 --> DistanceCheck{Within 500m site radius?}
    DistanceCheck -->|No| RejectCheckin[Check-in Rejected: Outside Boundary]
    DistanceCheck -->|Yes| Selfie[Capture Real-time Geo-tagged Selfie]
    
    Selfie --> LiveAlert[Socket.io: Live alert on Contractor Dashboard]
    LiveAlert --> WorkShift[Work Shift in Progress]
    
    WorkShift --> ClockOut[Worker Check-Out]
    ClockOut --> Review{Contractor Reviews Work}
    
    Review -->|Satisfactory| Approve[Approve & Release Escrow]
    Review -->|Dispute / Absent| Dispute[Raise Dispute]
    
    Approve --> Payout[Instant UPI Payout to Worker Bank Account]
    Payout --> Ledger[(Append-Only Ledger Entry)]
    Ledger --> Rating[Mutual 5-Star Rating]
    Rating --> Done([Transaction Complete])
    
    Dispute --> AdminTribunal[Admin Arbitration: Inspect GPS & Selfie Evidence]
    AdminTribunal --> Resolution{Admin Decision}
    Resolution -->|Worker Valid| Payout
    Resolution -->|Fraud / No-Show| Refund[Refund to Contractor]
    Resolution -->|Partial Work| Split[Split Payout]
    Refund --> Ledger
    Split --> Ledger
```

---

## 2. Sequence Diagram 1: Job Posting & Escrow Funding

Shows the interaction between Contractor, Frontend, Backend, Razorpay, and MongoDB to lock escrow before broadcasting.

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant F as Next.js Frontend
    participant B as Express Backend API
    participant R as Razorpay Gateway
    participant DB as MongoDB
    participant WS as Socket.io Service

    C->>F: Fills Job Form (Title, Skill, Location, Wage, 500m Radius)
    F->>B: POST /api/v1/jobs (Job Details)
    B->>DB: Save Job (Status: 'draft')
    B->>R: Create Order for Escrow (Total Wage Amount)
    R-->>B: Return Razorpay Order ID
    B-->>F: 201 Created (Job ID + Order ID)

    F->>C: Opens Razorpay Checkout Modal
    C->>R: Completes Payment (UPI / NetBanking / Card)
    R-->>F: Payment Successful (Payment ID + Signature)

    F->>B: POST /api/v1/escrow/fund (Job ID, Payment ID, Signature)
    B->>R: Verify Payment Signature
    R-->>B: Signature Verified
    
    B->>DB: Update EscrowTransaction (Status: 'FUNDED')
    B->>DB: Append LedgerEntry (Type: 'CREDIT', Account: 'CONTRACTOR_HOLDING')
    B->>DB: Update Job (Status: 'open')

    B->>WS: Broadcast 'job:new_nearby' to geo-room (Latitude, Longitude)
    WS-->>F: Push alert to nearby workers within radius
    B-->>F: 200 OK (Escrow Active & Job Published)
```

---

## 3. Sequence Diagram 2: Proof-of-Work Attendance (Check-In & Check-Out)

Shows how geolocation coordinates and selfie photo prevent proxy attendance and fake check-ins.

```mermaid
sequenceDiagram
    autonumber
    actor W as Worker
    participant WF as Worker Mobile App
    participant B as Express Backend API
    participant CS as Cloud Storage (S3 / CDN)
    participant DB as MongoDB
    participant WS as Socket.io Gateway
    actor C as Contractor

    W->>WF: Taps 'हाजिरी लगाएं' (Check In)
    WF->>WF: Request GPS (latitude, longitude, accuracy)
    WF->>B: POST /api/v1/attendance/check-in (jobId, coords, selfieImage)

    B->>DB: Fetch Job Location Coordinates
    B->>B: Calculate Haversine Distance (Worker GPS vs Job GPS)

    alt Distance > Job Radius (e.g. > 500m)
        B-->>WF: 400 Bad Request ("You are too far from site: 1200m away")
        WF-->>W: Show Alert: "Please arrive at the site to check in"
    else Distance <= Job Radius (Inside Boundary)
        B->>CS: Upload Selfie Image (with timestamp metadata)
        CS-->>B: Return Secure Image URL
        B->>DB: Create Attendance (checkInAt, checkInLocation, selfieUrl, distanceFromSite)
        B->>DB: Update EscrowTransaction (Status: 'CHECKED_IN')
        
        B->>WS: Emit 'attendance:worker_checked_in' (jobId, workerName, selfieUrl)
        WS-->>C: Live Dashboard Alert ("Ramesh Kumar checked in at 08:02 AM")
        B-->>WF: 200 OK (Check-In Successful)
        WF-->>W: Green Checkmark & Working Timer Started
    end

    Note over W,C: Worker completes 8-hour shift...

    W->>WF: Taps 'काम समाप्त' (Check Out)
    WF->>B: POST /api/v1/attendance/check-out (jobId, checkOutCoords)
    B->>DB: Update Attendance (checkOutAt, checkOutLocation)
    B->>DB: Update EscrowTransaction (Status: 'CHECKED_OUT')
    B->>WS: Emit 'attendance:worker_checked_out' to Contractor
    B-->>WF: 200 OK (Shift Recorded, Pending Approval)
```

---

## 4. Sequence Diagram 3: Escrow Approval & Instant UPI Payout

The happy path where the contractor approves the work, triggering instant payout via UPI and recording double-entry ledger entries.

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant CF as Contractor App
    participant B as Express Backend API
    participant R as RazorpayX Payout API
    participant DB as MongoDB
    actor W as Worker

    C->>CF: Reviews completed shift & clicks "Approve & Pay ₹800"
    CF->>B: POST /api/v1/escrow/release/:transactionId
    
    B->>DB: Fetch EscrowTransaction & Worker details (UPI ID)
    B->>B: Verify State Transition (CHECKED_OUT -> APPROVED -> RELEASED)
    
    B->>R: POST /v1/payouts (fund_account: worker UPI, amount: 800)
    R-->>B: Payout Accepted (Status: 'processing' / 'processed')
    
    B->>DB: Update EscrowTransaction (Status: 'RELEASED')
    
    Note over B,DB: Double-entry audit ledger recording
    B->>DB: Insert LedgerEntry (Debit: CONTRACTOR_HOLDING, ₹800)
    B->>DB: Insert LedgerEntry (Credit: WORKER_PAYOUT, ₹800)
    
    B-->>CF: 200 OK ("Payment Released Successfully")
    B->>W: SMS Alert ("WorkPulse: ₹800 credited to your UPI ID")
    CF->>C: Prompt for Worker Skill & Safety Rating
```

---

## 5. Sequence Diagram 4: Dispute & Admin Arbitration (Unhappy Path)

When there is a disagreement (e.g., worker left early or contractor refuses to approve), this flow guides arbitration.

```mermaid
sequenceDiagram
    autonumber
    actor C as Contractor
    participant B as Express Backend API
    participant DB as MongoDB
    actor A as Admin Arbitrator
    actor W as Worker

    C->>B: POST /api/v1/escrow/dispute/:txnId (Reason: "Worker left at 12 PM")
    B->>DB: Update EscrowTransaction (Status: 'DISPUTED')
    B->>DB: Create Incident (Type: 'dispute', Severity: 'medium', Notes)
    B->>W: Notify Worker of dispute via SMS / In-App alert

    Note over A,DB: Admin Arbitration Process
    A->>B: GET /api/v1/incidents/:id (Fetch dispute dossier)
    B->>DB: Retrieve Job GPS, Worker Check-in/out timestamps, Distance, & Selfies
    B-->>A: Render Evidence Portal:
    Note over A: 1. Check-in: 08:15 AM (Valid 40m distance, selfie verified)<br/>2. Check-out: 12:30 PM (Only 4 hours worked)

    A->>B: POST /api/v1/escrow/arbitrate (Decision: "SPLIT_PAYOUT", Worker: 50%, Contractor: 50%)
    
    B->>DB: Update EscrowTransaction (Status: 'APPROVED' / Resolved)
    B->>DB: Ledger: Debit Escrow ₹800 -> Credit Worker ₹400 -> Refund Contractor ₹400
    B-->>A: 200 OK (Dispute Closed)
    B->>W: SMS ("Dispute resolved: ₹400 credited for 4 hours worked")
    B->>C: SMS ("Dispute resolved: ₹400 refunded to your account")
```

---

## 6. Voice Search & Skill Extraction Pipeline

The voice service flow allowing illiterate or semi-literate workers to speak naturally in Hindi or Marathi.

```mermaid
flowchart LR
    WorkerSpeech([Worker speaks:<br/>'मुझे कल 2 दिन के लिए<br/>मिस्त्री का काम चाहिए']) 
    --> Mic[Mobile Browser / App Audio Recorder]
    
    Mic -->|WAV Audio File| FastAPIService[POST /transcribe<br/>FastAPI Voice Service]
    
    FastAPIService --> Whisper[OpenAI Whisper Engine]
    Whisper -->|Transcribed Text: Hindi/Marathi| NLP[Skill Extraction NLP Model]
    
    NLP -->|Extract Entities| JSONResult["Extracted JSON:<br/>{ skill: 'mason',<br/>duration_days: 2,<br/>language: 'hi' }"]
    
    JSONResult --> BackendQuery[Express API /api/v1/jobs]
    BackendQuery --> MongoNear[MongoDB 2dsphere $near query<br/>skill == 'mason' & status == 'open']
    
    MongoNear --> AudioCard[Render Simplified Visual Audio Job Cards]
    AudioCard --> WorkerDevice([Worker hears results & clicks to Apply])
```

---

## 7. Complete System Architecture & Network Topology

How all services, databases, and third-party gateways communicate across the deployment topology.

```mermaid
flowchart TB
    subgraph ClientTier [Client Tier - Mobile First PWA]
        WorkerClient["Worker App (PWA)<br/>• Noto Sans Devanagari<br/>• 48px Large Touch UI<br/>• Voice & Camera API"]
        ContractorClient["Contractor App<br/>• Desktop & Mobile Web<br/>• Live Socket Monitor<br/>• Razorpay Checkout"]
    end

    subgraph GatewayTier [Load Balancing & Reverse Proxy]
        Nginx["Nginx / Cloudflare<br/>• SSL Termination<br/>• Rate Limiting<br/>• Static Asset Caching"]
    end

    subgraph ServiceTier [Application Microservices]
        Backend["WorkPulse Backend (Node.js/Express)<br/>• REST API under /api/v1<br/>• Socket.io Gateway<br/>• Escrow State Engine<br/>• JWT & RBAC Auth"]
        VoiceService["Voice Service (Python FastAPI)<br/>• Whisper Speech-to-Text<br/>• Hindi/Marathi Entity Parser<br/>• Port 8000"]
    end

    subgraph DataTier [Storage & Persistence]
        MongoDB[("MongoDB 7<br/>• 2dsphere GeoJSON Indexes<br/>• Immutable Ledger Collection<br/>• High-frequency Attendance")]
    end

    subgraph ExternalTier [External Third-Party APIs]
        RazorpayGateway["Razorpay / RazorpayX<br/>• Escrow Fund Capture<br/>• Instant UPI Disbursal"]
        SmsGateway["SMS Gateway (Fast2SMS / Twilio)<br/>• Phone OTP Verification<br/>• Payment Credit SMS Alerts"]
        CloudStorage["Object Storage (S3 / R2 / GCS)<br/>• Geo-tagged Selfie Photos<br/>• Incident Site Photos"]
    end

    ClientTier -->|HTTPS / WSS| GatewayTier
    GatewayTier -->|/api/v1 & WebSockets| Backend
    GatewayTier -->|/voice| VoiceService

    Backend -->|Internal REST| VoiceService
    Backend -->|Mongoose Connection| MongoDB

    Backend -->|Payments & UPI| RazorpayGateway
    Backend -->|OTP & Alerts| SmsGateway
    Backend -->|Signed Upload URLs| CloudStorage
```
