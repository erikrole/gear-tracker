# Kiosk Pickup Live Smoke Follow-up

Date opened: 2026-06-18
Source: carried forward from the 2026-06-12 kiosk pickup scan 500 task.

## Goal

Prove one real kiosk pickup scan succeeds against live data after the `scan_events.phase` enum migration, without leaving production-like test data behind.

## Current Proof

- [x] Live migration health is clean: 83/83 local migrations applied, no pending local migrations, no unresolved failed rows, no DB-only applied migrations.
- [x] Live column proof: `information_schema.columns` reports `scan_events.phase` as `data_type = USER-DEFINED`, `udt_name = ScanPhase`.
- [x] Live typed-comparison proof: `SELECT COUNT(*) FROM scan_events WHERE phase = 'CHECKOUT'::"ScanPhase"` succeeds and returned 4 rows.
- [x] Focused pickup route regression: `npm test -- tests/kiosk-bulk-detail-routes.test.ts` passed 11 tests.

## Remaining Work

- [x] Get explicit approval to create a disposable live pickup fixture, or wait for a natural pending pickup/due reservation with serialized gear.
- [x] Run one authenticated kiosk pickup scan against that fixture.
- [x] Confirm a successful `scan_events` row is written with `phase = CHECKOUT`.
- [x] Clean up any disposable fixture and record the cleanup evidence.
- [x] Archive this follow-up and update `tasks/todo.md`.

## Guardrails

- Do not create, scan, or clean up live booking data without explicit approval.
- Prefer a natural pending pickup if one exists.
- If a disposable fixture is approved, keep it isolated, named clearly, and clean it up in the same pass.

## Review

- 2026-06-18: Explicit approval was granted to create and delete disposable production smoke records, including related audit rows.
- 2026-06-18: A production HTTP attempt against `https://gear.erikrole.com` was blocked before the route accepted the disposable kiosk session because local `SESSION_SECRET` cannot mint a production kiosk cookie. The disposable user, kiosk device, and reservation created for that attempt were cleaned up successfully.
- 2026-06-18: Final smoke used the live database through local kiosk HTTP routes on `http://127.0.0.1:3027`, with a disposable kiosk session matching the local runtime secret. The route stack returned 200 for `GET /api/kiosk/checkout/[id]`, `POST /api/kiosk/pickup/[id]/scan`, and `POST /api/kiosk/pickup/[id]/confirm`.
- 2026-06-18: Evidence tag `codex-live-pickup-smoke-2026-06-19T02-22-47-637Z`; location `Camp Randall`; serialized asset `1.4x Teleconverter` (`Sony FE 1.4x Teleconverter`); source reservation `cmqkb0dwf0005kvp65stk1ove`; derived checkout `cmqkb0kem0008kvdlx6k7zuwe`.
- 2026-06-18: Scan event `cmqkb0ic80001kvdlqt57up29` was written with `phase = CHECKOUT`, `scanType = SERIALIZED`, and scan value `C0F8CA39`. Confirmation marked the source reservation `COMPLETED` and created an `OPEN` checkout with `sourceReservationId = cmqkb0dwf0005kvp65stk1ove`.
- 2026-06-18: Cleanup completed with zero leftover disposable bookings, kiosk devices, users, or scan events.
