# Design Language Shared Component Consolidation Plan

## Objective

Finish Area 6 of the design-language goal by replacing repeated route-local operational UI with the shared components that should become default for future work.

## Peer Patterns Checked

- Items toolbar: `src/app/(app)/items/components/items-toolbar.tsx` uses `OperationalToolbar` and `OperationalActiveFilterChips`.
- Users toolbar: `src/app/(app)/users/UserFilters.tsx` uses `OperationalToolbar` and `OperationalActiveFilterChips`.
- Bookings filters: `src/components/booking-list/BookingFilters.tsx` still used a card-header filter row and route-local filter state presentation.
- Shared chip primitive: `src/components/FilterChip.tsx` was still a 28px target, affecting bookings, schedule, dashboard, and trade-board filter controls.

## Slice

- [x] Move Booking list filters onto `OperationalToolbar`.
- [x] Add shared active-filter chips to Booking list filters.
- [x] Raise shared `FilterChip` to the 40px operational target baseline.
- [x] Raise `OperationalActiveFilterChips` remove controls to the 40px operational target baseline.
- [x] Align Items, Users, and Bookings search-clear controls to the 40px target baseline.
- [x] Sync docs and task trackers.
- [x] Verify `npx tsc --noEmit`.
- [x] Verify `npm run db:migrate:check`.
- [x] Verify `git diff --check`.
- [x] Verify `npx next build`.
- [x] Browser-smoke `/bookings` and `/items` with authenticated Chrome proof.
- [x] Browser-smoke `/users` after the DevTools navigation rejection is cleared.

## Review

- `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed.
- Authenticated Chrome smoke passed for `/bookings`, `/bookings?tab=checkouts&status=PENDING_PICKUP`, `/items?status=AVAILABLE`, and `/users?role=STUDENT`, with no console errors or warnings from the checked pages.
- Screenshot evidence: `tasks/design-language-proof-bookings-area6.png`, `tasks/design-language-proof-bookings-filter-chip-area6.png`, `tasks/design-language-proof-items-filter-chip-area6.png`, and `tasks/design-language-proof-users-filter-chip-area6.png`.
