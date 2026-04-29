# Schedule Improvement Audit
**Date**: 2026-04-29
**Target**: `src/app/(app)/schedule/` + `src/hooks/use-schedule-data.ts`
**Type**: Page (multi-view system)

---

## What's Smart

**Parallel data fetch via React Query signal** (`use-schedule-data.ts:238–241`): `fetchSchedule` fires both `calendar-events` and `shift-groups` in a single `Promise.all`, and threads React Query's built-in `signal` through for automatic cancellation on query invalidation. Clean and correct.

**Server/client filter split** (`use-schedule-data.ts:81–126` + `250–271`): Date-range and sport filters are server-side (URL params); area, coverage, home/away, and myShifts are client-side. This avoids a network round-trip for every filter toggle while keeping the fetch payload bounded by view window. The split is well-reasoned.

**Double-invoke guard for hide** (`page.tsx:37–67`): `hidingRef.current` (a `Set`) guards `handleHideEvent` against concurrent calls for the same event — correct pattern from lessons.md (ref guard before state).

**User list lazy-load with dedup** (`ListView.tsx:114–136`): `usersLoadedRef.current` ensures the `/api/users?limit=200` call fires at most once per component mount, regardless of how many pickers are opened.

**Stale error display** (`use-schedule-data.ts:244–247`): `loadError` is only set when both the fetch failed AND `entries.length === 0`. On refresh failures the page keeps showing existing data — matches the lessons.md rule: "Refresh failure must NOT replace visible data."

---

## What Doesn't Make Sense

**`role="link"` on non-anchor elements** (`ListView.tsx:502, 743`): Two click targets — the mobile shift row `<div>` and the desktop shift child `<tr>` — use `role="link"` but call JavaScript functions (`onSelectGroup()`). `role="link"` implies following a URL; `role="button"` is correct here. Screen readers will announce these as links and expect keyboard-navigable destinations.

**Assign page uses client-side role gate** (`assign/page.tsx:43–54`): Fetches `/api/me`, inspects the role, then `router.replace`s non-staff. The page renders `null` for one tick while the check is in-flight. Every other staff-gated UI in the schedule system uses conditional rendering (`isStaff` guard at `page.tsx:36`). The server route has no auth guard either, so a direct URL visit flash-renders blank before redirect. Inconsistent pattern.

**`loadTradeCount` is a no-op wrapper** (`use-schedule-data.ts:335`): `loadTradeCount: () => { refetchTrades(); }` wraps React Query's already-stable `refetchTrades` in a plain function. Callers could use `refetchTrades` directly.

**`getThisMonday` duplicated** (`WeekView.tsx:84–90` and `use-schedule-data.ts:168–174`): Both files independently implement "Monday of the current week." One is parameterized (`getMonday(d)`), one is not (`getThisMonday()`). Neither is exported/shared.

---

## What Can Be Simplified

**Dead function `rowBarClass`** (`ListView.tsx:56–62`): Defined as a module-level function but never called. Desktop `EventRows` (lines 612–617) and the mobile card (lines 400–406) both inline their own `barColor`/`borderBar` triternaries. Remove `rowBarClass`.

**Dead import `formatDate`** (`ListView.tsx:24`): Imported from `./types` but not used anywhere in the file. The file uses `formatDateShort` (from `@/lib/format`) and `formatTime` (from `./types`). Remove the import.

**Dead export `areaCoverage`** (`types.ts:82–93`): Exported but not imported by any file in the codebase. Remove it.

---

## What Can Be Rethought

**Shift-groups silent truncation for busy months**

`buildScheduleUrls` passes `limit=200` on the events URL but no `limit` param on the shift-groups URL (`use-schedule-data.ts:83`). The shift-groups route defaults to `PAGINATION_DEFAULT_LIMIT = 50` and hard-caps at 100 (`route.ts:11–12`). For any month with more than 50 events that have shift groups, some groups are silently dropped — those events show no coverage data or shift rows with no indication to the user.

Current: no `limit` param → 50 groups returned silently.
Fix: pass `limit=200` on `sgParams` and raise or remove the hard-cap in the route (date-range already bounds the payload).

**Home/away color tokens inconsistent across views**

`CalendarView.tsx` (lines 80–91) and `CoverageBar` in `WeekView.tsx` (lines 106–110) use `var(--green)` / `var(--orange)` — the design system's theme-aware CSS variables.

`EventCard` in `WeekView.tsx` (lines 147–157) uses `bg-emerald-500` / `bg-amber-500` / `bg-emerald-500/8` / `bg-amber-500/8` — hardcoded Tailwind colors that ignore dark mode token definitions.

`EventRows` and the mobile card in `ListView.tsx` (lines 402–406, 614–616) also use `border-l-emerald-500` / `border-l-amber-500`.

The lessons.md rule is explicit: "CSS var references beat hardcoded dark-mode pairs." In dark mode, emerald/amber may diverge from what `var(--green)` / `var(--orange)` resolve to. All three views should use the same token.

---

## Consistency & Fit

### Dead Code

| Symbol | File | Line | Issue |
|---|---|---|---|
| `rowBarClass` | `ListView.tsx` | 56 | Defined, never called |
| `formatDate` | `ListView.tsx` | 24 | Imported, never used |
| `areaCoverage` | `types.ts` | 82 | Exported, no consumers anywhere |

### Ripple Map

- **If `/api/shift-groups` response shape changes**: `use-schedule-data.ts`, `use-assignment-grid.ts` (line 166), and `events/[id]/page.tsx` (line 48) all consume it.
- **If `CalendarEntry` type changes**: `ListView.tsx`, `WeekView.tsx`, `CalendarView.tsx`, `use-schedule-data.ts`, and `use-assignment-grid.ts` all reference it.
- **If `ACTIVE_STATUSES` values change in `types.ts`**: Must stay in sync with `ACTIVE_ASSIGNMENT_STATUSES` in `src/lib/shift-constants.ts` — currently both are `["DIRECT_ASSIGNED", "APPROVED"]` but maintained independently in two files.
- **If `/schedule/assign` route changes**: Hardcoded as `href="/schedule/assign"` in `page.tsx:78` — one reference, low ripple.

### Navigation Integrity ✅

All `<Link>` hrefs point to valid routes. No hardcoded broken paths detected.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | ListView has contextual empty states (myShifts vs hasFilters vs default). WeekView shows "No events this week." AssignmentGrid shows "No events this month." |
| Skeleton fidelity | ⚠️ | `WeekSkeleton` (`WeekView.tsx:231–258`) has identical-width rectangles — two `h-12 w-full` blocks per column, not representative of real card heights. ListView uses `SkeletonTable` which is acceptable. |
| Silent mutations | ⚠️ | `handleHideEvent` (`page.tsx:50–52`): on `res.ok` calls `data.loadData()` with no toast. User gets no confirmation the event was hidden. All other mutations have success toasts. |
| Confirmation quality | ✅ | Hiding is reversible (low-stakes). No destructive-without-confirm actions. |
| Mobile breakpoints | ✅ | All three views have dedicated mobile layouts. CalendarView shows "switch to List" on mobile. WeekView uses collapsible day sections. ListView switches to a card layout. |
| Error message quality | ✅ | Uses `classifyError` + `parseErrorMessage` consistently. Network vs server differentiation present. |
| Button loading states | ⚠️ | The "Unassigned" popover trigger (`ListView.tsx:769`) has no disabled state during `assigning=true` — a second picker open while an assignment is in-flight is possible. "Post for trade" correctly disables during `postingTradeId`. |
| Role gating | ✅ | Staff-only actions (hide, inline assign, new event, assign shifts) all gated behind `isStaff`. |
| Performance (N+1, over-fetch) | ⚠️ | No N+1 in API routes. However, `fetchTradeCount` (`use-schedule-data.ts:160–165`) loads full trade objects just to read `.data.length` — a count endpoint would be cheaper. Low severity given typical trade volume. |
| Debug cleanup | ✅ | No `console.log`, `TODO`, or `FIXME` found. |
| Accessibility basics | ⚠️ | `role="link"` misused on `<div>` (`ListView.tsx:502`) and `<tr>` (`ListView.tsx:743`) — should be `role="button"`. The hide-event icon button (`ListView.tsx:699`) has only a `<TooltipContent>` for label — no `aria-label` on the `<Button>` itself for screen readers that don't read tooltip content. |

---

## Quick Wins

**1. `ListView.tsx:24` + `types.ts:82` + `ListView.tsx:56` — Remove dead code**
Delete `formatDate` import, `areaCoverage` export, and the `rowBarClass` function. Pure subtraction — no downstream impact.

**2. `page.tsx:51` — Add success toast on hide event**
After `data.loadData()` on a successful hide, add `toast.success("Event hidden")`. Closes the only silent-mutation gap in the checklist.

**3. `ListView.tsx:502, 743` — Fix `role="link"` → `role="button"`**
Two panel-opening click targets have incorrect ARIA roles. `role="button"` is semantically correct for actions that don't navigate to a URL.

**4. `use-schedule-data.ts:83` — Add `limit=200` to `sgParams`**
`evParams` already has `limit: "200"`. Mirror it on `sgParams` to prevent the shift-groups route from silently defaulting to 50 and dropping coverage data on busy months. Also remove the `Math.min(rawLimit, 100)` hard-cap from `shift-groups/route.ts:12` or raise it to 200.

**5. `ListView.tsx:699` — Add `aria-label` to hide-event button**
`<Button variant="ghost" size="icon-sm">` with only an `<EyeOffIcon>` child needs `aria-label="Hide event"` for screen reader users.

---

## Bigger Bets

**Unified home/away color tokens across all three views**
WeekView `EventCard` and ListView's border bars use raw `emerald-500` / `amber-500`, while CalendarView and WeekView's `CoverageBar` use `var(--green)` / `var(--orange)`. Unifying to CSS variables everywhere means one dark-mode edit point in `globals.css`. Medium effort (6 class strings across 2 files), low risk, permanent design-system alignment.

**Shift-groups route: raise or remove the 100-record cap**
The route caps at 100 regardless of the requested `limit` (`route.ts:12`). For a program with 100+ events in a month, coverage data silently disappears. Fix options: (a) raise cap to 500 — date-range bounds payload already; (b) implement cursor pagination in the hook. Option (a) is simpler and correct given the bounded date window.
