# Plan 039: Make dashboard overflow links filter-aware

## Status
- Status: TODO
- Priority: P2
- Effort: S
- Owner: unassigned
- Created: 2026-06-11
- Source audit: `/improve dashboard` at commit `8d445512`

## Problem
Dashboard section counts switch to visible filtered row counts when sport or location filters are active, but overflow links only check `activeSport`. With a location-only filter active, the visible count can be scoped to one location while `View all N` still uses the unfiltered total.

This creates a small but real trust mismatch in the dashboard lanes: the header says one scoped count, the footer points at an unscoped total.

## Benefit
Dashboard filters stay internally consistent. Operators do not see unfiltered overflow totals while scanning a location-specific queue.

## Evidence
- Filters support both `activeSport` and `activeLocation`: `src/hooks/use-dashboard-filters.ts:42-43`, `src/hooks/use-dashboard-filters.ts:116-120`.
- Filtered data is used for visible row arrays and header counts: `src/app/(app)/dashboard/team-activity-column.tsx:55-62`, `src/app/(app)/dashboard/my-gear-column.tsx:54-59`.
- Parent passes only `activeSport` into both dashboard columns: `src/app/(app)/page.tsx:330-348`.
- My Gear overflow links hide only when `activeSport` is set: `src/app/(app)/dashboard/my-gear-column.tsx:146-189`.
- Team Activity overflow links hide only when `activeSport` is set: `src/app/(app)/dashboard/team-activity-column.tsx:141-218`.
- Dashboard area docs require five-row caps with `View all` overflow links: `docs/AREA_DASHBOARD.md:20`, `docs/AREA_DASHBOARD.md:142-146`.

## Scope
1. Replace the column prop's narrow `activeSport` overflow decision with a filter-aware signal:
   - Option A: pass `hasActiveFilter`.
   - Option B: pass both `activeSport` and `activeLocation`.
2. Keep sport-specific empty-state copy, or extend it to location copy if that remains simple and clear.
3. Hide unfiltered overflow totals whenever any dashboard filter is active, unless the link can carry the same filter scope to the target page.
4. Apply the behavior consistently across:
   - My checkouts
   - My reservations
   - Team checkouts
   - Awaiting pickup
   - Stale reservations
   - Team reservations
5. Preserve existing deep links for unfiltered states.

## Out Of Scope
- Adding location query support to `/checkouts`, `/reservations`, or `/bookings`.
- Changing dashboard filter chips or saved presets.
- Changing row caps.

## Implementation Notes
- The smallest implementation is to pass `filters.hasActiveFilter` from `page.tsx` to both columns and replace `!activeSport` footer guards with `!hasActiveFilter`.
- Keep `activeSport` available for existing empty-state copy.
- If target pages already support equivalent `sport` or `location` params, carrying those params is acceptable, but do not expand target page filtering in this slice.

## Verification
- Add or extend a dashboard source-contract test proving column overflow footers use a filter-aware guard, not only `activeSport`.
- Run:
  - the new or updated dashboard filter/overflow test
  - `npx vitest run tests/dashboard-pending-pickup-link.test.ts`
  - `npx tsc --noEmit`
  - `git diff --check`

## Docs
- Update `docs/AREA_DASHBOARD.md` changelog to record filter-aware overflow behavior.

## STOP Conditions
- Stop if preserving filtered overflow links requires new target-page filtering behavior. That belongs in a separate plan.
- Stop if changing footer visibility makes filtered dashboard sections appear to drop reachable data without a clear route to the full unfiltered list.
