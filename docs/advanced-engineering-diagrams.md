# WorkPulse – Advanced Engineering & Security Diagrams

This document contains 6 critical engineering diagrams for the WorkPulse platform, covering financial invariants, anti-fraud geofencing, emergency SOS routing, double-entry ledger settlement, low-literacy onboarding, and production deployment topology.

---

## 1. Escrow State Machine & Financial Invariants

WorkPulse uses a deterministic finite-state automaton (FSA) for escrow transactions. Every state transition is mathematically verified against strict actor permissions and produces an immutable double-entry ledger event.

```mermaid
stateDiagram-v2
    [*] --> CREATED: Contractor posts job requisition
    
    CREATED --> FUNDED: Contractor pays via Razorpay Gateway
    CREATED --> CANCELLED: Contractor cancels before funding
    
    FUNDED --> CHECKED_IN: Worker arrives & passes GPS geofence (<500m)
    FUNDED --> CANCELLED: Contractor cancels (100% auto-refund to contractor)
    FUNDED --> DISPUTED: Worker no-show after shift start time
    
    CHECKED_IN --> CHECKED_OUT: Worker clocks out after shift completion
    CHECKED_IN --> DISPUTED: Injury / Site conflict / Walkout
    
    CHECKED_OUT --> APPROVED: Contractor reviews work & approves
    CHECKED_OUT --> DISPUTED: Contractor challenges attendance or workmanship
    
    APPROVED --> RELEASED: Instant UPI Payout via RazorpayX
    
    DISPUTED --> APPROVED: Admin arbitration decides in favor of Worker
    DISPUTED --> CANCELLED: Admin arbitration decides in favor of Contractor (Refund)
    DISPUTED --> RELEASED: Admin issues split payout (e.g. 50/50 partial release)
    
    RELEASED --> [*]: Final State (Funds Credited)
    CANCELLED --> [*]: Final State (Funds Returned)

    note right of FUNDED
      Funds locked in Platform Escrow Pool.
      Cannot be withdrawn by either party
      without validation or arbitration.
    end note

    note right of RELEASED
      Double-Entry Invariant:
      Sum(Debits) == Sum(Credits)
      Zero financial leakage.
    end note
```

---

## 2. Geo-Fencing & Anti-Spoofing Security Verification Pipeline

To protect contractors from proxy attendance and fake check-ins, the backend executes a 5-layer anti-fraud pipeline before approving any check-in.

```mermaid
flowchart TD
    WorkerCheckin[Worker clicks 'Check-In' on Mobile App] --> L1[Layer 1: Device Telemetry Inspection]
    
    L1 --> CheckMock{Is Mock Location / Fake GPS detected?}
    CheckMock -->|Yes| FlagFraud1[Reject: Mock GPS Detected & Log Fraud Attempt]
    CheckMock -->|No| L2[Layer 2: Location Accuracy Verification]
    
    L2 --> CheckAccuracy{Is GPS Accuracy < 30 meters?}
    CheckAccuracy -->|No: Weak Signal| RetryGPS[Prompt: Move to open sky & Retry]
    CheckAccuracy -->|Yes| L3[Layer 3: Haversine Geofence Boundary Check]
    
    L3 --> HaversineCalc[Calculate distance: Worker GPS coords vs Job Site GPS coords]
    HaversineCalc --> CheckRadius{Distance <= Job Radius e.g. 500m?}
    CheckRadius -->|No| RejectDistance[Reject: Too far from job site]
    CheckRadius -->|Yes| L4[Layer 4: Real-time Camera & EXIF Audit]
    
    L4 --> CheckCamera{Is Photo captured live via App Camera?}
    CheckCamera -->|No: Gallery Upload| RejectGallery[Reject: Gallery uploads not permitted]
    CheckCamera -->|Yes| CheckTimestamp{Photo Timestamp matches Server Time within 2 mins?}
    CheckTimestamp -->|No| RejectTime[Reject: Stale Photo]
    CheckTimestamp -->|Yes| L5[Layer 5: Velocity & Anomaly Check]
    
    L5 --> CheckSpeed{Did worker commute at realistic speed < 120 km/h?}
    CheckSpeed -->|No: Teleportation| RejectSpeed[Flag: Impossible transit velocity]
    CheckSpeed -->|Yes| ValidCheckin[SUCCESS: Check-In Approved & Broadcasted via Socket.io]
```

---

## 3. Emergency SOS & Incident Escalation Workflow

When a worker faces physical danger, site hazards, or an emergency, tapping the high-contrast SOS button triggers an instant, multi-channel broadcast.

```mermaid
sequenceDiagram
    autonumber
    actor W as Worker in Distress
    participant App as WorkPulse Mobile App
    participant B as Backend API
    participant SMS as SMS / WhatsApp Gateway
    participant WS as Socket.io Alert Gateway
    actor C as Contractor / Site Supervisor
    actor Team as WorkPulse Safety & Police Response

    W->>App: Presses Large Red SOS Button (Holds 2 seconds)
    App->>App: Fetch high-priority current GPS coordinates
    App->>B: POST /api/v1/incidents (type: 'SOS', severity: 'critical', coords)
    
    par Real-Time Dashboard Siren
        B->>WS: Emit 'emergency:sos_broadcast' (jobId, workerName, locationPin)
        WS-->>C: Flashing Red Siren on Contractor Dashboard + High-Pitch Alarm
    and Emergency SMS with Google Maps Link
        B->>SMS: Send SMS to Contractor & Worker's Emergency Contact
        Note over SMS,C: "EMERGENCY: Worker Ramesh Kumar triggered SOS at site! Location: maps.google.com/?q=28.53,77.39"
    and Rapid Platform Escalation
        B->>Team: Alert WorkPulse 24x7 Safety Command Center
        Team->>C: Direct Phone Call to Contractor
        Team->>W: Direct Phone Call / Dispatch local assistance
    end

    B->>App: Audio-visual confirmation ("मदद भेजी जा रही है / Help is being notified")
```

---

## 4. Low-Literacy & Voice-First Onboarding Architecture

Over 70% of daily-wage workers in India face literacy barriers. This diagram illustrates how a worker onboarded in under 60 seconds without typing a single word.

```mermaid
flowchart LR
    Start([App Opened by Worker]) --> Lang[1. Visual Flag / Language Select:<br/>हिंदी / मराठी / English]
    Lang --> AudioIntro[Automatic Audio Greeting:<br/>'अपना 10 अंकों का मोबाइल नंबर बोलें']
    
    AudioIntro --> VoiceInput[Worker Speaks Phone Number]
    VoiceInput --> FastAPIVoice[Voice Service: Whisper STT]
    FastAPIVoice --> Digits[Extracted 10-digit number]
    
    Digits --> SendOTP[SMS Gateway sends 4-digit OTP]
    SendOTP --> AutoRead[Android SMS Retriever API<br/>Auto-reads OTP without typing]
    
    AutoRead --> VoiceSkills[Audio Prompt:<br/>'आप क्या काम करते हैं? जैसे मिस्त्री, बढ़ई']
    VoiceSkills --> WorkerTrade[Worker speaks: 'मिस्त्री का काम करता हूँ']
    
    WorkerTrade --> FastAPIVoice2[Voice Service: Skill Extraction NLP]
    FastAPIVoice2 --> SkillBadge[Assigned Trade Badge: 🧱 Rajmistri / Mason]
    
    SkillBadge --> GPSDetect[Auto-detect Home Pin via GPS]
    GPSDetect --> ReadyProfile([Profile Complete in 60s<br/>Ready to receive work!])
```

---

## 5. Double-Entry Financial Settlement & Platform Fee Flow

WorkPulse implements double-entry bookkeeping. For every rupee deposited or disbursed, matching debit and credit entries ensure zero reconciliation discrepancies.

```mermaid
flowchart TD
    subgraph FundingPhase [1. Escrow Funding Phase]
        ContractorBank[(Contractor Bank Account)] -->|Razorpay Payment ₹1,000| PlatformPool[(WorkPulse Escrow Pool Account)]
        PlatformPool -.->|Ledger Record| L1["Credit: CONTRACTOR_HOLDING_ACC (+₹1,000)<br/>Debit: BANK_CASH_INFLOW (+₹1,000)"]
    end

    subgraph ShiftCompletion [2. Work Shift & Approval Phase]
        L1 --> EscrowHold[(Held securely during shift)]
        EscrowHold --> WorkApproved{Contractor clicks<br/>'Approve Work'}
    end

    subgraph SettlementPhase [3. Settlement & Disbursal Phase]
        WorkApproved --> PayoutEngine[Automated Settlement Engine]
        
        PayoutEngine -->|₹950 Daily Wage| WorkerUPI[(Worker UPI Account)]
        PayoutEngine -->|₹30 Platform Fee 3%| PlatformRevenue[(WorkPulse Revenue Account)]
        PayoutEngine -->|₹20 Worker Insurance Fund| InsurancePool[(Worker Safety & Medical Pool)]
        
        PayoutEngine -.->|Ledger Record| L2["Debit: CONTRACTOR_HOLDING_ACC (-₹1,000)<br/>Credit: WORKER_PAYOUT_ACC (+₹950)<br/>Credit: PLATFORM_FEE_ACC (+₹30)<br/>Credit: INSURANCE_FUND_ACC (+₹20)"]
    end
```

---

## 6. Production Container Topology & CI/CD Deployment

Shows how the frontend, API backend, Python voice microservice, and MongoDB cluster are orchestrated with Docker and Nginx reverse proxy.

```mermaid
flowchart TB
    subgraph GitHubRepo [Source Code Repository]
        Git[GitHub: kasimshah19/WorkPulse] --> Actions[GitHub Actions CI/CD]
    end

    Actions -->|Automated Tests| TestSuite{Tests Pass?}
    TestSuite -->|npm test + pytest| BuildImages[Docker Multi-Stage Build]
    
    subgraph ProductionHost [Production Cloud Server / VPS]
        NginxProxy["Nginx Reverse Proxy (Port 80/443)<br/>• Let's Encrypt SSL<br/>• WebSockets / WSS forwarding<br/>• Gzip & Asset Cache"]
        
        subgraph DockerCompose [Docker Compose Network: workpulse-net]
            FrontendContainer["Container: workpulse-frontend<br/>• Next.js 14 Production Server<br/>• Internal Port 3000"]
            
            BackendContainer["Container: workpulse-backend<br/>• Node.js / Express REST API<br/>• Socket.io Clustering<br/>• Internal Port 5000"]
            
            VoiceContainer["Container: workpulse-voice<br/>• Python FastAPI + Uvicorn<br/>• Whisper STT Microservice<br/>• Internal Port 8000"]
            
            MongoContainer[("Container: workpulse-mongo<br/>• MongoDB 7.0 Engine<br/>• Volume: /data/db<br/>• Port 27017")]
        end
    end

    BuildImages -->|Deploy| DockerCompose

    NginxProxy -->|workpulse.in /| FrontendContainer
    NginxProxy -->|workpulse.in/api/v1| BackendContainer
    NginxProxy -->|workpulse.in/socket.io| BackendContainer
    
    BackendContainer -->|HTTP JSON requests| VoiceContainer
    BackendContainer -->|Mongoose Pool| MongoContainer
```
