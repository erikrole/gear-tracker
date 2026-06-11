# Plan 038: Surface dashboard partial-result warnings

## Status
- Status: TODO
- Priority: P2
- Effort: S/M
- Owner: unassigned
- Created: 2026-06-11
- Source audit: `/improve dashboard` at commit `8d445512`

## Problem
Both dashboard endpoints return `partialFailures`, but the dashboard client does not type or render that metadata. If one side query fails, the API falls back to empty counts or rows and logs the segment, while the operator sees a clean-looking dashboard.

That is especially risky for an ops console: a blank lane can mean "nothing to do" or "that read failed".

## Benefit
Operators get the same partial-results signal that Fix Today and Inventory Hygiene already show. A dashboard with fallback data stays usable, but it no longer looks final.

## Evidence
- `/api/dashboard` collects and returns `partialFailures`: `src/app/api/dashboard/route.ts:391-445`, `src/app/api/dashboard/route.ts:826`.
- `/api/dashboard/stats` collects and returns `partialFailures`: `src/app/api/dashboard/stats/route.ts:9-18`, `src/app/api/dashboard/stats/route.ts:94-112`.
- `DashboardData` does not include `partialFailures`: `src/app/(app)/dashboard-types.ts:182-204`.
- `fetchDashboardStats` parses only `json.data`, so top-level `partialFailures` from stats is discarded: `src/hooks/use-dashboard-data.ts:48-56`.
- Dashboard page renders banners and columns, but no partial-result warning: `src/app/(app)/page.tsx:306-355`.
- Existing reusable primitive: `OperationalPartialResultsAlert` in `src/components/OperationalFeedback.tsx:91-115`.
- Existing consumers: Fix Today at `src/app/(app)/admin/fix-today/FixTodayClient.tsx:114-170`, Inventory Hygiene at `src/app/(app)/items/hygiene/page.tsx:226-270`.

## Scope
1. Extend dashboard client types to carry partial-result metadata:
   - `DashboardData.partialFailures?: string[]`
   - a stats wrapper or stats type field that preserves the top-level stats `partialFailures`.
2. Normalize missing partial failures to an empty array in `useDashboardData`.
3. Preserve full dashboard partial failures when overlaying stats.
4. Include stats partial failures in the visible warning if the fast stats query succeeds with fallback metadata.
5. Render `OperationalPartialResultsAlert` near the dashboard refresh/freshness area or above the operational lanes.
6. Use dashboard-specific copy, for example title "Some dashboard data used fallback results" and noun "dashboard check".

## Out Of Scope
- Blocking dashboard use when partial failures exist.
- Showing stack traces or raw database errors in the UI.
- Retrying individual failed segments.

## Implementation Notes
- `OperationalPartialResultsAlert` already handles empty arrays and warning tone. Reuse it rather than creating a custom alert.
- Keep the warning compact. Dashboard is a daily action console, so the warning should explain trust state without pushing action lanes far down the page.
- Deduplicate labels if both full and stats payloads report the same segment.
- Treat stats request hard failure separately from partial failures. Existing background refresh toast behavior should remain.

## Verification
- Add a source-contract test that dashboard types and `useDashboardData` preserve `partialFailures`.
- Add a source-contract or component test proving `src/app/(app)/page.tsx` renders `OperationalPartialResultsAlert`.
- Run:
  - the new or updated dashboard partial-failure test
  - `npx tsc --noEmit`
  - `git diff --check`

## Docs
- Update `docs/AREA_DASHBOARD.md` changelog to record that dashboard partial-result metadata is visible to operators.
- No `docs/GAPS_AND_RISKS.md` change is needed unless implementation uncovers a broader fallback-trust gap.

## STOP Conditions
- Stop if stats partial-failure metadata cannot be preserved without changing the API envelope broadly.
- Stop if adding the alert causes layout overlap or pushes the primary action lanes below the first viewport on common desktop widths.
