# Item Asset Tag Family Grouping Plan

## Goal
Keep related item families together in Items and equipment picker sorting. Rows such as `70-200 1`, `70-200 2`, `70-200 3`, `70200 4`, `FB 70-200 1`, and `FB 70-200 2` should read as one family group instead of alternating by unit number across operational prefixes.

## Checklist
- [x] Confirm Items and picker sorting share `compareItemAssetTags`.
- [x] Add a family bucket to the comparator.
- [x] Normalize compact lens-range tags like `70200` to the same family as `70-200`.
- [x] Update regression tests for grouped rows.
- [x] Sync area docs and verify.

## Review
- Shared comparator now sorts by equipment family, operational-prefix bucket, unit number, prefix, then full normalized tag.
- Compact numeric lens ranges normalize for sorting, so `70200 4` groups with `70-200 4`.
- Focused coverage updated for the comparator, `/api/assets`, and picker-search behavior.
