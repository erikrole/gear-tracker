# Bookings Ownership Pass - 2026-05-06

## Goal
- Make the Bookings page behave like one owned operational surface across All, Checkouts, and Reservations: active-only All view, clear URL state, consistent page controls, correct row actions, accurate equipment counts, and documented shipped reality.

## Peer patterns checked
- Users: PageHeader owns primary actions and refresh/export controls; filters sit close to a dense table with explicit clear behavior.
- Items: preserves density/view preferences, guards rapid actions, and keeps pagination/count affordances explicit.
- Schedule: top-level view state is real workflow state, not just local visual state.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [ ] Users: consider URL-backed filter state if the active ownership pass wants shareable roster views.
- [ ] Schedule: keep row primary targets separate from row actions when future compact rows gain more inline controls.

## Review
- Shipped: URL-backed booking tabs; All-tab active-only query; All-tab kind-aware action menus; checkout/reservation menu extras shared across the unified page; desktop equipment counts include serialized items plus bulk planned quantities; tabs and view switcher aligned with peer shadcn patterns.
- Verified: `npx tsc --noEmit`; focused `npx vitest run tests/checkout-actions-client.test.ts tests/checkout-rules.test.ts`; `npm run db:migrate:check`; `git diff --check`; `npx next build`; authenticated Chrome DevTools smoke on `/bookings` tab switching with clean console.
- Deferred: Dedicated past toggle and row action browser exercise with live booking rows because the local seeded data set did not include visible bookings.

## Next Pass - 2026-05-07

### Goal
- Finish the active-versus-past split so `/bookings` defaults to active operational work and past terminal records are reachable through one explicit page-level toggle.

### Plan
- [x] Add URL-backed Active/Past scope to the Bookings page.
- [x] Wire `past=true` through combined, checkout, and reservation list APIs.
- [x] Make filter copy and empty states reflect active versus past scope.
- [x] Verify active and past requests in browser/network smoke.
- [x] Sync area docs and review notes.

### Review
- Shipped: URL-backed Active/Past scope beside the view toggle; All defaults to `active=true`; Past sends `past=true`; combined/per-kind APIs filter terminal records consistently; filter headings and empty states now name active or past scope.
- Verified: `npx tsc --noEmit`; focused checkout rule/client tests; `npm run db:migrate:check`; `git diff --check`; `npx next build`; Chrome DevTools smoke for `/bookings?tab=all`, Past toggle, Checkouts active/past, and Reservations active with expected API query strings and no console errors beyond Fast Refresh dev logs.
- Deferred: Fully exercising row context actions still depends on seeded visible bookings in the local test dataset.
