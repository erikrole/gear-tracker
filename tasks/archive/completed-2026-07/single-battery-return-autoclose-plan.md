# Single Battery Return Auto-Close Plan - 2026-07-23

## Goal
- Close an open checkout in the same transaction that returns its final numbered battery, matching the existing final serialized-item return behavior.

## Route
- Owner area: Checkouts
- Secondary area: Kiosk numbered-unit custody
- Ledger: this plan
- Existing references: `tasks/bulk-battery-followups.md`, `docs/AREA_CHECKOUTS.md`, D-012, D-022, D-028, and D-040

## Source Checks
- Production checkout `CO-0097` contained one Sony Battery. Its numbered-unit allocation and `checkedInQuantity` were returned on 2026-07-22, while the booking remained `OPEN` until the separate kiosk completion path ran on 2026-07-23.
- `src/app/api/kiosk/checkin/[id]/scan/route.ts` auto-completes a final serialized return through `kioskCheckinAsset`, but returns immediately after `scanKioskCheckinBulkUnit` handles a numbered unit.
- `src/lib/services/bulk-unit-scans.ts` atomically returns the numbered unit, increments the booking bulk count, and restores its stock movement, but does not run the shared all-items-returned completion check.
- `src/lib/services/bookings-checkin.ts` already owns the shared completion invariant, scan-session closure, audit entry, badge event, and Live Activity cleanup behavior.

## Stop Conditions
- Stop if production evidence shows another outstanding allocation on the incident checkout.
- Stop if the numbered-unit scan cannot share the existing completion invariant inside the same SERIALIZABLE transaction.
- Stop if the response change would break the tolerant kiosk scan response contract.

## Slices
- [x] Add a failing regression for a battery-only final return scan.
- [x] Run the shared all-items-returned completion check after a successful numbered-unit return inside the existing scan transaction.
- [x] Preserve partial-return behavior and trigger the same badge and Live Activity cleanup as a final serialized scan.
- [x] Sync checkout documentation and closeout evidence.

## Verification
- [x] Focused kiosk check-in and numbered-unit tests.
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused lint for touched TypeScript files.
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs` if shared-source ownership changes codemaps.
- [x] `git diff --check`
- [x] Inspect the final diff and record any unavailable physical-kiosk proof.

## Review
- Shipped: final numbered-unit kiosk returns now run the shared checkout completion invariant before the scan transaction commits. Battery-only checkouts close on the final scan; partial and mixed returns remain open.
- Verified: production incident shape, 45 focused tests, TypeScript, focused ESLint, codemap/docs verification, whitespace, and `npm run build:app`.
- Deferred: none.
- Blocked: physical managed-kiosk scan proof was not available in this local source pass.
- Proof artifacts: production checkout `CO-0097` showed one Sony Battery returned before the booking's later separate completion; focused regressions use the same one-unit shape.
- Next slice or stop: stop. No schema, client, or migration change is required.
