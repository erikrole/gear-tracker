# React Query Cache Follow-Up Plan

Date: 2026-05-05
Status: Slices 1-3 shipped

## Context

GAP-11 was stale. React Query is already the shared cache layer:
- `src/hooks/use-fetch.ts` wraps `useQuery` with auth redirect handling, classified errors, focus refetch, and last-refreshed timestamps.
- `src/lib/query-client.ts` defines the shared `QueryClient` and persists selected dashboard and booking queries.
- Several higher-value surfaces already use direct `useQuery` hooks for dashboard, bookings, schedule, items, and wizard data.
- `docs/NORTH_STAR.md` already records React Query adoption as shipped.

The next optimization should not be a broad migration. It should be a cache-behavior audit and small consistency pass.

## Slice 1: Cache-Key Audit

- [x] Inventory query keys across `src/hooks`, `src/components`, and `src/app/(app)`.
- [x] Flag duplicate keys with different response shapes, especially generic `["fetch", url]` versus named keys like `["me"]`, `["form-options"]`, `["booking", id]`.
- [x] Propose a small `queryKeys` helper only if the duplication is meaningful enough to justify it.
- [x] Verify no page runs both `useFetch` focus refresh and direct `useQuery` focus refresh for the same data.

Result: no broad `queryKeys` helper yet. The meaningful duplication was repeated `["me"]` and `["form-options"]` query functions, so Slice 1 centralized those through `useCurrentUser` and new `useFormOptions`.

## Slice 2: Persistence Scope

- [x] Review persisted queries in `src/lib/query-client.ts`.
- [x] Confirm dashboard and booking detail are still the right persisted surfaces.
- [x] Check for sensitive or high-churn data that should not be persisted.
- [x] Add comments or tests if the persistence allowlist is easy to regress.

Result: persistence remains limited to `dashboard` and `booking` cache roots. Added `shouldPersistQueryKey` and a focused unit test so broad list/settings/current-user/form-options queries do not become persisted by accident.

## Slice 3: Error-State Consistency

- [x] Audit React Query direct callers for required error states.
- [x] Prioritize shared data required by forms, especially `me`, `form-options`, and picker/search data.
- [x] Patch only pages that silently degrade required form inputs to empty arrays.

Result: `BookingWizard` already surfaced `form-options` failures. `BookingListPage` was the remaining shared-data consumer that silently rendered empty requester/location filter options, so it now shows a destructive alert with retry when form options fail to load.

## Verification

- [x] `npm run db:migrate:check`
- [x] `npm run test -- --runInBand` or targeted Vitest files if full suite remains red from pre-existing failures
- [x] `npx next build` as the build-safe check if `npm run build` still blocks on Prisma/Neon schema engine

## Review

- GAP-11 is closed as a migration gap.
- Remaining work is cache correctness and consistency, not a system-wide rewrite.
- Slice 1 removed repeated direct `/api/me` and `/api/form-options` named-key query functions from the app shell, settings layout, schedule assignment page, booking list, booking wizard, booking detail page, and booking details sheet.
- Slice 2 locked persistence to dashboard and booking detail roots and covered it with `tests/query-client.test.ts`.
- Slice 3 added a visible retry state for booking list filter metadata failures instead of silently rendering incomplete requester/location filters.
