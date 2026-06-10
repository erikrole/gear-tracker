# Add Item Flow Quick Fixes Plan

Started: 2026-06-10

## Scope
- Show nearby serialized asset tags during Standard item intake so repeated tags like `FX3 2` make the current count and next likely tag visible before save.
- Treat Standard item purchase price as USD in the form and payload parsing.
- Save Add item fiscal year to the same `metadata.fiscalYearPurchased` key used by item detail.
- Add an inline photo upload field to Standard item creation and upload the selected image after the asset is created.

## Non-goals
- No schema change.
- No changes to bulk item-family creation.
- No automatic product metadata enrichment.

## Checklist
- [x] Add repeat-tag summary helper and wire it to the Standard asset tag field.
- [x] Align fiscal-year options and payload metadata with item detail.
- [x] Make purchase price visibly USD and parse common USD input safely.
- [x] Add Standard photo upload selection and post-create upload handling.
- [x] Add focused tests for payload and helper behavior.
- [x] Sync Items docs and archive this plan after verification.

## Verification
- [x] `npx vitest run tests/manual-intake-submit.test.ts tests/add-item-repeat-tags.test.ts tests/new-item-sheet-ui-source.test.ts`
- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npm run build`

## Review
- Standard Add item now shows repeat-family context after asset-tag blur. In the local authenticated smoke, `FX3 3` showed `2 existing FX3 items. Next tag should be FX3 3.`
- Purchase price is labeled as USD and parses values such as `1299.99`, `$1,299.99`, and `0` before submit.
- Fiscal year now submits as `metadata.fiscalYearPurchased`, matching item detail.
- Standard Add item now exposes a photo upload field and uploads the selected file through `/api/assets/{id}/image` after asset creation.
- Authenticated browser smoke on `http://localhost:3016/items` opened Add item and confirmed the repeat hint, USD field, and photo upload field with no console errors or warnings beyond normal Fast Refresh logs.
