# WorkPulse PWA & Offline Strategy Specification

## 1. Overview
WorkPulse operates as a Progressive Web Application (PWA) designed for low-end mobile devices and intermittent 2G/3G connectivity typical of Indian construction sites. The architecture strictly enforces financial safety invariants by differentiating between safe-to-cache UI shells and strictly non-cacheable money/attendance operations.

---

## 2. Web App Manifest
- **Manifest Location**: `frontend/public/manifest.json`
- **Display Mode**: `standalone`
- **Theme Color**: `#ea580c` (WorkPulse Amber/Orange)
- **Background Color**: `#0f172a` (Slate 950 Dark Theme)
- **Icons**: Scalable SVG and maskable web app icon assets.

---

## 3. Caching Strategy Matrix

| Resource Type | Pattern / Route | Service Worker Strategy | Rationale & Safety Boundary |
|---|---|---|---|
| **Money & Ledger Mutations** | `/api/v1/wallet/*`, `/api/v1/payments/*` | `NetworkOnly` | **STRICT NON-CACHEABLE**: Financial transactions must reach the ACID MongoDB replica set; offline caching of balances or ledger debits would violate double-entry conservation invariants. |
| **Escrow Operations** | `/api/v1/escrow/*` | `NetworkOnly` | **STRICT NON-CACHEABLE**: Escrow locks, releases, and refunds require strict real-time consensus. |
| **Attendance Verification** | `/api/v1/jobs/:id/attendance/*`, `/api/v1/attendance/*` | `NetworkOnly` | **STRICT NON-CACHEABLE**: Clock-in and clock-out require live GPS geofencing, selfie upload, and server-side clock drift checks. |
| **Disputes & Incidents** | `/api/v1/disputes/*`, `/api/v1/incidents/*` | `NetworkOnly` | Real-time safety and legal disputes cannot accept stale or duplicated local state. |
| **Authentication & Sessions** | `/api/v1/auth/*` | `NetworkOnly` | Security tokens (access JWT + rotating refresh cookie) must be verified live against database sessions. |
| **Skills & Catalogs** | `/api/v1/voice/skills` | `NetworkFirst` | Public catalog metadata remains usable during momentary drops; falls back to 24-hour cached copy. |
| **Static Images & Icons** | `\.(?:png\|jpg\|jpeg\|svg\|webp\|ico)$` | `StaleWhileRevalidate` | Instant loading of UI iconography, worker category avatars, and site branding. |
| **Fonts & Web Typography** | `\.(?:woff\|woff2\|ttf)$` | `StaleWhileRevalidate` | Prevents layout shift (CLS) and ensures immediate typography rendering. |
| **Next.js JavaScript Chunks** | `/_next/static/*` | `StaleWhileRevalidate` | Cached for 7 days with background revalidation on new deployments. |

---

## 4. Offline Fallback & User Experience
1. **Live Offline Banner (`OfflineBanner.js`)**:
   - Detects `navigator.onLine` and `online`/`offline` window events.
   - Displays an unambiguous bilingual warning: `"आप ऑफ़लाइन हैं (No Internet). हाज़िरी और पैसे से जुड़े काम ऑनलाइन होने पर ही चलेंगे।"`.
2. **Action Disabling**:
   - Money release, withdrawal, and attendance clock-in buttons require network connectivity; offline attempts show friendly Hindi guidance without silent background queuing that could lead to double-charges.
3. **Session Resiliency**:
   - Short 15-minute access JWT kept in client memory (`useAuthStore`).
   - On 401 response or socket `auth:expired` event, single in-flight `POST /api/v1/auth/refresh` transparently recovers the session using the httpOnly `workpulse_refresh` cookie without user disruption.
