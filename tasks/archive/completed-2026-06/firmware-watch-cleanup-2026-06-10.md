# Completed Firmware Watch Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Firmware Watch Daily Notifications (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/firmware-watch-plan.md` for daily official-source firmware polling.
- [x] **Durable watcher state** - Add a firmware watch model for official source URL, latest version/date, baseline state, and parse status.
- [x] **Official-source adapters** - Add tested Sony page parsing for latest firmware version and release date.
- [x] **Daily notification job** - Run enabled targets from `morning-refresh`, baseline silently on first successful check, and notify active admins once per new version.
- [x] **Docs and verification** - Sync area docs/decisions and run focused tests plus deploy-shaped checks.

**Review**
- 2026-06-10: Daily firmware watch foundation shipped. Enabled official support targets are polled by `morning-refresh`; first successful checks baseline silently, later version changes create deduped admin `firmware_update_released` inbox rows and best-effort push fanout. Follow-up narrowed active targets to verified Sony support pages from live inventory.
- 2026-06-10: Added migration `0075_add_firmware_watch_targets` and deployed it to Neon. Live health confirmed 76/76 local migrations applied with newest local migration `0075_add_firmware_watch_targets`.
- 2026-06-10: Verification passed: `npx vitest run tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx prisma validate`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, approved-network `npm run db:migrate:deploy`, approved-network `npm run db:migrate:health`, and approved-network `npm run build`. The first sandboxed deploy/health/build attempts failed only on blocked Neon DNS.

## Completed: Firmware Watch Inventory Seed Follow-up (2026-06-10)
- [x] **Open follow-up plan** - Started and archived `tasks/archive/firmware-watch-inventory-seed-plan.md` to make the watcher inventory-driven and Sony-only.
- [x] **Live inventory read** - Identify existing camera body model groups and maintenance-status counts from Neon.
- [x] **Support mode note** - Store active versus maintenance firmware support mode on watch targets.
- [x] **Seed live targets** - Add official Sony support targets for existing camera bodies and baseline them without notifying.
- [x] **Docs and verification** - Sync docs/tasks and rerun focused plus deploy-shaped checks.

**Review**
- 2026-06-10: Dry-run seed found five verified official Sony support targets from the live camera-body inventory: a1, a7 III, a7 IV, a7S III, and FX6. A7 III is marked maintenance firmware; the rest are active firmware support.
- 2026-06-10: Non-Sony bodies and unresolved Sony models are skipped with reasons in `tasks/firmware-watch-inventory-report.md` rather than seeded with guessed URLs.
- 2026-06-10: Applied migration `0076_add_firmware_watch_support_mode` and seeded five baselined live `FirmwareWatchTarget` rows. Live readback confirmed a1 `4.00` (active), a7 III `4.04` (maintenance), a7 IV `6.02` (active), a7S III `5.01` (active), and FX6 `6.00` (active).
- 2026-06-10: Verification passed: `node --check scripts/seed-firmware-watch-targets.mjs`, `npx vitest run tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit`, `git diff --check`, approved-network `npm run db:migrate:deploy`, approved-network `npm run db:migrate:health`, live target readback, and approved-network `npm run build`.
- 2026-06-10: Added the official Sony FX3 and FX3A downloads paths from user-provided Sony URLs. The seed now tracks FX3 `7.02` and FX3A `2.02` as separate active firmware branches, both released 2026-03-17.
