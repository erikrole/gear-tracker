# AREA: Reports & Analytics

## Document Control
- Area: Reports & Analytics
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-09
- Status: Active
- Version: V1

## Direction
Provide staff and admin with analytics dashboards to track checkout/reservation activity, utilization patterns, scan success rates, and audit events. Reports are read-only views gated to ADMIN/STAFF.

## Core Rules
1. All reports are ADMIN/STAFF only (enforced on routes and endpoints).
2. Reports are tab-based: users navigate between report types via sidebar link to `/reports` which redirects to `/reports/utilization`.
3. Each report has filters (date range, status, location) and metrics cards.
4. Data is cached via React Query with focus refresh.
5. Empty states and error states handled with EmptyState + retry.

## Routes

### `/reports`
- **Page:** `src/app/(app)/reports/page.tsx`
- **Behavior:** Redirects to `/reports/utilization`

### `/reports/layout.tsx`
- **Layout:** Shared tab navigation bar showing all 6 report types:
  - Utilization (default)
  - Checkouts
  - Overdue
  - Scans
  - Bulk Losses
  - Audit
- **Styling:** Tab buttons with active underline; responsive on mobile

### `/reports/utilization`
- **Page:** `src/app/(app)/reports/utilization/page.tsx`
- **Type:** Charts + metrics dashboard
- **Metrics:** Total inventory, checked out, available, maintenance, retired
- **Charts:** Utilization trends (equipment category breakdown, location breakdown, time-series checkout rate)
- **Filters:** Date range, location, category
- **Data:** `GET /api/reports/utilization?from=...&to=...&location=...&category=...`

### `/reports/checkouts`
- **Page:** `src/app/(app)/reports/checkouts/page.tsx`
- **Type:** Tabular report with filterable list
- **Columns:** Booking ref, requestor, checked out date, due date, status, items count, location
- **Metrics:** Total checkouts (period), average duration, top requestors
- **Charts:** Checkout trends (by day/week/month), status breakdown
- **Filters:** Date range, status (active/completed/overdue), requestor, location
- **Data:** `GET /api/reports/checkouts?from=...&to=...&status=...&requestor=...&location=...`

### `/reports/overdue`
- **Page:** `src/app/(app)/reports/overdue/page.tsx`
- **Type:** List of overdue bookings with escalation status
- **Columns:** Booking ref, requestor, due date, days overdue, location, escalation count
- **Metrics:** Total overdue, highest priority escalations, days-overdue distribution
- **Filters:** Date range, location, escalation count
- **Behaviors:** Click row to view booking detail. Mark as complete button per row.
- **Data:** `GET /api/reports/overdue?from=...&to=...&location=...`

### `/reports/scans`
- **Page:** `src/app/(app)/reports/scans/page.tsx`
- **Type:** Scan activity analytics
- **Columns:** Session date, device, phase (checkout/return), success count, failed count, success rate
- **Metrics:** Total scans (period), success rate %, devices active, average scans per session
- **Charts:** Scan trends (success/failure rate over time), device distribution, phase breakdown
- **Filters:** Date range, device, phase, location
- **Data:** `GET /api/reports/scans?from=...&to=...&device=...&phase=...&location=...`

### `/reports/bulk-losses`
- **Page:** `src/app/(app)/reports/bulk-losses/page.tsx`
- **Type:** Bulk inventory loss tracking
- **Columns:** SKU name, category, lost count, value (if tracked), date detected, location
- **Metrics:** Total units lost (period), SKUs with losses, total value at risk
- **Charts:** Loss trends by category, location, top-loss SKUs
- **Filters:** Date range, category, location
- **Data:** `GET /api/reports/bulk-losses?from=...&to=...&category=...&location=...`

### `/reports/audit`
- **Page:** `src/app/(app)/reports/audit/page.tsx`
- **Type:** Audit log viewer (admin only within ADMIN/STAFF)
- **Columns:** Timestamp, actor, action, resource (item/booking/user), details, outcome
- **Metrics:** Total events (period), events by action type, events by actor role
- **Charts:** Event frequency over time, action breakdown, actor breakdown
- **Filters:** Date range, action type, actor, resource type
- **Data:** `GET /api/reports/audit?from=...&to=...&action=...&actor=...&resourceType=...`

## Components

**Shared across reports:**
- `MetricCard` — displays key metric (number + label, optional trend indicator)
- Charts from `recharts` (line, bar, pie charts as needed per report)
- `Card` + `CardHeader` + `CardContent` for sections
- Filter bar with date range picker, select dropdowns
- Table/skeleton loading states
- EmptyState for no data

**Key files:**
- `src/app/(app)/reports/MetricCard.tsx` — metric display card
- `src/app/(app)/reports/[reportType]/charts.tsx` — recharts components per report
- `src/app/(app)/reports/[reportType]/page.tsx` — report page (data fetching + layout)

## Data Model
- Reports aggregate from existing models: `Booking`, `ScanEvent`, `BulkStockMovement`, `AuditLog`
- No new tables; reports are read-only views via API endpoints that SELECT/aggregate

## Security
- `requirePermission("report", "view")` on all report routes + endpoints
- ADMIN/STAFF only
- Audit log endpoint logs report access (low priority)

## Acceptance Criteria
- [x] AC-1: Utilization report with inventory metrics + trend charts
- [x] AC-2: Checkouts report with list + status breakdown
- [x] AC-3: Overdue report with escalation tracking
- [x] AC-4: Scans report with device + phase analytics
- [x] AC-5: Bulk Losses report with SKU tracking
- [x] AC-6: Audit report with event log viewer (ADMIN only)

## Change Log
- 2026-03-15: Reports V1 shipped — 6 report pages (utilization, checkouts, overdue, scans, bulk-losses, audit). Tab navigation. Metrics cards. Charts (recharts). Filters. Table lists. Date range pickers. Empty states + error handling.
- 2026-04-09: Design refresh (Phase 3) — Linear/Notion refresh applied: one-off error div → Alert component, inline styles → Tailwind, legacy CSS removed. Text-secondary → text-muted-foreground. Doc sync.
- 2026-04-09: Created AREA_REPORTS.md as formal feature area documentation.
- 2026-05-01: Audit pass — split `/api/reports?type=X` mega-route into per-type routes under `/api/reports/{utilization,checkouts,overdue,scans,audit,bulk-losses}`; moved handlers to `src/lib/services/reports.ts`. Replaced in-memory daily aggregation with `date_trunc` `$queryRaw` GROUP BY in scan + checkout reports (no more pulling every row to bucket in JS). Removed dead heatmap block from utilization page (API never returned the field). Standardized `bulk-losses` loading/error guards to match siblings (preserves data on refresh). Extracted shared `syncUrl()` to `src/lib/url-sync.ts`; checkouts page now uses it.
