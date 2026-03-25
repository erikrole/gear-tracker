# Mobile/Scan Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-ready (21/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_MOBILE.md + BRIEF_STUDENT_MOBILE_V1.md + D-015 provide clear, testable scope with KPIs. Out-of-scope items explicitly listed. |
| Hardening | 4/5 | 5-pass hardening completed on scan page (shadcn migration, data flow, resilience, UX polish). All API routes have auth + ownership. One gap: unit picker has hardcoded light-mode colors that break in dark mode. QrScanner camera permission UX is minimal. |
| Roadmap | 3/5 | V1 shipped. Phase B deferred items (telemetry, KPI measurement) specced but not planned. Phase C kiosk mode unbriefed. No plan file. |
| Feature completeness | 5/5 | All 6 AREA_MOBILE ACs met. All 6 BRIEF ACs met. All 4 Scan Experience Contract requirements met. All NORTH_STAR workflows covered. |
| Doc sync | 4/5 | AREA_MOBILE changelog current through 2026-03-23. GAPS_AND_RISKS reflects closed items. BRIEF AC checkboxes remain unchecked despite all shipped. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Scan Page | `/scan` (~1023 lines) | **Hardened** | 5-pass audit completed. Skeleton loading, shadcn Alert for errors, optimistic updates, auto-clear feedback, processingRef guards on all handlers, network drop recovery, 401 handling, beforeunload guard, celebration overlay, haptic feedback. 13 useState + 5 useRef. Mobile-first design. |
| QrScanner | Component (~102 lines) | Partially hardened | Debounce guards (3s same code, 1s any), cleanup on unmount, stable refs. Camera permission denial UX defers to html5-qrcode error message — no explicit "how to enable" instructions. |

## API Route Status
| Route | Method | Auth | Ownership Gating | Issues |
|---|---|---|---|---|
| `/api/checkouts/[id]/scan` | POST | requirePermission + student ownership | Yes (server-side) | None |
| `/api/checkouts/[id]/scan-status` | GET | withAuth + student ownership | Yes (server-side) | None |
| `/api/checkouts/[id]/checkin-scan` | POST | requireBookingAction | Yes (via booking-rules) | None |
| `/api/checkouts/[id]/start-scan-session` | POST | requirePermission + student ownership | Yes (server-side) | None |

## Mobile Infrastructure
| Feature | Status | Notes |
|---|---|---|
| Viewport meta | Shipped | width=device-width, initialScale=1, viewportFit=cover |
| overscroll-behavior-y: none | Shipped | globals.css body |
| -webkit-tap-highlight-color: transparent | Shipped | Global on interactive elements + scan-specific |
| Apple Web App capable | Shipped | statusBarStyle: black-translucent |
| Service Worker | Shipped | Registered on load |
| iOS input zoom fix | Shipped | text-base md:text-sm on Input/Textarea/SelectTrigger |
| Scan-specific CSS | Shipped | ~250 lines dedicated scan styles |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| Student scan own checkout (QR) | Shipped | BRIEF AC-1 | STUDENT in scan permission + ownership gating |
| Student blocked from scanning others' checkouts | Shipped | BRIEF AC-2 | Server-side ownership check on 3 routes |
| Student dashboard mobile = My Gear only | Shipped | BRIEF AC-3 | Per AREA_MOBILE changelog |
| Student sidebar hides Users/Settings/Kits | Shipped | BRIEF AC-4 | Role-adaptive sidebar |
| Owned bookings visual distinction | Shipped | BRIEF AC-5 | Ownership border accent |
| Build passes, no permission regressions | Shipped | BRIEF AC-6 | |
| 2-tap to own checkouts | Shipped | AREA_MOBILE AC-1 | Dashboard My Gear, role-adaptive |
| Mobile list support (search, status, detail) | Shipped | AREA_MOBILE AC-2 | Filters on all list pages |
| Overdue red treatment | Shipped | AREA_MOBILE AC-3 | Dashboard + list pages |
| Scan 1 tap from nav | Shipped | AREA_MOBILE AC-4 | Scan in nav |
| Role-based action visibility | Shipped | AREA_MOBILE AC-5 | Sidebar + server auth |
| Dashboard chart-light, action-first | Shipped | AREA_MOBILE AC-6 | |
| Camera permission fallback | Shipped | Scan Contract | Alert + manual entry always available |
| Scan routes to item/booking context | Shipped | Scan Contract | Lookup/checkout/checkin modes |
| Failed scan retry without state loss | Shipped | Scan Contract | Error auto-clears, camera stays active |
| Scan telemetry (success rate KPI) | Deferred | BRIEF Phase B | Specced but no plan |
| Task completion timing | Deferred | BRIEF Phase B | Specced but no plan |
| Floating scan button | Mentioned | BRIEF | Needs UX research |
| Kiosk mode | Mentioned | Phase C | Unbriefed |
| Offline draft preservation | Mentioned | AREA_MOBILE | "Where feasible" |

## Issues Found
1. **Dark mode bug (unit picker)** — Line ~863 of scan/page.tsx uses hardcoded `bg-white`, `bg-blue-100`, `text-blue-800`, `border-gray-200` on unit number buttons. Will render incorrectly in dark mode. Per lessons.md: "Never hardcode colors on interactive elements."
2. **BRIEF AC checkboxes stale** — All 6 ACs in BRIEF_STUDENT_MOBILE_V1.md still marked `- [ ]` despite shipped.
3. **Camera permission UX minimal** — Shows raw html5-qrcode error. No explicit "How to enable camera" instructions (AREA doc requires clear fallback).
4. **statusColor() duplicates logic** — Could use existing statusLabel() from booking-details helpers per D-025.

## Recommended Actions (prioritized)
1. **[P1] Fix dark mode unit picker** — Replace hardcoded bg-white/bg-blue-100 with theme-aware Tailwind classes. Quick fix.
2. **[P2] Check off BRIEF AC checkboxes** — Mark all 6 as `- [x]` in BRIEF_STUDENT_MOBILE_V1.md.
3. **[P2] Improve camera permission UX** — Add explicit instructions when camera access denied (e.g., "Go to Settings > Safari > Camera").
4. **[P3] Plan Phase B scan telemetry** — Write plan file for KPI measurement (scan success rate, task completion timing).
5. **[P3] Deduplicate statusColor** — Use shared helper instead of scan-specific implementation.

## Roadmap Status
**Rating: Partially defined**

- V1 fully shipped. All ACs met across both AREA and BRIEF docs.
- Phase B: scan telemetry + KPI measurement specced in BRIEF but no plan file.
- Phase C: kiosk mode mentioned in NORTH_STAR but unbriefed (GAP-4).
- No dedicated scan/mobile roadmap file.
