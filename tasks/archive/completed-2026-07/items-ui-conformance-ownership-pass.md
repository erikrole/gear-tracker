# Items UI Conformance Ownership Pass

Date: 2026-07-16
Route: `/items`

## Goal

Implement the three approved source-backed design corrections without changing Items behavior or widening the route architecture: restore 40px toolbar targets, align creation entry copy on `Add item`, and render desktop table headers in sentence case.

## Scope

- [x] Raise the four item-type toggles and all advanced facet triggers to the 40px operational target baseline.
- [x] Rename the populated-header and empty-inventory creation actions to `Add item` while preserving the existing sheet and permission gates.
- [x] Remove the route-level uppercase transform from desktop Items table headers while preserving density and sorting.
- [x] Add focused source-contract coverage for all three corrections.
- [x] Sync `docs/AREA_ITEMS.md` and `tasks/design-language-route-conformance-checklist.md`.
- [x] Complete focused tests, TypeScript, lint, migration-prefix, docs, build, whitespace, and authenticated browser verification.

## Peer Patterns Checked

- `/users`: creation entry and empty-state recovery both use `Add users`, and the desktop roster explicitly renders sentence-case table labels.
- Shared `BookingListPage`: desktop shadcn table headers render their authored sentence-case labels without a route-wide uppercase transform.
- `/schedule/assign`: compact `ToggleGroupItem` controls use `h-10` without introducing a new primitive.

## Boundaries

- No API, schema, permission, data-flow, or shared primitive changes.
- Preserve item-family and serialized rows in the same discovery surface.
- Preserve mobile cards, table sorting, filter semantics, active-filter chips, and all existing role gates.
- Do not modify native iOS or kiosk surfaces.

## Review

- Focused source-contract coverage passed: 26 tests across the Items UI, search-focus, creation-sheet, and operational-status-rail suites.
- TypeScript, focused ESLint, full lint, migration-prefix verification, docs verification, whitespace validation, and the production app build passed.
- Authenticated browser proof at 1280px and 375px confirmed all four item-type toggles and the Category, Status, and Location facet triggers render at 40px with no horizontal overflow.
- The same browser session could not visually prove `Add item` or the desktop header casing because the data bootstrap failed after the development server's generated `.next` route manifest became inconsistent. A clean production rebuild passed after removing only the disposable `.next` cache; focused source tests cover both unrendered contracts.
