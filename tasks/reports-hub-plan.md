# Reports Hub — Overdue Leaderboard + Scan History

## Plan

Restructure `/reports` from a single-page tab layout into a sub-page layout (like `/settings`) with breadcrumb + tab nav. Add two new report pages. Gate everything to STAFF/ADMIN only.

### Slices

- [ ] **1. Sidebar + permissions**: Add Reports to sidebar nav, hide from STUDENT. Update `report.view` to `["ADMIN", "STAFF"]`. Add `requirePermission` to reports API route.
- [ ] **2. Reports layout + sub-pages**: Create `reports/layout.tsx` with breadcrumb + section tabs. Break existing page into sub-pages: `/reports/utilization`, `/reports/checkouts`, `/reports/audit`. Make `/reports` redirect to first sub-page.
- [ ] **3. Overdue Leaderboard**: New API `type=overdue` + new page `/reports/overdue`. Who has the most overdue items, sorted by total overdue duration.
- [ ] **4. Scan History Feed**: New API `type=scans` + new page `/reports/scans`. Last N scans: actor, item, booking, success/fail, timestamp. Paginated.
- [ ] **5. Build verification**: `npm run build` clean.
- [ ] **6. Commit & push**.
