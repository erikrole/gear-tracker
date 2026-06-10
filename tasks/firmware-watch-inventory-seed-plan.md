# Firmware Watch Inventory Seed Plan

Started: 2026-06-10

## Goal
Remove unused Canon support from the firmware watcher, identify existing live camera bodies, seed official Sony firmware watch targets for those models, and record whether each watched model appears actively updated or in firmware maintenance mode.

## Checklist
- [ ] Read live asset inventory and identify serialized camera body model groups, including maintenance-status counts.
- [ ] Update firmware watch schema to store support mode and note.
- [ ] Remove Canon parser/runtime docs from the current implementation while leaving the already-applied enum value harmless in the database.
- [ ] Add a seeding script for existing Sony camera bodies and run it against Neon.
- [ ] Run the watcher once to baseline the seeded targets without notifications.
- [ ] Sync docs/tasks and run focused tests, Prisma checks, migration health, and build.

## Review
- Pending implementation.
