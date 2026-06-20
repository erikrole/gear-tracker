# Kit Detail Design Language Pass

## Goal

Bring `/kits/[id]` member management in line with the operational design language without redesigning the page.

## Source Review

- [x] Read `docs/AREA_KITS.md`
- [x] Read `docs/BRIEF_KIT_MANAGEMENT_V1.md`
- [x] Read `docs/DESIGN_LANGUAGE.md`
- [x] Read `docs/DECISIONS.md`
- [x] Read `docs/GAPS_AND_RISKS.md`
- [x] Cross-reference `prisma/schema.prisma`
- [x] Compare peer detail patterns in item and bulk inventory detail surfaces

## Slice

- [x] Move serialized kit member row actions to `OperationalRowActions`.
- [x] Move bulk kit member row actions to `OperationalRowActions`.
- [x] Add confirmation and real error handling for bulk member removal.
- [x] Keep copy object-specific and operational.
- [x] Harden the bulk-member delete route so the membership must belong to the current kit.
- [x] Sync area/design-language tracking docs.
- [x] Run static, build, and authenticated browser verification.

## Review

Implemented 2026-05-21. The signed-in kit detail smoke verified the route renders, serialized member rows expose named `OperationalRowActions` triggers, the destructive menu item is keyboard reachable, and current seeded kits have no bulk members to smoke without mutating data. Verification passed: `npx tsc --noEmit`, focused pending-pickup expiry test, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/kits` plus `/kits/cmn5857mr0001l104x2fhm3eu` with no console messages.
