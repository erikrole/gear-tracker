# API Hardening: Schedule Assign

Date: 2026-05-14
Surface: `/schedule/assign` related APIs
Routes reviewed:

- `GET /api/calendar-events`
- `PATCH /api/calendar-events/[id]/visibility`
- `GET|POST /api/shift-groups`
- `POST /api/shift-groups/[id]/shifts`
- `DELETE /api/shift-groups/[id]/shifts/[shiftId]`
- `POST /api/shift-assignments`
- `DELETE /api/shift-assignments/[id]`
- `GET /api/shifts/[id]/conflicts`
- `GET /api/users`

## Summary

No auth bypass found. The related handlers are wrapped, staff/admin mutation permissions are server-enforced, shift assignment service writes run in Serializable transactions, and the freshly hardened event-visibility route validates strict boolean payloads and audits inside the same transaction.

Follow-up fixes are complete: calendar and shift date inputs now validate consistently, invalid add-slot date payloads have route coverage, and the Assign page mutation handlers use a ref-backed duplicate-submit guard.

## Passing Checks

- Handler wrappers: reviewed exports are wrapped with `withAuth`.
- Mutating assignment routes use `requirePermission`.
- Add/remove shift routes use `requirePermission`.
- Event visibility blocks non-staff/admin users and validates `{ isHidden: boolean }`.
- Direct assignment, request, approval, decline, swap, and remove use Serializable transactions in `src/lib/services/shift-assignments.ts`.
- Add shift uses a Serializable transaction and writes `shift_added` audit.
- Delete shift cancels open trades, deletes related assignments, marks the group manually edited, and audits force context.
- Event visibility update and audit entry run in one transaction.
- Focused existing tests cover shift assignment service behavior and visibility route hardening.

## P0 Findings

None.

## P1 Findings

### P1-1: Add-slot accepts invalid optional dates and can 500 instead of 400 — RESOLVED

Source: `src/app/api/shift-groups/[id]/shifts/route.ts:9-15`, `src/app/api/shift-groups/[id]/shifts/route.ts:30-42`

`startsAt` and `endsAt` are optional strings, then parsed with `new Date(...)`. Invalid strings are not rejected before the Prisma create. The route also does not enforce `endsAt > startsAt` when overrides are provided.

Impact: The current Assign page does not send date overrides, so the normal UI path is safe. The API route itself is still loose and can turn malformed client input into a 500. This is exactly the kind of route-validation gap the hardening workflow is meant to catch.

Fix: `POST /api/shift-groups/[id]/shifts` now validates override dates through `src/lib/api-dates.ts`, rejects inverted override ranges before opening a transaction when both dates are provided, and validates override-plus-parent-event ranges inside the transaction before creating a shift.

Verification: `tests/schedule-date-validation.test.ts`.

### P1-2: Client-side add/remove/assign handlers need ref-backed duplicate guards — RESOLVED

Source: `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx:52-140`

The API layer protects assignment conflicts, but the client can still send duplicate mutation requests before `acting` state disables controls. The add-slot endpoint treats each valid request as a new shift, so accidental double-submit creates extra slots.

Fix: `AssignmentCell` now uses `actingRef` as an immediate action gate while retaining `acting` state for disabled/loading UI.

Verification: TypeScript and production build.

## P2 Findings

### P2-1: Calendar and shift-group read routes should reject invalid date query params — RESOLVED

Source: `src/app/api/calendar-events/route.ts:10-21`, `src/app/api/shift-groups/route.ts:14-28`

Both routes use `new Date(...)` for query params without validating `Invalid Date` or inverted ranges. The shipped Assign hook sends valid ISO dates, but malformed direct requests can still cause Prisma errors.

Fix: `GET /api/calendar-events` and `GET /api/shift-groups` now reject invalid query dates and inverted ranges with 400 responses.

Verification: `tests/schedule-date-validation.test.ts`.

## Tests To Add With Fixes

- `POST /api/shift-groups/[id]/shifts` rejects invalid `startsAt`. Shipped.
- `POST /api/shift-groups/[id]/shifts` rejects `endsAt <= startsAt`. Shipped.
- `GET /api/shift-groups` rejects invalid `startDate`. Shipped.
- `GET /api/calendar-events` rejects invalid `startDate`. Shipped.
- `AssignmentCell` rapid-click protection is guarded with `actingRef` and verified by TypeScript/build coverage. Component-level tests can be added if this area gets a dedicated React Testing Library harness.

## Follow-up: /schedule Peer Pass

The normal `/schedule` page was re-checked after the Assign fixes. No new route-level P0/P1 API gaps were found. Current source already uses `limit=200` for schedule shift-group reads, and the shared date parser added in this pass now protects the same read route used by `/schedule`.

Small cleanup completed:

- `loadTradeCount` now returns the React Query refetch function directly.
- Inline assignment on `/schedule` now gives success feedback to match Assign.
- Shared week-start date math removes duplicated local helpers.

## Files Read

- `AGENTS.md`
- `.agents/skills/gt-api-hardening/SKILL.md`
- `.agents/skills/gt-audit-web/SKILL.md`
- `docs/AREA_SHIFTS.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `tasks/lessons.md`
- `prisma/schema.prisma`
- `src/lib/api.ts`
- `src/lib/rbac.ts`
- `src/lib/permissions.ts`
- `src/lib/http.ts`
- `src/lib/validation.ts`
- `src/lib/services/shift-assignments.ts`
- `src/app/api/calendar-events/route.ts`
- `src/app/api/calendar-events/[id]/visibility/route.ts`
- `src/app/api/shift-groups/route.ts`
- `src/app/api/shift-groups/[id]/shifts/route.ts`
- `src/app/api/shift-groups/[id]/shifts/[shiftId]/route.ts`
- `src/app/api/shift-assignments/route.ts`
- `src/app/api/shift-assignments/[id]/route.ts`
- `src/app/api/shifts/[id]/conflicts/route.ts`
- `src/app/api/users/route.ts`
- `tests/shift-assignments.test.ts`
- `tests/calendar-event-visibility-route.test.ts`
- `tests/api-hardening-wave13.test.ts`
- `tests/schedule-date-validation.test.ts`
