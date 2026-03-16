# Reports Hub — Overdue Leaderboard + Scan History

## Plan

Restructure `/reports` from a single-page tab layout into a sub-page layout (like `/settings`) with breadcrumb + tab nav. Add two new report pages. Gate everything to STAFF/ADMIN only.

### Slices

- [x] **1. Sidebar + permissions**: Reports in sidebar nav, hidden from STUDENT. `report.view` scoped to `["ADMIN", "STAFF"]`. `requirePermission` in reports API route. ✅
- [x] **2. Reports layout + sub-pages**: `reports/layout.tsx` with breadcrumb + 5 tab sub-pages. `/reports` redirects to `/reports/utilization`. ✅
- [x] **3. Overdue Leaderboard**: API `type=overdue` + `/reports/overdue`. Person-level breakdown sorted by total overdue duration. ✅
- [x] **4. Scan History Feed**: API `type=scans` + `/reports/scans`. Paginated scan events with actor, item, booking, timestamp. ✅
- [x] **5. Build verification**: `npm run build` clean. ✅
- [x] **6. Commit & push**. ✅

## Status: COMPLETE (verified 2026-03-16)
