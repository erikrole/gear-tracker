# Categories Visibility Plan

## Scope
Audit and patch how inventory categories show up in Settings, Items filters, and item category pickers.

## Findings
- Category records are hierarchical and have no `active` flag, so cleanup today is hard delete only.
- Hard delete is intentionally blocked when serialized assets, item families, or subcategories still reference the category.
- Items filtering and category comboboxes only surfaced root leaves plus direct children, which hid parent categories with direct items and hid grandchildren entirely.
- The Fill gaps wizard could repair missing categories, but its category suggestions were shallow token matches and did not learn from already-categorized inventory.

## Slice
- [x] Add a shared full-path category option helper.
- [x] Use it in `/items` category filters.
- [x] Use it in shared category comboboxes for create/edit flows.
- [x] Add server-side missing-category suggestions from existing categorized inventory.
- [x] Add gear-term fallback suggestions in the Fill gaps wizard.
- [x] Add focused regression coverage.
- [x] Sync docs and record verification.

## Deferred
- Category archive/deactivate is the right future upgrade for cleanup without breaking historical references, but it needs a schema and migration slice.

## Review
- 2026-06-19: Added `buildCategoryPathOptions` and wired it into Items filters plus the shared category combobox used by create/detail flows. `/api/assets?missing=category` now returns optional `suggestedCategoryId` values based on existing categorized standard items, item families, and legacy bulk category strings. The wizard ranks those server suggestions above client-side gear-term fallback matches.
- Verification: `npx vitest run tests/category-options.test.ts tests/category-cleanup-wizard.test.ts tests/items-response-parsing.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npm run build:app`, and `npm run verify:docs` passed. Browser smoke was attempted with Chrome DevTools against local `/items`, but DevTools snapshot verification was blocked by the Codex usage limit.
