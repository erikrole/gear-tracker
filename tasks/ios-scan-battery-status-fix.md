# iOS Scan Battery Status Fix - 2026-06-25

## Scope

Fix `/api/assets` item-family scan payloads so native iOS Scan and global search do not show stale checked-out Sony Battery rows as active custody.

## Plan

- [x] Patch the item-family read model to compute numbered-unit display status from active checkout allocations first, then raw unit status.
- [x] Keep derived unit QR scan payloads backward-compatible for iOS by changing existing status/count values only.
- [x] Add focused `/api/assets` regression coverage for stale `CHECKED_OUT` unit rows with no active allocation.
- [x] Sync Scan/Mobile docs and run verification.

## Review

- 2026-06-25: `/api/assets` now builds one active numbered-unit allocation map for returned item families, then uses effective display status for family counts, exact matched-unit status, and the exact-unit roster. Stale raw `CHECKED_OUT` units with no active allocation display as Available; truly allocated units still display as Checked out with custody context. `findBulkUnitByScanValue` now applies the same lookup-status correction.
- Verification passed: `npx vitest run tests/api-assets-item-families.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `npm run drift:ios`, `npm run audit:ios:gaps`, `npm run codemap`, `npm run verify:docs`, and `npm run build:app`.
- Live Neon read verification was attempted but the sandbox could not reach the Neon pooler, so the fix is verified through the local route contract rather than a live DB sample.
