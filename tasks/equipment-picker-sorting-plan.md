# Equipment Picker Sorting Plan

## Goal
Make the checkout/reservation equipment picker sort like the Items list: asset-tag family first, with operational prefixes such as `FB` grouped under the real item family instead of drifting by raw text, hidden popularity, or checkout count.

## Checklist
- [x] Confirm picker ownership and source contracts in `AREA_CHECKOUTS`, `AREA_ITEMS`, `DECISIONS`, and schema.
- [x] Reuse the shared `compareItemAssetTags` helper instead of inventing another picker-specific comparator.
- [x] Apply the comparator to `/api/assets/picker-search` serialized results.
- [x] Apply the comparator to picker bulk rows.
- [x] Add regression coverage for screenshot-style camera ordering.
- [x] Update docs and close out verification.

## Review
- Reused `compareItemAssetTags` for serialized picker API rows and bulk picker rows.
- Added regression coverage for camera rows that previously looked random when hidden popularity separated prefixed tags from their equipment family.
- No schema, payload, or UI control changes were needed.
