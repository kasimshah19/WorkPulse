# WorkPulse

> Direct micro-contracting, proof-of-work & escrow payment platform for daily-wage and blue-collar workers in India.

---

## Tech Stack

| Layer          | Technology                                  |
|----------------|---------------------------------------------|
| Frontend       | Next.js (App Router), Tailwind CSS, Zustand, PWA |
| Backend API    | Node.js, Express, Mongoose, Socket.io       |
| Voice Service  | Python 3.11+, FastAPI, Uvicorn              |
| Database       | MongoDB (with GeoJSON / 2dsphere indexes)   |
| Auth           | JWT (phone + OTP flow planned)              |
| Payments       | Razorpay (escrow model, Phase 3+)           |
| Real-time      | Socket.io (job broadcast, attendance)       |

---

## Folder Map

```
workpulse/
├── frontend/          Next.js PWA (mobile-first, Hindi-ready)
├── backend/           Express REST API + Socket.io
├── voice-service/     FastAPI microservice (STT + skill extraction)
├── docs/              Architecture, API contracts, DB schema, escrow state machine
├── docker-compose.yml MongoDB + backend + voice-service
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Node.js** >= 18 LTS
- **Python** >= 3.11
- **MongoDB** >= 6.0 (local or Docker)
- **Docker & Docker Compose** (optional, for containerised dev)

---

## Quick Start

### 1. Clone & Environment

```bash
git clone <repo-url> && cd workpulse

# Copy env files (fill in real values)
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp voice-service/.env.example voice-service/.env
```

### 2. Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:5000
# Health check: GET /api/v1/health
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

### 4. Voice Service

```bash
cd voice-service
python -m venv venv
# Windows: venv\Scripts\activate | Mac/Linux: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
# Health check: GET /health
```

### 5. Docker (all services)

```bash
docker compose up --build
```

---

## Phase Roadmap

| Phase | Name                          | Description                                                   |
|-------|-------------------------------|---------------------------------------------------------------|
| 0     | **Project Scaffold**          | Monorepo setup, boilerplate, health endpoints (this commit)   |
| 1     | **Auth & Onboarding**         | Phone/OTP login, profile creation, language selection          |
| 2     | **Job Posting & Matching**    | Contractor posts jobs, geo-based matching, worker discovery    |
| 3     | **Escrow & Payments**         | Razorpay integration, escrow state machine, UPI payouts        |
| 4     | **Attendance & Proof-of-Work**| GPS check-in/out, selfie verification, distance validation     |
| 5     | **Voice Interface**           | Whisper STT, skill extraction, voice-driven job search         |
| 6     | **Ratings & Trust**           | Mutual ratings, trust scores, repeat-hire preferences          |
| 7     | **Safety & Incidents**        | SOS button, injury reporting, dispute resolution               |
| 8     | **Notifications & Real-time** | SMS, push, Socket.io live updates                              |
| 9     | **Admin & Analytics**         | Admin dashboard, dispute management, platform metrics          |

---

## License

Private – All rights reserved.
