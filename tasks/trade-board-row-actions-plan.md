# Trade Board Row Actions Plan - 2026-05-20

## Goal
- Move Trade Board secondary and destructive row commands onto the shared `OperationalRowActions` trigger without slowing the primary claim/review workflow.

## Peer patterns checked
- Items rows use `OperationalRowActions` for table overflow commands while preserving row-open behavior.
- Settings rows use `OperationalRowActions` for lifecycle and destructive row commands.
- Booking rows now use `OperationalRowActions` for overflow actions while preserving right-click context menus.

## Plan
- [x] Keep the primary Trade Board action visible for claim and staff approval.
- [x] Move cancel and decline commands into `OperationalRowActions`.
- [x] Preserve action guards, busy state, confirmations, and toast behavior.
- [x] Update schedule/design docs and task ledger.
- [x] Verify TypeScript, migration check, whitespace, build, and browser smoke.

## Review
- Shipped: Trade Board row actions now keep Claim and Approve visible while Cancel and Decline render through `OperationalRowActions`.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and protected-route browser smoke on `/schedule`.
- Deferred:
