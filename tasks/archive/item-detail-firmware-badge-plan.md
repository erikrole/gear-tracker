# Item Detail Firmware Badge Plan

Started: 2026-06-10

## Goal
Replace the larger firmware watch panel with a compact firmware badge that shows the installed firmware number, colors it by update state, and opens an edit/update dialog with the Sony source link.

## Checklist
- [x] Store per-asset installed firmware in existing item metadata as `installedFirmwareVersion`.
- [x] Render the firmware badge in the Info card: green when installed matches latest, orange/yellow when installed is behind, gray when unset or unknown.
- [x] Add a click dialog to edit installed firmware, mark the item updated to the latest watched version, and open the official Sony update page.
- [x] Sync Items docs/tasks and run focused tests, TypeScript, migration check, whitespace, browser smoke, and build.

## Review
- 2026-06-10: Item detail firmware now renders as a compact badge backed by `metadata.installedFirmwareVersion`. The badge is green when installed matches latest, orange/yellow when installed differs from latest, and gray when no installed version is recorded or latest is unknown.
- 2026-06-10: Clicking the firmware badge opens an edit dialog with installed/latest/release/check context, a saveable installed-version input, a Mark updated to latest action, and the official Sony update page link.
- 2026-06-10: Authenticated in-app browser smoke passed on real FX3 item `cmmvmbdhe001hjx04hb39a7mk`; unset state showed `Set firmware`, latest `7.02`, released `Mar 17, 2026`, and the dialog exposed the installed-version input, Mark updated to latest, and Sony update-page link with no console warnings/errors. The smoke did not mutate the live item firmware value.
- 2026-06-10: Verification passed: `npx vitest run tests/item-detail-firmware-display.test.ts tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, authenticated browser smoke, and approved-network `npm run build`.
