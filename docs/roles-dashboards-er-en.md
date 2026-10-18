# WorkPulse – Roles, Dashboards & ER Architecture (English)

---

## 1. Platform Roles

WorkPulse is architected around **three primary roles**:

| Role | Target Persona | Key Responsibilities & Value Proposition |
|---|---|---|
| **1. Worker** | Daily-wage laborers, masons, carpenters, plumbers, electricians, loaders | • Discover nearby work within a geo-radius.<br>• Voice-based search and profile creation.<br>• Geofenced GPS check-in/out with selfie proof-of-work.<br>• Instant, guaranteed daily payout via UPI upon approval. |
| **2. Contractor** | Sub-contractors, civil engineers, site supervisors, individual homeowners | • Post job specifications (skill, workers required, wage, site radius).<br>• Lock payments in escrow (via Razorpay) before work commences.<br>• Monitor real-time worker arrivals and selfie verifications.<br>• 1-click escrow approval/release or dispute raising. |
| **3. Admin / Arbitrator** | WorkPulse platform operations, support and dispute resolution officers | • Audit and arbitrate disputed escrow funds using GPS and selfie evidence.<br>• Detect and prevent GPS spoofing, mock locations, or abuse.<br>• Maintain the append-only double-entry financial ledger. |

---

## 2. Complete Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ JOBS : "posts (Contractor)"
    USERS ||--o{ ATTENDANCES : "checks-in (Worker)"
    USERS ||--o{ ESCROW_TRANSACTIONS : "funds (Contractor)"
    USERS ||--o{ ESCROW_TRANSACTIONS : "receives (Worker)"
    USERS ||--o{ RATINGS : "gives / receives"
    USERS ||--o{ INCIDENTS : "reports"

    JOBS ||--o{ ATTENDANCES : "tracks"
    JOBS ||--o{ ESCROW_TRANSACTIONS : "holds payment"
    JOBS ||--o{ RATINGS : "evaluated on"
    JOBS ||--o{ INCIDENTS : "occurs during"

    ESCROW_TRANSACTIONS ||--o{ LEDGER_ENTRIES : "generates audit trail"

    USERS {
        ObjectId _id PK
        string name "Full Name"
        string phone UK "Unique 10-digit mobile number"
        string role "worker | contractor | admin"
        string[] skills "e.g., ['mason', 'carpenter']"
        Point location "GeoJSON [lon, lat] 2dsphere index"
        string languagePreference "hi | en | mr"
        string upiId "worker@upi"
        boolean isVerified "KYC / OTP verified flag"
        datetime createdAt
    }

    JOBS {
        ObjectId _id PK
        ObjectId contractor FK "Reference to USERS"
        string title "Mason needed for 3 days"
        string skillRequired "e.g., 'mason'"
        number workersNeeded "Number of required workers"
        number wagePerDay "Daily wage in INR"
        date startDate
        date endDate
        Point location "GeoJSON [lon, lat] 2dsphere index"
        number radiusMeters "Geofence boundary (e.g., 500m)"
        string status "draft | open | in_progress | completed | cancelled"
        ObjectId[] assignedWorkers FK "References to USERS"
        datetime createdAt
    }

    ATTENDANCES {
        ObjectId _id PK
        ObjectId job FK "Reference to JOBS"
        ObjectId worker FK "Reference to USERS"
        datetime checkInAt "Check-in timestamp"
        datetime checkOutAt "Check-out timestamp"
        Point checkInLocation "GPS coordinates at check-in"
        Point checkOutLocation "GPS coordinates at check-out"
        string selfieUrl "Proof-of-work photo URL"
        number distanceFromSite "Distance from job center in meters"
        datetime createdAt
    }

    ESCROW_TRANSACTIONS {
        ObjectId _id PK
        ObjectId job FK "Reference to JOBS"
        ObjectId contractor FK "Contractor User ID"
        ObjectId worker FK "Worker User ID"
        number amount "INR held in escrow"
        string status "CREATED | FUNDED | CHECKED_IN | CHECKED_OUT | APPROVED | RELEASED | DISPUTED | CANCELLED"
        string idempotencyKey UK "UUID preventing duplicate billing"
        datetime createdAt
        datetime updatedAt
    }

    LEDGER_ENTRIES {
        ObjectId _id PK
        ObjectId transaction FK "Reference to ESCROW_TRANSACTIONS"
        string type "DEBIT | CREDIT"
        string account "CONTRACTOR_HOLDING | WORKER_PAYOUT | PLATFORM_FEE"
        number amount "INR amount"
        number balanceAfter "Account balance post-transaction"
        datetime createdAt "Immutable timestamp"
    }

    RATINGS {
        ObjectId _id PK
        ObjectId job FK "Reference to JOBS"
        ObjectId fromUser FK "Rater User ID"
        ObjectId toUser FK "Rated User ID"
        number score "Rating between 1 and 5"
        string type "worker_skill | contractor_payment_safety"
        string comment "Optional feedback"
        datetime createdAt
    }

    INCIDENTS {
        ObjectId _id PK
        ObjectId job FK "Reference to JOBS"
        ObjectId reportedBy FK "Reporter User ID"
        Point location "GPS coordinates"
        string severity "low | medium | high | critical"
        string type "SOS | injury | dispute"
        string status "open | investigating | resolved | closed"
        string notes "Incident description"
        datetime createdAt
    }
```

---

## 3. High-Level Dashboard Navigation Architecture

```mermaid
flowchart TD
    Landing[WorkPulse Home / Landing Page] --> Auth[Phone OTP Authentication & Role Detection]
    
    Auth -->|Role = Worker| WD[1. Worker Dashboard]
    Auth -->|Role = Contractor| CD[2. Contractor Dashboard]
    Auth -->|Role = Admin| AD[3. Admin / Arbitrator Dashboard]

    subgraph WD_Views [Worker Sub-Views - /worker/*]
        WD --> W1[Jobs: Radius-based local discovery]
        WD --> W2[Attendance: Geofenced GPS & selfie proof]
        WD --> W3[Wallet: Escrow balance & instant UPI payout]
        WD --> W4[SOS: Emergency safety trigger]
    end

    subgraph CD_Views [Contractor Sub-Views - /contractor/*]
        CD --> C1[Post Job: Geo-tagged work requirements]
        CD --> C2[Monitor: Live real-time site attendance]
        CD --> C3[Escrow: Razorpay deposit & 1-click release]
        CD --> C4[Ratings: Worker performance evaluation]
    end

    subgraph AD_Views [Admin Sub-Views - /admin/*]
        AD --> A1[Disputes: Arbitration tribunal]
        AD --> A2[Ledger: Double-entry financial audit]
        AD --> A3[Fraud: Anti-spoofing & anomaly detection]
        AD --> A4[Health: System metrics & socket monitoring]
    end
```

---

## 4. Dashboard 1: Worker Dashboard (`/worker/dashboard`)

```mermaid
flowchart TB
    subgraph WorkerFlow [Worker Daily Operational Flow]
        W_Home[Worker Home View] --> W_Find[1. Find Nearby Work]
        W_Find -->|Geo-query within 5-10km| W_Apply[Review Wage & Apply]
        
        W_Apply -->|Assigned by Contractor| W_Travel[Commute to Site]
        W_Travel --> W_Att[2. Proof-of-Work Attendance]
        
        W_Att --> GeofenceCheck{Is Worker within Site Radius?}
        GeofenceCheck -->|No| Denied[Check-in Disabled: Outside Site Boundary]
        GeofenceCheck -->|Yes| Cam[Camera Activated -> Capture Selfie -> Check-in Recorded]
        
        Cam --> W_Work[Perform Daily Work Shift]
        W_Work --> W_Out[End of Day -> Clock Out]
        
        W_Out --> W_Paid[3. Wallet & Payout]
        W_Paid -->|Contractor Approves| UPI[Instant Bank Payout via UPI]
    end
```

### Key Capabilities:
* **Large Touch Targets (min 48px)**: Designed for one-handed operation on low-cost Android smartphones.
* **Geofence Enforcement**: Workers can only check in if their device GPS coordinates are within the configured job boundary (e.g., 500m).
* **Voice-First Search (Phase 5)**: Workers can speak in Hindi, Marathi, or English to find matching jobs.
* **One-Tap Emergency SOS**: Immediately transmits live GPS coordinates and contacts site supervisor and platform response teams.

---

## 5. Dashboard 2: Contractor Dashboard (`/contractor/dashboard`)

```mermaid
flowchart TB
    subgraph ContractorFlow [Contractor Operational Lifecycle]
        C_Home[Contractor Home View] --> C_Post[1. Post Job Requisition]
        C_Post --> Form[Set Skills, GPS Location, Geofence Radius, Daily Wage]
        
        Form --> C_Escrow[2. Fund Escrow Account via Razorpay]
        C_Escrow -->|Funds Safely Locked| C_Live[3. Real-Time Site Supervision]
        
        C_Live -->|Live Socket.io Feed| CheckinView[Inspect Workers Arrival, GPS Proximity & Selfie]
        
        CheckinView --> DayEnd{End of Day Work Verification}
        DayEnd -->|Satisfactory Work| Release[Approve Work -> Instant Escrow Release to Worker]
        DayEnd -->|Incomplete / Dispute| RaiseDispute[Raise Dispute -> Escalates to Admin Arbitration]
    end
```

### Key Capabilities:
* **Geofence Job Definition**: Contractors drop a pin on a map and specify an allowable radius (e.g., 500 meters).
* **Guaranteed Escrow Protection**: Contractors deposit funds upfront, building trust with daily workers without risking unearned disbursement.
* **Live Site Supervision**: Real-time websocket stream of checked-in workers, arrival times, and timestamped selfie verification photos.
* **Frictionless Payout Approval**: 1-click end-of-day release, eliminating manual cash handoffs.

---

## 6. Dashboard 3: Admin & Dispute Dashboard (`/admin/dashboard`)

```mermaid
flowchart TB
    subgraph AdminFlow [Arbitration & Financial Integrity Lifecycle]
        DisputeQueue[Pending Dispute Queue] --> SelectDispute[Select Disputed Job Escrow]
        
        SelectDispute --> Evidence[Triangulate Evidence]
        Evidence --> Ev1[Worker GPS Coordinates & Check-in/out Timestamps]
        Evidence --> Ev2[Timestamped Geo-tagged Selfie Verification]
        Evidence --> Ev3[Contractor Claim & Site Inspection Photos]
        
        Evidence --> Adjudication{Arbitration Decision}
        Adjudication -->|Worker Fulfilled Work| ForceRelease[Force Escrow Release to Worker]
        Adjudication -->|Worker Absent / Invalid| ForceRefund[Refund Funds to Contractor]
        Adjudication -->|Partial Completion| SplitWage[Split Escrow Payout]
        
        ForceRelease --> Ledger[Record Immutable Double-Entry Ledger Entry]
        ForceRefund --> Ledger
        SplitWage --> Ledger
    end
```

### Key Capabilities:
* **Evidence-Based Arbitration**: Resolves disputes impartially by cross-referencing worker GPS logs, device accuracy, and verified selfies against contractor claims.
* **Immutable Double-Entry Ledger**: Every state transition (CREATED, FUNDED, APPROVED, RELEASED, REFUNDED) generates an immutable, append-only ledger transaction.
* **Anti-Spoofing & Fraud Detection**: Flags simulated GPS apps, unrealistic commute velocities, or duplicate identities.
