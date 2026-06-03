# Assignment Conflict Review Plan

## Goal
Add a staff/admin conflict review workflow so availability conflicts are easy to find on `/schedule/assign`, visible on event detail Crew, and resolvable with the existing personal call-window override path.

## Source Audit
- Read `AGENTS.md`, `tasks/lessons.md`, `docs/NORTH_STAR.md`, `docs/AREA_SHIFTS.md`, `docs/AREA_EVENTS.md`, `docs/AREA_SETTINGS.md`, `docs/AREA_NOTIFICATIONS.md`, `docs/GAPS_AND_RISKS.md`, `docs/DECISIONS.md`, `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`, and `prisma/schema.prisma`.
- Existing data model already supports assignment conflict flags (`ShiftAssignment.hasConflict`, `conflictNote`) and personal call-window overrides (`callStartsAt`, `callEndsAt`).
- Existing route behavior already preserves call-window precedence and denies student assignment edits through `PATCH /api/shift-assignments/[id]`.
- `/schedule/assign` currently shows conflict dots/tooltips on assigned avatars and conflict labels in the user picker after `/api/shifts/[id]/conflicts` loads.
- Event detail Crew already shows assigned-person conflict badges and renders `CallWindowEditor` for personal overrides.

## Scope
- Web-only.
- No schema change.
- Preserve Settings/default call-time rules and assignment > slot > default precedence.
- Availability remains advisory; no automatic call-window mutation.
- Improve staff/admin review and triage on `/schedule/assign` and event detail Crew.
- Students remain read-only for final effective call windows.

## Implementation Plan
- Add a shared assignment-conflict summary helper for grid-level assigned/open/clean counts and event filtering.
- Add an assignment review filter on `/schedule/assign` for all assignments, assigned conflicts, open slots, and clean assignments.
- Make assigned conflicts in the grid visible as compact conflict rows with the conflict note and a direct personal call-window editor.
- Add candidate filtering inside `UserAvatarPicker`: All, Conflicts, Clean, using the already-loaded shift conflict map.
- Keep event detail Crew aligned by making conflict rows show the note beside the personal call-window editor.
- Add focused tests for conflict summary/filtering and candidate filtering behavior.

## Verification Plan
- Focused tests for conflict grouping/filtering, candidate conflict filtering, assigned-person display state, and unchanged call-window precedence.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke for `/schedule/assign`, event detail Crew, and My Shifts/dashboard. If the configured dev DB still lacks migration `0074_student_availability_ad_hoc`, document that limitation.

## Shipped
- Added `src/lib/assignment-conflict-review.ts` for assigned/open/clean/conflict summary counts, event review filtering, and candidate conflict filtering.
- Added a staff/admin Review toolbar to `/schedule/assign` with All, Conflicts, Open, and Clean filters plus visible conflict/open/clean counts.
- Updated assignment grid cells so assigned conflicts show visible conflict notes and keep the personal call-window editor directly in the conflicted assignment context.
- Updated `UserAvatarPicker` so loaded candidates can be filtered by All, Conflicts, and Clean after the shift conflict map is available.
- Updated event detail Crew so assigned-person conflict notes appear beside the personal call-window editor in the Call column.
- Added focused tests for review summary/filtering and candidate conflict filtering.
- Updated `docs/AREA_SHIFTS.md`, `docs/AREA_EVENTS.md`, and `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`.

## Verified
- `npx vitest run tests/assignment-conflict-review.test.ts tests/shift-call-windows.test.ts tests/shift-call-window-routes.test.ts tests/student-availability-conflicts.test.ts tests/student-availability-routes.test.ts` passed: 21 tests.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke:
  - `/schedule/assign` rendered for an authenticated admin with the new Review controls and conflict/open/clean labels.
  - `/schedule?includePast=true` rendered staffed schedule history and exposed a staffed Football vs Notre Dame event.
  - `/events/cmmgnauku006ox10lo95bhkif` rendered event detail Crew with filled rows and personal call-window editors.
  - Dashboard rendered for the authenticated admin session.

## Deferred
- Browser smoke did not verify a live conflicted assigned-person badge because the staffed event found in the current dev data had no availability conflict notes.
- Browser smoke did not verify the candidate popover filter interaction because browser-control navigation timed out while moving `/schedule/assign` to a staffed future month.
- Dashboard smoke did not show a My Shifts card in the current admin seed session, so only dashboard route rendering was verified.
- Availability remains advisory by design and still does not automatically mutate call windows.

## Benefits
- Staff/admin can now find conflict-heavy assignment work without opening every cell or relying on tiny avatar dots.
- Conflicted assigned rows show both the reason and the personal override editor in the same context, reducing the chance of changing the wrong slot/default call time.
- Candidate assignment can be narrowed to conflicted or clean people once the existing per-shift availability check loads.
- The implementation reuses the current assignment PATCH route, audit behavior, notification behavior, and call-window precedence.

## Remaining Risks
- The live dev data needs at least one conflicted assigned person to visually prove the new conflict badge path in browser.
- The Schedule data still emits duplicate-key dev console warnings for some dated event rows; this slice did not address that existing schedule-data issue.
- Next dev emitted a known runtime stack while route content still rendered; production build passed.

## Next Suggested Goal
- Add a lightweight conflict-fixture or admin seed utility for browser verification, so future assignment and availability work can prove conflicted Crew and Assign states without mutating production-like schedule data manually.
