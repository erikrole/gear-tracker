# Dashboard Ownership Pass - 2026-07-16

## Goal

- Modernize the dashboard booking row, header commands, and operational disclosure without changing booking behavior.

## Peer patterns checked

- `users`: uses descriptive operational-rail disclosure copy and a direct secondary/primary header action rhythm.
- `items`: keeps header commands on shared button primitives and uses the operational status rail for compact orientation.

## Plan

- [x] Replace overlapping row thumbnails and floating timing badges with quieter operational metadata.
- [x] Align sync health, refresh, filters, and reservation creation as one header command group.
- [x] Rename the generic Details disclosure to Booking breakdown.
- [x] Run focused tests, TypeScript, lint, build, and authenticated browser proof.

## Contract boundaries

- Preserve booking links, urgency semantics, permissions, filters, detail-sheet selection, and reservation-first creation.

## Review

- **Shipped:** Dashboard booking rows keep requester and item count together, remove the redundant overlapping gear stack, and present due or pickup urgency as compact clock-led metadata. Header sync, refresh, filter, and creation controls now share one command rhythm. The rail disclosure is named Booking breakdown.
- **Verified:** 11 focused dashboard/shared-rail tests, focused ESLint, TypeScript, all 96 migration prefixes, whitespace, and an isolated clean `npm run build:app` passed. Authenticated browser proof covered the live dashboard row, labeled Refresh control, Booking breakdown open/close state, and zero console warnings or errors.
- **Environment note:** The first build attempt shared `.next` with the already-running port 3001 dev server and failed during generated-route collection. The same source completed a clean isolated build after separating the output from that server.
- **Deferred:** None for this visual slice. Booking behavior and data contracts were intentionally unchanged.

## Visual follow-up - 2026-07-16

### Plan

- [x] Give booking identity more weight without restoring redundant gear thumbnails.
- [x] Improve Upcoming events hierarchy and use horizontal header space when available.
- [x] Normalize every dashboard header command to a 40px control height.
- [x] Re-run focused checks, build, and authenticated browser proof.

### Review

- **Shipped:** The booking identity block now leads with a medium borrower avatar, stronger title, and dot-separated metadata. Upcoming events uses the available header width for its venue filter and gives event rows a calendar anchor with clearer time and location grouping. Live sync, Refresh, the optional dashboard filter, and New reservation all use a 40px height.
- **Verified:** Nine focused dashboard tests, focused ESLint, TypeScript, all 96 migration prefixes, whitespace, and an isolated `npm run build:app` passed. Authenticated port 3001 proof measured all three visible header commands at exactly 40px, exercised Home and All venue filters, and found no browser warnings or errors.
- **Deferred:** None. The follow-up remains presentation-only.

## Final interaction cleanup - 2026-07-16

### Plan

- [x] Remove the redundant booking-row launch arrow.
- [x] Remove Extend from dashboard rows and keep due-date changes in booking details.
- [x] Reduce oversized empty team cards to compact operational rows.
- [x] Verify the simplified row action model, empty-state density, focused checks, and build.

### Review

- **Shipped:** Dashboard checkout rows now have one clear interaction: open booking details. Inline Extend controls are absent from both My Gear and Team Activity, while due timing remains visible and the detail sheet keeps the due date editable in context.
- **Verified:** Ten focused dashboard tests, focused ESLint, TypeScript, whitespace checks, and an isolated `npm run build:app` passed. Authenticated port 3001 proof confirmed no Extend control on the dashboard, opened the checkout detail sheet, and verified its Edit flow exposes the due date without saving a change.
- **Recommendation:** Move on from the dashboard. The remaining whitespace and role-dependent empty states are intentional consequences of its action-first two-column model, not unfinished polish.

## Sync indicator and booking sheet overhaul - 2026-07-16

### Plan

- [x] Move booking sync health beside the Dashboard title and reduce its visual footprint.
- [x] Replace the dense booking sheet field table with a scan-first overview and quieter supporting context.
- [x] Consolidate sheet actions into a clear primary action, full-detail link, and secondary action menu.
- [x] Verify dashboard hierarchy, sheet summary/edit paths, focused checks, build, and authenticated browser behavior.

### Peer patterns checked

- `PageHeader` title/action ownership for page-level hierarchy.
- `ShiftDetailPanel` for contextual sheet behavior and stable loading/error handling.
- Shared booking detail components for status, permissions, editing, equipment, and custody boundaries.

### Review

- **Shipped:** Live sync is now a compact bold title accessory with a restrained green glow. The booking sheet replaces the long field matrix with a due/window summary, compact pickup and linked context, optional notes, a quieter creation line, and an equipment-first working section. Footer actions resolve to Open full booking and a named More actions menu.
- **Preserved:** Booking permissions, reservation equipment planning, event relinking, owner transfer, cancellation confirmation, kiosk custody boundaries, and API routes are unchanged.
- **Verified:** 34 focused tests, focused ESLint, TypeScript, 96 migration prefixes, whitespace, codemap/docs verification, and an isolated `npm run build:app` passed. Authenticated port 3001 proof covered the compact title indicator, rendered checkout summary, More actions menu, and the then-current due-date edit path without saving or cancelling anything.

## Inline sheet editing and custody alignment - 2026-07-16

### Plan

- [x] Align the sheet status badge with dashboard urgency rails without losing lifecycle meaning.
- [x] Use weekday-first date formatting and keep due-back timing visible as the stable schedule anchor.
- [x] Replace the sheet-wide edit mode with explicit inline title, date, and notes edits.
- [x] Show numbered item-family unit identities directly in equipment rows.
- [x] Keep active checkout equipment changes at the kiosk while retaining reservation equipment planning on web.
- [x] Re-run focused checks and docs/build gates; record the authenticated browser-proof limitation.

### Review

- **Shipped:** Due-today and overdue checkout status badges now match the dashboard urgency rails. The sheet shows weekday-first dates, exposes title, schedule, and notes edits in context with explicit confirmation, displays numbered battery identities directly, and removes the bottom Edit booking action.
- **Custody boundary:** The shared sheet only exposes equipment editing for reservations. Active checkout contents remain readable on web and editable at the kiosk.
- **Verified:** 22 focused source and custody tests, focused ESLint, TypeScript, all 96 migration prefixes, whitespace, codemap/docs verification, and an isolated `npm run build:app` passed. Fresh authenticated browser proof remains pending because the available controlled browser opened an unauthenticated session rather than the user's in-app browser session.

## Exception queue and identity cleanup - 2026-07-16

### Plan

- [x] Consolidate the overdue queue onto the shared dashboard section header and booking row.
- [x] Remove the redundant top-bar profile control and keep profile navigation in the sidebar identity card.
- [x] Present serialized equipment as Gotham asset tag plus product name in the booking sheet.
- [x] Re-run focused checks and docs/build gates; record the authenticated browser-proof limitation.

### Review

- **Shipped:** The overdue queue now reads as the urgent member of the same dashboard system instead of a standalone legacy banner. Its red count and rail preserve severity, the shared row owns detail selection, and the header owns the full overdue route. The shell no longer repeats profile navigation at the top right. Booking equipment rows use the asset tag as the strong Gotham identifier and the product name as supporting context without repeating serial numbers.
- **Preserved:** Overdue sorting, nudge permissions, booking-sheet selection, full-list routing, booking data, and custody rules are unchanged.
- **Verified:** 26 focused dashboard/shell tests, focused ESLint, TypeScript, all 96 migration prefixes, whitespace, codemap/docs verification, and an isolated `npm run build:app` passed. Fresh authenticated browser proof remains pending because the available controlled browser does not share the user's signed-in in-app session.
