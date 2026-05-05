# Student Availability V1 Brief

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Area: AREA_SHIFTS / AREA_USERS
- Status: Shipped
- Last Updated: 2026-05-05

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

## Acceptance Criteria

- [x] AC-1: A student can add a recurring weekly unavailability block for themselves.
- [x] AC-2: A student cannot view or modify another student's blocks.
- [x] AC-3: Staff/admin can view and modify a user's blocks from that user's profile.
- [x] AC-4: Blocks validate `startsAt < endsAt` and day-of-week range.
- [x] AC-5: Shift assignment UI surfaces conflicting students without blocking override.
- [x] AC-6: Auto-assignment and trade swaps preserve conflict notes when an assigned worker overlaps an availability block.

## Out Of Scope

- Date-specific unavailable days.
- Semester date ranges.
- Student-facing calendar overlay.
- Email or push notifications for availability conflicts.
- Hard prevention of conflicted assignment.

## Follow-Up Options

1. Add date-specific one-off unavailability only if weekly class blocks prove insufficient.
2. Add `semesterLabel` editing and filtering if staff need to distinguish current versus past blocks.
3. Add a profile-level visual weekly grid if the list of blocks becomes hard to scan.
