# Schedule Ship-Readiness Audit

**Date**: 2026-04-04
**Auditor**: Claude (automated)
**Area**: Schedule (Shift Calendar, Assignment, Trades)
**Overall Verdict**: **Nearly ready** (19/25)

---

## Scores

| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_SHIFTS.md current (last entry 2026-04-03), all 11 ACs marked met, IA matches code, clear boundaries between Schedule/Events/Scan |
| Hardening | 4/5 | Schedule page 6-pass hardened + 5-bug stress test (2026-04-03/04). Event detail page NOT hardened. Minor error handling gaps remain. |
| Roadmap | 5/5 | `tasks/schedule-roadmap.md` updated 2026-04-04 with V1 (shipped), V1.5 (shipped), V2 (3 features sized), V3 (5 features with schema/API/effort). Dependencies mapped. |
| Feature completeness | 3/5 | Core V1 complete. V2 gear readiness, conflict warning, quick-assign not yet shipped. Backfill route has potential N+1 performance concern. |
| Doc sync | 2/5 | AREA_SHIFTS.md last-updated header says 2026-03-16 but changelog goes to 2026-04-03. NORTH_STAR.md line 204 stale ("Inline dashboard actions" still "Planned"). WeekView not reflected in AREA_SHIFTS.md IA section. |

---

## Page-by-Page Status

| Page | Route | Hardening | Issues |
|---|---|---|---|
| Schedule | `/schedule` | **Hardened** | 6-pass hardened 2026-04-03. 401 redirect, double-click guards, mobile skeletons. Minor: `handleHideEvent` doesn't differentiate network vs server errors in toast. |
| ScheduleFilters | (component) | **Hardened** | Clean. Responsive. No issues. |
| ListView | (component) | **Hardened** | Desktop table + mobile cards. Dead CSS removed. Tailwind theme classes applied. |
| WeekView | (component) | **Hardened** | Desktop grid + mobile collapsible. Loading skeleton added. |
| CalendarView | (component) | **Partial** | Mobile notice fixed (`hidden max-md:block`). Still shows "Switch to List view" on mobile rather than auto-switching — poor UX. |
| Event Detail | `/events/[id]` | **Not hardened** | 4 parallel fetches, 9 useState calls. Has 401 handling and error/retry states. EventSkeleton doesn't match actual layout (missing coverage card section). Never been through `/harden-page`. |
| ShiftCoverageCard | (component) | **Partial** | Role-gated rendering works. Uses shadcn Table. Not independently stress-tested. |
| ShiftDetailPanel | (dynamic) | **Partial** | 8+ useState calls. Dynamically imported (SSR disabled). Not fully audited — truncated at 150 lines during inspection. |
| TradeBoard | (dynamic) | **Partial** | Dynamically imported. Area + status filters. Not fully audited — truncated during inspection. |

---

## API Route Inventory

| Route | Method | Auth | Validation | Audit | Txn | Issues |
|---|---|---|---|---|---|---|
| `/api/shifts` | POST | withAuth + perm | Zod | Yes | Single create | Clean |
| `/api/shifts/[id]` | PATCH/DELETE | withAuth + perm | Zod | Yes | Single op | Clean |
| `/api/shifts/backfill` | POST | withAuth + perm | — | Yes | — | **Loop calls `generateShiftsForEvent()` per event — potential N+1** |
| `/api/shifts/my-hours` | GET | withAuth | — | — (read) | — | **Double iteration over assignments — inefficient but not broken** |
| `/api/shift-groups` | GET | withAuth + perm | Query params | — (read) | — | Uses Promise.all for count+findMany — good |
| `/api/shift-groups/[id]` | GET/PATCH | withAuth + perm | Zod | Yes (PATCH) | SERIALIZABLE | Clean (BRK-001 fixed) |
| `/api/shift-groups/[id]/regenerate` | POST | withAuth + perm | — | Yes | Delegates | Clean |
| `/api/shift-groups/[id]/shifts` | POST | withAuth + perm | Zod (inline) | Yes | $transaction | Clean |
| `/api/shift-groups/[id]/shifts/[shiftId]` | DELETE | withAuth + perm | — | Yes | $transaction | Excellent cascading (cancels open trades) |
| `/api/shift-assignments` | POST | withAuth + perm | Zod | Yes | Delegates (SERIALIZABLE) | Clean |
| `/api/shift-assignments/request` | POST | withAuth + perm | Zod | Yes | Delegates (SERIALIZABLE) | Clean |
| `/api/shift-assignments/[id]/approve` | PATCH | withAuth + perm | — | Yes | Delegates (SERIALIZABLE) | Clean (BRK-002 fixed: re-validates conflicts) |
| `/api/shift-assignments/[id]/decline` | PATCH | withAuth + perm | — | Yes | Delegates | Clean |
| `/api/shift-assignments/[id]/swap` | PATCH | withAuth + perm | Zod | Yes | Delegates | Clean |
| `/api/shift-trades` | GET/POST | withAuth + perm | Zod (POST) | Yes (POST) | Delegates (SERIALIZABLE) | Clean |
| `/api/shift-trades/[id]/claim` | PATCH | withAuth + perm | — | Yes | Delegates (SERIALIZABLE) | Clean |
| `/api/shift-trades/[id]/approve` | PATCH | withAuth + perm | — | Yes | Delegates (SERIALIZABLE) | Clean |
| `/api/shift-trades/[id]/decline` | PATCH | withAuth + perm | — | Yes | Delegates | Clean |
| `/api/shift-trades/[id]/cancel` | PATCH | withAuth + perm | — | Yes | Delegates | Clean |

**19 routes total. All have auth + permission checks. All mutations have audit logging. All multi-step mutations use SERIALIZABLE transactions.**

---

## Service Layer

| Service | Transactions | Isolation | Key Functions | Issues |
|---|---|---|---|---|
| `shift-assignments.ts` | Yes on all mutations | SERIALIZABLE | checkTimeConflict, directAssignShift, requestShift, approveRequest, initiateSwap, removeAssignment | Clean. Time conflict check centralized and reused. |
| `shift-trades.ts` | Yes on all mutations | SERIALIZABLE | postTrade, claimTrade, approveTrade, declineTrade, executeSwap | Clean. Area match validation on claim. |

---

## Feature Inventory

| Feature | Status | Source | Notes |
|---|---|---|---|
| List view (date-grouped, expandable) | **Shipped** | AREA_SHIFTS.md, BRIEF_SHIFT_REDESIGN_V2 | Desktop table + mobile cards |
| Calendar view (month grid, coverage dots) | **Shipped** | AREA_SHIFTS.md | Coverage indicators green/orange/red |
| Week view (7-day columns) | **Shipped** | schedule-roadmap.md V1.5 | Originally V2, shipped early |
| Multi-filter (sport, area, coverage, time) | **Shipped** | AREA_SHIFTS.md AC | Persisted to localStorage |
| My Shifts toggle | **Shipped** | AREA_SHIFTS.md AC | Default ON for students |
| My Hours stat strip | **Shipped** | schedule-roadmap.md V1.5 | Week + month totals |
| ShiftDetailPanel (per-event editing) | **Shipped** | BRIEF_SHIFT_REDESIGN_V2 Slice 1 | Add/remove shifts, manuallyEdited guard |
| Universal user assignment | **Shipped** | BRIEF_SHIFT_REDESIGN_V2 Slice 2 | Not roster-locked, any user assignable |
| Avatar picker with search | **Shipped** | BRIEF_SHIFT_REDESIGN_V2 Slice 3 | Mobile responsive |
| Premier event requests | **Shipped** | AREA_SHIFTS.md AC | Student request → staff approve |
| Trade board (post/claim/approve/decline) | **Shipped** | AREA_SHIFTS.md AC | Area + status filters, sheet overlay |
| Time conflict validation | **Shipped** | Stress test BRK-002 | Centralized, checked on assign/request/approve/claim |
| Audio + haptic scan feedback | **Shipped** | schedule-roadmap.md V1.5 | Web Audio API, 4 feedback types |
| Shift auto-generation from ICS | **Shipped** | AREA_SHIFTS.md AC | Via cron + manual backfill |
| Event Command Center | **Shipped** | AREA_SHIFTS.md changelog | Merged with Shift Coverage card |
| Gear readiness indicators | **Specced** | schedule-roadmap.md V2a | Icon on list/calendar/week views |
| Conflict warning on assignment | **Specced** | schedule-roadmap.md V2b | Pre-assignment warning in picker |
| Quick-assign from list view | **Specced** | schedule-roadmap.md V2c | Popover-based, staff only |
| Smart assignment suggestions | **Specced** | schedule-roadmap.md V3a | Heuristic: area + sport + history |
| Student availability | **Specced** | schedule-roadmap.md V3b, GAPS_AND_RISKS | New schema model needed |
| Batch operations | **Specced** | schedule-roadmap.md V3c | Multi-event shift regeneration |
| Shift email notifications | **Mentioned** | GAPS_AND_RISKS, todo.md | Deferred to Phase B, no spec |
| Coverage gap alerts | **Mentioned** | schedule-roadmap.md (deferred) | User deferred during feature eval |
| Real-time updates | **Specced** | schedule-roadmap.md V3e | Polling-based via React Query |
| Drag-to-assign | **Mentioned** | schedule-roadmap.md (explicitly excluded) | Deliberately deferred — ShiftDetailPanel sufficient |

---

## Open Gaps & Blockers

### From GAPS_AND_RISKS.md
- **Shift email notifications**: V1 = in-app only. No timeline for email via Resend. Not blocking ship.
- **Student availability**: Deferred to Phase B. No schema migration yet.

### Discovered During Audit
1. **Event detail page (`/events/[id]`) not hardened**: 9 useState hooks, 4 parallel fetches, no stress test history. This is the second most-used page in the Schedule area after `/schedule` itself.
2. **Backfill route performance**: `POST /api/shifts/backfill` loops over events calling `generateShiftsForEvent()` per iteration. For 50+ events, this could exceed Vercel's 10s serverless timeout on Hobby plan.
3. **Doc sync drift**: AREA_SHIFTS.md header says "Last Updated: 2026-03-16" but content was updated 2026-04-03. WeekView is not listed in the IA section. My Hours stat strip not in IA section.
4. **CalendarView mobile UX**: Shows "Switch to List view" text on mobile instead of auto-switching or providing a better experience. Acknowledged but not fixed.
5. **EventSkeleton layout mismatch**: Skeleton doesn't include coverage card section, creating a visual jump on load.
6. **my-hours double iteration**: Two passes over the same assignment array (week filter + month filter). Minor perf concern, not a blocker.

---

## Recommended Actions (prioritized)

1. **Run `/harden-page` on Event Detail page** (`/events/[id]`) — the only unhardened page in this area. Has 401 handling already but needs full 6-pass treatment (design system, resilience, UX polish, skeleton sync).

2. **Fix AREA_SHIFTS.md doc sync** — update "Last Updated" header from 2026-03-16 to 2026-04-04. Add WeekView and My Hours to the IA section. Add V1.5 enhancements to the feature list.

3. **Profile backfill route** — verify `generateShiftsForEvent()` doesn't cause N+1 queries. If it does, batch the DB reads before the loop. If the loop is acceptable, add a note about expected event count limits.

4. **Consolidate my-hours calculation** — refactor double-loop into single pass over assignments. Not urgent but easy cleanup.

5. **Improve CalendarView mobile UX** — either auto-switch to ListView on mobile or render a simplified mobile calendar. Current "Switch to List view" text is a dead end.

6. **Sync NORTH_STAR.md** — line 204 "Inline dashboard actions" still shows "Planned" — clarify if this is V2 scope or remove.

---

## Roadmap Status

| Version | Status | Features | Notes |
|---|---|---|---|
| **V1** | Shipped (2026-03-26) | List/Calendar views, filters, ShiftDetailPanel, TradeBoard, premier requests, auto-generation | All 11 ACs met |
| **V1.5** | Shipped (2026-04-03/04) | Week view, My Hours, audio/haptic feedback, 6-pass hardening, 5-bug stress test | Originally V2 scope, shipped early |
| **V2** | Planned (3 features) | Gear readiness indicators, conflict warning, quick-assign | No schema changes needed. 1 new API route. 2-3 sessions estimated. |
| **V3** | Envisioned (5 features) | Smart suggestions, student availability, batch ops, coverage heatmap, real-time updates | 1 schema migration (StudentAvailability). 4-6 sessions. |

**Roadmap rating: Well-defined** — V1 shipped, V2 planned with file-level specifics and build order, V3 envisioned with schema changes and effort sizing.

---

## Hardening Detail

### Hardening History (from git)
- **2026-04-03**: `/harden-page Schedule` — 6-pass audit (architecture, design system, data flow, resilience, UX polish, doc sync). 3 commits.
- **2026-04-03**: `/break-this Schedule` — stress test of all shift API routes + services. 5 bugs found and fixed. 2 commits.
- **Event Detail page**: No hardening history found.

### Per-Page Hardening Checklist

| Check | Schedule `/schedule` | Event Detail `/events/[id]` |
|---|---|---|
| Design system alignment | Pass — shadcn/ui throughout, dead CSS removed | Partial — uses shadcn but not audited for dead code |
| Data flow safety | Pass — AbortController, 401 handling, null-safe | Partial — has 401 + retry but 4 parallel fetches not stress-tested |
| Resilience | Pass — spam-click guards, try/catch/finally, network differentiation | Partial — has retry button but no spam-click guards on actions |
| UX polish | Pass — skeletons (desktop+mobile), toasts, optimistic updates | Partial — EventSkeleton doesn't match layout, no optimistic mutations |
| Accessibility | Not audited | Not audited |
