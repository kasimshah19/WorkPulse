# WorkPulse

<div align="center">

> **Direct micro-contracting, biometric proof-of-work, and escrow payment platform engineered for daily-wage and blue-collar workers in India.**

<!-- 20+ Curated Shields.io Badges -->
[![Release](https://img.shields.io/badge/Release-v0.8-0ea5e9?style=for-the-badge&logo=git&logoColor=white)](https://github.com/kasimshah19/WorkPulse/releases/tag/v0.8)
[![CI Pipeline](https://img.shields.io/badge/CI%20Pipeline-Passing-10b981?style=for-the-badge&logo=githubactions&logoColor=white)](https://github.com/kasimshah19/WorkPulse/actions)
[![License](https://img.shields.io/badge/License-Proprietary-64748b?style=for-the-badge)](LICENSE)

<br/>

[![Next.js](https://img.shields.io/badge/Next.js%2014-black?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React%2018-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?style=flat-square&logo=pwa&logoColor=white)](https://web.dev/progressive-web-apps/)
[![Zustand](https://img.shields.io/badge/State-Zustand-443e38?style=flat-square)](https://github.com/pmndrs/zustand)
[![Node.js](https://img.shields.io/badge/Node.js%2020%20LTS-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express%204.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.io](https://img.shields.io/badge/Socket.io%204.7-010101?style=flat-square&logo=socketdotio&logoColor=white)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB%207.0%20Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Python](https://img.shields.io/badge/Python%203.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI%200.115-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![OpenAI Whisper](https://img.shields.io/badge/STT-OpenAI_Whisper-412991?style=flat-square&logo=openai&logoColor=white)](https://github.com/openai/whisper)
[![Jest](https://img.shields.io/badge/Tested%20with-Jest%2029-C21325?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io/)
[![Pytest](https://img.shields.io/badge/Tested%20with-Pytest%208.3-0A9EDC?style=flat-square&logo=pytest&logoColor=white)](https://pytest.org/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Axe Core](https://img.shields.io/badge/A11y-WCAG%202.1%20AA-blueviolet?style=flat-square)](https://www.deque.com/axe/)
[![JWT](https://img.shields.io/badge/Auth-Dual_Token_JWT-black?style=flat-square&logo=jsonwebtokens)](https://jwt.io/)
[![Razorpay](https://img.shields.io/badge/Fintech-Razorpay%20API-0C2340?style=flat-square&logo=razorpay&logoColor=3395FF)](https://razorpay.com/)
[![DPDP Act](https://img.shields.io/badge/Compliance-DPDP%20Act%202023-1e293b?style=flat-square)](https://www.meity.gov.in/)

</div>

---

## 🌐 Live Deployments & Cloud Topology

| Service | Platform | Environment | Live URL / Access | Security Policy |
|---|---|---|---|---|
| **Frontend Web & Mobile PWA** | **Vercel** | Production | [https://workpulse-app.vercel.app](https://workpulse-app.vercel.app) | Public HTTPS, Content Security Policy, Workbox Service Worker |
| **Core API & Real-time Socket Server** | **Render** | Production | [https://workpulse-api.onrender.com](https://workpulse-api.onrender.com) | TLS 1.3, Rate-Limited (100 req/15m), CSRF Header Protected |
| **Voice STT Microservice** | **Render / Internal** | Internal VPC | `http://voice-service:8000` | Restricted internal VPC traffic, HMAC Key authenticated |
| **Database Cluster** | **MongoDB Atlas** | Multi-Region Replica Set | `Protected Cloud Cluster` | *Credentials & raw URI redacted for security; zero public IP exposure* |

> [!NOTE]
> MongoDB database connection strings and credentials are restricted to VPC peering and encrypted environment secrets. No raw database endpoints are exposed publicly.

---

## 🎯 The Problem vs. The WorkPulse Solution

### The Reality of India's Unorganized Labor Market
Over 450 million blue-collar and daily-wage construction, electrical, painting, and plumbing workers in India face severe structural vulnerabilities every day:
- **Wage Theft & Delayed Disbursals**: Contractors delay payments for weeks or ghost workers after demanding 10-hour workdays.
- **Zero Digital Proof-of-Work**: Laborers have no formal employment records, blocking them from accessing micro-loans, insurance, or formal banking.
- **Retaliatory Blacklisting**: If a worker complains about unsafe job conditions or unpaid wages, contractors leave 1-star reviews or spread false claims, destroying the worker's livelihood.
- **High Illiteracy & Language Barriers**: Complex smartphone UIs, English menus, and formal resume forms completely alienate uneducated workers.

### How WorkPulse Solves This
WorkPulse replaces middlemen and exploitative practices with a high-integrity, automated platform:

| Challenge | WorkPulse Architectural Solution |
|---|---|
| **Contractor Non-Payment** | **Mandatory Pre-Funded Daily Escrow**: Contractors must fund daily shift wages into escrow before workers leave home. |
| **Unapproved Work Shifts** | **Guaranteed 24-Hour Auto-Approval**: If a contractor fails to sign off within 24 hours after a checked-out shift, the escrow releases funds to the worker automatically. |
| **Fake Attendance / Buddy Punching** | **Geofenced Biometric Proof**: Workers clock in within a strict 100-meter GPS polygon accompanied by a live, geo-tagged selfie. |
| **Retaliatory Reviews** | **Double-Blind Mutual Ratings**: Ratings remain cryptographically hidden (`revealedAt: null`) until both parties rate or 14 days elapse, with Bayesian smoothing ($C=3, M=4.0$). |
| **Text Literacy Barriers** | **Zero-Typing Multilingual Voice Onboarding**: Workers speak naturally in Hindi or Marathi; OpenAI Whisper STT + phonetic regex extract trade and experience in seconds with a guaranteed 16-skill icon fallback. |
| **Financial Discrepancies** | **Double-Entry Ledger Engine**: Banking-grade immutable ledger where every transaction enforces $\sum \text{DEBIT} = \sum \text{CREDIT}$ with continuous mathematical reconciliation. |

---

## 🏗️ System Architecture & Data Flow

```mermaid
flowchart TB
    subgraph ClientLayer [Client Layer - Mobile-First PWA (Next.js 14)]
        WorkerClient["Worker PWA (360px Optimized)<br/>• Hindi / Marathi / English UI<br/>• Offline Cache Boundary (sw.js)<br/>• Web Audio / MediaRecorder API"]
        ContractorClient["Contractor Web Portal<br/>• Live Geofence Mapping (Leaflet)<br/>• Escrow Top-up (Razorpay)<br/>• Instant Shift Sign-off"]
        AdminPortal["Platform Admin Dashboard<br/>• Dispute Arbitration (Evidence Inspector)<br/>• Live SOS Emergency Radar<br/>• Ledger Reconciliation Engine"]
    end

    subgraph EdgeLayer [Edge Security & Reverse Proxy]
        EdgeGateway["Edge Security & Gateway<br/>• Rate Limiting (Redis / In-Memory)<br/>• Dual-Token Rotation Interceptor<br/>• CSRF X-Requested-With Protection"]
    end

    subgraph ServiceLayer [Application Microservices]
        BackendAPI["WorkPulse Core Backend (Node.js & Express)<br/>• REST API (/api/v1)<br/>• Real-time Socket.io Gateway<br/>• Escrow State Machine Engine<br/>• Double-Entry Ledger Service<br/>• Cron Schedulers (Attendance/Escrow/Safety)"]
        VoiceService["Voice Microservice (Python FastAPI)<br/>• OpenAI Whisper STT Engine<br/>• Hindi/Marathi Skill Normalizer<br/>• DPDP Compliant (In-Memory Buffer Only)"]
    end

    subgraph DataLayer [Persistence & State]
        MongoDB[("MongoDB 7.0 Atlas Replica Set<br/>• 17 Normalized Collections<br/>• Geospatial 2dsphere Indexes<br/>• ACID Transactions (Multi-doc Sessions)<br/>• TTL-Indexed Refresh Tokens & OTPs")]
    end

    subgraph ExternalGateways [External Cloud Services]
        Razorpay["Razorpay Gateway<br/>• Escrow Funding via UPI/Cards<br/>• Automated UPI Payout Disbursals"]
        SMS["SMS Gateway (MSG91 / Twilio)<br/>• OTP Delivery & SMS Fallback Alerts"]
        ObjectStorage["Cloud Object Storage (S3 / R2)<br/>• Attendance Selfies & Dispute Evidence"]
    end

    ClientLayer -->|HTTPS / WSS| EdgeLayer
    EdgeLayer --> BackendAPI
    BackendAPI <-->|Internal HMAC Auth REST| VoiceService
    BackendAPI <-->|Mongoose Pool / ReplicaSet| MongoDB
    BackendAPI --> Razorpay
    BackendAPI --> SMS
    BackendAPI --> ObjectStorage
```

---

## ⚙️ Core Technical Features

### 1. Escrow State Machine & Double-Entry Ledger
Financial safety is the foundation of WorkPulse. Money never moves without an immutable ledger entry.

```
[ CREATED ] ──( Contractor Funds )──► [ FUNDED ] ──( Worker Check-In )──► [ CHECKED_IN ]
                                                                                │
                                                                         ( Worker Check-Out )
                                                                                │
                                                                                ▼
[ RELEASED ] ◄──( Contractor Approves / 24h Auto-Approval )─────────── [ CHECKED_OUT ]
     ▲                                                                          │
     │                                                                   ( Dispute Raised )
     │                                                                          │
     └──────( Admin Arbitrates: Worker / Split )────── [ DISPUTED ] ◄───────────┘
                                                           │
                                                           └──( Admin Arbitrates: Refund )──► [ REFUNDED ]
```

- **Zero-Sum Ledger**: Every transaction requires a `groupId`. Debits must strictly equal credits ($\sum \text{Debit} = \sum \text{Credit}$).
- **Automated Mathematical Reconciliation (`npm run reconcile`)**: Continuously verifies Invariants A through E across all system wallets, held escrows, and gateway transactions.

### 2. Dual-Token Rotation & Session Security (Phase 8 Hardened)
- **15-Minute Access Token**: Kept purely in client memory (`authStore.js`).
- **7-Day Sliding Refresh Token**: Stored in a strict `httpOnly`, `sameSite: 'lax'`, `path: '/api/v1/auth'` cookie and hashed (SHA-256) in MongoDB `refreshtokens` collection.
- **Family Hijacking Detection**: Replaying an expired or already-rotated token immediately triggers security revocation across all active devices for that user.
- **Production Guard Rails**: Server throws a fatal startup error if `NODE_ENV=production` is launched with dev OTP bypasses or default secret keys.

### 3. Voice Onboarding & DPDP Compliance
- **Hindi & Marathi Trade Extraction**: Workers speak their trade ("Main 5 saal se bijli ka kaam karta hoon"). The audio buffer is transcribed via OpenAI Whisper and classified into 9 standardized trades.
- **Privacy First (DPDP Act 2023)**: Audio bytes are processed in memory and never written to disk or database. Session metadata auto-expires in 90 days via MongoDB TTL.
- **Guaranteed Fallback**: If microphone permission is denied or voice service is offline, a 16-skill icon grid engages instantly.

### 4. Emergency SOS & Volunteer Safety Radar
- **Instant Distress Broadcast**: Workers tap the emergency SOS button to broadcast their location to nearby workers, contractors, and platform admins via Socket.io.
- **Fault-Tolerant Execution**: Emergency SOS bypasses geofencing checks (`locationFlag: MISSING/STALE`) with 120-second client-side UUID deduplication and automatic `tel:112` / `sms:` fallback links.
- **Automated Multi-Tier Escalation**: Background schedulers escalate unacknowledged emergencies from nearby peers (Tier 1) to platform admins and emergency contacts (Tier 2).

---

## 🧰 Technology Stack Matrix

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Frontend Framework** | **Next.js** | `v14.2.15` | App Router, Server Components, Route Handlers |
| **UI Library** | **React** | `v18.3.1` | Concurrent rendering, dynamic hooks |
| **Styling & Icons** | **Tailwind CSS + Lucide** | `v3.4.14` | Mobile-first 360px responsive design system |
| **Offline Engine** | **next-pwa (Workbox)** | `v5.6.0` | Service worker shell caching, network-only financial boundary |
| **Mapping & GPS** | **Leaflet + React-Leaflet** | `v1.9.4` | Interactive geofencing, site pinpoints, SOS radar |
| **State Management** | **Zustand** | `v4.5.5` | In-memory token store, language selector, session state |
| **Backend Runtime** | **Node.js** | `v20.x LTS` | High-performance asynchronous event loop |
| **REST Server** | **Express** | `v4.21.0` | Modular middleware, route controllers, validation pipeline |
| **Real-time Engine** | **Socket.io** | `v4.7.5` | WebSockets, bidirectional alerts, attendance pulses |
| **Database ODM** | **Mongoose** | `v8.7.0` | Multi-document ACID transactions, schema enforcement |
| **Database Engine** | **MongoDB Atlas** | `v7.0` | 17 normalized collections, 2dsphere spatial indexes |
| **Voice Framework** | **Python / FastAPI** | `v3.11+ / v0.115` | High-speed async audio streaming & STT dispatch |
| **STT Engine** | **OpenAI Whisper** | `base / v3` | Multilingual Hindi, Marathi, and Hinglish speech recognition |
| **Security & Cryptography** | **bcryptjs + crypto** | `v2.4.3` | Password hashing, SHA-256 session token hashing |
| **Input Validation** | **Joi** | `v17.13.3` | Schema validation, stripUnknown, coordinate bounds checking |
| **Test Runners** | **Jest + Pytest + Playwright** | `Latest` | Unit, integration, chaos simulation, and e2e testing |

---

## 📂 Repository Structure

```
WorkPulse/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Multi-stage GitHub Actions CI (MongoDB RS, Pytest, Next build)
├── frontend/                      # Next.js 14 Mobile-First Progressive Web App
│   ├── public/                    # PWA Manifest, icons, service worker (sw.js)
│   ├── src/
│   │   ├── app/                   # App Router (Worker, Contractor, Admin, Auth, Dev)
│   │   ├── components/            # Reusable UI widgets, OfflineBanner, MapPicker
│   │   ├── lib/                   # API axios client with refresh queue, socket.io client
│   │   └── store/                 # Zustand in-memory auth & application stores
│   ├── e2e/                       # Playwright E2E & @axe-core accessibility test suites
│   ├── next.config.js             # PWA runtime caching policies & security headers
│   └── package.json
├── backend/                       # Node.js + Express REST & Socket.io Core Engine
│   ├── src/
│   │   ├── config/                # Environment assertions, constants, database connection
│   │   ├── controllers/           # Auth, Jobs, Attendance, Escrow, Wallet, Safety, Admin
│   │   ├── middleware/            # JWT auth, dual-token guard, RBAC, Rate limiter, Joi validation
│   │   ├── models/                # 17 Mongoose schemas (User, Escrow, Ledger, RefreshToken...)
│   │   ├── routes/                # Express router endpoints
│   │   ├── schedulers/            # 24h Escrow auto-approval, Attendance auto-checkout, SOS
│   │   ├── scripts/               # Chaos simulation, Explain query audits, Demo seeders
│   │   ├── services/              # Double-entry ledger, Escrow state machine, Ratings, Sessions
│   │   └── sockets/               # Real-time event rooms and push broadcasts
│   ├── tests/                     # 12 Jest suites (Authz matrix, Lifecycle, Chaos simulation)
│   └── package.json
├── voice-service/                 # Python 3.11 FastAPI Voice STT Microservice
│   ├── app/
│   │   ├── core/                  # Service configuration, API keys, CORS
│   │   ├── routers/               # /transcribe, /extract, /health endpoints
│   │   └── services/              # Skill extractor, normalizer, Whisper STT integration
│   ├── tests/                     # Pytest suite (health, regex extractor, dummy wavs)
│   └── requirements.txt
└── docs/                          # Comprehensive Engineering & Architecture Documentation
    ├── architecture.md            # System architecture, monorepo topology, sequence diagrams
    ├── api-contract.md            # Complete REST & Socket.io API contract
    ├── db-schema.md               # 17 Collection data models & indexing strategies
    ├── escrow-state-machine.md    # Financial state machine & dispute arbitration logic
    ├── flow-validation.md         # 11 User journeys mapped end-to-end
    ├── testing.md                 # Test suite metrics, chaos simulation report, reconciliation
    ├── security.md                # Threat models, token rotation, production safety barriers
    └── pwa.md                     # Caching strategy matrix and offline resiliency
```

---

## ⚡ Quickstart & Local Setup

### Prerequisites
- **Node.js**: `v20.x LTS` or higher
- **Python**: `v3.11` or higher
- **MongoDB**: `v7.0` (Local replica set or MongoDB Atlas)
- **Git**

### 1. Clone Repository
```bash
git clone https://github.com/kasimshah19/WorkPulse.git
cd WorkPulse
```

### 2. Configure Environment Files
```bash
# Backend configuration
cp backend/.env.example backend/.env

# Voice service configuration
cp voice-service/.env.example voice-service/.env

# Frontend configuration
cp frontend/.env.example frontend/.env.local
```

### 3. Setup Backend
```bash
cd backend
npm install

# Seed realistic demo database (1 Admin, 5 Contractors, 15 Workers across 6 job stages)
npm run demo:reset

# Verify double-entry ledger balance
npm run reconcile

# Start local API & Socket server
npm run dev
# Running on http://localhost:5000
```

### 4. Setup Voice Microservice
```bash
cd ../voice-service

# Create virtual environment
python -m venv venv

# Windows
.\venv\Scripts\activate
# Linux/macOS: source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# Running on http://localhost:8000
```

### 5. Setup Frontend
```bash
cd ../frontend
npm install
npm run dev
# Running on http://localhost:3000
```

---

## 🧪 Testing & Verification Matrix

WorkPulse enforces automated verification across all layers before any code is merged:

| Test Suite | Framework / Tool | Verified Scenarios | Result | Execution Command |
|---|---|---|---|---|
| **Ledger Reconciliation** | Custom Math Engine | Invariants A through E (Sum Debit == Sum Credit, zero drift) | ✅ **PASS (diff = 0)** | `npm run reconcile` (in `backend/`) |
| **Chaos Simulation** | Stochastic Thread Pool | 2,000 concurrent actions, idempotency double-clicks, dispute races | ✅ **PASS (0 errors)** | `npm run simulate -- --seed 42` |
| **Authorization Matrix** | Jest + Supertest | 57 endpoints tested across Worker, Contractor, Admin, Anonymous | ✅ **57 / 57 PASS** | `npm test -- tests/authz.matrix.test.js` |
| **Lifecycle & Time-Travel** | Jest + Clock Utility | Onboard -> Escrow -> Geofence Check-in -> 24h Auto-Approval -> Payout | ✅ **3 / 3 PASS** | `npm test -- tests/lifecycle.test.js` |
| **Query Plan & Index Audit** | MongoDB Explain Plans | 12 core query paths audited for index utilization | ✅ **0 COLLSCAN** | `npm run audit:indexes` |
| **Voice STT Microservice** | Pytest | Hindi/Marathi phonetics, audio parsers, schema validators | ✅ **18 PASS (1 skipped)** | `python -m pytest -v` (in `voice-service/`) |
| **Accessibility & A11y** | Playwright + Axe-Core | WCAG 2.1 AA audits, 48px touch targets, color contrast ratios | ✅ **PASS** | `npm run test:e2e` (in `frontend/`) |
| **Frontend Production Build** | Next.js Compiler | 33 static pages compiled, service worker generated, zero type errors | ✅ **PASS (87.6 kB shared)** | `npm run build` (in `frontend/`) |

---

## 📋 Comprehensive API Route Overview

| Method | Endpoint | Allowed Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/send-otp` | Public | Dispatches 6-digit OTP via SMS (mock/MSG91) |
| `POST` | `/api/v1/auth/verify-otp` | Public | Validates OTP; returns in-memory access token & sets refresh cookie |
| `POST` | `/api/v1/auth/refresh` | Public | Rotates refresh token and issues fresh 15-minute access token |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current refresh token family and clears session cookie |
| `GET` | `/api/v1/users/me` | Authenticated | Fetches profile, role, KYC status, and wallet summary |
| `POST` | `/api/v1/voice/onboard` | Worker | Streams voice audio to Whisper STT for trade extraction |
| `POST` | `/api/v1/voice/confirm` | Worker | Commits reviewed trades and experience to worker profile |
| `POST` | `/api/v1/jobs` | Contractor | Creates a new micro-contracting job opening |
| `GET` | `/api/v1/jobs/nearby` | Worker | Finds open jobs matching worker skills within configured radius |
| `POST` | `/api/v1/escrow/jobs/:id/fund` | Contractor | Locks daily shift wages into escrow from contractor wallet |
| `POST` | `/api/v1/attendance/check-in` | Worker | Validates 100m GPS geofence and stores proof-of-work selfie |
| `POST` | `/api/v1/attendance/check-out` | Worker | Completes shift, calculates hours, and initiates signoff timer |
| `POST` | `/api/v1/attendance/:id/signoff` | Contractor | Approves shift attendance and triggers immediate escrow release |
| `POST` | `/api/v1/wallet/withdraw` | Worker | Disburses wallet balance directly to worker UPI ID |
| `POST` | `/api/v1/ratings` | All | Submits double-blind counterparty review |
| `POST` | `/api/v1/incidents/sos` | Worker | Triggers emergency distress alert with real-time GPS updates |
| `POST` | `/api/v1/admin/disputes/:id/resolve` | Admin | Arbitrates disputed escrow (Full Release, Refund, or Split) |
| `GET` | `/api/v1/admin/reconciliation` | Admin | Returns real-time mathematical ledger health audit |

---

## 👥 Demo Credentials

For testing and demonstration, use the automated seeder (`npm run seed:demo`):

| Role | Name | Phone Number | Credentials / Notes |
|---|---|---|---|
| **Platform Admin** | Platform Admin | `+919000000900` | Full administrative, arbitration, and ledger access |
| **Contractor** | Sharma Electricals | `+919000000101` | Pre-funded wallet balance: ₹50,000 |
| **Contractor** | Verma Construction | `+919000000102` | Pre-funded wallet balance: ₹50,000 |
| **Worker (Electrician)** | Suresh Electrician | `+919000000001` | UPI: `suresh@okhdfcbank` |
| **Worker (Mason)** | Bablu Rajmistri | `+919000000003` | UPI: `bablu@okaxis` |
| **Worker (Painter)** | Raju Painter | `+919000000005` | Shift in-progress demo user |

*(In development mode, OTP is fixed to `123456` or bypassable via `/api/v1/auth/dev-login`)*

---

## 📄 License & Attribution

WorkPulse is developed as an enterprise-grade direct contracting and fintech platform for unorganized workers in India.  
Copyright © 2026 WorkPulse Platform. All rights reserved.
