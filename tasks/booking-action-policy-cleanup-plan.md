# Booking Action Policy Cleanup Plan

Date: 2026-06-22

Backlog source: `DESLOPPIFY.md` C2.

## Goal

Remove the stale client-side booking action matrix so app/web booking lists cannot advertise actions the server rejects under D-040.

## Slice

- [x] Audit `DESLOPPIFY.md`, D-040 docs, client booking actions, server booking rules, booking list menus, and focused tests.
- [x] Extract a DB-free shared booking action policy used by both server rules and booking-list UI.
- [x] Remove the stale `checkin` action from app/web allowed actions for OPEN checkouts.
- [x] Keep server-only actions such as `force-complete` and `nudge` available through server rules.
- [x] Update focused client and server tests to assert kiosk-only return behavior.
- [x] Sync DESLOPPIFY, checkout/reservation docs, gaps, codemaps, and task queue.
- [x] Run focused tests plus project verification gates.

## Verification Target

- `npx vitest run tests/checkout-actions-client.test.ts tests/checkout-rules.test.ts`
- `npx tsc --noEmit`
- `npm run verify:docs`
- `npm run db:migrate:check`
- `git diff --check`
- `npm run build:app`

## Review

- 2026-06-22: Booking action policy cleanup shipped locally. App/web booking list actions and server booking rules now use shared DB-free policy helpers, OPEN checkouts no longer expose `checkin` through the client helper, and focused tests assert the D-040 kiosk-only return boundary. Verification passed with focused booking action Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.
