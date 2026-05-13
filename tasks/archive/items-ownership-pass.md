# Items Ownership Pass

Date: 2026-05-10

## Goal
Polish `/items` as the next page ownership pass without reopening completed item-detail or hygiene work. Keep the list fast and tag-first, and close the sharp edges around mixed serialized and bulk inventory rows.

## Scope
- [x] Keep table, card, toolbar, and pagination controls consistent with the current page patterns.
- [x] Prevent bulk SKU rows from entering serialized-item bulk actions, favorites, print labels, or lifecycle mutations.
- [x] Make persisted Items list preferences hydration-safe.
- [x] Improve toolbar and pagination control hit areas without changing the page information architecture.
- [x] Sync `docs/AREA_ITEMS.md`, archive this task record, and run focused verification.

## Peer Patterns Checked
- `/kits` for URL-backed list filters, summary affordances, filtered empty recovery, and browser-smoked list polish.
- `/users` for page header action grouping and restrained roster-list controls.
- `/schedule` for hydration-safe preferences and larger segmented/filter controls.
- `/items/hygiene` for read-only cleanup queue framing and Items-area doc sync.

## Notes
- Bulk rows are navigation rows for `/bulk-inventory`, not serialized asset records.
- V1 still keeps bulk mutation operations out of scope for the Items list.
- Historical note: `npm run build` used to stop at Prisma `migrate deploy` in this environment. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.

## Review
- Shipped the mixed-row guardrails in the table, context menu, favorite column, page handlers, and bulk-action hook.
- Shipped hydration-safe preference restore for density and column visibility.
- Shipped toolbar and pagination hit-area polish, including bulk-only pagination behavior.
- Verified with TypeScript, migration-prefix validation, focused asset hardening tests, whitespace diff check, production build, and authenticated browser smoke covering all, bulk-only, and serialized-only item views.
