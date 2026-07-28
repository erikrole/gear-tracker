# Add Item Workflow and Image Chooser Plan - 2026-07-28

## Goal
- Keep Add Item as one comprehensive web sheet while making tracking selection, image choice, repeated intake, and post-create recovery consistent across serialized items and item families.

## Route
- Owner area: Items
- Secondary area: Bulk Inventory
- Ledger: `tasks/add-item-workflow-plan.md`
- Existing reference: `tasks/archive/add-item-flow-quick-fixes-plan.md`

## Source Checks
- `src/app/(app)/items/new-item-sheet.tsx` owns all three tracking modes and the post-create handoff.
- `src/components/ChooseImageModal.tsx` already owns persisted item and item-family search, URL, upload, and removal.
- Asset and bulk-SKU image routes already provide permission-checked, audited Blob persistence.
- The current serialized pre-create photo path posts multipart field `image`, while the image route requires `file`.

## Stop Conditions
- Stop if either create response does not return a durable catalog ID.
- Stop if create permission does not allow the corresponding image mutation for the same operator.
- Stop if the shared modal cannot preserve its current item-detail and item-family-detail callers.

## Slices
- [x] Slice 1: Add draft image selection to the shared modal without changing persisted callers.
- [x] Slice 2: Unify Add Item image staging and post-create persistence across new Standard, Units, and Quantity records.
- [x] Slice 3: Normalize the full-sheet hierarchy and repeated-intake success/reset behavior.
- [x] Slice 4: Add focused regression coverage and sync Items, Bulk Inventory, and design-language docs.

## Verification
- [x] Focused Add Item, image modal, image-search, and pending-action Vitest coverage.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] Authenticated browser smoke on `/items` at desktop and narrow widths, or record the exact blocker.

## Review
- Shipped: Add Item now stages Search, Paste URL, or Upload images before create for new Standard, Units, and Quantity records; saves through the correct audited endpoint after ID return; isolates image retry from record creation; removes duplicated tracking guidance and the pre-submit Add another checkbox; and fully resets repeated intake to Standard.
- Verified: 23 focused Vitest assertions, focused and full lint, TypeScript, migration-prefix check, regenerated/current codemaps, whitespace check, and `npm run build:app`.
- Deferred: No native iOS work, schema change, new route, or image change for Quantity add-to-existing.
- Blocked: Authenticated browser proof. The only available in-app browser blocks localhost; its LAN request reached `/items` and received the expected `307` to `/login`, but no authenticated browser was available. A concurrent build/dev `.next` collision then made `/login` return 500, so no visual or narrow-width claims are recorded.
- Proof artifacts: Focused test output (5 files, 23 tests) and successful 210-page app build in this session.
- Next slice or stop: Stop implementation. Re-run authenticated desktop/narrow Add Item smoke when a local authenticated browser session is available.
