# Student Availability Conflicts Plan

## Goal
Add web support for semester-bounded weekly availability and ad hoc student conflicts so staff/admin can see why an individual assignment call window may need adjustment.

## Source Audit
- Read `AGENTS.md`, `tasks/lessons.md`, `docs/NORTH_STAR.md`, `docs/AREA_SHIFTS.md`, `docs/AREA_EVENTS.md`, `docs/AREA_SETTINGS.md`, `docs/AREA_NOTIFICATIONS.md`, `docs/GAPS_AND_RISKS.md`, `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`, and `prisma/schema.prisma`.
- Existing recurring availability is stored in `StudentAvailabilityBlock` and already drives `/api/shifts/[id]/conflicts`, `/schedule/assign`, auto-fill conflict flags, and trade-swap conflict flags.
- Existing V1 explicitly deferred date-specific unavailable days and semester date ranges, which are now in scope.
- Current call-window precedence already exists in `src/lib/shift-call-windows.ts` and must remain assignment override, then slot override, then default shift window.
- Current gaps: availability blocks cannot express semester bounds, cannot express one-time conflicts, cannot be edited, and conflict overlap logic is duplicated in route/service code.

## Scope
- Web-only.
- Preserve Settings sport default call-time rules and current call-window precedence.
- Add student self-service weekly semester blocks and one-time ad hoc conflicts.
- Staff/admin can view and manage student availability from user profiles and see conflict context in `/schedule/assign` and event detail Crew.
- Availability remains advisory. It must not automatically mutate assignment call windows.
- Students can manage only their own availability. Staff/admin can manage student availability from the user profile surface.

## Implementation Plan
- Extend `StudentAvailabilityBlock` with optional `kind`, `date`, `semesterStartsOn`, and `semesterEndsOn` fields while keeping existing weekly rows valid.
- Add a shared availability-conflict helper for weekly/ad hoc overlap, semester date bounds, local time conversion, and conflict copy.
- Update availability APIs to validate weekly versus ad hoc payloads, support edits, audit create/update/delete, and preserve student self-service authorization.
- Rebuild the web Availability tab into weekly semester and ad hoc sections with add/edit/delete controls.
- Update shift conflict reads and persisted assignment conflict flags to use effective call windows and the shared helper.
- Surface assigned-person conflict copy in event detail Crew next to the assignment and leave the call-window editor as the manual adjustment path.
- Add focused tests for helper precedence, API validation/authorization/audit, conflict endpoint behavior, and assignment conflict persistence.

## Verification Plan
- Focused tests for weekly availability overlap, ad hoc overlap, semester date bounds, student self-service authorization, staff/admin visibility, student denial for editing others, Schedule Assign conflict behavior, event detail conflict display behavior, and unchanged call-window precedence.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke for student availability management, `/schedule/assign`, event detail Crew, and My Shifts/dashboard.

## Shipped
- Added additive schema support for weekly and ad hoc student availability blocks, including semester date bounds, one-time conflict dates, kind, and updated timestamps.
- Added `src/lib/student-availability.ts` as the shared conflict helper for weekly/ad hoc overlap checks, semester bounds, local date handling, and conflict copy.
- Updated student availability APIs so students can create, edit, and delete their own blocks, staff/admin can manage student blocks from profiles, payloads validate weekly versus ad hoc shape, and create/update/delete actions write audit entries.
- Rebuilt the student Availability tab into separate weekly class schedule and one-time conflict sections with add, edit, and delete controls.
- Updated shift conflict reads plus direct assignment, auto-fill, trade-swap, assignment call-window update, and slot call-window update paths to evaluate conflicts against the effective call window without changing call-window precedence.
- Added event detail Crew conflict visibility next to assigned staff while preserving the assignment-level call-window editor as the manual adjustment path.
- Updated `docs/AREA_SHIFTS.md`, `docs/AREA_EVENTS.md`, and `docs/BRIEF_STUDENT_AVAILABILITY_V1.md` to reflect shipped web availability/conflict support.

## Verified
- `npx prisma generate`
- `npx prisma validate`
- `npx vitest run tests/student-availability-conflicts.test.ts tests/student-availability-routes.test.ts tests/shift-call-windows.test.ts tests/shift-call-window-routes.test.ts tests/shift-assignments.test.ts` passed: 54 tests.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke:
  - Student profile Availability tab loaded the route, but the API returned Prisma P2022 because the connected dev DB does not yet have the new availability columns.
  - `/schedule/assign` rendered for an authenticated admin and showed the current no-active-future-events state.
  - `/schedule?includePast=true` rendered schedule data and exposed the Football Media Day event link.
  - The Football Media Day event detail route rendered for an authenticated admin, but it had no crew scheduled, so the conflict badge was not visually observable there.
  - Dashboard/My Shifts surface rendered for an authenticated admin.
- Attempted `npx prisma migrate deploy` and `npx prisma migrate status` against the configured Neon database; both failed with `Schema engine error` before reporting migration state.

## Deferred
- Live browser CRUD against the connected dev database is deferred until migration `0074_student_availability_ad_hoc` can be applied. The current dev DB is missing the new availability columns.
- Availability remains advisory by design. It does not automatically mutate assignment call windows.
- Student calendar import, semester preset management, and notification copy about conflicts are out of this slice.
- iOS availability entry and conflict visibility remain out of scope.

## Benefits
- Students can now record both semester class patterns and one-time conflicts like exams without overloading one weekly-only model.
- Semester bounds reduce false conflicts from old classes after a term ends.
- Staff/admin get conflict context at assignment time and on event detail Crew, then can use the existing assignment-level call-window editor to make the final call.
- Conflict behavior is less drift-prone because route and service code use one shared overlap helper.
- Availability changes now have audit coverage, which makes operator-visible schedule decisions easier to trace.

## Remaining Risks
- The configured dev database must successfully run migration `0074_student_availability_ad_hoc` before the Availability tab can load live data.
- Browser verification did not prove a live create/edit/delete flow because Prisma migration deployment/status failed with `Schema engine error`.
- Event detail conflict badge was code-tested but not visually observed in browser because the smoke event had no scheduled crew.
- Overnight call windows are not a primary supported case for this helper; current event/shift workflows appear date-bound.

## Next Suggested Goal
- Add an assignment review pass that groups conflicted candidates and assigned staff, with quick filters for "has conflict" and a compact staff/admin workflow to adjust individual assignment call windows from the conflict list.
