# WorkPulse Post-Phase 8 Roadmap & Future Work

**Date**: 2026-10-22  
**Context**: Phase 8 Feature Freeze & Hardening Completion  

During Phase 8, strict feature freeze discipline was enforced to guarantee reliability, zero financial drift, security hardening, and test coverage. This document captures high-value architectural initiatives and product features deliberately scheduled for subsequent development phases.

---

## 1. Trust, Identity & Fraud Prevention

### 1.1 Biometric Facial Liveness & Anti-Spoofing
- **Current State**: Workers capture a geo-tagged selfie during check-in; image is stored and reviewed on demand by contractors and admins.
- **Future Architecture**:
  - Client-side or edge TensorFlow Lite / WebAssembly liveness detection (blink detection, subtle head turn).
  - Face embedding extraction to prevent "buddy punching" (Worker A clocking in on behalf of Worker B).

### 1.2 Automated Aadhaar OCR & Vault Compliance
- **Current State**: Aadhaar numbers are validated using Verhoeff checksum algorithm and stored in masked format (`XXXX-XXXX-1234`).
- **Future Architecture**:
  - Real-time OCR document scanning using Tesseract / Google Cloud Vision to auto-populate name, DOB, and photo.
  - Dedicated UIDAI Aadhaar Vault hardware security module (HSM) compliance.

---

## 2. Voice, Telephony & Offline Accessibility

### 2.1 IVR (Interactive Voice Response) for Feature Phones
- **Current State**: Workers access voice onboarding and job matching via browser Web Audio API in the Next.js PWA.
- **Future Architecture**:
  - SIP trunk integration with telecom aggregators (e.g. Exotel, Twilio India, Tata Tele).
  - Workers can dial a toll-free number (1800-XXX-XXXX) from a basic non-smart phone.
  - Telephony audio streamed to FastAPI Whisper microservice for intent recognition and automated job discovery.

### 2.2 Offline Attendance Queueing with Cryptographic Proof
- **Current State**: PWA displays a bilingual offline warning and caches app shell; attendance check-in requires network access (`NetworkOnly` cache boundary) to guarantee real-time escrow locking.
- **Future Architecture**:
  - Local QR-code peer-to-peer exchange: Worker app generates a time-bounded signed BLE/NFC or QR packet; Contractor scans locally while offline; combined signed packet syncs to server once either party regains connectivity.

---

## 3. Financial Infrastructure & Multi-Gateway Redundancy

### 3.1 Multi-Gateway Payment Orchestration
- **Current State**: Payments and UPI payouts run through Razorpay mock and test mode.
- **Future Architecture**:
  - Dynamic payment orchestration routing between Razorpay, Cashfree, and PayU based on gateway uptime, fee tiers, and latency.
  - Instant fallback routing if Webhook delivery from primary gateway exceeds 15 seconds.

### 3.2 Automated GST & Tax Invoicing
- **Current State**: All wages and platform fees are logged in paise in the double-entry ledger.
- **Future Architecture**:
  - Automated GSTIN lookup via government API.
  - Dynamic generation of B2B Tax Invoices for contractors and self-billing receipts for workers.
  - Integration with ClearTax or GST Suvidha Providers (GSP).

---

## 4. Scalability, Infrastructure & Reliability

### 4.1 Native Mobile Applications (React Native / Flutter)
- **Current State**: Mobile-first Next.js PWA optimized for 360px viewport with service worker caching.
- **Future Architecture**:
  - Native Android application distribution via Google Play Store.
  - Background Geofencing API for battery-efficient continuous presence monitoring without keeping browser active.

### 4.2 Multi-Region Database Sharding
- **Current State**: Single MongoDB Atlas replica set hosted in `ap-south-1` (Mumbai).
- **Future Architecture**:
  - Zone sharding based on geographic region (`state` / `pincode`), localizing Pune, Bengaluru, and Delhi-NCR workloads.
  - Cross-region read replicas for low-latency job matching and public worker profile queries.
