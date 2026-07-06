# Items List Niceties Plan

Started: 2026-06-26

## Scope

- [x] Rename the default sort option from `Name` to `Asset tag`.
- [x] Add durable favorites for item-family rows and include them in the Favorites filter.
- [x] Normalize asset-tag search aliases so compact and hyphenated family tags find each other.
- [x] Keep unavailable row badges consistent with the holder-first status grammar.
- [x] Add valid item-family row actions without exposing serialized-only mutations.
- [x] Add focused tests, sync docs, and run verification.

## Notes

- Item-family favorites need persistence because the Favorites filter is server-side and user-scoped.
- The schema slice is additive: `favorite_item_families` mirrors serialized `favorite_items` with user and `BulkSku` cascades.
- Search normalization should stay conservative and only expand obvious numeric family tokens such as `70200` and `70-200`.

## Review

- 2026-06-26: Items list niceties shipped locally. Item-family favorites now persist through `favorite_item_families`, show in row stars/context menus, and participate in `/api/assets?favorites_only=true`. Items and picker search share compact/hyphenated asset-tag aliases, so `70200` and `70-200` both find the same family. The web sort selector now says `Asset tag`, and item-family row menus expose only valid actions: open, manage inventory, favorite, copy tag, and numbered-unit label export when applicable.
- Verification passed with Prisma format/generate/validate, migration-prefix check, focused Vitest coverage, TypeScript, codemap/docs verification, whitespace check, and `npm run build:app`.
- Live migration deploy/health was not run; migration `0085_item_family_favorites` remains a local pending migration for the next deploy step.
