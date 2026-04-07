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
| AC-1 | Admin CRUD for kiosk devices | Not started |
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

## Change Log
| Date | Change |
|------|--------|
| 2026-04-07 | Area doc created, all ACs pending |
