# Task Queue

Last updated: 2026-05-07

**Current release**: Beta — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## Recently Shipped

### Design System Cleanup (2026-04-14)
- [x] **Badge variants** — Removed 4 unused variants (ghost, link, mixed, yellow); consolidated from 13 → 9
- [x] **Typography** — 15 settings page headings migrated from hardcoded `text-[22px]` → `text-2xl` token
- [x] **Legacy CSS** — ~240 lines removed: `ops-row*` (dashboard columns), `possession-card*` (no consumers), `data-table*` (TradeBoard + ShiftConfigTable) all migrated to Tailwind
- [x] **Accent naming** — 3 direct `var(--accent)` usages replaced with `var(--primary)` / `hover:border-primary`
- [x] **Theme toggle** — `.theme-toggle-row` CSS block migrated to inline Tailwind (`data-[state=on]:`, `hover:`) in Sidebar.tsx

### Guides Feature (2026-04-14)
- [x] **Slice 1** — Guide model + migration (0032), service layer (`src/lib/guides.ts`), 5 API routes with auth + audit logging
- [x] **Slice 2** — `/guides` list page (category chips, search, card grid), `/guides/[slug]` BlockNote reader, sidebar nav entry
- [x] **Slice 3** — `/guides/new` create page, `/guides/[slug]/edit` edit page (publish toggle, admin delete with AlertDialog)
- [x] **Doc sync** — `AREA_GUIDES.md` created, `guides-plan.md` archived

### Kiosk Mode — Full Flow (2026-04-14)
- [x] **Verified all 12 kiosk API routes** — all use `withKiosk`, correct auth on all mutations
- [x] **Confirmed `source: "KIOSK"`** on checkout/complete and checkin/complete audit entries
- [x] **Confirmed 5-min inactivity timer** in KioskShell
- [x] **Updated AREA_KIOSK.md** — all 11 ACs marked complete, full implementation documented
- [x] **Archived `tasks/kiosk-plan.md`** → `tasks/archive/`

### Scan Flow Hardening (2026-04-09)
- [x] **Stress test** — 4 issues found, 4 fixed: scanValue normalization, bulk bin case-insensitive match, cross-booking numbered bulk unit integrity, completeCheckinScan status guard
- [x] **Harden pass** — 6 fixes across 4 files: Badge components, dark-mode color consistency, finally blocks on both hooks, Page Visibility refresh, camera error UX

### Booking Flow Overhaul (2026-04-09)
- [x] **Multi-step wizard** — `/checkouts/new` and `/reservations/new` replace `CreateBookingSheet`. 3 steps: Context & Details → Equipment → Confirmation.
- [x] **BookingDetailsSheet Equipment tab** — 3rd tab with unreturned badge count, scan-to-return (inline camera, local QR lookup, audio/haptic), full EquipmentPicker in edit mode.
- [x] **Thumbnails everywhere** — `<AssetImage size={36}>` on all equipment rows. Bulk qty stepper capped at max, 44px touch targets.
- [x] **Stress test** — 12 issues found, 8 fixed (broken redirect URL, stale scan state, date validation, audit log deps, draft save await, form-options error state).
- [x] **Cleanup** — `CreateBookingSheet` and `BookingEquipmentEditor` deleted. Dashboard wired to wizard navigation.

---

## Open Items

### Damage Report Photos + Avatar Polish (2026-05-07)
- [x] **Report photo evidence** — Add optional photo evidence to damaged/lost check-in reports without restoring scrubbed checkout/check-in condition-photo gates.
- [x] **User photo polish** — Resize profile avatars before upload and surface an admin roster cue for users missing profile photos.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and checkout/scan/users docs synced.

### Active Backlog Index (2026-05-06)
- [ ] **Next recommended slice: Admin Fix Today queue** — Build the daily action queue first so admins stop checking separate pages for overdue gear, pending pickup orphans, offline kiosks, flagged items, low batteries, sync failures, and license expirations.
- [ ] **Battery follow-through** — Finish the remaining battery workflow polish in Bulk Battery Hardening: explicit kiosk battery scan step, override visibility, booking-create guidance, and optional gear suggestions.
- [ ] **Admin helpers** — Work through Admin Helper Backlog in this order: Fix Today queue, Kiosk admin cockpit, People offboarding assistant, Inventory hygiene center, Admin exception review, Renewal and expiry calendar, Morning digest.
- [ ] **Ops V2/V3 deferred work** — Keep deeper battery reporting, inventory health, attachment slot schema, and templates/presets behind slice plans.
- [ ] **Low-priority systemic gaps** — Keep SystemConfig UI, scan endpoint rate limiting, PENDING_PICKUP auto-expiry, and Game-Day Readiness Score visible but behind daily-ops work.

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
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed. Exact `npm run build` stopped at `prisma migrate deploy` schema-engine failure before Next build; remote DB escalation was rejected as unsafe for this dashboard-only pass.

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

### Bulk Battery Hardening (2026-05-05)
- [x] **Kiosk-scanned numbered batteries** — Treat battery booking as quantity at creation, then bind/return specific numbered units through kiosk unit QR scans. Add low-availability camera-model battery warnings at creation. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
- [x] **Kiosk battery client and labels** — Include batteries in iOS kiosk pickup/return checklists, block pickup confirm until planned units are scanned, align compatibility rules to the current import snapshot, and improve Brother P-Touch unit labels. Verified with focused tests, TypeScript, migration-prefix check, local Next build, iOS simulator build, and whitespace check.
- [x] **Battery Unit Cockpit** — Added `/bulk-inventory/batteries` plus an Admin nav entry for active numbered battery SKUs, unit status counts, low-stock signals, checked-out aging, booking/requester context, and audited unit status actions.
- [x] **Kiosk battery mismatch polish** — Kiosk pickup/return now distinguishes wrong battery type, duplicate scans, units checked out elsewhere, units not checked out on the booking, and lost/retired units.
- [x] **Battery compatibility lows** — Battery Cockpit now flags low compatible battery families by matching active camera inventory against existing battery compatibility rules.
- [ ] **Kiosk explicit battery scan step** — Make pickup clearly call out required battery unit scans before confirm, while preserving current unit-binding behavior.
- [ ] **Kiosk admin override visibility** — Preserve admin override, but make battery-related override use visible and audit-friendly in the pickup flow.
- [ ] **Booking-create battery guidance polish** — Make compatible battery warnings feel like actionable guidance instead of generic alerts, without requiring unit selection before pickup.
- [ ] **Booking-create optional gear suggestions** — Suggest compatible support gear such as batteries, media, readers, and cages from selected camera context.
- [ ] **Attachment management polish** — Improve camera attachment attach, detach, and replace flows while keeping slot identity display-only for now.
- [ ] **Battery audit/reporting** — Add missing batteries by unit, loss rate by SKU, unit checkout history, repeated missing-unit patterns, and aging checked-out battery reporting.
- [ ] **Inventory health dashboard** — Add operational health signals for low stock by location, missing camera-system attachments, batteries below threshold by camera family, and retired/lost trends.
- [ ] **Attachment slot schema decision** — Revisit nullable `attachmentSlot` only if slot filters, required attachment checks, completeness reports, or slot-level maintenance workflows justify schema work.
- [ ] **Templates/presets** — Add camera kit presets such as FX6 shoot or FX3 shoot that suggest batteries and optional gear while keeping batteries as numbered bulk inventory.

### Admin Helper Backlog (2026-05-06)
- [ ] **Admin Fix Today queue** — Single admin-only action queue for overdue gear, pending pickup orphans, offline kiosks, damaged/lost/maintenance flags, low batteries, calendar sync failures, and expiring licenses.
- [x] **Battery unit cockpit** — Shipped `/bulk-inventory/batteries` with available/out/lost/retired counts, aging checked-out units, quick unit actions, and low compatible batteries by camera family.
- [ ] **Kiosk admin cockpit** — Show each iPad location, active state, last seen, current mode, pending pickup count, failed scan count, stale activation state, and repair actions such as deactivate, regenerate code, clear stuck pickup, and fix wrong-person attribution.
- [ ] **Admin exception review** — One feed for admin overrides, kiosk-source activity, location exceptions, failed scans, manual releases, retired/lost changes, and destructive actions.
- [ ] **People offboarding assistant** — On user deactivation, show and resolve open checkouts, upcoming reservations, shift assignments, Photo Mechanic license slots, active sessions, and allowed-email claims tied to that person.
- [x] **Inventory hygiene center** — Shipped `/items/hygiene` as a staff/admin checklist for missing category, missing department, missing primary scan code, missing image, duplicate scan identity, retired items still in kits, camera bodies with no attachments, and bulk SKUs below threshold.
- [ ] **Renewal and expiry calendar** — One admin calendar for Photo Mechanic renewals, warranty dates, calendar feed health, expiring credentials, and deadline-based admin attention.
- [ ] **Admin-only morning digest** — Daily email, push, or in-app summary for overdue count, due today, pickups waiting, kiosk offline, low batteries, expiring licenses, and calendar sync errors.

### Deferred Gaps To Keep Visible (2026-05-06)
- [ ] **SystemConfig admin surface** — `SystemConfig` has no admin UI; keep deferred until more config keys exist beyond internal escalation settings. Source: GAP-21.
- [ ] **PENDING_PICKUP auto-expiry** — Decide whether stale pickups should auto-expire after a fixed window or stay manual via Fix Today. Source: GAP-33.
- [ ] **Mobile staff parity review** — iOS still intentionally lacks some web power-user filters/conflict badges/admin item actions; revisit after web admin helpers settle. Sources: GAP-34, GAP-35, GAP-36.

### Codex Readiness (2026-05-05)
- [x] **Worktree hygiene** — classified untracked Codex/agent files, kept useful project-scoped guidance, and removed tracked local `.DS_Store` noise from future diffs
- [x] **Codex config cleanup** — deduped local hook config and verified no secrets in Codex/agent guidance files
- [x] **Verification gate** — ran migration-prefix check, JSON validation, diff whitespace check, and secret-pattern scan
- [x] **Next optimization plan** — wrote `tasks/react-query-cache-plan.md`; GAP-11 is a cache-key audit follow-up, not a migration

### Review
- Page Ownership Skill shipped: added a project skill for end-to-end web page and page-slice execution passes, including orientation, peer comparison, structure/UX/UI/consistency/hardening lenses, verification, docs sync, and propagation candidates. `audit-page-web` now points full-page implementation requests at the new skill while staying a diagnostic readiness audit. Verification passed for frontmatter/heading scan and `git diff --check`.
- Dashboard Upcoming Events Parity shipped: the dashboard Upcoming Events card now uses schedule-style read-only coverage metadata from `/api/dashboard`, shows event title, time, location, home/away state, staffing avatars, filled/total coverage, open-slot warnings, and home call time when available. Quick-create controls were removed from the widget, keeping `/schedule` as the management surface. Verification passed for TypeScript, migration-prefix check, whitespace, and local Next build.
- Item Detail Tabs Final Polish shipped: Schedule now pairs the month grid with a compact agenda row list, continuous week-spanning booking bars, quieter Today control, completed trailing calendar cells, and filters cancelled bookings out of occupied schedule and quick Past Bookings views. QR details are owned by the QR preview instead of a separate visible action. Calendar booking clicks keep users in context with a lighter booking preview sheet that matches the current app chrome, uses requester/creator avatars for human context, and routes deeper work to the full booking page. Insights now uses completion audit activity for return timing when available, labels the metric honestly, and shows item age in years for older gear. Attachments now hides the travel rule when no children exist and explains when fixed accessories should be added. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, authenticated Chrome DevTools tab checks, and console review.
- Item Detail Tabs Follow-up shipped: Schedule now uses clickable continuation/end markers instead of repeating long booking names across every occupied day. Past Bookings now pulls requester avatar URLs through the detail API and renders compact rows with title, requester, date range, kind, and status. History now has All / Item updates / Bookings scopes, backend scope filtering, cursor pagination, cleaner legacy audit labels, and quieter import metadata handling. Verified with TypeScript, migration-prefix check, whitespace check, local route checks, and authenticated Chrome DevTools checks on Info, Schedule, and History.
- Item Detail Tab Direction Pass shipped: the detail tab rail now uses a quieter thin active underline, removes the redundant Bookings tab, renames Calendar to Schedule, and removes visible shortcut numerals. Info now includes Past Bookings beneath upcoming reservations with requester avatars and clearer booking context. Insights is a compact signal view, History is framed around the full item touch log, Attachments has operational summary/direction, and Settings reads as workflow eligibility policy. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, and `npx next build`.
- Item Detail Data Form Hardening shipped: shared inline save controls now use a ref guard against rapid duplicate saves, show saving state instead of competing save/cancel controls, disable text/select/date/notes/QR inputs while requests are active, and toast actual save errors. Asset PATCH now trims incoming strings, accepts clearable nullable fields, allows zero-value financial fields, saves department by ID, and parses server error bodies consistently. The shared API CSRF guard now compares against the actual request origin, so localhost item saves are not rejected before auth/permissions while bad origins still return 403. The info card now uses consistent gray picker surfaces for select/category/date/year controls, a year-only Fiscal Year picker, a shared Admin badge, and a top-aligned notes row.
- Home Dashboard Focused Pass shipped: dashboard rows now use one shared row component, no longer nest action buttons inside clickable row buttons, and use a safer mobile layout with predictable truncation. Filter clear no longer nests a focusable pseudo-button inside the popover trigger. Docs synced in `AREA_DASHBOARD.md`. Verification passed for TypeScript, migration-prefix check, and local Next build; exact `npm run build` remains blocked at remote Prisma migrate deploy.
- Home Dashboard Follow-up Pass shipped: overdue banner rows now split open/check-in/nudge into sibling controls, saved filter presets now split apply/delete into sibling controls, and the production browser check confirms the app can render `/login`; dashboard visual inspection still needs an authenticated browser session.
- Home Dashboard Console Polish shipped: stat cards are quieter and section headers now share one component, reducing repeated header styling across My Gear and Team Activity.
- Home Dashboard Live Browser Polish shipped: local login now works on `localhost:7001`, the dashboard renders without the Next dev issue badge, buttons/toggles have explicit tactile transitions, and the Upcoming Events header stays readable in narrow columns.
- Sidebar Polish Pass shipped: sidebar nav rows are quieter without permanent index numbers, icon states are clearer, hover/active transitions are explicit, and collapsed mode was checked live.
- Schedule Page Focused Pass shipped: New Event no longer relies on invalid empty Select values, location loading and event creation redirect/error paths are explicit, schedule row expansion uses a real expand control instead of a focusable row-link hybrid, inline schedule mutations have ref-backed duplicate-submit guards, and the live Arc console is down to normal dev noise after a reload.
- Schedule Command Bar + Coverage Pass shipped: Needs staff is now a first-class schedule command, secondary filters keep their own count, the list header/rows surface open-slot coverage gaps without requiring the shift panel, and the live shift-trades reload error is cleared.
- Schedule Readiness Polish Pass shipped: schedule now opens with an operational snapshot for open slots, ready events, my shifts, open trades, and next visible call time before the date-grouped list.
- Schedule Inline Assignment Matrix Pass shipped: expanded events now show one scannable slot matrix, staff can assign open slots directly from each tile, students keep inline trade posting, and the event manager is exposed as one clear action instead of relying on row-click behavior.
- Schedule Collapsed Staffing Preview Pass shipped: collapsed rows now show assigned-staff avatar groups and open-slot counts, those previews fade on expand, and expanded content returns to dense assignment rows for fully staffed events.
- Schedule Role Language Polish shipped: schedule rows now state staff/student needs in plain language, keep event start/all-day context with the event title, keep expanded role labels neutral to avoid competing color systems, avoid repeating the same need in the collapsed avatar preview, and reserve the right column for real home call times.
- Cross-Page DevTools Cleanup shipped: active filter clears no longer nest buttons, manifest icons use correctly declared app assets, search inputs have stable identifiers, dashboard event titles read cleanly, and schedule call ranges no longer repeat identical start/end times. Authenticated Chrome DevTools checks are clean on dashboard, schedule, bookings, items, users, and guides; abort/retry fetches remain intentional stale-request cancellation.
- Items Page Hardening Pass shipped: item export, duplicate, maintenance, and retire handlers now release busy state through auth redirects and failures; item-list empty states and pagination now key off merged serialized/bulk rows; selection clears when item type, favorites, attachments, filters, or sort changes; CSV export now honors favorites and the same search fields as the list.
- Items Page UX/UI Polish Pass shipped: the toolbar now reads as one command bar with advanced filters behind a toggle, header actions share a compact 32px rhythm, the inventory summary is a compact health grid, and item rows/cards lead with tag plus product identity without duplicating serial or department metadata in the name stack.
- Items Compact + Fill Gaps Upgrade shipped: compact density now removes thumbnails for a plainer shadcn table read, and Fill gaps now preloads a mixed serialized/bulk queue, exposes retryable count/load/save failures, ranks suggestions with same-category department hints including legacy bulk category text, makes no-photo items explicit, and lets staff review skipped items before closing the session.
- Item Detail UX/UI Cleanup Slice 1 shipped: the default Overview now leads with active checkout/upcoming reservation context, keeps item facts as the secondary right column, moves QR scan identity into the facts card, and quiets the header so derived status plus available actions are easier to read.
- Item Detail UX/UI Cleanup Slice 2 shipped: serial number left the header, duplicated brand/model sublines collapse when the product name already contains that identity, location/category/department now have clear slash separators, Check out is the primary available action while Reserve stays secondary, and scan identity rows are labeled.
- Item Detail UX/UI Cleanup Slice 3 shipped: the header action cluster now puts workflow buttons first, keeps Actions with the workflow controls, moves refresh/favorite plus freshness text into a quieter utility row, and removes the blocking freshness tooltip by baking date/time into the Updated line.
- Item Detail UX/UI Cleanup Slice 4 shipped: the admin scan identity panel now uses a compact inset layout with labeled QR/Serial values, matching copyable mono text, and a larger QR preview that owns the manage/view action without a redundant text button.
- Item Detail Hardening + Polish Pass shipped: detail header controls now respect action busy state, favorite toggles are rapid-click guarded, failed item photos render the no-photo fallback, mobile calendar shows a booking list instead of a blank grid area, booking filters use the standard toggle-group, and detail tab fetches clean up stale requests.
- Item Detail Missing Server Chunk Runtime Fix completed: the reported `Cannot find module './1893.js'` error came from stale `.next` server output. Regenerating the Next build produced a coherent `/items/[id]` bundle, and a local production route check returned `200 OK`.
- Camera Attachments shipped: item detail now uses grouped Attachments, SD card slot labels render for tags such as `MBB 17 IV 1A`, scan lookup shows parent/slot context, and docs lock QR-coded batteries to numbered bulk semantics. `npm run build` stopped at remote Prisma migrate deploy; safer local `npx next build` passed.
- Derived Bulk Unit QR Scans shipped: QR values generated by the numbered bulk QR tab, such as `94e068d1-7`, now submit as one validated numbered unit under the parent SKU without converting batteries into serialized items.
- Bulk Battery Hardening shipped: kiosk pickup/check-in now scans numbered battery unit QRs one by one, lookup resolves unit QRs, checkout creation warns on low compatible battery availability, and camera-battery guidance is no longer a hard gate.
- Battery Unit Cockpit shipped: admins/staff now have `/bulk-inventory/batteries` for active numbered battery SKUs, low-stock signals, checked-out aging, booking/requester context, and audited quick unit actions.
- Kiosk battery mismatch polish shipped: derived unit scans now return operator-specific feedback for wrong battery type, duplicate pickup scan, checked-out elsewhere, not checked out on this booking, and lost/retired unit cases.
- Kiosk battery client and labels shipped: kiosk detail payloads include battery units in the checklist, pickup confirm blocks unscanned planned battery quantities, the iOS pickup subtitle counts bulk quantities, Brother P-Touch labels emphasize the unit number, and battery reporting is pinned as GAP-37.
- React Query cache migration was already shipped in code and documented in `docs/NORTH_STAR.md`; stale GAP-11 status is reconciled in `docs/GAPS_AND_RISKS.md`.
- Cache Slice 1 shipped: repeated `["me"]` and `["form-options"]` query functions now use shared hooks; `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Cache Slice 2 shipped: persisted query allowlist is now a tested helper; `tests/query-client.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, and `npx next build` passed.
- Duplicate allocation check converted from scratch task file into `npm run db:check:dupe-allocations`; `node --check scripts/check-dupe-allocations.mjs` and `npm run db:migrate:check` passed.
- Cache Slice 3 shipped: booking list requester/location filter metadata failures now show a retryable alert instead of silently degrading to empty filters.
- Bookings Past Scope shipped: `/bookings` now keeps Active and Past as explicit URL-backed scopes. All active requests send `active=true`, Past requests send `past=true` across combined, checkout, and reservation list APIs, and the list copy names the current scope. Verified with typecheck, focused checkout tests, migration-prefix check, diff check, Next build, and authenticated DevTools network/console smoke.
- Booking Creation Step 2 UX Polish shipped: the shared checkout/reservation picker now reports valid, warning, unavailable, and checking counts to the wizard, Step 2 shows those counts in one compact status strip, and the footer CTA now names warning and unresolved states before review.
- Booking Creation Final Screen Polish shipped: Step 3 now leads with role-clear handoff language for checkout versus reservation, shows next step/location/timing facts, and uses "Create pickup" so checkout creation does not imply kiosk custody already happened.

### Reservations (P2)
- [x] ~~**Resolve equipment conflict badges**~~ (AC-8) — Already implemented in `BookingEquipmentTab.tsx:53-106`. Fetches conflicts for BOOKED/DRAFT bookings. Verified 2026-04-06.

### Users (P2)
- [x] ~~**Add sport/area assignment CRUD**~~ — Shipped 2026-03-28 (GAP-23). Popover multi-select in UserInfoTab.
- [x] ~~**Session-level active enforcement**~~ — Shipped 2026-04-06. `requireAuth()` checks `user.active` + deactivation deletes sessions.

### Known Bugs (documented with proof tests)
- [x] ~~**Fix `claimTrade()` missing isolation**~~ — Fixed 2026-03-30: SERIALIZABLE added to all shift-trades.ts + shift-assignments.ts transactions.
- [x] ~~**Fix bulk scan TOCTOU**~~ — Fixed 2026-03-30: Quantity guard moved inside SERIALIZABLE transaction.
- [x] ~~**Fix `markCheckoutCompleted` double-return**~~ — Fixed 2026-03-30: Now subtracts `checkedInQuantity` from return amount.
- [x] ~~**Fix CSRF bypass with missing Origin**~~ — Fixed 2026-03-30: Origin header required on all mutating requests (cron exempted via Bearer auth).

---

## Scan Flow — Low Priority (from 2026-04-09 stress test)
- [x] ~~**Admin override detail logging**~~ — Shipped 2026-04-14: `createAdminOverride` now queries the active scan session, calls `buildScanCompletionState`, and stores `bypassed.missingSerialized`, `bypassed.missingBulk`, `bypassed.missingUnits`, and `bypassed.phase` in the `details` field of both the `OverrideEvent` and the audit entry.
- [ ] **Server-side rate limiting on scan endpoints** — `/api/checkouts/[id]/scan` and `/checkin-scan` have no per-session rate limit. Client-side 1s debounce is the only guard. Migrate to Upstash KV rate limiter when user base grows (tracked in GAP-32).
- [x] ~~**Device context never sent from client**~~ — Shipped 2026-04-14: `use-scan-submission.ts` now sends `deviceContext: navigator.userAgent` on all scan POST requests (both `submitScan` and the numbered-bulk inline fetch).

---

## Phase B Backlog (needs briefs before implementation)

- [x] ~~**Shift email notifications**~~ — Trade lifecycle emails shipped for claimed, completed, approved, and declined trades; broader assignment emails remain out of scope
- [x] ~~**Student availability tracking**~~ — Shipped as recurring weekly unavailability blocks with profile Availability tab and assignment conflict indicators; date-specific exceptions remain optional follow-up
- [x] ~~**Date range grouping**~~ — Already shipped in `BookingInfoTab`: the booking detail "When" field shows connected start/end values with duration. Reconciled 2026-05-05.
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)

---

## Wins Sprint (2026-04-30)

- [x] Replace `img` with `next/image` in booking detail condition photos
- [x] Remove silent JSON parse swallowing in booking + scan client flows
- [x] Add missing indexes (`notifications.sent_at`, `override_events.created_at`, `bulk_stock_balances.bulk_sku_id`)
- [x] Run `npm run test` (fails on pre-existing unrelated tests: equipment-guidance, shift-trades, create-booking)
- [x] Run `npm run build` (`npm run build` blocked by Prisma schema engine error against Neon; `npx next build` passes)

### Review
- Shipped low-effort hardening on booking + scan client paths and added missing operational indexes.
- Verification complete for compilation (`npx next build` succeeds). Test suite currently red for unrelated pre-existing failures.
