# Area: Scan

## Overview
The scan page is the primary interface for camera-based QR/barcode scanning during checkout and check-in workflows. It also serves as a standalone item lookup tool.

## Architecture

```
src/app/(app)/scan/
├── page.tsx                    (~250 lines) — thin orchestrator
└── _components/
    ├── types.ts                — shared type definitions
    ├── ScanControls.tsx        — camera toggle, QrScanner, manual entry, feedback banner
    ├── ScanChecklist.tsx       — serialized + bulk item checklist with status badges
    ├── UnitPickerSheet.tsx     — numbered bulk unit selection sheet
    └── ItemPreviewDrawer.tsx   — lookup mode item preview bottom drawer (Drawer, not Sheet)

src/hooks/
├── use-scan-session.ts         — status loading, 15s polling, session start, celebration, completion
└── use-scan-submission.ts      — scan processing, feedback auto-clear, optimistic updates, unit picker state

src/lib/
└── scan-feedback.ts            — Web Audio API tones + haptic vibration patterns (success/error/info/celebration)

src/components/
└── QrScanner.tsx               — native BarcodeDetector with ZXing polyfill (dynamic import, SSR: false)
```

## Modes

| Mode | URL Pattern | Description |
|---|---|---|
| **Lookup** | `/scan` | Free-form scan → item preview bottom sheet |
| **Checkout** | `/scan?checkout={id}&phase=CHECKOUT` | Scan items for a checkout booking |
| **Check-in** | `/scan?checkout={id}&phase=CHECKIN` | Scan items being returned |

## Key Patterns

1. **Race condition guards** — `useRef` synchronous guards prevent concurrent submissions from camera debounce
2. **Optimistic updates + background refresh** — UI marks items scanned immediately; 15s polling confirms with server
3. **Multi-device sync** — periodic `loadScanStatus()` catches updates from other devices
4. **Dynamic flow routing** — numbered bulk unit picker is discovered mid-scan (API returns SCAN_NOT_IN_CHECKOUT → show picker)
5. **Feedback auto-clear** — success: 5s, error/info: 8s

## API Dependencies

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/checkouts/{id}/scan-status` | GET | Load checklist state |
| `/api/checkouts/{id}/start-scan-session` | POST | Create audit session |
| `/api/checkouts/{id}/scan` | POST | Submit checkout scan |
| `/api/checkouts/{id}/checkin-scan` | POST | Submit check-in scan |
| `/api/checkouts/{id}/complete-checkout` | POST | Finalize checkout |
| `/api/checkouts/{id}/complete-checkin` | POST | Finalize check-in |
| `/api/bulk-skus/{id}/units` | GET | Fetch units for unit picker |
| `/api/assets` | GET | Item lookup search |
| `/api/assets/{id}` | GET | Item detail for preview |

## Change Log

| Date | Change |
|---|---|
| 2026-03-23 | Scan page hardened (5-pass): design system alignment, data flow, resilience, UX polish |
| 2026-03-25 | Decomposed from 1,038→251 lines: extracted 2 hooks + 4 components + shared types (GAP-14 closed) |
| 2026-04-03 | Audio + haptic scan feedback: distinct tones & vibration patterns for success/error/info/celebration via Web Audio API (`src/lib/scan-feedback.ts`) |
| 2026-04-09 | **Scan flow stress test (4 fixes):** scanValue normalization (trim+lowercase), bulk bin case-insensitive matching, cross-booking numbered bulk unit check-in integrity guard + frontend picker scope fix, completeCheckinScan booking status guard |
| 2026-04-09 | **Hardening pass (6 fixes):** mode badges → Badge component; bulk row/circle dark-mode color normalization; handleLookupScan finally block; loadScanStatus finally block; Page Visibility refresh on tab return; camera error prefix removed |
