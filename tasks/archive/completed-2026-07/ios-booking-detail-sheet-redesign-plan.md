# iOS Booking Detail Sheet Redesign Plan

## Goal

Redesign native Booking Detail around the question a person opens it to answer: what booking is this, what needs attention now, and what can I do next?

## Completed scope

- Replaced the repeated title, status, countdown, overdue banner, locked notice, and kiosk callout treatment with one identity header and one operational summary.
- Placed eligible Extend and Cancel actions directly after the operational summary.
- Grouped requester, schedule, location, pickup kiosk, and non-empty notes into a quieter Details card.
- Kept equipment readable, separate, and explicitly read-only.
- Preserved role gates, lifecycle actions, live timing, optimistic locking, conflict loading, pull-to-refresh, and kiosk-only custody.
- Added focused source-contract coverage for hierarchy and duplicate-control removal.
- Synced the native mobile area documentation and booking-detail audit.

## Verification

- Focused Booking Detail, student field, and native-control source contracts passed.
- XcodeGen project drift, iOS drift, and iOS audit coverage passed.
- The generic iOS Simulator build succeeded with Xcode system access.
- Visual runtime proof was not captured because no simulator was already booted.

## Boundaries

- No API, model, schema, booking lifecycle, permissions, or kiosk custody changes.
- No new booking actions or web parity work.
- Unrelated dirty-worktree changes were preserved.
