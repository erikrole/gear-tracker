# Reports Improvement Audit
**Date**: 2026-05-01
**Target**: `src/app/(app)/reports/**` + `src/app/api/reports/route.ts`
**Type**: System (6 report pages + 1 mega-route)

---

## What's Smart

- **`Promise.allSettled` for read-only parallel queries** (`route.ts:51`, `:111`, `:322`, `:402`, `:466`) — matches `lessons.md` "Data Integrity" rule. One slow query never kills the whole report.
- **Lazy `dynamic()` chart imports with matching skeleton fallbacks** (`utilization/page.tsx:31-38`, `checkouts/page.tsx:32-43`, `audit/page.tsx:19-26`) — recharts is heavy; this keeps the report shell light. Skeletons preserve layout on hydration.
- **`useFetch` consistency for refresh/`lastRefreshed`/error pattern** — five of six pages share the same hook, the same retry copy, the same network-vs-server differentiation, and the same `setInterval(setNow, 60_000)` for live "ago" updates (`utilization:131-134`, `checkouts:109-112`, `scans:122-125`, `audit:109-112`, `overdue:138-141`).
- **Server-side pagination on volume-heavy reports** (`scans/page.tsx:127-138`, `audit/page.tsx:114-124`) — `limit + offset` flow through to the API. No 50k-row client renders.
- **URL-sync helper for filter state** (`scans/page.tsx:99-106`, `audit/page.tsx:87-94`) — period/phase/page survive refresh and are shareable.
- **Drill-down via `MetricCard.href`** (`utilization:215, 219`, `checkouts:205, 211`, `overdue:223-224`) — every metric is clickable into the source list.
- **Audit page reuses `<ActivityTimeline>`** (`audit/page.tsx:220-224`) instead of a bespoke list — same diff/expand UX as elsewhere in the app.

---

## What Doesn't Make Sense

- **Utilization renders a heatmap the API never returns.** `utilization/page.tsx:259-278` reads `data.heatmap` and renders a "365-Day Checkout Activity" card, but `getUtilizationReport()` (`route.ts:50-102`) returns no `heatmap` field — only `getCheckoutReport()` does. The conditional `data.heatmap && data.heatmap.length > 0` always evaluates false, so the section is dead UI in production.
- **`bulk-losses/page.tsx:52` clobbers visible data on every refresh.** It uses `if (loading)` instead of the documented `if (loading && !data)` pattern. Sibling pages all do the right thing — bulk-losses doesn't even have a refresh button to expose this, but the moment one is added it will replace data with skeletons.
- **Three parallel conventions for URL filter sync inside one feature area.** `scans` + `audit` use a shared-shape `syncUrl()` helper. `checkouts/page.tsx:177-181` calls `window.history.replaceState` inline. `utilization`, `overdue`, `bulk-losses` don't sync at all. New developer reading the directory has no idea which is canonical.
- **Heatmap import inconsistency.** `utilization/page.tsx:29` imports `Heatmap` synchronously; `checkouts/page.tsx:40-43` lazy-loads it via `dynamic()`. Same component, two different cost decisions in adjacent files.
- **`STATUS_META` is split across two files for utilization.** `utilization/page.tsx:49-55` defines status labels and badge variants; `utilization/charts.tsx:12-26` defines parallel `STATUS_META_LABELS` and `STATUS_COLORS`. The two will drift the next time someone adds a status.
- **Dead `transform: (json) => json as unknown as X`** in every page (`utilization:138`, `checkouts:116`, `audit:128`, `scans:142`). Pure cast, no transform. Confuses readers into looking for a real mapping.
- **`bulk-losses` uses fundamentally different toolbar/skeleton/error styling** than the other five reports — generic `Skeleton h-24 + h-64`, no refresh, no period filter, no `lastRefreshed`, error has no body copy. Reads like an earlier feature that was never updated to the V1 conventions.

---

## What Can Be Simplified

- **Six near-identical CSV downloaders** (`utilization:105-125`, `checkouts:87-99`, `scans:85-97`, `audit:73-85`, `overdue:120-132`). Extract `downloadCsv(filename, rows, headerOrder)` to `src/lib/csv.ts`. Currently ~120 lines of copy-paste.
- **Six identical `setNow` intervals** for relative-time updates (`utilization:131-134`, etc). Extract `useNow(intervalMs)` hook (~5 lines). Today: 30 lines duplicated.
- **`syncUrl` defined twice verbatim** (`scans/page.tsx:99-106`, `audit/page.tsx:87-94`). Move to `src/lib/url-sync.ts`.
- **Period filter cluster (`All / 7d / 30d / 90d`)** is duplicated in `scans:189-198`, `audit:171-180`, and a partial form in `checkouts:172-185`. Extract `<PeriodFilter value onChange options />`.
- **Error Alert block** is duplicated near-verbatim five times (`utilization:174-185`, `checkouts:152-163`, `scans:167-178`, `audit:144-155`, `overdue:180-191`). Extract `<ReportError onRetry kind={"network"|"server"} />`.
- **Toolbar (period filter + refresh button + Export CSV)** is the same in scans + audit + checkouts (with minor variation). Extract `<ReportToolbar />`. Net reduction ~150 lines across the three files.
- **`getCheckoutReport` runs two `findMany` over Booking by `createdAt`** (`route.ts:140-148`) — one for the period, one for 365 days. The 365-day window already includes the period; one query + in-memory split would do.
- **`MetricCard.tsx:24` builds className with `${href ? "..." : ""}` template** — should use `cn()` for consistency with the rest of the codebase.
- **AuditReportPage's `byAction?.length > 0` defensive chains** (`audit:202, 204, 205`) are redundant — by line 162 the API contract guarantees both are arrays. Drop the optional chaining.
- **`audit/charts.tsx:24` `tickFormatter` truncates with regex `/^(.{20}).+$/`** — `.slice(0, 20) + "…"` is shorter and clearer.

---

## What Can Be Rethought

- **Split `/api/reports/route.ts` (566 lines, 6 handlers, `?type=` switch) into per-type routes.** Current model: one route file ships every report's handler in one bundle, switched on a query param. Alternative: `src/app/api/reports/utilization/route.ts`, `.../checkouts/route.ts`, etc. Tradeoff: more files (6 vs 1) for (a) per-route bundle splitting and cold-start, (b) per-route `revalidate` / Next caching, (c) idiomatic Next.js routing, (d) easier ownership/tests. Worth doing.
- **Make read-only reports server components with a thin client island for filters.** All six pages are `"use client"` for filter state — but `utilization`, `overdue`, `bulk-losses` have no page-level filters at all (only refresh/export). They could be RSC with first paint server-rendered and a small `<RefreshIsland />` for the reload button. Cuts JS payload, fixes initial-render flash, and removes the "if (!data) return null" paint hole.
- **In-memory aggregation over `findMany` does not scale.** `getScanHistoryReport` (`route.ts:338-342`) does `db.scanEvent.findMany({ where, select: { createdAt, success } })` with no limit — pulls every matching row to bucket by day in JS. Same in `getCheckoutReport` (`route.ts:140-148`). At 100k+ scan events this will dominate latency and risk Vercel's 10s/60s timeout. Replace with `$queryRaw` `SELECT date_trunc('day', "createdAt") AS d, success, count(*) GROUP BY 1, 2`. The CLAUDE.md "Vercel Deployment Constraints" rule directly calls this out.
- **Move heatmap to utilization (where the bug already tries to put it) and remove from checkouts.** Mental model: utilization is the "year overview" page, checkouts is the "recent activity" page. Heatmap is a year-overview view. The current state — checkouts owns it, utilization tries (but fails) to render it — is backwards.
- **Bulk losses needs a period filter.** Every other report has one; bulk-losses is "all time" only. As lost units accumulate over years, the leaderboard will become unreadable.
- **`bulk-losses` `recentLosses` shows generic copy** ("completed check-in with missing units") without naming the items. The audit log's `afterJson` already contains the unit list. Render it.
- **Period filter as ISO date range, not 7/30/90 buttons.** Every report locks the user to fixed windows. A `<DateRangePicker />` (already used elsewhere in the app per `AREA_REPORTS.md`) is more flexible — and the API already accepts `startDate`/`endDate` for scans and audit.

---

## Consistency & Fit

### Pattern Drift
- **URL filter sync**: 3 conventions (`syncUrl()` helper / inline `replaceState` / no sync). Files: `scans/page.tsx`, `audit/page.tsx` use the helper; `checkouts/page.tsx:178-181` is inline; `utilization`, `overdue`, `bulk-losses` lack it entirely.
- **Loading guard**: `bulk-losses/page.tsx:52` uses `if (loading)` (clobbers refresh) vs siblings' `if (loading && !data)`.
- **Lazy heavy components**: `utilization/page.tsx:29` synchronous Heatmap import vs `checkouts/page.tsx:40-43` dynamic.
- **Refresh / live time**: 5/6 pages have refresh button + `setNow` interval + `lastRefreshed` tooltip; `bulk-losses` has none.
- **Error messages**: 5/6 differentiate `error === "network"`; `bulk-losses/page.tsx:61` does not.
- **Skeleton fidelity**: 5/6 have content-shaped skeletons; `bulk-losses/page.tsx:54-58` uses two generic rectangles.

### Dead Code
- `utilization/page.tsx:46` — `heatmap` field on `UtilizationData` type. API never returns it.
- `utilization/page.tsx:259-278` — entire `data.heatmap && ...` conditional block. Permanently unreachable.
- `utilization/page.tsx:7` — `EmptyState` import is unused (no `<EmptyState>` in the file).
- `utilization/page.tsx:138`, `checkouts/page.tsx:116`, `scans/page.tsx:142`, `audit/page.tsx:128` — `transform: (json) => json as unknown as X` is a no-op. Drop entirely.
- `audit/page.tsx:223` — `loading` prop passed to `<ActivityTimeline>`. Verify the timeline actually consumes it; if not, drop.
- `route.ts:7-8` — `req` parameter is destructured only for the `URL(req.url)` parse; consider `searchParams` from Next's typed signature instead.

### Ripple Map
- **If `MetricCard` props change** → all 6 report pages need updating.
- **If `useFetch` shape changes** → 5 report pages affected.
- **If `/api/reports?type=...` response shape changes for one type** → only that single page (no other consumers — verified via grep, only files under `src/app/(app)/reports/` call it).
- **If `/checkouts?status=overdue` route handling changes** → `reports/checkouts/page.tsx:211` and `reports/overdue/page.tsx:222` link to it (and `src/app/(app)/checkouts/page.tsx` is already a redirect to `/bookings?tab=checkouts&status=overdue`).
- **If `REPORT_SECTIONS` order changes in `lib/nav-sections.ts`** → only the layout tab bar is affected.
- **If `Heatmap` props change** → `utilization` (sync import, broken) and `checkouts` (dynamic import, working) — verify both at once.

### Navigation Integrity
- All `href` links resolve to existing routes ✅ (`/items?status=*`, `/checkouts/{id}` → redirects to `/bookings`, `/users`, `/bookings?tab=checkouts`).
- Period/phase/page query params are read on mount and survive `replaceState` updates ✅ for scans + audit; absent for utilization/overdue/bulk-losses (acceptable — no filters to sync).

---

## Polish Checklist
| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | Every list has one. |
| Skeleton fidelity | ⚠️ | `bulk-losses/page.tsx:53-58` uses two generic boxes; siblings shape skeletons to content. |
| Silent mutations | ✅ | Read-only — N/A. |
| Confirmation quality | ✅ | Read-only — N/A. |
| Mobile breakpoints | ✅ | All tables have `md:hidden` mobile cards. |
| Error message quality | ⚠️ | `bulk-losses/page.tsx:62-72` has no body copy and no network/server differentiation. |
| Button loading states | ✅ | Refresh `<RefreshCw className="animate-spin" />` consistently. |
| Role gating | ✅ | API: `requirePermission("report", "view")` (`route.ts:8`). Client: gated by `(app)` layout. |
| Performance (N+1, over-fetch) | ❌ | `getScanHistoryReport` (`route.ts:338-342`) and `getCheckoutReport` (`route.ts:140-148`) `findMany` ALL rows in window for client-side date bucketing. Will not scale; risks Vercel timeout. |
| Debug cleanup | ✅ | No `console.*` or `TODO`/`FIXME` in the area. |
| Accessibility basics | ✅ | Refresh icon button wrapped in Tooltip; tabs are real `<Link>`s with text. |

---

## Raise the Bar

- **`scans/page.tsx` and `audit/page.tsx` URL-sync + server pagination** is the cleanest pattern in this area. `checkouts/page.tsx` should adopt the same `syncUrl` helper and drop its inline `window.history.replaceState`. The `<PeriodFilter />` extraction (see Quick Wins) makes this a one-line swap.
- **`audit/page.tsx`'s reuse of `<ActivityTimeline>`** instead of a bespoke list shows how a domain-shared component prevents drift. Worth keeping in mind when the next "list of events" UI is built (e.g. notifications history).
- **`overdue/page.tsx:228-246` `BarChart` with horizontal layout** auto-sizes by entry count (`Math.max(150, leaderboard.length * 36)`). Same pattern lives in `utilization/charts.tsx:88` and `audit/charts.tsx:46` — that auto-height idiom is a small but real polish move worth replicating in any future ranked-list chart.

---

## Quick Wins

- **`utilization/page.tsx:46, 259-278`** — Delete dead heatmap block and `heatmap` field from `UtilizationData`. The block has never rendered. (Or: fix the bug and add `heatmap` to `getUtilizationReport()` — see Bigger Bets.)
- **`bulk-losses/page.tsx:52, 61`** — Change `if (loading)` → `if (loading && !data)` and `if (error || !data)` → `if (error && !data)`. Matches sibling pages and prevents refresh from clobbering the page.
- **`utilization/page.tsx:7`** — Remove unused `EmptyState` import.
- **All 4 pages** — Drop the `transform: (json) => json as unknown as X` no-op cast.
- **Extract `syncUrl()` to `src/lib/url-sync.ts`** — single source for `scans/page.tsx:99-106` and `audit/page.tsx:87-94`, then use in `checkouts/page.tsx:177-181`.

---

## Bigger Bets

- **Replace in-memory daily aggregation with `$queryRaw` `date_trunc('day', "createdAt")` GROUP BY** in `getScanHistoryReport` (`route.ts:338-342`) and `getCheckoutReport` heatmap branch (`route.ts:144-148`). Today the API pulls every matching row to bucket in JS — fine at 1k events, dangerous at 100k. Aligns with CLAUDE.md "keep API routes fast" / "batch DB operations." Cost: ~1 hour per query, requires a touch of raw SQL knowledge. Worth it because reports are the most query-heavy surface in the app and the next dataset growth wave will hit them first.

- **Split `src/app/api/reports/route.ts` (566 lines) into per-type routes** under `src/app/api/reports/{utilization,checkouts,overdue,scans,audit,bulk-losses}/route.ts`. Each becomes ~80-150 lines with focused tests, independent bundle, and per-route caching headroom. Cost: half a day, mostly mechanical. Removes the awkward `?type=` discriminator and aligns with the `AREA_REPORTS.md` doc which already describes them as `/api/reports/{kind}` endpoints (the doc is wrong about the current code shape — fixing the code is easier than rewriting the doc).
