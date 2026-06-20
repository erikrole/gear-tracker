# Completed May Post-Backlog UI and Item Cleanup - 2026-05-07

Archived from `tasks/todo.md` on 2026-06-18.

### Avatar + shadcn Cleanup (2026-05-07)
- [x] **Shared people avatar groups** — Added `UserAvatarGroup` and migrated schedule/dashboard assignment previews to one tooltip/overflow pattern.
- [x] **Shared gear thumbnail stacks** — Added `ItemThumbnailStack` and migrated dashboard/bookings gear previews away from person-avatar primitives.
- [x] **Control cleanup** — Moved booking filter clear actions and event staffing icon/request controls onto shadcn `Button`/`Badge` variants.
- [x] **Verification + browser smoke** — `npx tsc --noEmit`, focused checkout tests, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and browser smoke on bookings, dashboard, schedule, and event detail passed.

### Booking Creation Ownership Pass (2026-05-07)
- [x] **Event picker window** — Checkout and reservation creation now fetch and label the documented next-30-days event window instead of a 3-day slice.
- [x] **Draft multi-event persistence** — `/api/drafts` now accepts ordered `eventIds[]`, writes `BookingEvent` draft links, rejects mixed `eventId`/`eventIds`, and returns ordered `events[]` for resume.
- [x] **Draft resume wiring** — Resumed drafts restore `selectedEvents` in the shared booking wizard so event-linked interrupted work does not collapse to ad hoc creation.
- [x] **Item-list shadcn alignment** — Creation now uses the Items list/header/form standard with shared `PageHeader`, shadcn switch/button/badge primitives, quiet bordered surfaces, item-style form rows, and browser-clean labels.
- [x] **Item picker flow** — `EquipmentPicker` now hydrates deep-linked/draft-selected assets, uses shadcn item-list composition, restores scan-to-add in Step 2, adds select-visible/clear-section controls, and lets valid selections review immediately.
- [x] **Item picker hardening** — Availability preview now checks visible plus selected assets, section searches persist, conflict-warning rows stay selectable, and booking detail edit excludes its own booking from picker conflict checks.
- [x] **Stale selection recovery** — Unresolved deep-linked or draft asset IDs render as removable unavailable rows and no longer count toward review, confirmation, draft, or create payloads.
- [x] **Verification + docs** — `npx tsc --noEmit`, focused Vitest coverage, `npm run db:migrate:check`, `git diff --check`, `npx next build`, local HTTP route checks, Arc smoke on `/checkouts/new` and `/reservations/new`, and checkout/reservation area docs synced.

### Page Ownership Skill (2026-05-06)
- [x] **Create execution skill**: Add a `page-ownership-pass` skill for full-page and page-slice UX/UI/consistency/hardening work.
- [x] **Keep audit boundary clean**: Cross-reference `audit-page-web` so readiness audits remain diagnostic while ownership passes can implement.
- [x] **Verify skill shape**: Check markdown/frontmatter, trigger language, and source-control diff before calling it done.

### Dashboard Upcoming Events Parity (2026-05-06)
- [x] **Plan + audit** — Compare Schedule event rows with the dashboard quick view and keep scope read-only.
- [x] **API/type parity** — Add staffing coverage metadata to dashboard event summaries without changing event behavior.
- [x] **Dashboard quick view UI** — Render schedule-style event identity, home/away, location/time, assignment preview, and coverage signals; remove quick-create controls.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `AREA_DASHBOARD.md` and `AREA_EVENTS.md` synced.

### Item Detail Tabs Final Polish (2026-05-06)
- [x] **Schedule agenda clarity** — Add a month agenda layer and reduce calendar chrome that does not help operators act.
- [x] **Schedule cancellation correctness** — Keep cancelled bookings out of the calendar grid and month agenda while preserving them in history surfaces.
- [x] **Schedule bar continuity** — Render month-grid bookings as continuous week-spanning bars instead of split per-day pills.
- [x] **Quick context cleanup** — Remove cancelled bookings from Past Bookings quick context and keep QR details owned by the QR preview.
- [x] **Booking preview sheet alignment** — Keep calendar clicks in an in-place preview, but align the sheet header, sections, footer, and action language with the current UI.
- [x] **Booking preview identity polish** — Add requester and creator avatars so the preview reads as human activity, not only metadata rows.
- [x] **Insights metric confidence** — Make age human-readable and stop overstating return-timing accuracy.
- [x] **Attachments empty state** — Fix empty-state rule language so unattached items do not imply they travel with a parent.
- [x] **Verification + docs** — Run focused checks, live tab checks, and sync `AREA_ITEMS.md`.

### Item Detail Tabs Follow-up (2026-05-06)
- [x] **Schedule correctness** — Stop rendering the same long booking title on every overlapping calendar day.
- [x] **Past Bookings context** — Wire requester avatar photos through the item detail API and reduce row text density.
- [x] **History polish + backend** — Improve the history surface UX and make older activity pagination usable.
- [x] **Verification + docs** — Run focused checks, live route checks, and sync `AREA_ITEMS.md`.

### Item Detail Tab Direction Pass (2026-05-06)
- [x] **Tab ownership cleanup** — Remove redundant Bookings tab, rename Calendar to Schedule, and keep tab labels/counts focused.
- [x] **Info booking context** — Add a quick Past Bookings surface below upcoming reservations for operational context.
- [x] **Secondary tab direction** — Make History the full touch log, keep Insights lightweight, and strengthen Attachments/Settings structure.
- [x] **Verification + docs** — Run focused checks and sync `AREA_ITEMS.md`.

### Item Detail Data Form Hardening (2026-05-06)
- [x] **Shared form guardrails** — Harden inline text, select, date, notes, and QR edit flows against double-submit, stale saving state, and weak disabled states.
- [x] **PATCH normalization** — Align asset PATCH validation with the detail form by trimming inputs, allowing nullable clearable fields, and preserving DB-required fields.
- [x] **Form surface polish** — Normalize select/category/date control framing, use gray picker surfaces, convert fiscal year to a year selector, use the shared badge treatment for admin scan identity, and top-align textarea rows.
- [x] **Local save unblock** — Fix shared API CSRF origin comparison so same-origin localhost PATCH requests are not rejected as cross-origin, while bad origins still return 403.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 4 (2026-05-06)
- [x] **Scan identity density** — Make the admin scan identity panel use space better while keeping QR, serial, and scan actions obvious.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 3 (2026-05-06)
- [x] **Header button layout** — Make the item action cluster read as primary workflow first, secondary item actions second, and utilities last.
- [x] **Freshness row cleanup** — Removed the blocking refresh tooltip and baked date/time into the visible Updated line.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 2 (2026-05-06)
- [x] **Header identity cleanup** — Drop serial number from the header, make the product subline smarter, and add clearer separators for location/category/department.
- [x] **Action flow cleanup** — Reduce competing header buttons and make secondary creation actions feel secondary.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail UX/UI Cleanup Slice 1 (2026-05-06)
- [x] **Overview hierarchy** — Make the default detail view lead with operational state and keep item metadata as the secondary facts column.
- [x] **Header simplification** — Reduce decorative weight, clarify derived status, and make action availability explicit.
- [x] **Tracking identity placement** — Move QR/scan identity into the item facts card instead of a detached admin-only sidebar.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and live dev `curl -I /items/cmmfqwb3l0001ob0lw2khjtzs` passed.

### Item Detail Missing Server Chunk Runtime Fix (2026-05-06)
- [x] **Runtime diagnosis** — Confirmed `Cannot find module './1893.js'` was stale/inconsistent `.next` output, not a current source/build problem.
- [x] **Narrow fix** — Regenerated the Next server bundle with `npx next build`; the rebuilt runtime loads chunk `1893` through `.next/server/chunks/1893.js`.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, `git diff --check`, and a local production `curl -I /items/test-runtime-chunk` check passed.

### Home Dashboard Focused Pass (2026-05-05)
- [x] **Audit current dashboard surface** — Read area docs, decisions, gaps, schema, API routes, existing audits, and dashboard components before editing.
- [x] **Framework/debug pass** — Removed stale `/api/reservations/[id]/extend` branch; dashboard extend now uses canonical `/api/bookings/[id]/extend`.
- [x] **Structure pass** — Extracted shared `DashboardBookingRow` for My Gear and Team Activity booking rows.
- [x] **UX/UI pass** — Split row navigation from inline action buttons, made filter clear a separate icon button, and tightened row truncation/mobile behavior.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.

### Home Dashboard Follow-up Pass (2026-05-05)
- [x] **Overdue banner controls** — Split overdue row navigation from check-in and nudge actions.
- [x] **Saved filter controls** — Split saved preset apply and delete into sibling controls.
- [x] **Browser verification** — Production server rendered `/login` cleanly. Protected dashboard visual inspection is blocked without an authenticated session cookie.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, and `git diff --check` passed.

### Home Dashboard Console Polish (2026-05-05)
- [x] **Metric strip polish** — Reduced stat-card visual weight and moved labels above numbers for faster scanning.
- [x] **Section header standardization** — Added shared `DashboardSectionHeader` for dashboard cards with consistent count and affordance treatment.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `npx next build`, and `git diff --check` passed.

### Home Dashboard Live Browser Polish (2026-05-05)
- [x] **Local login unblock** — Added gitignored local session env, reset the approved dev admin seed, and fixed dev CSP/service-worker behavior so the login form hydrates instead of falling back to `GET /login?`.
- [x] **Dev-console cleanup** — Fixed the `dashboard-stats` cache reader by providing a query function, clearing the remaining TanStack Query warning in the live browser.
- [x] **Interaction polish** — Replaced broad `transition-all` on shared buttons/toggles with explicit transition properties plus `active:scale-[0.96]`, and added focus-visible treatment to dashboard stat/row links.
- [x] **Responsive header polish** — Let the Upcoming Events header place its Home/Away filter on a second line so the title stays readable in narrow dashboard columns.

### Sidebar Polish Pass (2026-05-05)
- [x] **Navigation hierarchy** — Removed permanent trailing item index numbers from sidebar nav rows; they added visual load without a shipped shortcut layer.
- [x] **Interaction polish** — Replaced sidebar `transition-all` usage with explicit transition properties and added `active:scale-[0.96]` to nav buttons and quick-create actions.
- [x] **Collapsed-state check** — Verified icon-only sidebar mode in the live browser after the nav cleanup.
- [x] **Shell upgrade pass** — Strengthen section separation and normalize utility action feedback.

### Schedule Page Focused Pass (2026-05-05)
- [x] **Audit current schedule surface** — Read North Star, shift/events/mobile docs, decisions, gaps, student availability brief, current schedule components, and live dev behavior before editing.
- [x] **Framework/debug pass** — Cleared live console issues, hardened New Event sheet failure paths, fixed empty Select values, and kept legacy HTTPS thumbnails compatible with CSP.
- [x] **UX/UI pass** — Tightened schedule toolbar interaction feedback, removed row-as-link semantics from the desktop list, and added rapid-click guards to inline assignment/trade actions.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npx vitest run tests/query-client.test.ts`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and live Arc schedule/New Event checks passed.

### Schedule Command Bar + Coverage Pass (2026-05-05)
- [x] **Command bar hierarchy** — Promote view, venue, coverage, and secondary filters into clearer groups so the staff-critical coverage filter is not buried.
- [x] **Coverage-first list treatment** — Make under-covered events easier to scan with gap counts, stronger coverage copy, and subtle row emphasis.
- [x] **Verification + docs** — Run focused TypeScript/whitespace checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Readiness Polish Pass (2026-05-05)
- [x] **Operational snapshot** — Add compact readiness metrics so staff can see events, open slots, my shifts, and trade-board state without scanning rows.
- [x] **Surface polish** — Tighten the schedule surface so filters, metrics, and list read as one workflow rather than separate controls.
- [x] **Verification + docs** — Run focused checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Inline Assignment Matrix Pass (2026-05-05)
- [x] **Expanded event matrix** — Replace repeated expanded shift rows with an event-level slot matrix that groups staffing work into scannable assignment tiles.
- [x] **Inline actions** — Preserve staff assignment from open slots and student post-for-trade actions without nesting interactive controls in clickable rows.
- [x] **Verification + docs** — Run focused checks, verify `/schedule` live in Arc, and sync shift docs.

### Schedule Collapsed Staffing Preview Pass (2026-05-05)
- [x] **Collapsed avatar group** — Add a shadcn-style avatar group to collapsed event rows so fully staffed events read at a glance.
- [x] **Expanded row detail** — Replace large expanded slot cards with polished dense rows that preserve assignment and trade actions.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and live Arc `/schedule` checks passed, including the expanded assign-slot popover.

### Schedule Role Language Polish (2026-05-05)
- [x] **Role-aware needs** — Replace raw `ST`/`FT` labels with readable staff/student slot language and grouped open-need summaries.
- [x] **Travel event cleanup** — Remove away/neutral call-time placeholders from collapsed and expanded schedule rows.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and live Arc `/schedule` checks passed, including the expanded assign-slot popover.

### Cross-Page DevTools Cleanup (2026-05-06)
- [x] **Filter chip HTML validity** — Split active filter clear controls into sibling buttons so booking/status filters no longer render nested buttons.
- [x] **Manifest icon cleanup** — Pointed app manifest metadata at the existing 192/512 SVG icons instead of declaring the 72px Badgers logo as any-size.
- [x] **Search field identifiers** — Added stable `id`/`name` attributes to the visible search fields flagged by Chrome DevTools.
- [x] **Dashboard/schedule copy cleanup** — Fixed dashboard event title spacing/home-away language and removed zero-duration call ranges from schedule rows.
- [x] **Verification + docs** — `npx tsc --noEmit`, `git diff --check`, and Chrome DevTools MCP smoke checks passed on dashboard, schedule, bookings, items, users, and guides.

### Items Page Hardening Pass (2026-05-06)
- [x] **Audit current items surface** — Read item docs, decisions, gaps, schema, existing item audits, and current list/detail files before editing.
- [x] **Async action resilience** — Make item export, duplicate, maintenance, and retire handlers always release busy state, including auth redirects and unexpected failures.
- [x] **Filter/list correctness** — Keep selection and empty states aligned with item type, favorites, attachment filters, sorting, and mixed serialized/bulk result sets.
- [x] **Export filter parity** — Keep CSV export aligned with the visible list filters where the export route supports them.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. AREA_ITEMS.md synced.

### Items Page UX/UI Polish Pass (2026-05-06)
- [x] **Command bar hierarchy** — Restructure search, view filters, advanced filters, favorites, clear actions, and header action sizing so the toolbar reads as one workflow.
- [x] **Operational telemetry** — Rework the status summary strip so it scans like inventory health instead of a second toolbar.
- [x] **Row hierarchy** — Improve desktop rows and mobile cards so tag identity, product metadata, status, location, and category have clearer priority.
- [x] **Verification + docs** — `npx tsc --noEmit` and `git diff --check` passed. AREA_ITEMS.md synced.

### Items Compact + Fill Gaps Upgrade (2026-05-06)
- [x] **Compact table mode** — Make compact mode read like a plain shadcn data table by removing row thumbnails and tightening row rhythm.
- [x] **Fill gaps queue** — Make the gap wizard more resilient with batch prefetch, retryable failures, smarter same-category suggestions, explicit no-photo handling, skipped-item review, and mixed serialized/bulk gap cleanup.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, Chrome for Testing Fill gaps layout checks, and a read-only Prisma data check for legacy bulk category-name department hints passed. AREA_ITEMS.md and AREA_BULK_INVENTORY.md synced.

### Cheqroom Import QR Repair (2026-05-06)
- [x] **Importer QR precedence** — Use Cheqroom `Codes` as the primary QR/scan value before `Barcodes`, and preserve both source values for traceability.
- [x] **Re-import repair path** — Let upserts repair existing QR/primary scan values when there is no unique-owner conflict.
- [x] **Current data repair** — Applied a guarded repair from the 2026-05-06 Cheqroom export: created 2 missing assets, repaired 20 QR values, repaired 23 primary scan values, refreshed duplicate-name rows by source/tracking match, and cross-checked all 43 CSV rows cleanly.
- [x] **Verification + docs** — `npx tsc --noEmit`, `node --check scripts/import-cheqroom-items.mjs`, `npm run db:migrate:check`, `git diff --check`, and source-aware Prisma cross-check passed. AREA_IMPORTER.md and GAPS_AND_RISKS.md synced.

### Item Detail Hardening + Polish Pass (2026-05-06)
- [x] **Header resilience** — Wire the detail action busy state into header controls, guard optimistic favorites against rapid repeats, and replace failed-photo blanks with the standard no-photo fallback.
- [x] **Bookings/calendar polish** — Use the shadcn toggle-group pattern for booking filters and add a mobile calendar list so the tab is useful below desktop width.
- [x] **Async cleanup** — Cancel stale insights, activity, and attachment-search fetches; preserve 401 redirect handling; and make category/QR save flows always release saving state.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. AREA_ITEMS.md synced.

### Camera Attachments (2026-05-05)
- [x] **Attachment model implementation** — Treat camera-tied SD cards/cages/fixed parts as non-bookable item attachments and preserve QR-coded batteries as numbered bulk units. Verified with focused tests, TypeScript, migration-prefix check, and local Next build.

### Derived Bulk Unit QR Scans (2026-05-05)
- [x] **Numbered unit QR scan path** — Let QR values like `94e068d1-7` resolve to the parent numbered bulk SKU and unit #7 without opening the picker. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
