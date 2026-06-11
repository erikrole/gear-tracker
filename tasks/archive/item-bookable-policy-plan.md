# Item Bookable Policy Plan

Date: 2026-06-10

## Goal
Simplify item workflow policy controls to one operator-facing Bookable setting.

## Plan
- [x] Confirm current item policy fields and booking enforcement.
- [x] Replace item detail's three workflow toggles with one Bookable switch.
- [x] Replace Standard Add item's three booking-policy toggles with one Bookable switch.
- [x] Sync item docs, task notes, and source tests.
- [x] Run focused verification and archive this plan.

## Notes
- `Bookable` writes checkout and reservation eligibility together.
- `availableForCustody` remains stored for compatibility, but is not useful enough to keep as a visible item setting right now.
- Attachment policy remains separate because parented accessories are not independently bookable.
