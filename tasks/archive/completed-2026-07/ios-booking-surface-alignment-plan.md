# iOS Booking Surface Alignment Plan

## Goal

Align native booking presentation with the accepted Item Detail hierarchy so the same booking reads consistently across Item Detail and Bookings without changing booking data, filters, actions, or custody policy.

## Completed scope

- Used the Item Detail custody card as the visual and information-hierarchy reference.
- Kept Bookings-specific navigation, search, scope controls, sections, pagination, and freshness feedback.
- Aligned booking rows around title, live timing, requester, location, and item count.
- Let the existing status rail carry normal checked-out state and removed the redundant `Checked Out` pill from open checkout rows.
- Preserved explicit pills for overdue, reserved, pickup, and exceptional lifecycle states.
- Added focused source-contract coverage for the shared hierarchy and status restraint.
- Synced Mobile and Reservations documentation after runtime verification.

## Verification

- Focused Vitest source-contract coverage passed.
- All 214 native iOS source-contract tests passed across 52 files.
- `npm run drift:ios` passed.
- The main Wisconsin app built, installed, and launched on the iPhone 17 Pro Max Simulator.
- Authenticated production-backed Bookings proof passed at `/private/tmp/gear-tracker-bookings-aligned.png`.
- Focused whitespace verification passed.

## Boundaries

- No booking API payload, lifecycle semantics, filtering, ordering, actions, permissions, or kiosk custody policy changed.
- Unrelated dirty-worktree changes were preserved.
