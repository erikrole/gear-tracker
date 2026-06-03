# Call Window Overrides Plan

## Goal
Add web support for editable slot-level and assignment-level call windows so different coverage areas and individual staff exceptions can have distinct call start/end times.

## Source Audit
- Read `AGENTS.md`, `tasks/lessons.md`, `docs/NORTH_STAR.md`, `docs/AREA_EVENTS.md`, `docs/AREA_CHECKOUTS.md`, `docs/AREA_RESERVATIONS.md`, `docs/AREA_NOTIFICATIONS.md`, `docs/AREA_SHIFTS.md`, `docs/GAPS_AND_RISKS.md`, `docs/DECISIONS.md`, `docs/BRIEF_ESCALATION_PHASE_B.md`, `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`, `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`, `docs/archive/BRIEF_SHIFT_REDESIGN_V2.md`, and `prisma/schema.prisma`.
- Existing schema already has `Shift.callStartsAt`, `Shift.callEndsAt`, `ShiftAssignment.callStartsAt`, `ShiftAssignment.callEndsAt`, and `ShiftAssignment.callNote`; no migration should be needed.
- Existing APIs already accept staff/admin slot and assignment call-window updates and write audit rows: `PATCH /api/shifts/[id]` and `PATCH /api/shift-assignments/[id]`.
- Existing notifications already distinguish slot call-time changes from personal call-time changes and use assignment > slot > shift fallback.
- Current gaps are web UX and display consistency: Schedule list, `/schedule/assign`, event detail crew coverage, and dashboard/My Shifts still show raw shift start or a single false shared call label in some places, and fast staff/admin surfaces do not expose clear override editing.

## Scope
- Web-only.
- Staff/admin can edit slot call start/end and individual assignment call start/end.
- Students can view effective call windows but cannot edit them.
- Assignment override takes precedence over slot override, which takes precedence over generated/default shift window.
- No reason/note field in this slice.
- Preserve current calendar/manual event semantics, current shift generation semantics, role boundaries, audit behavior, and notification vocabulary.

## Implementation Plan
- Add a shared call-window helper for effective-window precedence, source labeling, display copy, mixed-window detection, and `datetime-local` conversion.
- Add a shadcn-based call-window editor component that can edit slot or assignment override pairs, clear overrides, guard duplicate saves, and surface specific failures.
- Wire Schedule list expanded rows so staff/admin can edit slot and assignment call windows inline, students see effective windows only, and event parent rows show mixed/slot-specific call copy instead of one false shared time.
- Wire `/schedule/assign` cells so assignment avatars show effective call windows and staff/admin can edit slot or personal call windows without leaving the grid.
- Wire event detail crew coverage so the time column shows call windows, staff/admin can edit them, and student rows remain read-only.
- Update dashboard/My Shifts display to show the user's effective call window.
- Add focused tests for precedence, mixed labels, API role/audit/notification behavior, and display helper behavior.

## Verification Plan
- Focused tests for changed behavior.
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated browser smoke for `/schedule`, `/schedule/assign`, event detail crew coverage, and My Shifts/dashboard student-visible surface.

## Shipped
- Added shared effective call-window helpers with assignment > slot > default precedence, source labels, mixed-window summaries, and `datetime-local` conversion.
- Added a shadcn-based `CallWindowEditor` for staff/admin slot and personal assignment overrides, including clear-to-inherit, duplicate-save guard, auth handling, validation, and failure toasts.
- Wired Schedule list rows to show mixed call windows honestly, expose slot/personal editors in expanded rows, and keep student-facing call windows read-only.
- Wired `/schedule/assign` cells to show inherited or overridden call windows and let staff/admin edit slot or personal call windows inline.
- Wired event detail crew coverage and the schedule side sheet to show and edit effective call windows without changing event/manual/calendar semantics.
- Updated My Shifts/dashboard and Schedule readiness to use the user's effective call window.
- Hardened slot create/update APIs so partial call-window pairs are rejected instead of silently persisting ambiguous state.
- Added focused tests for precedence, formatting, slot override API behavior, assignment override API behavior, staff/admin authorization, student denial, audit rows, and notification dispatch.
- Updated `docs/AREA_SHIFTS.md` and `docs/AREA_EVENTS.md` to reflect the shipped web call-window override surfaces.

## Verified
- `npx vitest run tests/shift-call-windows.test.ts tests/shift-call-window-routes.test.ts`
- `npx vitest run tests/shift-call-windows.test.ts tests/shift-call-window-routes.test.ts tests/shift-assignments.test.ts tests/shift-groups-route.test.ts`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Authenticated in-app browser smoke on `http://127.0.0.1:3010/`: admin session rendered the dashboard/My Shifts surface without auth redirect.
- Authenticated in-app browser smoke on `http://127.0.0.1:3010/schedule`: admin session rendered Schedule, the Football Media Day multi-day event, call/readiness cards, and no auth redirect.
- Authenticated in-app browser smoke on `http://127.0.0.1:3010/schedule/assign`: admin session rendered Assign shifts with no auth redirect.
- Authenticated in-app browser smoke on `http://127.0.0.1:3010/events/cmoxazros000tkv5urn1jvvv0`: route rendered under admin auth and returned the product error state for a stale/missing event id. The real Football Media Day row was visible on Schedule, but the in-app browser wrapper timed out when clicking the row into detail, so detail verification is covered by build/tests plus route smoke rather than a live event-detail click-through.

## Deferred
- No iOS changes.
- No reason/note field for overrides, by request.
- No changes to ICS/calendar source sync semantics.
- No change to trade-board or external calendar export copy in this slice unless those surfaces already consumed the effective helper through touched code.

## Benefits
- Staff/admin can set Video, Photo, or other coverage areas to different call windows for the same event without creating duplicate operational events.
- Staff/admin can set a single person's exception window, such as an exam conflict, without changing the rest of the slot.
- Schedule rows now avoid false shared call labels when people or slots have different effective windows.
- Students see their own effective call window but do not see editing controls.
- Notifications and audits stay aligned with the effective call-window model already present in the APIs.

## Remaining Risks
- Dense `/schedule/assign` cells now expose more controls for staff/admin when a slot has many assignments; this is functional but worth revisiting if the grid starts feeling crowded.
- Event-detail live click-through could not be completed in the in-app browser because the wrapper timed out on the visible Football Media Day row. The route, compile, build, and focused tests passed.
- External-facing shift surfaces not touched in this web-only slice may still describe scheduled shift times rather than effective call windows.

## Next Suggested Goal
- Add student availability/exam-conflict capture that can feed these assignment-level call-window exceptions, so staff/admin can see why a personal override is needed before editing the assignment.
