# AREA: Kiosk Mode

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: Shipped
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
| AC-2 | iPad activation with 6-digit code | ✅ Complete |
| AC-3 | Idle screen with live stats | ✅ Complete |
| AC-4 | Checkout in ≤3 taps | ✅ Complete |
| AC-5 | Hand scanner input | ✅ Complete |
| AC-6 | Camera + manual fallbacks | ✅ Complete |
| AC-7 | Return flow | ✅ Complete |
| AC-8 | Scan lookup | ✅ Complete |
| AC-9 | 5-min inactivity timeout | ✅ Complete |
| AC-10 | Audit trail with source=KIOSK | ✅ Complete |
| AC-11 | Kiosk API rejects non-kiosk requests | ✅ Complete |
| AC-12 | PENDING_PICKUP pickup flow | ✅ Complete |
| AC-13 | Desktop scan routes gated (403) | ✅ Complete |

## Implemented Features

**AC-2 through AC-11: Full kiosk flow** (2026-04-09 → 2026-04-14)
- **Route:** `src/app/(kiosk)/kiosk/` — dedicated route group with full-screen layout (no sidebar)
- **Auth helpers:** `withKiosk()` in `src/lib/api.ts`, `requireKiosk()` in `src/lib/auth.ts` — validate kiosk session cookie, update `lastSeenAt`, throw 401 if inactive/deactivated
- **API routes** under `src/app/api/kiosk/`:
  - `POST /activate` — validates 6-digit activation code, sets `sessionToken`, sets `activated=true`
  - `GET /me` — returns kiosk identity (kioskId, locationId, locationName)
  - `POST /heartbeat` — updates `lastSeenAt`
  - `GET /dashboard` — returns live stats (active checkouts, today's events, team status)
  - `GET /users` — returns student list for avatar grid (filtered by kiosk locationId)
  - `GET /student/[userId]` — returns a student's active checkouts and reservations
  - `POST /checkout/scan` — validates item availability (read-only, no booking created yet)
  - `POST /checkout/complete` — creates booking + allocates all scanned items, logs `source: "KIOSK"`
  - `GET /checkout/[id]` — returns booking detail for return flow
  - `POST /checkin/[id]/scan` — marks individual items as returned, deactivates allocation
  - `POST /checkin/[id]/complete` — completes the check-in, logs `source: "KIOSK"`
  - `POST /scan-lookup` — returns item status by QR/tag (no state change)
  - `POST /pickup/[id]/scan` — validates a scanned item against a PENDING_PICKUP booking
  - `POST /pickup/[id]/confirm` — transitions PENDING_PICKUP → OPEN, logs `source: "KIOSK"`
- **Visual layer** in `src/app/(kiosk)/kiosk/_components/`:
  - `KioskShell` — state machine (idle → hub → checkout/pickup/return/scan-lookup → success); 5-min inactivity timer; 5s auto-return from success
  - `ActivationForm`, `IdleScreen`, `AvatarGrid`, `StudentHub`, `CheckoutFlow`, `PickupFlow`, `ReturnFlow`, `ScanInput`, `ScanLookup`, `SuccessScreen`

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
| 2026-04-14 | AC-2–AC-11 complete: Full kiosk flow shipped — activation, idle screen, avatar grid, student hub, checkout flow, return flow, scan lookup, inactivity timer, source=KIOSK audit trail, withKiosk auth on all routes. All ACs verified. |
