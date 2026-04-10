# AREA: Kiosk Mode

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: In Development
- Created: 2026-04-07
- Brief: `BRIEF_KIOSK.md`
- Decision Refs: D-030

## Description
Self-serve iPad kiosk for gear checkout/return at equipment counter. Students tap their name and scan gear — no login required. Landscape orientation, hand scanner primary input.

## Components
- `/kiosk` route group with dedicated layout (full-screen, no navigation chrome)
- `KioskDevice` model for device-level authentication
- `ScanInput` component: hand scanner + camera + manual entry
- Idle screen, student hub, checkout/return flows, scan lookup

## Acceptance Criteria Status

| ID | Criterion | Status |
|----|-----------|--------|
| AC-1 | Admin CRUD for kiosk devices | ✅ Complete |
| AC-2 | iPad activation with 6-digit code | Not started |
| AC-3 | Idle screen with live stats | Not started |
| AC-4 | Checkout in ≤3 taps | Not started |
| AC-5 | Hand scanner input | Not started |
| AC-6 | Camera + manual fallbacks | Not started |
| AC-7 | Return flow | Not started |
| AC-8 | Scan lookup | Not started |
| AC-9 | 5-min inactivity timeout | Not started |
| AC-10 | Audit trail with source=KIOSK | Not started |
| AC-11 | Kiosk API rejects non-kiosk requests | Not started |

## Implemented Features

**AC-1: Admin CRUD for kiosk devices** (2026-04-07 → 2026-04-09)
- **Route:** `src/app/(app)/settings/kiosk-devices/page.tsx`
- **Model:** `KioskDevice` with fields: name, locationId, active (boolean), activated (boolean), activatedAt (timestamp), lastSeenAt (timestamp)
- **API Endpoints:**
  - `POST /api/kiosk-devices` — Create device with name and location
  - `PATCH /api/kiosk-devices/[id]` — Toggle active flag (enable/disable device)
  - `DELETE /api/kiosk-devices/[id]` — Delete device record
  - `GET /api/kiosk-devices` — List all devices
- **UI:** Settings page shows device list (name, location, active status, last seen time) with Add Device button (opens form dialog), toggle active switch, and delete button (confirm dialog).
- **Activation Code:** Dialog displays 6-digit activation code on device creation; code copied to clipboard via Copy button.
- **Access:** ADMIN/STAFF only; 401 redirect on all mutations.

## Change Log
| Date | Change |
|------|--------|
| 2026-04-07 | Area doc created, all ACs pending |
| 2026-04-09 | AC-1 complete: Admin CRUD for kiosk devices shipped at `/settings/kiosk-devices`. Device model + API endpoints + settings page UI. Activation code generation. Updated AREA doc. |
