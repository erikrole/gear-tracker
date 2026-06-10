# Item Detail Firmware Display Plan

Started: 2026-06-10

## Goal
Show latest available firmware information on serialized item detail pages when the item's brand/model matches a baselined firmware watch target.

## Checklist
- [x] Return model-level firmware watch data from `/api/assets/[id]`.
- [x] Add item detail types for firmware watch metadata.
- [x] Render latest firmware version, release date, support mode, and official source link in the Info tab item information card.
- [x] Sync Items docs/tasks and run focused tests, TypeScript, migration check, whitespace, and build.

## Review
- 2026-06-10: `/api/assets/[id]` now matches serialized item brand/model to enabled `FirmwareWatchTarget` rows and returns read-only firmware watch metadata.
- 2026-06-10: The Info tab item information card now renders a firmware panel when a watch target exists, showing latest available version, release date, support mode, last check status, and official source link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; the Info card showed Firmware, Active, latest `7.02`, `Released Mar 17, 2026`, last checked date, and the Sony official-source link with no console warnings/errors.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and approved-network `npm run build`. The first build attempt failed during page-data collection for stale route module paths, then the immediate rerun succeeded.
