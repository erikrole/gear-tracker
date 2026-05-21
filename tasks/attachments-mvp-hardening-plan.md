# Attachments MVP Hardening Plan - 2026-05-21

## Goal
- Make item attachments feel like an MVP-ready workflow for camera-tied SD cards, cages, and fixed parts without adding schema or treating attachments as file uploads.

## Source Checks
- `docs/AREA_ITEMS.md`: attachments are hidden by default, grouped on item detail, and exposed through direct scan/search or the Attachments-only filter.
- `docs/DECISIONS.md`: D-023 keeps one-level `Asset.parentAssetId`, no nesting, no independent booking line items, and staff/admin mutation gates.
- `prisma/schema.prisma`: `Asset.parentAssetId` plus `parent`/`accessories` relations already exist; no migration needed.
- `src/app/(app)/items/[id]/ItemSettingsTab.tsx`: current attach UI is inline search, detach is immediate after confirm, and move is not exposed.
- `src/app/api/assets/[id]/accessories/route.ts`: attach, detach, and move endpoints already exist.

## Slices
- [x] Slice 1: Add testable attachment UI helpers for search candidate states, status warnings, and display text.
- [x] Slice 2: Enrich item search payloads with existing status/location/category/parent/image fields needed by attachment candidate rows.
- [x] Slice 3: Replace the inline attachment search with a structured shadcn dialog, add pending states, better detach copy, and expose move for child items.
- [x] Slice 4: Improve attachment list discoverability on `/items` through clearer filter chip text and informative parent count hover text.
- [x] Slice 5: Sync Items docs, retire the open todo item, and verify.

## Verification
- [x] `npx vitest run tests/asset-attachments.test.ts`
- [x] `npx vitest run tests/asset-attachments.test.ts tests/asset-action-hardening.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Browser smoke attempted; blocked before authenticated routes by local login `Prisma P1000` database credential failure.

## Review
- Shipped: structured attachment add/move dialog, candidate explanations, busy-item warnings, child move-parent action, safer detach pending state, image/status/slot context in attachment rows, clearer hidden-attachment filter copy, and parent count hover text.
- Verified: focused helper/route tests, TypeScript, migration-prefix check, whitespace check, and production Next build pass.
- Browser proof: dev server rendered `/login`, but the seeded admin login failed at `/api/auth/login` because Prisma could not authenticate to the configured database, so authenticated `/items`, item detail, child detail, and `/scan` smoke could not be completed in this environment.
- Deferred: no schema change; `attachmentSlot` remains deferred until slot filters, required slot checks, or slot-level maintenance workflows justify it.
