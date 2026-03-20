# Insights Tab — Item Detail Page

## Goal
Add a glanceable utilization dashboard tab to the item detail page, using shadcn/ui charts (Recharts). Stats computed server-side via a single API endpoint for accuracy (no 100-entry cap), with client-side time-window filtering for snappy UX.

## Architecture — Server-Side, Optimized

### API Endpoint: `GET /api/assets/[id]/insights`

**Single query strategy** — one Prisma query, no N+1:

```sql
-- Conceptual: fetch all bookings for this asset with minimal fields
SELECT b.kind, b.status, b.starts_at, b.ends_at, b.sport_code,
       u.name as requester_name
FROM booking_serialized_items bsi
JOIN bookings b ON b.id = bsi.booking_id
JOIN users u ON u.id = b.requester_user_id
WHERE bsi.asset_id = $1
  AND b.status NOT IN ('DRAFT', 'CANCELLED')
ORDER BY b.starts_at DESC
```

**Why this is cheap:**
- `booking_serialized_items` has `@@index([assetId])` — direct index hit
- `bookings` has `@@index([status, kind])` — filter is indexed
- Only select 6 scalar fields per booking — no event/location/notes joins
- Server aggregates into pre-computed stats → small JSON response (~2KB)
- Single DB roundtrip, no groupBy/aggregate (just fetch + JS reduce)

**Response shape:**
```json
{
  "totalBookings": 47,
  "utilizationPct": 62.3,
  "monthly": [{ "month": "2025-04", "checkouts": 3, "reservations": 2 }, ...],
  "bySport": [{ "sport": "Football", "days": 45 }, ...],
  "topBorrowers": [{ "name": "Jane", "count": 12 }, ...],
  "byKind": { "CHECKOUT": 30, "RESERVATION": 17 },
  "byDayOfWeek": [2, 5, 8, 12, 15, 7, 3],
  "punctuality": { "onTime": 38, "late": 9 },
  "avgDurationDays": 3.2,
  "longestDurationDays": 14,
  "costPerUse": 12.50,
  "idleStreakDays": 5,
  "ageDays": 420,
  "windowBookings": 15
}
```

**Optimizations:**
- Compute ALL time windows server-side in one pass (loop once, bucket into 30d/90d/1yr/all)
- Return all 4 windows in a single response — client toggles instantly with zero fetches
- Cache-friendly: add `Cache-Control: private, max-age=60` — stats don't change every second
- Total payload: ~4KB for all 4 windows (vs ~50KB for raw booking data)

## Time Window
Toggle at top: **30d / 90d / 1yr / All**. All windows pre-computed server-side, client switches instantly. Default: 90d.

## Cards (2-column grid, 10 cards)

### Row 1 — Headline Metrics
| Card | Chart | Logic |
|------|-------|-------|
| **Utilization Rate** | Radial bar chart (gauge) | `bookedDays / totalDaysInWindow * 100`. A "booked day" = any day overlapping at least one booking. |
| **Bookings by Month** | Area chart | Group bookings by `startsAt` month. Dual series: checkouts + reservations. Shows trend + seasonality. |

### Row 2 — Segmentation
| Card | Chart | Logic |
|------|-------|-------|
| **By Sport** | Horizontal bar chart | Group by `sportCode` (fall back to "Untagged"). Sum checkout days per sport. Top 6 + "Other". |
| **Top Borrowers** | Horizontal bar chart | Group by `requester.name`. Count bookings. Top 5. |

### Row 3 — Patterns
| Card | Chart | Logic |
|------|-------|-------|
| **Checkout vs Reservation** | Donut (pie) chart | Count by `booking.kind`. Two segments. |
| **Day-of-Week Demand** | Vertical bar chart (7 bars) | Count bookings starting on each weekday (Mon–Sun). |

### Row 4 — Health
| Card | Chart | Logic |
|------|-------|-------|
| **Return Punctuality** | Stacked horizontal bar | COMPLETED bookings: on-time vs late. Late = `endsAt < now` while `status` was still OPEN. |
| **Avg Checkout Duration** | Big number + subtitle | `avg(endsAt - startsAt)` for CHECKOUT kind. Subtitle: "Longest: Xd". |

### Row 5 — Financial & Idle
| Card | Chart | Logic |
|------|-------|-------|
| **Cost Per Use** | Big number + subtitle | `purchasePrice / totalBookings`. Subtitle: "N total uses". Show "—" if no price. |
| **Idle Streak & Age** | Big number pair | Left: days since last booking ended. Right: days since `purchaseDate` (or "—"). |

## Implementation Slices

### Slice 1: Install shadcn chart + API endpoint
- [ ] `npx shadcn@latest add chart` (installs recharts + chart.tsx)
- [ ] Create `src/app/api/assets/[id]/insights/route.ts`
  - Single Prisma query: `bookingSerializedItem.findMany` with minimal booking select
  - Server-side aggregation: one loop over results, bucket into all 4 time windows
  - Return pre-computed stats for all windows in one response
  - Add `Cache-Control: private, max-age=60` header
- [ ] Verify endpoint returns correct shape with curl/browser test

### Slice 2: Build the 10 chart cards
- [ ] Create `src/app/(app)/items/[id]/ItemInsightsTab.tsx`
- [ ] Fetch `/api/assets/[id]/insights` on mount, show Spinner while loading
- [ ] Time window toggle (30d / 90d / 1yr / All) — switches pre-fetched data, no network call
- [ ] 10 cards in 2-column responsive grid (`grid grid-cols-1 md:grid-cols-2 gap-4`)
- [ ] Charts:
  - Radial bar: `<RadialBarChart>` for utilization gauge
  - Area: `<AreaChart>` for monthly trend (dual series: CO + RES)
  - Horizontal bar: `<BarChart layout="vertical">` for sport + borrowers
  - Donut: `<PieChart>` with inner radius for CO vs RES
  - Vertical bar: `<BarChart>` for day-of-week
  - Stacked bar: `<BarChart>` with two `<Bar>` for punctuality
  - Big numbers: plain shadcn Card with large text, no Recharts
- [ ] All charts use `ChartContainer` + `ChartTooltip` from shadcn
- [ ] Chart colors via `chartConfig` tied to CSS variables

### Slice 3: Wire into tab bar + build verify
- [ ] Add "Insights" tab to `tabDefs` in `page.tsx`
- [ ] Conditionally render `<ItemInsightsTab>` when active
- [ ] Pass `asset.id` prop (tab fetches its own data)
- [ ] `npm run build` — must pass clean
- [ ] Empty history: graceful empty states per card

## Chart Color Palette (from existing CSS vars)
- Primary blue (`--chart-1`): checkouts, main metrics
- Purple (`--chart-2`): reservations
- Green (`--chart-3`): on-time / completed
- Orange (`--chart-4`): warning / late
- Sport bars: cycle through 6 distinct hues via chartConfig

## Performance Budget
- API response: < 100ms (single indexed query + JS reduce)
- Response size: ~4KB (all 4 windows pre-aggregated)
- Client render: instant window switching (data already in memory)
- Recharts bundle: ~45KB gzipped (one-time, code-split with dynamic import)

## Edge Cases
- **No history**: Show empty state per card ("Not enough data yet")
- **No sportCode on bookings**: Group as "Untagged"
- **No purchasePrice**: Cost per use shows "—"
- **No purchaseDate**: Age shows "—"
- **Single booking**: All charts still render (1 bar, 1 segment, etc.)
- **DRAFT/CANCELLED bookings**: Excluded from all stats (filtered server-side)

## Dependencies
- `recharts` (via shadcn chart component)
- One new API endpoint (`/api/assets/[id]/insights`)
- No schema changes
- No new DB indexes needed (existing `@@index([assetId])` on BookingSerializedItem is sufficient)
