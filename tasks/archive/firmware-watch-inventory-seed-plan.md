# Firmware Watch Inventory Seed Plan

Started: 2026-06-10

## Goal
Remove unused Canon support from the firmware watcher, identify existing live camera bodies, seed official Sony firmware watch targets for those models, and record whether each watched model appears actively updated or in firmware maintenance mode.

## Checklist
- [x] Read live asset inventory and identify serialized camera body model groups, including maintenance-status counts.
- [x] Update firmware watch schema to store support mode and note.
- [x] Remove Canon parser/runtime docs from the current implementation while leaving the already-applied enum value harmless in the database.
- [x] Add a seeding script for existing Sony camera bodies and run it against Neon.
- [x] Run the watcher once to baseline the seeded targets without notifications.
- [x] Sync docs/tasks and run focused tests, Prisma checks, migration health, and build.

## Review
- 2026-06-10: Dry-run seed identified five verified Sony official support targets from the live camera-body inventory: a1, a7 III, a7 IV, a7S III, and FX6. A7 III is marked maintenance firmware; the others are active firmware support.
- 2026-06-10: Canon runtime support was removed. The applied `CANON_SUPPORT` enum remains harmless database history, but no Canon targets are seeded.
- 2026-06-10: Remaining live camera bodies are explicitly skipped until a verified official URL or parser exists: DJI Mavic 3, GoPro Hero 11 Black, Insta360 X4, Insta360 GO 3S, JVC GY-HM250U, Sony a1 II, Sony a7 V, Sony a9 III, and Sony FX3.
- 2026-06-10: Applied migration `0076_add_firmware_watch_support_mode` and seeded five baselined live `FirmwareWatchTarget` rows. Live readback confirmed all five have `baseline_established_at` set.
- 2026-06-10: Verification passed: `node --check scripts/seed-firmware-watch-targets.mjs`, `npx vitest run tests/firmware-watch.test.ts tests/morning-refresh-route.test.ts`, `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit`, `git diff --check`, approved-network `npm run db:migrate:deploy`, approved-network `npm run db:migrate:health`, live target readback, and approved-network `npm run build`.
- 2026-06-10: Added the official Sony FX3 and FX3A downloads paths from user-provided Sony URLs. The seed now tracks FX3 `7.02` and FX3A `2.02` as separate active firmware branches, both released 2026-03-17.
