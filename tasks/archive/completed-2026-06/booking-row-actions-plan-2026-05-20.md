# Booking Row Actions Plan - 2026-05-20

## Goal
- Move booking list row overflow actions onto the shared `OperationalRowActions` trigger without changing booking action policy or right-click context menus.

## Peer patterns checked
- Items and Settings rows use `OperationalRowActions` for 40px accessible overflow triggers.
- Booking list rows use shared `BookingOverflowMenu` across desktop table rows, mobile rows, and booking cards.
- Checkout and reservation docs require row click for details and overflow/menu actions for secondary commands.

## Plan
- [x] Replace the custom `BookingOverflowMenu` dropdown wrapper with `OperationalRowActions`.
- [x] Update booking table, mobile row, and card triggers to use the shared trigger surface.
- [x] Preserve context-menu behavior and existing menu items.
- [x] Update checkout/reservation/design docs and task ledger.
- [x] Verify TypeScript, whitespace, build, and browser smoke.

## Review
- Shipped: `BookingOverflowMenu` now renders the shared `OperationalRowActions` trigger, so table rows, mobile rows, and booking cards share the same 40px accessible overflow control.
- Verified: `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke on `/bookings`.
- Deferred: None. Trade Board row action migration is tracked in `tasks/archive/completed-2026-06/trade-board-row-actions-plan-2026-05-20.md`.
