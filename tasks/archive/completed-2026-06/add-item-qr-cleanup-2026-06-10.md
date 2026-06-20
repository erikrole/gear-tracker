# Completed Add Item and QR Cleanup - 2026-06-10

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Add Item Flow Quick Fixes (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/add-item-flow-quick-fixes-plan.md` for Standard add-item flow fixes.
- [x] **Repeat tag count** - Show matching serialized item count and next likely tag for repeated tags such as `FX3 2`.
- [x] **Procurement fixes** - Treat purchase price as USD and save fiscal year to detail-compatible metadata.
- [x] **Inline photo upload** - Add a Standard item photo upload field and upload the selected photo after asset creation.
- [x] **Docs and verification** - Sync Items docs, archive the plan, and run focused tests plus build checks.

**Review**
- 2026-06-10: Standard Add item now checks repeat-family tags on blur and shows current count plus next likely tag. Local browser smoke verified `FX3 3` showed `2 existing FX3 items. Next tag should be FX3 3.`
- 2026-06-10 follow-up: Repeat-family suggestions now update while typing and prefix-match existing tag families, so typing `F`, `FX`, `FX3`, or `70-200` can suggest the next tag without entering a number first.
- 2026-06-10: Purchase price now reads as USD, accepts common USD formatting, and asset create accepts nonnegative values to match item detail. Fiscal year now writes `metadata.fiscalYearPurchased`, the key read by item detail.
- 2026-06-10: Standard Add item now includes an inline photo upload field. Selected files are validated client-side and uploaded through the existing asset image endpoint after the asset create returns an id.
- 2026-06-10: Verification passed: focused Add item tests, TypeScript, migration-prefix check, whitespace check, approved-network production build, and authenticated Chrome DevTools smoke on `/items`. The first sandboxed build failed only on blocked Neon DNS.

## Completed: QR Code Generation Simplification (2026-06-10)
- [x] **Open slice plan** - Started and archived `tasks/archive/qr-code-generation-plan.md` for shorter generated item tracking codes.
- [x] **Generation format** - New generated asset QR codes now use 8 uppercase hex characters without the `QR-` prefix.
- [x] **Compatibility** - Existing stored `QR-...` codes remain valid because scan lookup still accepts prefixed fallbacks.
- [x] **Docs and verification** - Sync Items docs and run focused format, type, migration, whitespace, and build checks.

**Review**
- 2026-06-10: Existing item QR generation, duplicated asset generation, and the Add item sheet generator now share one prefixless asset QR helper. No migration rewrites existing labels.
- 2026-06-10: Verification passed with `npx vitest run tests/asset-qr-code-format.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and approved-network `npm run build`. The first sandboxed build failed only on blocked Neon DNS.
