# Completed Item Detail Firmware Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Item Detail Firmware Badge (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-firmware-badge-plan.md` to make item firmware status a compact editable badge.
- [x] **Installed firmware metadata** - Store the per-asset installed firmware version in item metadata without adding schema.
- [x] **Badge and dialog** - Show green updated / orange outdated / gray unset firmware badge with an edit dialog and Sony source link.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Item detail firmware now renders as a compact badge backed by `metadata.installedFirmwareVersion`. The badge is green when installed matches latest, orange/yellow when installed differs from latest, and gray when no installed version is recorded or latest is unknown.
- 2026-06-10: Clicking the firmware badge opens an edit dialog with installed/latest/release/check context, a saveable installed-version input, a Mark updated to latest action, and the official Sony update page link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; unset state showed `Set firmware`, latest `7.02`, released `Mar 17, 2026`, and the dialog exposed the installed-version input, Mark updated to latest, and Sony update-page link with no console warnings/errors. The smoke did not mutate the live item firmware value.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, authenticated browser smoke, and approved-network `npm run build`.

## Completed: Item Detail Firmware Display (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/item-detail-firmware-display-plan.md` to surface model-level firmware watch data on item detail.
- [x] **Detail API data** - Return matching firmware watch target metadata from `/api/assets/[id]`.
- [x] **Info tab display** - Show latest available firmware, release date, support mode, and source link in the item information card.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: `/api/assets/[id]` now matches serialized item brand/model to enabled `FirmwareWatchTarget` rows and returns read-only firmware watch metadata.
- 2026-06-10: The Info tab item information card now renders a firmware panel when a watch target exists, showing latest available version, release date, support mode, last check status, and official source link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; the Info card showed Firmware, Active, latest `7.02`, `Released Mar 17, 2026`, last checked date, and the Sony official-source link with no console warnings/errors. Release/check dates render with a UTC formatter so vendor date-only releases do not shift by local timezone.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and approved-network `npm run build`. The first build attempt failed during page-data collection for stale route module paths, then the immediate rerun succeeded.
