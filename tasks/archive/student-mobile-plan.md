# Student Mobile Hardening — Plan

## Status: Complete (2026-03-15)

## Slice 1: Unblock student scan + ownership gating
- [x] Add STUDENT to scan permission in permissions.ts
- [x] Add ownership check in scan API (students can only scan own checkouts)
- [x] Add ownership check in scan-status API
- [x] Add ownership check in start-scan-session API
- [x] Verify scan page enforces ownership on mount (server-side gating)

## Slice 2: Role-adaptive dashboard + sidebar gating
- [x] Dashboard: hide team activity for STUDENT on mobile (≤768px)
- [x] Sidebar: hide Users, Settings, Kits for STUDENT
- [x] Add ownership border accent to "My Gear" rows (ops-row-owned class)

## Slice 3: Build + verify + docs
- [x] Build passes
- [x] Update AREA_MOBILE.md change log
- [x] Update GAP-1 in GAPS_AND_RISKS.md (brief written, V1 shipped)
