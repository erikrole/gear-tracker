# Student Availability V1 Brief

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Area: AREA_SHIFTS / AREA_USERS
- Status: Shipped
- Last Updated: 2026-06-18

## Problem

Staff need to know when students are predictably unavailable before assigning shifts. The most common case is recurring class blocks during a semester, not one-off PTO-style exceptions.

## V1 Scope

Students and staff can maintain weekly recurring unavailability blocks on the user profile Availability tab. A block records day of week, local start time, local end time, and an optional label such as a class name.

This is intentionally an availability-warning system. It does not prevent staff/admin overrides, because operations may still need to assign a conflicted student after direct confirmation.

## Shipped Behavior

- `StudentAvailabilityBlock` stores recurring weekly blocks tied to a user.
- `/users/[id]` includes an Availability tab.
- Students can manage only their own blocks.
- Staff and admins can view and manage blocks for any user.
- `GET /api/users/[id]/availability` returns the user's blocks.
- `POST /api/users/[id]/availability` creates a block after validating weekday and start/end time order.
- `DELETE /api/users/[id]/availability/[blockId]` removes a block after ownership validation.
- Assignment pickers call `GET /api/shifts/[id]/conflicts` and show conflict indicators for overlapping blocks.
- Auto-assign and trade-swap flows carry conflict flags/notes forward instead of silently ignoring class conflicts.

## Shipped Follow-Up (2026-06-03)

- Weekly class blocks can now be bounded by semester start/end dates.
- Students can add one-time ad hoc conflicts, such as exams.
- Students can edit and delete their own blocks on the web Availability tab.
- Staff/admin can view and manage student blocks from student profiles.
- Shift conflict checks, direct assignment, auto-fill, and trade swaps use the effective call window plus one shared weekly/ad hoc overlap helper.
- Availability remains advisory and does not automatically change slot or personal call windows.
- Staff/admin assignment review now filters `/schedule/assign` by conflict/open/clean states, surfaces assigned-person conflict notes in the grid, filters loaded candidates by conflict state, and keeps personal call-window adjustment beside the conflict context.

## Shipped Follow-Up (2026-06-18)

- `StudentAvailabilityBlock` now supports an `intent`: cannot work, prefer, dislike, or time off.
- Existing weekly and ad hoc rows remain compatible and default to approved cannot-work advisory conflicts.
- Time-off rows support pending, approved, and denied status with staff/admin review metadata.
- Student-created time-off requests default to pending; staff/admin-created or reviewed time off can be approved or denied.
- Candidate scoring now rewards preferred windows, warns on dislikes and pending time off, and marks approved time off as blocking.
- Direct assignment, pickup, trade swap, request approval, and personal call-window updates now reject approved time off while preserving advisory behavior for other availability signals.
- Staff approval or denial of a time-off request creates an in-app notification for the student.

## Acceptance Criteria

- [x] AC-1: A student can add a recurring weekly unavailability block for themselves.
- [x] AC-2: A student cannot view or modify another student's blocks.
- [x] AC-3: Staff/admin can view and modify a user's blocks from that user's profile.
- [x] AC-4: Blocks validate `startsAt < endsAt` and day-of-week range.
- [x] AC-5: Shift assignment UI surfaces conflicting students without blocking override.
- [x] AC-6: Auto-assignment and trade swaps preserve conflict notes when an assigned worker overlaps an availability block.
- [x] AC-7: Students can request time off and staff/admin can approve or deny the request.
- [x] AC-8: Prefer/dislike/time-off signals feed candidate scoring and scheduling conflict checks without breaking existing weekly/ad hoc blocks.

## Out Of Scope

- Student-facing calendar overlay.
- Email or push notifications for availability conflicts.
- Automatic conflict notifications to students.
- Staff conflict digest outside Schedule health queues.
- Hard prevention of ordinary conflicted assignment.

## Follow-Up Options

1. Add a profile-level visual weekly grid if the list of blocks becomes hard to scan.
2. Add student-facing calendar overlay only if students need a read-only schedule preview.
3. Add cross-event conflict digesting only if staff need a separate summary outside the assignment workflow.
4. Add push/email delivery for time-off review outcomes only after the notification policy needs that extra channel.
