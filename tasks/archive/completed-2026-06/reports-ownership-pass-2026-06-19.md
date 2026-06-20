# Reports Ownership Pass

## Goal

Polish the operational Reports surfaces that touch checkout, overdue, and scan history data so the UI and API present ship-ready, status-correct information.

## Scope

- `/reports/checkouts`
- `/reports/overdue`
- `/reports/scans`
- `/api/reports/checkouts`
- `/api/reports/overdue`
- `/api/reports/scans`
- `src/lib/services/reports.ts`

## Plan

- [x] Harden checkout report analytics so draft bookings do not count as completed operational checkout activity.
- [x] Harden overdue report item summaries so only outstanding gear is counted and displayed.
- [x] Normalize scan report URL state and reject invalid scan API filters.
- [x] Add focused regression coverage for the corrected report semantics.
- [x] Sync Reports documentation with shipped behavior.

## Review

- Checkout activity metrics, requester rankings, recent rows, exports, and heatmap now use the shared custody checkout scope: `OPEN` and `COMPLETED`.
- Overdue rows now query active serialized allocations and compute bulk outstanding quantities before rendering counts and item summaries.
- Scan report URL state now handles invalid `page`, `period`, and `phase` params defensively, while the API rejects invalid dates, inverted ranges, and unsupported phases.
- Browser smoke exposed a shared React Query hydration mismatch. The provider now creates isolated server query clients and defers browser persistence until after mount.
- Added service and route regression tests for the corrected semantics.
