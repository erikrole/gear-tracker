# Reports Page — Charts Redesign

## Goal
Replace table-heavy reports with visual, chart-driven dashboards using shadcn/ui Charts (Recharts) already installed, plus a heatmap component for activity density. Keep tables as secondary detail — charts are the headline.

## Principles
- **Fast**: Minimal API changes. Aggregate server-side where possible, reuse existing queries.
- **Cheap**: No new DB indexes. No new models. Reuse `recharts` (already bundled via ItemInsightsTab).
- **Robust**: Every chart has an empty state. All data pre-computed server-side. No client-side aggregation of large datasets.

---

## Heatmap Component

Install [shadcn-heatmap](https://github.com/fishdev20/shadcn-heatmap) — a copy-paste shadcn-compatible component (no npm package, just a file). GitHub-style calendar heatmap.

**Data shape:** `{ date: string, value: number }[]`
**Props:** `data`, `title`, `rangeDays`, `cellSize`, `cellGap`, `axisLabels`, `onCellClick`, `renderTooltip`, `palette`

**Installation:**
1. Copy `heatmap-calendar.tsx` into `src/components/ui/`
2. Dependencies already satisfied: `clsx`, `tailwind-merge`, `lucide-react`, shadcn `card` + `tooltip`

Alternative: try `npx shadcn@latest add https://ui.8starlabs.com/r/heatmap.json` first — if the registry works, it auto-installs. Fall back to manual copy if 403.

---

## Slice 1: API Enhancements (single commit, no UI changes)

### 1a. Utilization — no API changes needed
Current shape already has `statusCounts`, `byLocation`, `byType`, `byDepartment`. Perfect for pie/bar charts.

### 1b. Checkouts — add daily volume + trend data
Add to `getCheckoutReport()` response:
```ts
dailyVolume: { date: string; checkouts: number; checkins: number }[]
```
**Query:** Group bookings by `DATE(createdAt)` within the period. Use a single `groupBy` on `createdAt` truncated to day, or fetch all bookings in range and bucket in JS (simpler, already fetching `recentCheckouts`).

**Approach:** Extend existing query — fetch ALL bookings in range (not just 20), but only select `{ createdAt, kind, status }` for the volume query. Keep `recentCheckouts` take=20 for the table.

```ts
// New query in Promise.all:
db.booking.findMany({
  where: { kind: "CHECKOUT", createdAt: { gte: since } },
  select: { createdAt: true, status: true },
  orderBy: { createdAt: "asc" }
})
```
Then bucket by day in JS. Cheap — only 2 scalar fields per row.

### 1c. Checkouts — add daily heatmap data (365d)
Add to response:
```ts
heatmap: { date: string; value: number }[]  // last 365 days, regardless of period filter
```
Separate query: count bookings per day for last 365 days. Single `groupBy` or JS bucket.

### 1d. Scans — add daily aggregation
Add to `getScanHistoryReport()` response:
```ts
dailyScans: { date: string; success: number; fail: number }[]
```
Same approach: fetch `{ createdAt, success }` for all scans in range, bucket by day.

### 1e. Audit — add action/entity aggregation + metric counts
Add to `getAuditReport()` response:
```ts
byAction: { action: string; count: number }[]
byEntityType: { entityType: string; count: number }[]
totalInPeriod: number
```
Two `groupBy` queries + one count. All indexed on `createdAt`.

### 1f. Overdue — no API changes needed
Current shape has `leaderboard` with `overdueCount` + `totalOverdueHours` per person. Perfect for horizontal bar chart.

---

## Slice 2: Utilization Page — Pie + Bar Charts

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [MetricCards: Available | Checked Out | Reserved | │
│  Maintenance | Retired | Total]                    │
├────────────────────────┬─────────────────────────┤
│ Status Distribution    │ By Type                 │
│ [Donut Chart]          │ [Horizontal Bar]        │
├────────────────────────┼─────────────────────────┤
│ By Location            │ By Department           │
│ [Horizontal Bar]       │ [Horizontal Bar]        │
└────────────────────────┴─────────────────────────┘
```

**Charts:**
1. **Status Distribution** — `PieChart` (donut) with 5 segments from `statusCounts`
2. **By Type** — `BarChart layout="vertical"` from `byType` (sorted by count)
3. **By Location** — `BarChart layout="vertical"` from `byLocation`
4. **By Department** — `BarChart layout="vertical"` from `byDepartment`

**Keep:** MetricCards row, CSV export. **Remove:** plain data tables.

---

## Slice 3: Checkouts Page — Area + Bar + Heatmap

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [MetricCards: Total Checkouts | Currently Overdue] │
│ [Period: 7d | 30d | 90d]              [Export CSV] │
├──────────────────────────────────────────────────┤
│ Checkout Volume (Area Chart — daily trend)        │
├────────────────────────┬─────────────────────────┤
│ Top Requesters         │ Recent Checkouts        │
│ [Horizontal Bar]       │ [Table — keep as-is]    │
├────────────────────────┴─────────────────────────┤
│ Activity Heatmap (365-day calendar)               │
└──────────────────────────────────────────────────┘
```

**Charts:**
1. **Checkout Volume** — `AreaChart` with daily data, X=date, Y=count. Shaded area.
2. **Top Requesters** — `BarChart layout="vertical"` replacing the plain table. Top 10 ranked.
3. **Activity Heatmap** — `HeatmapCalendar` component. 365-day view. Color intensity = checkout count per day.

**Keep:** Recent checkouts table (useful for drill-down), period selector, CSV export.

---

## Slice 4: Overdue Page — Horizontal Bar

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [MetricCards: Total Overdue | People Affected]    │
├──────────────────────────────────────────────────┤
│ Overdue Hours by Person (Horizontal Bar)          │
├──────────────────────────────────────────────────┤
│ Detailed Breakdown (Expandable table — keep)      │
└──────────────────────────────────────────────────┘
```

**Charts:**
1. **Overdue Hours by Person** — `BarChart layout="vertical"`, Y=person name, X=totalOverdueHours. Color gradient: more hours = more red. Show `overdueCount` in tooltip.

**Keep:** Expandable detail table below the chart, CSV export.

---

## Slice 5: Scans Page — Line + Stacked Bar

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [MetricCards: Total Scans | Success Rate]         │
│ [Filters: Period | Phase]              [Export CSV]│
├──────────────────────────────────────────────────┤
│ Daily Scan Volume (Stacked Bar: success vs fail)  │
├──────────────────────────────────────────────────┤
│ Scan History (Paginated table — keep)             │
└──────────────────────────────────────────────────┘
```

**Charts:**
1. **Daily Scan Volume** — `BarChart` with stacked `<Bar>` for success (green) and fail (red). X=date, Y=count. Shows both volume and quality at a glance.

**Keep:** Paginated scan event table, filters, CSV export.

---

## Slice 6: Audit Page — Bar Charts + Metrics

**Layout:**
```
┌──────────────────────────────────────────────────┐
│ [MetricCards: Total Events (period)]              │
│ [Filters: Period | Action]             [Export CSV]│
├────────────────────────┬─────────────────────────┤
│ By Action              │ By Entity Type          │
│ [Horizontal Bar]       │ [Horizontal Bar]        │
├────────────────────────┴─────────────────────────┤
│ Audit Log (Paginated table — keep)                │
└──────────────────────────────────────────────────┘
```

**Charts:**
1. **By Action** — `BarChart layout="vertical"` from `byAction`. Actions ranked by frequency.
2. **By Entity Type** — `BarChart layout="vertical"` from `byEntityType`.

**Keep:** Paginated audit log table, filters, CSV export.

---

## Implementation Order

1. **Slice 1**: API enhancements (daily volume, heatmap data, aggregations)
2. **Slice 2**: Utilization charts (pie + bars)
3. **Slice 3**: Checkouts charts (area + bar + heatmap install)
4. **Slice 4**: Overdue chart (horizontal bar)
5. **Slice 5**: Scans chart (stacked bar)
6. **Slice 6**: Audit charts (bars + metrics)
7. Build + verify + push

Each slice independently deployable — charts added above existing tables, tables kept as detail.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/api/reports/route.ts` | Add dailyVolume, heatmap, dailyScans, byAction, byEntityType |
| `src/components/ui/heatmap-calendar.tsx` | NEW — copy from shadcn-heatmap |
| `src/app/(app)/reports/utilization/page.tsx` | Replace tables with pie + bar charts |
| `src/app/(app)/reports/checkouts/page.tsx` | Add area chart, bar chart, heatmap |
| `src/app/(app)/reports/overdue/page.tsx` | Add horizontal bar chart above table |
| `src/app/(app)/reports/scans/page.tsx` | Add stacked bar chart above table |
| `src/app/(app)/reports/audit/page.tsx` | Add bar charts + metric cards |

---

## Chart Color Palette (reuse from ItemInsightsTab)

```ts
const CHART_COLORS = {
  primary:   "hsl(220 70% 55%)",   // blue — checkouts, main metric
  secondary: "hsl(270 60% 60%)",   // purple — reservations
  success:   "hsl(142 60% 45%)",   // green — available, on-time, success
  warning:   "hsl(25 90% 55%)",    // orange — maintenance, warning
  danger:    "hsl(0 70% 55%)",     // red — overdue, retired, fail
  muted:     "hsl(220 10% 60%)",   // gray — neutral
};
```

---

## Performance Budget

- API responses: < 200ms each (all queries indexed, JS aggregation only)
- No new DB indexes required
- Recharts already code-split (loaded by ItemInsightsTab)
- Heatmap component: ~5KB gzipped (pure CSS grid, no charting lib)
- All chart data pre-aggregated server-side — client just renders

---

## Empty States

Every chart card handles zero data:
- Pie/donut: show "No data" with muted empty ring
- Bar charts: show "No data yet" centered text
- Area/line: show flat zero line with "No activity in this period"
- Heatmap: render grid with all cells at zero intensity (still useful to show time range)

---

## Dependencies

- `recharts` — already installed (via shadcn chart)
- `shadcn-heatmap` — new file, no npm dependency
- No schema changes
- No new DB indexes
