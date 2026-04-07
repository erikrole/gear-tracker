# BRIEF: Kiosk Mode

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: In Development
- Created: 2026-04-07
- Decision Refs: D-030

## Problem Statement
Pre-game checkout creates a 30-minute bottleneck. Multiple students need gear simultaneously, but each must log in individually. A dedicated kiosk iPad at the gear counter eliminates authentication friction and enables scan-and-go workflows.

## User Stories
1. As a **student**, I tap my name on the kiosk iPad, scan equipment with the hand scanner, and walk away in under 30 seconds.
2. As a **student returning gear**, I tap my name, select my checkout, scan items back in, and I'm done.
3. As a **staff member**, I glance at the kiosk idle screen to see today's schedule, active checkouts, and overdue items.
4. As an **admin**, I set up a new kiosk device in Settings by generating an activation code and entering it on the iPad.

## Scope

### In Scope
- KioskDevice model with activation code pairing
- Separate `/kiosk` route group (no sidebar, full-screen, landscape)
- Idle screen: live stats (items out, checkouts, overdue), today's schedule, active team checkouts
- Avatar grid for student identity (tap name, no password)
- Student hub: my gear, upcoming reservations, action buttons
- Scan-first checkout: scan items → Done → booking auto-created
- Return flow: select checkout → scan items back → Done
- Scan lookup: quick item status check
- ScanInput component: hand scanner primary (hidden input), camera fallback, manual entry
- Inactivity timeout (5 min → idle screen)
- Location-scoped kiosk (filters items, default location for bookings)
- Audit trail: all actions record `source: "KIOSK"` + student actorId + kioskDeviceId

### Out of Scope (Phase C+)
- Offline/degraded mode
- Reservation creation from kiosk
- Condition/damage reporting at kiosk
- Kit template selection
- Multi-language support

## Technical Design

### Authentication
- KioskDevice model: device-level auth, not user-level
- 6-digit activation code pairing (admin generates, enters on iPad)
- Long-lived session token (30 days) stored as HTTP-only cookie
- `requireKiosk()` validates device session, returns `{ kioskId, locationId }`
- Student identity passed as `actorId` on each API call (not a separate session)

### Scanning
- **Hand scanner (primary):** USB/Bluetooth barcode scanner acts as keyboard input. Hidden auto-focused `<input>` receives keystrokes, processes on Enter.
- **Camera (fallback):** Toggle to QrScanner component (existing). For when hand scanner unavailable.
- **Manual entry:** Type tag button for edge cases.
- Unified `ScanInput` component emits `onScan(value)` regardless of input mode.

### Layout
- Landscape iPad (1024×768)
- Two-column layouts throughout
- 60px+ tap targets, large text
- No sidebar, no header, no bottom nav — full-screen kiosk shell

### Data Flow
- Kiosk API routes at `/api/kiosk/*` use `withKiosk()` wrapper
- Reuse existing service-layer functions for booking/checkin logic
- Kiosk dashboard API returns stats, schedule, team checkouts in one call

## Acceptance Criteria
- [ ] AC-1: Admin can create, list, and deactivate kiosk devices in Settings
- [ ] AC-2: iPad can be activated with 6-digit code and maintains session for 30 days
- [ ] AC-3: Idle screen shows live stats, today's schedule, and team checkouts
- [ ] AC-4: Student can tap avatar to identify, then check out gear in ≤3 taps
- [ ] AC-5: Hand scanner input works seamlessly (scan → item appears in list)
- [ ] AC-6: Camera and manual entry work as fallbacks
- [ ] AC-7: Return flow: select checkout → scan items → complete
- [ ] AC-8: Scan lookup shows item status, holder, due date
- [ ] AC-9: 5-minute inactivity returns to idle screen
- [ ] AC-10: All kiosk actions produce audit trail with source=KIOSK
- [ ] AC-11: Kiosk API routes reject non-kiosk requests

## KPIs
- Checkout time: ≤30 seconds (tap name → scan → done)
- Scan success rate: ≥95%
- Zero-training usability: student can use without instruction

## Change Log
| Date | Change |
|------|--------|
| 2026-04-07 | Brief created |
