# Audit: /schedule/assign (web)

Date: 2026-05-14
Route: `/schedule/assign`
MVP verdict: READY after fixes
Scope: audit plus follow-up fix verification for the Assign shifts page after the dashboard/schedule UI slice.

## Verdict

No P0s found. The initial audit found two P1s and two P2s. The follow-up fix pass resolved all four: `/schedule/assign` is now server-gated for staff/admin, assignment mutations use a ref-backed duplicate-submit guard, successful mutations provide terse feedback, and schedule date inputs now fail with 400s instead of leaking malformed dates to Prisma.

## P0 Findings

None.

## P1 Findings

### P1-1: Staff-only page is gated only after client hydration — RESOLVED

Fix: `src/app/(app)/schedule/assign/page.tsx` is now a server wrapper that calls `requireAuth()` and redirects non-staff/admin users before mounting the client grid. The interactive UI moved to `src/app/(app)/schedule/assign/_components/AssignPageClient.tsx`.

`/schedule/assign` fetches the current user in the client, redirects non-staff in `useEffect`, and only returns `null` while the role is loading. Once a STUDENT role is known, the component continues into the render path for at least the redirect pass, and the users query is not disabled by role.

Impact: This is not an API auth bypass because assignment mutations still require staff/admin permissions, but it is a staff-only operational surface that can flash or briefly mount for non-staff. It also does unnecessary roster and assignment-grid fetching before redirect. This conflicts with the route's documented staff/admin ownership.

Verification: covered by TypeScript and production build.

### P1-2: Assignment mutations use state-only duplicate-submit guards — RESOLVED

Fix: `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx` now uses `actingRef` as the immediate guard for assign, remove, add-slot, and remove-slot actions while preserving `acting` state for loading UI.

`handleAssign`, `handleRemove`, `handleAddShift`, and `handleDeleteShift` all check `if (acting) return`, then call `setActing(...)`. Because React state updates are async, two rapid clicks in the same render can enter the handler before `acting` updates. The highest-risk case is `handleAddShift`, because the API creates a new shift each time and adding duplicate empty slots is a valid operation from the server's perspective.

Impact: Staff can accidentally create duplicate slots or send overlapping mutation requests. The backend protects active assignment conflicts, but it does not know which duplicate add-slot request was accidental.

Verification: covered by TypeScript and focused schedule checks.

## P2 Findings

### P2-1: Successful assignment mutations are silent — RESOLVED

Fix: assignment, assignment removal, add-slot, and remove-slot success paths now show terse success toasts after refetch.

The page shows error toasts, but successful assign, remove, add-slot, and remove-slot actions only refetch. In a dense grid, that is usually enough when the avatar/open-slot count changes immediately, but slow network or a small viewport can make the action feel silent.

Verification: covered by TypeScript.

### P2-2: Read-route date query validation is still loose — RESOLVED

Fix: `src/lib/api-dates.ts` now centralizes optional date parsing and date-order validation. `GET /api/calendar-events`, `GET /api/shift-groups`, and `POST /api/shift-groups/[id]/shifts` use it.

Both read routes parse `startDate` and `endDate` with `new Date(...)` without rejecting invalid values. The Assign page builds valid ISO dates, so this is not a normal user-path issue, but malformed query params can still flow into Prisma and become 500s.

Verification: `tests/schedule-date-validation.test.ts` covers invalid query dates, inverted query ranges, invalid add-shift overrides, inverted add-shift overrides, and parent-event fallback range validation.

## Acceptance Criteria Status

- Staff/admin can manage assignment slots: PASS.
- Students cannot mutate assignments: PASS at API layer.
- Staff-only page ownership: PASS, server-gated.
- Active/future events only: PASS from source inspection.
- Compact assigned-avatar display: PASS and aligned with current product direction.
- Empty/filter recovery states: PASS.
- API hardening for touched mutations: PASS.

## Files Read

- `AGENTS.md`
- `.agents/skills/gt-audit-web/SKILL.md`
- `.agents/skills/gt-api-hardening/SKILL.md`
- `docs/AREA_SHIFTS.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`
- `prisma/schema.prisma`
- `tasks/schedule-audit.md`
- `tasks/shifts-audit.md`
- `src/app/(app)/schedule/assign/page.tsx`
- `src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx`
- `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx`
- `src/hooks/use-assignment-grid.ts`
- `src/app/api/calendar-events/route.ts`
- `src/app/api/calendar-events/[id]/visibility/route.ts`
- `src/app/api/shift-groups/route.ts`
- `src/app/api/shift-groups/[id]/shifts/route.ts`
- `src/app/api/shift-groups/[id]/shifts/[shiftId]/route.ts`
- `src/app/api/shift-assignments/route.ts`
- `src/app/api/shift-assignments/[id]/route.ts`
- `src/app/api/shifts/[id]/conflicts/route.ts`
- `src/app/api/users/route.ts`
- `src/lib/api.ts`
- `src/lib/rbac.ts`
- `src/lib/permissions.ts`
- `src/lib/services/shift-assignments.ts`
- `src/lib/validation.ts`
- `tests/shift-assignments.test.ts`
- `tests/calendar-event-visibility-route.test.ts`
- `tests/api-hardening-wave13.test.ts`
- `tests/schedule-date-validation.test.ts`

## Notes

The previous `tasks/schedule-audit.md` finding about `limit=200` on shift groups is now resolved in `src/hooks/use-assignment-grid.ts`. The route cap is also now effectively 200 via `parsePagination`, even though the local `Math.min(rawLimit, 500)` remains harmless.

## Follow-up: /schedule Peer Pass

After fixing `/schedule/assign`, the normal `/schedule` page was re-checked against the older `tasks/schedule-audit.md` notes. Current source already had the hide-event toast, `limit=200` shift-group fetch, hide button `aria-label`, role semantics cleanup, and venue-tone standardization. The remaining real cleanup was completed:

- Normal Schedule inline assignment now shows `Assigned shift` on success.
- Week-start math now uses shared `getMonday()` from schedule types instead of duplicating `getThisMonday()`.
- `loadTradeCount` now exposes React Query's `refetchTrades` directly instead of wrapping it in a no-op function.
- The unused schedule-local `formatDate` helper was removed.
- Assign conflict color classes now use tokenized orange variables instead of raw amber/yellow utility classes.
