# Dashboard backend hardening plan

Audit of `/api/dashboard`, `/api/dashboard/stats`, `/api/my-shifts`, and the
shared `dashboard-counts` reader. This area is already well-built (shared
bounded count aggregate, Promise.allSettled partial failures, Upstash rate
limiting, institution-timezone day bounds), so findings are consistency gaps
rather than corruption bugs.

## Findings

### D1 (P1) -- Dashboard shows archived events that Schedule hides
Every Schedule surface filters events through `buildScheduleEventWhere`
(`status != CANCELLED`, `isHidden: false`, `archivedAt: null`). The dashboard
Upcoming Events query rolls its own filter and omits `archivedAt: null`, so an
archived-but-future event (a data-quality anomaly Schedule flags for cleanup)
still renders on Home.

### D2 (P1) -- Personal shift surfaces include assignments on archived events
Dashboard `myShifts`/`myEventWork`, stats `myShiftsCount`/`myShiftsTodayCount`,
and `/api/my-shifts` all filter on `status: CONFIRMED` + today-forward but not
`archivedAt: null`. A student could keep seeing (and prepping gear for) a shift
on an event staff explicitly archived. Deliberate scope note: `isHidden` stays
visible on personal surfaces -- hiding is list hygiene, and a real assignment
beats it; archiving is operational retirement and wins.

### D3 (P2) -- Counts SQL pending-pickup lane has no kind guard
`COUNT(*) FILTER (WHERE status = 'PENDING_PICKUP')` counts any booking kind.
Only checkouts use that status today; add `kind = 'CHECKOUT'` so a future
reservation-lifecycle change cannot silently inflate the lane.

### D4 (P2) -- /api/my-shifts limit param accepts negative values
`Math.min(Number(limit) || 5, 20)` lets `limit=-5` through as Prisma
`take: -5` (reads from the end). Clamp to 1..20.

## Slices

- [x] S1: `archivedAt: null` on dashboard upcoming events + all five personal
      shift filters (D1, D2)
- [x] S2: `kind = 'CHECKOUT'` guard on the pending-pickup count lane (D3)
- [x] S3: Clamp my-shifts limit to 1..20 (D4)
- [x] S4: Source-contract tests + build + docs sync

## Review

Shipped in one pass. Source-contract assertions added to
`tests/dashboard-stats-transient-lanes.test.ts`; full suite + build green.
