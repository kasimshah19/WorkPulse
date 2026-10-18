# WorkPulse – Architecture

## Overview

WorkPulse is a three-tier platform connecting daily-wage workers with contractors through geo-based job matching, proof-of-work attendance tracking, and escrow-protected payments.

## High-Level Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Frontend   │────▶│   Backend API    │────▶│    MongoDB      │
│  (Next.js)  │◀────│  (Express +      │     │  (GeoJSON +     │
│  PWA        │ WS  │   Socket.io)     │     │   2dsphere)     │
└─────────────┘     └────────┬─────────┘     └─────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Voice Service  │
                    │  (FastAPI)      │
                    └─────────────────┘
```

## Services

### Frontend (Next.js PWA)
- Mobile-first, high-contrast UI
- Multi-language support (Hindi, Marathi, English)
- Offline-capable via service worker
- Socket.io for real-time updates

### Backend API (Express)
- RESTful API under `/api/v1`
- JWT authentication (phone/OTP)
- Socket.io for job broadcasts and attendance events
- Escrow state machine for payment lifecycle
- Geo-queries for radius-based job matching

### Voice Service (FastAPI)
- Speech-to-text transcription
- Skill extraction from spoken input
- Language detection

### Database (MongoDB)
- GeoJSON Point with 2dsphere indexes for location queries
- Append-only ledger for financial audit trail
- Idempotency keys on escrow transactions

## TODO
<!-- Phase 1+: Add detailed component diagrams, sequence diagrams, deployment topology -->
