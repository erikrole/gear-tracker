# Area: Scan

## Overview
The app scan page is a camera and manual-code lookup tool for finding inventory items by tag, QR value, serial number, or primary scan code. Checkout pickup and return scans are executed by kiosk flows, not by the signed-in web app scan page.

## Architecture

```
src/app/(app)/scan/
├── page.tsx                    — lookup-only scanner and stale booking-link guard
└── _components/
    ├── types.ts                — shared type definitions
    ├── ScanControls.tsx        — camera toggle, QrScanner, manual entry, feedback banner
    └── ItemPreviewDrawer.tsx   — lookup mode item preview bottom drawer (Drawer, not Sheet)

src/hooks/
└── use-scan-submission.ts      — lookup processing, feedback auto-clear, item preview state

src/lib/
└── scan-feedback.ts            — Web Audio API tones + haptic vibration patterns (success/error/info/celebration)

src/components/
└── QrScanner.tsx               — native BarcodeDetector with ZXing polyfill (dynamic import, SSR: false)
```

## Modes

| Mode | URL Pattern | Description |
|---|---|---|
| **Lookup** | `/scan` | Free-form scan → item preview bottom sheet |
| **Legacy booking deep link** | `/scan?checkout={id}&phase=CHECKOUT|CHECKIN` | Shows a kiosk-only handoff notice and keeps the page in lookup mode |

## Key Patterns

1. **Lookup-only web contract** - app `/scan` never starts or completes booking custody scans.
2. **Kiosk execution boundary** - checkout pickup, check-in, and numbered battery unit scans run through kiosk routes.
3. **Stale deep-link guard** - old `/scan?checkout=...` URLs do not show a broken booking checklist; they show the kiosk handoff and a checkout detail link.
4. **Manual fallback** - `ScanControls` supports typed tag, QR, serial, or primary scan code values for desktop/no-camera situations.
5. **Attachment visibility** - lookup scans show attached camera items with parent camera context and SD card slot labels when the tag convention supports it.
6. **Item-family lookup** - parent/bin QR values and derived unit QR values resolve to the parent item-family context. Exact unit scans may show unit status, but app scan remains lookup-only.
7. **Feedback auto-clear** - success: 5s, error/info: 8s.

## API Dependencies

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/assets` | GET | Item lookup search |
| `/api/assets/{id}` | GET | Item detail for preview |
| `/api/checkouts/{id}/scan` | POST | Kiosk-gated 403 stub for legacy app checkout scan requests |
| `/api/checkouts/{id}/checkin-scan` | POST | Kiosk-gated 403 stub for legacy app check-in scan requests |

Kiosk execution endpoints are documented in `docs/AREA_KIOSK.md`.

## Change Log

| Date | Change |
|---|---|
| 2026-05-13 | Scan lookup polish: exact item-family unit QR scans now show the parent family, scanned unit number, unit status, and checked-out custody context while keeping app scan lookup-only. |
| 2026-05-13 | Item-family lookup: app scan now resolves parent/bin QR and derived unit QR values to the parent item-family detail context while preserving kiosk-only custody scans. |
| 2026-05-10 | Scan ownership pass: app `/scan` is now lookup-only, stale booking deep links show kiosk handoff instead of a broken camera checklist, mobile nav says Lookup, and booking/dashboard links no longer target `/scan?checkout=...`. |
| 2026-05-09 | Badge achievements Slice 3: kiosk checkout, pickup, and check-in scans now emit feature-flagged badge scan-result events from the kiosk routes only. Regular app checkout/check-in scan stubs remain kiosk-gated 403 routes and award nothing. |
| 2026-05-08 | Reconciled stale scan endpoint rate-limit TODO: regular app checkout/check-in scan routes are kiosk-gated 403 stubs, and a static contract now protects that boundary |
| 2026-05-07 | Check-in damaged/lost item reports can include optional photo evidence. The retired app booking-mode checklist UI that exposed this is no longer wired through `/scan`; future exception reporting should be re-cut outside lookup scan. |
| 2026-05-05 | Kiosk battery unit scans: pickup/check-in can scan one numbered battery unit at a time, and kiosk lookup resolves unit QR values to parent SKU and unit status |
| 2026-05-05 | Numbered bulk unit QR scans: values like `94e068d1-7` resolve to the parent bulk SKU and unit #7, bypassing the picker while preserving server-side unit validation |
| 2026-05-05 | Camera attachment lookup polish: lookup preview labels attached items with parent camera context and SD card slot labels when tags follow the `1A` convention |
| 2026-03-23 | Scan page hardened (5-pass): design system alignment, data flow, resilience, UX polish |
| 2026-03-25 | Decomposed from 1,038→251 lines: extracted 2 hooks + 4 components + shared types (GAP-14 closed) |
| 2026-04-03 | Audio + haptic scan feedback: distinct tones & vibration patterns for success/error/info/celebration via Web Audio API (`src/lib/scan-feedback.ts`) |
| 2026-04-09 | **Scan flow stress test (4 fixes):** scanValue normalization (trim+lowercase), bulk bin case-insensitive matching, cross-booking numbered bulk unit check-in integrity guard + frontend picker scope fix, completeCheckinScan booking status guard |
| 2026-04-09 | **Hardening pass (6 fixes):** mode badges → Badge component; bulk row/circle dark-mode color normalization; handleLookupScan finally block; loadScanStatus finally block; Page Visibility refresh on tab return; camera error prefix removed |

Historical entries before 2026-05-10 may reference the retired app booking-mode scan implementation. Current app scan scope is lookup only.
