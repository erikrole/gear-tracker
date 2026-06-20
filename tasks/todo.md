# Task Queue

Last updated: 2026-06-20

---

## Active: Categories visibility audit and patch (2026-06-19)

Plan: `tasks/categories-visibility-plan.md`

- [x] Audit category schema, API, Settings page, Items filters, and item create/detail pickers.
- [x] Patch category option generation so every category, including parent categories and grandchildren, can show up where exact category filters/assignments are valid.
- [x] Make the Fill gaps wizard smarter for missing-category cleanup across standard items and item families.
- [x] Add focused regression coverage.
- [x] Sync Settings/Items docs and record verification.

### Review
- 2026-06-19: Categories cleanup patch shipped locally. Category filters and shared pickers now use full hierarchy paths, `/api/assets?missing=category` suggests categories from already-categorized inventory, and Fill gaps uses those suggestions before gear-term fallback matching. Verification passed with focused Vitest, TypeScript, migration-prefix check, whitespace check, app build, and docs check. Browser smoke was blocked by the Codex/DevTools usage limit after starting the dev server.

---

## Active: Breadcrumb audit and patch (2026-06-19)

Plan: cross-cutting navigation slice in `src/components/PageBreadcrumb.tsx`

- [x] Audit current breadcrumb ownership, route derivation, role-aware sibling menus, recents, creation-flow treatment, and mobile constraints.
- [x] Patch remaining breadcrumb presentation and loading-edge issues without changing AppShell ownership.
- [x] Sync breadcrumb docs and record verification results.
- [x] Run focused verification and browser smoke.

### Review
- 2026-06-19: Shipped the breadcrumb display polish. `PageBreadcrumb` now treats `/new` task routes plus `/import` as quiet breadcrumb routes, waits for current-user role data before rendering role-gated Settings sibling dropdowns, and makes crowded Home crumbs compact on narrow screens while preserving screen-reader text. Verification passed with `npx tsc --noEmit`, `git diff --check -- src/components/PageBreadcrumb.tsx tasks/todo.md docs/AREA_MOBILE.md docs/AREA_SETTINGS.md`, and `npm run build:app`. `npm run verify:docs` reported codemap drift in `docs/CODEMAPS/architecture.md`, `docs/CODEMAPS/backend.md`, and `docs/CODEMAPS/frontend.md`; codemap regeneration was not run because the current worktree includes unrelated category/API edits. Authenticated Chrome DevTools smoke with the seeded admin verified `/settings/notifications` rendered `Home > Settings > Notifications` with 40px breadcrumb targets, `/resources/new` used the transparent quiet breadcrumb treatment, route data retried cleanly to 200, and the console had no app warnings or errors. Screenshot: `/private/tmp/breadcrumb-resources-new.png`.
- 2026-06-20: Follow-up UI refinement shipped locally. The breadcrumb shell now uses a quiet translucent trail without a boxed border, parent crumbs keep 40px+ targets with softer hover surfaces, separators are lower contrast, current-page crumbs use a subtle underline instead of a filled chip, and loading skeletons match the lighter treatment. Verification passed with `npx tsc --noEmit`, `npm run build:app`, `npm run verify:docs`, and focused diff whitespace checks. Authenticated Chrome DevTools smoke verified `/settings/notifications` and `/resources/new`: parent controls stayed transparent at 40px height, quiet routes had no shell background/shadow, current crumbs rendered a 2px underline, route/data requests returned 200 after expected dev retries, and the console had no app warnings or errors. Screenshot capture timed out in DevTools, so verification used DOM measurements and computed styles.

---

## Active: Schedule title cleanup (2026-06-19)

Plan: `tasks/schedule-title-cleanup-plan.md`

- [x] Confirmed Schedule/Event docs, schema, and shared formatter contract.
- [x] Updated shared Schedule title formatting for UW Athletics source prefixes and neutral-site location sublines.
- [x] Aligned future calendar sync prefix cleanup.
- [x] Added focused Schedule formatter and calendar-sync regression tests.
- [x] Run verification and record results.

---

## Active: Schedule call time display (2026-06-19)

Plan: `tasks/schedule-call-time-display-plan.md`

- [x] Confirmed the data model already separates event time, generated/default shift window, slot override, and personal override.
- [x] Update shared call-time display so rows show one call time per slot/person while preserving full-window edit/conflict data.
- [x] Run full verification and record results.

---

## Active: Schedule hardening from improve pass (2026-06-19)

Plan: `tasks/schedule-hardening-improve-plan.md`
Follow-up plan: `tasks/venue-mappings-audit-surface-plan.md`
Follow-up plan: `tasks/schedule-data-quality-queue-plan.md`
Follow-up plan: `tasks/schedule-event-identity-normalization-plan.md`

- [x] Gate hidden calendar-event list reads by role.
- [x] Replace stale mirrored calendar-events query coverage with route-backed tests.
- [x] Update Schedule/Event docs and run verification.
- [x] Centralize shared CalendarEvent where-building for Schedule/Event server reads.
- [x] Harden sport-code API boundaries and mapped home-venue sync classification.
- [x] Add sport-code route coverage and read-only venue mapping audit helper.
- [x] Harden manual calendar-event creation with schema-backed validation.
- [x] Surface the venue mapping audit in Settings for admin review and recovery.
- [x] Add the Schedule data-quality queue for event cleanup review.
- [x] Normalize noisy event opponent and venue identity strings at ingest/edit boundaries.

### Review
- 2026-06-19: Shipped the Schedule hardening improve follow-up. `/api/calendar-events?includeHidden=true` now rejects non-staff/admin users, route-backed GET tests cover default hidden/archive filtering plus staff-only hidden reads, and the stale mirrored query-helper test was removed. Verification passed with focused Vitest coverage, TypeScript, migration-prefix check, diff whitespace check, docs verification, and `build:app`.
- 2026-06-19: Shipped the query-contract follow-up. `/api/calendar-events`, Schedule health, Schedule automation, and Schedule exports now share `buildScheduleEventWhere`, with helper-level tests covering visibility/archive/status/date-window/sport/unmapped behavior.
- 2026-06-19: Shipped sport-code and venue hardening. API boundaries now normalize lowercase sport codes and reject unknown values before reads/writes, while calendar sync uses mapped home-venue flags when deriving home versus neutral event state.
- 2026-06-19: Shipped route coverage and venue audit follow-up. Schedule health, automation, exports, shift groups, bookings, users, and drafts now have route-level sport-code normalization/rejection tests, and `auditVenueMappings` flags home-venue mapping drift without mutating data.
- 2026-06-19: Shipped manual calendar-event creation schema hardening. `/api/calendar-events` POST now validates manual event payloads through one Zod schema before date normalization and create/audit writes.
- 2026-06-19: Shipped the venue mapping audit surface. Settings > Venue Mappings now shows read-only diagnostics for missing home-venue mappings, stale inactive/missing mapping targets, and home-looking mappings that point at non-home locations.
- 2026-06-19: Shipped the Schedule data-quality queue. Schedule health now flags visible events with missing sport/opponent/venue mapping context, future archived status, or shifts without sport metadata, and `/schedule?queue=data-quality` filters review to those events.
- 2026-06-19: Shipped event identity normalization. Calendar sync, manual event creation, event edits, event revert, and Schedule title rendering now share opponent/venue cleanup while preserving raw calendar venue evidence and pickup-location separation.

---

## Recently Archived: Plan 014, Plan 018, and iOS picker reconciliation (2026-06-19)

Archived to `tasks/archive/completed-2026-06/plan-014-018-020-023-reconciliation-2026-06-19.md`:

- Plan 014 kiosk checkout completion conflict reconciliation.
- Plan 018 resumed kiosk pickup progress reconciliation.
- Plan 020 iOS booking picker display-aligned sort.
- Plan 021 iOS booking picker bulk photos.
- Plan 022 iOS picker category grouping design spike.
- Plan 023 iOS picker category grouping implementation.

---

## Recently Completed: Plan 005 AppTabView split (2026-06-19)

- Split native Profile, Notification Settings, Account Security, Account Avatar, and Availability views out of `ios/Wisconsin/Views/AppTabView.swift`.
- Kept `AppTabView.swift` scoped to stable tab shell and push routing, with no tab label, tag, badge, or role-gating changes.
- Final proof lives in `plans/005-split-ios-app-tab-view.md`.

---

## Recently Completed: Plan 013 CreateBookingSheet split (2026-06-19)

- Split native reservation creation into focused `ios/Wisconsin/Views/CreateBooking/` files for view model logic, event-linking views, selected equipment rows, form rows, and pickers.
- Kept `CreateBookingSheet.swift` scoped to the Details, Equipment, Confirm flow, scanner presentation, submit handling, and view-model wiring.
- Final proof lives in `plans/013-split-ios-create-booking-sheet.md`.

---

## Recently Completed: Plan 011 iOS avatar consolidation (2026-06-19)

- Routed Profile, User detail, Schedule assignment, Users, Booking rows, Event detail crew, and reservation requester avatars through `UserAvatarView` or its thin current-user wrapper.
- Preserved tone-aware fallback colors for role/profile contexts and gray fallback treatment for assignment rows.
- Final proof lives in `plans/011-consolidate-ios-avatar-rendering.md`.

---

## Recently Completed: Plan 017 iOS kiosk checkout error path (2026-06-19)

- Routed native kiosk checkout completion through `KioskAPI.perform` while preserving the current event, purpose, due-back, and cart payload.
- Added source-contract coverage so the method cannot fall back to direct `session.data(for: req)` response handling.
- Final proof lives in `plans/017-ios-kiosk-complete-unify-error-path.md`.

---

## Recently Completed: Plan 050 iOS reservation showtime polish (2026-06-19)

- Aligned native reservation event titles to sport-code `vs`/`at` naming and stopped event venue from silently becoming pickup location.
- Kept counted item families in the same Equipment flow as serialized assets, with thumbnail slots in the picker and review.
- Final proof lives in `plans/050-ios-booking-showtime-polish.md`.

---

## Recently Completed: Plan 043, 049, and 051 reconciliation (2026-06-19)

- Reconciled the three plans that were already shipped on main but lacked individual closeout metadata.
- Checked done criteria and added review notes for available-only derived status filtering, quantity add-to-existing unit-family protection, and Brother battery label CSV tracking.
- Closed the stale plan-ledger TODO summary in `plans/README.md`.

---

## Recently Archived: completed ownership passes (2026-06-19)

Archived to `tasks/archive/completed-2026-06/`:

- Booking creation ownership pass.
- Scan ownership pass.
- Reports ownership pass.
- Trade Board ownership pass.

---

## Recently Archived: completed root cleanup batch (2026-06-19)

Archived to `tasks/archive/completed-2026-06/`:

- Kit detail design-language pass.
- Kiosk gate pending-pickup plan.
- iOS schedule/trade control clarity plan.
- Web interface audit plan.
- Web bug sweep ledger.
- April sprint plan.

---

## Recently Archived: Codex PR and plan orchestrator starting slice (2026-06-18)

Archived to `tasks/archive/completed-2026-06/orchestrator-starting-slice-2026-06-18.md`:

- Created the read-only orchestrator ledger and classified PR #349, PR #353, and PR #324.
- Added reusable builder, dependency-builder, reviewer, and verification-only prompt contracts.
- Ran the first revived PR pilot and kept the recurring wake-up policy manual-first.
- Rechecked PR #324 and preserved the close recommendation behind explicit approval.
- Converted dependency PR audit blockers into the now-archived dependency hardening slice.

## Recently Archived: dependency audit hardening (2026-06-18)

Archived to `tasks/archive/completed-2026-06/dependency-audit-hardening-2026-06-18.md`:

- Cleared the mandatory high audit gate by updating lockfile resolution for `vitest`, `vite`, `ws`, and related transitive dependencies.
- Fixed CI placeholder env scope so `npm ci` can run `postinstall` before audit, tests, and build.
- Allowed only `dependabot[bot]` through Claude Code review.
- Reconciled source-contract tests to current iOS/kiosk/event contracts.
- PR #349 and PR #353 are superseded by this local hardening slice once shipped; PR #324 was closed after explicit approval.

---

## Recently Archived: completed Schedule, iOS, and kiosk custody slices (2026-06-18)

Archived to `tasks/archive/completed-2026-06/active-queue-cleanup-2026-06-18.md`:

- Schedule crew UI trim pass.
- Schedule event editing clarity pass.
- Schedule first-class UI polish pass.
- iOS Schedule all-day display correction.
- Kiosk all-day fallback correction.
- Dashboard upcoming event title cleanup.
- iOS kiosk all-day call-time cleanup.
- Laowa 10mm item detail crash trace.
- Event all-day call-window display cleanup.
- Kiosk-only custody contract.

---

## Recently Archived: completed 2026-06-15 Kiosk/iOS follow-ups (2026-06-18)

Archived to `tasks/archive/completed-2026-06/kiosk-ios-followups-2026-06-15.md`:

- iOS hand-scanner debugger.
- Kiosk activation reset fallback.
- Wiscard profile capture.
- Kiosk numbered battery scanner hardening.
- Kiosk checkout event context.
- Kiosk iOS UI consolidation and brand polish.

The 2026-06-12 kiosk pickup scan follow-up is now archived after live database smoke and cleanup proof.

---

## Recently Archived: Kiosk pickup live smoke follow-up (2026-06-18)

Archived to `tasks/archive/completed-2026-06/kiosk-pickup-live-smoke-followup-2026-06-18.md`:

- [x] Split the live pickup smoke out of the completed 2026-06-12 kiosk cleanup bundle.
- [x] Preserve the completed enum/schema proof from the post-deploy check.
- [x] Get explicit approval to create a disposable live pickup fixture.
- [x] Run an authenticated kiosk pickup scan against live database data and clean up disposable data.

### Review
- 2026-06-18: The schema side is already proven live: migration health is clean, `scan_events.phase` is `ScanPhase`, and the typed comparison that previously failed now succeeds. No live pickup fixture currently exists, so the remaining smoke is carried as an explicit follow-up instead of mutating live data implicitly.
- 2026-06-18: Fixture-backed live database smoke passed through local kiosk HTTP routes. A successful serialized pickup scan wrote scan event `cmqkb0ic80001kvdlqt57up29` with `phase = CHECKOUT`; pickup confirmation completed source reservation `cmqkb0dwf0005kvp65stk1ove` and opened checkout `cmqkb0kem0008kvdlx6k7zuwe`. Cleanup evidence showed zero leftover disposable bookings, kiosk devices, users, or scan events.

---

## Recently Archived: completed 2026-06-12 kiosk bundle (2026-06-18)

Archived to `tasks/archive/completed-2026-06/kiosk-2026-06-12-cleanup.md`:

- Kiosk pickup scan 500 and kiosk UI pass, with live pickup smoke carried forward.
- Kiosk dashboard final polish.
- Kiosk iPad activation and idle polish.
- Always-on kiosk session persistence and standby display.

---

## Recently Archived: completed roadmap intake and project cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/roadmap-and-project-cleanup-2026-06-12.md`:

- Roadmap ideas intake from 2026-06-12.
- Project folder cleanup from 2026-06-12.

---

## Recently Reconciled: iOS booking event linking and showtime polish (2026-06-11)

Plan: `tasks/archive/completed-2026-06/ios-booking-event-linking-polish-plan.md`

- [x] Add native event linking to reservation creation.
- [x] Refresh the three-step iOS booking UI for showtime.
- [x] Add focused tests and doc sync.
- [x] Run the iOS verification stack and record results.

### Review
- 2026-06-11: Native reservation creation now links up to 3 upcoming events, submits `eventIds[]`, preserves event-detail prefill behavior, and has cleaner Apple-style Details/Equipment/Confirm context.
- 2026-06-11: Verification passed with focused iOS source tests, whitespace check, iOS drift check, iOS gap audit, and XcodeBuildMCP simulator build. TypeScript remains blocked by the unrelated pre-existing conflicted `tests/booking-create-ux.test.ts`.

---

## Recently Reconciled: iOS Scan bulk unit QR resolution (2026-06-11)

Plan: `tasks/archive/completed-2026-06/ios-scan-bulk-unit-qr-plan.md`

- [x] Decode `/api/assets` item-family `bulkItems` in native iOS.
- [x] Render resolved numbered battery unit results in Scan instead of "Nothing found."
- [x] Add focused contract coverage and sync docs.
- [x] Run focused tests and iOS verification.

### Review
- 2026-06-11: Native Scan/global search now decode `/api/assets.bulkItems`, render item-family battery results with scanned unit context, and keep reservation scan-to-add explicit by directing item-family matches back to quantity controls.
- 2026-06-11: Verification passed with focused Vitest tests, iOS drift check, iOS gap audit, whitespace check, and escalated iOS Simulator build. `npx tsc --noEmit` remains blocked by unrelated `tests/bulk-unit-adjustment-routes.test.ts:171`.

---

## Recently Archived: completed search and B&H image cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/search-and-bhphoto-cleanup-2026-06-10.md`:

- Ambient quick search type-to-search removal from 2026-06-10.
- B&H asset image picker fix from 2026-06-10.

---

## Release Status

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

### Recently Archived: item info and identity firmware cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/item-info-identity-firmware-cleanup-2026-06-10.md`:

- Item Info Sidebar Hardening from 2026-06-10.
- Item Detail Identity Firmware Refresh from 2026-06-10.

### Recently Archived: item detail firmware cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/item-detail-firmware-cleanup-2026-06-10.md`:

- Item Detail Firmware Badge from 2026-06-10.
- Item Detail Firmware Display from 2026-06-10.

### Recently Archived: firmware watch cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/firmware-watch-cleanup-2026-06-10.md`:

- Firmware Watch Daily Notifications from 2026-06-10.
- Firmware Watch Inventory Seed Follow-up from 2026-06-10.

### Recently Archived: add item and QR cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/add-item-qr-cleanup-2026-06-10.md`:

- Add Item Flow Quick Fixes from 2026-06-10.
- QR Code Generation Simplification from 2026-06-10.

### Recently Archived: iOS settings cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-settings-cleanup-2026-06-10.md`:

- iOS Settings Detail Menus Slice from 2026-06-10.
- iOS Settings First-Class Slice from 2026-06-10.

### Recently Archived: booking flow and notification category cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/booking-flow-notification-category-cleanup-2026-06-10.md`:

- Booking Flow Follow-up from 2026-06-10.
- iOS Notifications Category Parity Slice from 2026-06-10.

### Recently Archived: iOS notifications token and tap-through cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-notifications-token-tapthrough-cleanup-2026-06-10.md`:

- iOS Notifications Token Honesty Slice from 2026-06-10.
- iOS Notifications Tap-Through Slice from 2026-06-10.

### Recently Archived: iOS notifications audit and runtime cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-notifications-audit-runtime-cleanup-2026-06-10.md`:

- iOS Notifications Audit from 2026-06-10.
- iOS Runtime Warning Cleanup from 2026-06-09.

### Recently Archived: Internal Public Beta Launch Readiness (2026-06-18)

Archived to `tasks/archive/completed-2026-06/internal-public-beta-launch-readiness-2026-06-08.md`:

- Completed onboarding hardening, no-temp-password beta pivot, production env checks, launch data prep, production/authenticated browser smoke, iOS beta gate, and the one-page beta runbook.
- Created release follow-up `tasks/internal-public-beta-release-cut-followup.md` because `npm run release` requires a clean worktree and creates a version commit, tag, push, and GitHub Release.

### Recently Archived: iOS HIG and schedule trade cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-hig-schedule-trade-cleanup-2026-06-05.md`:

- iOS HIG and iOS 27 Readiness from 2026-06-05.
- iOS Schedule Detail and Trade Control Clarity from 2026-06-03.

### Recently Archived: iOS create booking and profile clarity cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-create-booking-profile-clarity-cleanup-2026-06-03.md`:

- iOS Create Booking Control Clarity from 2026-06-03.
- iOS Profile Controls Clarity from 2026-06-03.

### Recently Archived: iOS booking detail and items clarity cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-booking-detail-items-clarity-cleanup-2026-06-03.md`:

- iOS Booking Detail Control Clarity from 2026-06-03.
- iOS Items Control Clarity from 2026-06-03.

### Recently Archived: iOS schedule and tabs clarity cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/ios-schedule-tabs-clarity-cleanup-2026-06-03.md`:

- iOS Schedule Control Clarity from 2026-06-03.
- iOS Tabs And Buttons Readiness from 2026-06-03.

### Recently Archived: Onboarding Flow Plan (2026-06-18)

Archived to `tasks/archive/completed-2026-06/onboarding-flow-plan-2026-06-03.md`:

- Shipped the bulk-capable invitation lifecycle with allowlist security and D-037.
- Unified Users and Settings onboarding around invite-first bulk and one-email flows.
- Added onboarding status follow-up, registration prefill, and iOS forced-password setup.
- Retired first-time temporary-password onboarding for beta.
- Closed Slice 7 with focused onboarding/API/source verification and plan archival.

### Recently Archived: booking create cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/booking-create-cleanup-2026-05-30.md`:

- Booking Create UX Ownership Pass from 2026-05-30.
- Booking Create Hardening from 2026-05-30.

### Recently Archived: May major completed work cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/may-completed-major-work-cleanup-2026-05-21.md`:

- Global Search MVP Hardening through Damage Report Photos + Avatar Polish.
- Includes design language, settings, product image search, resources, schedule, dashboard, bulk families, badges, reports, API hardening, and security patch completed sections.

### Active Backlog Index (2026-05-06)
- [x] **Next recommended slice: Admin Fix Today queue** — Shipped `/admin/fix-today` as an admin-only read queue for overdue gear, pending pickup handoffs, offline kiosks, flagged maintenance items, low batteries, calendar sync failures, and license expirations.
- [x] **Battery follow-through** — Shipped the explicit kiosk battery scan step: typed numbered-battery rows and scan-summary counts in checkout detail, plus dedicated iOS pickup/return battery progress cards.
- [ ] **Admin helpers** — Remaining helper slices moved to `tasks/admin-helper-followups.md`: kiosk admin follow-through, people offboarding, exception review, renewal/expiry calendar, and morning digest.
- [ ] **Ops V2/V3 deferred work** — Keep inventory health, attachment slot schema, templates/presets, and database-configurable equipment guidance behind slice plans.
- [ ] **Low-priority systemic gaps** — Keep generic SystemConfig UI and mobile staff parity visible but behind daily-ops work.

### Recently Archived: Bulk Battery Hardening cleanup (2026-06-19)

Archived to `tasks/archive/completed-2026-06/bulk-battery-hardening-cleanup-2026-05-05.md`:

- Numbered battery kiosk pickup/check-in scans, kiosk client labels, Battery Unit Cockpit, mismatch polish, compatibility lows, explicit battery scan progress, booking-create battery guidance, attachment management polish, battery audit/reporting, and bulk battery item hardening are shipped.
- Remaining future work moved to `tasks/bulk-battery-followups.md`: kiosk admin override visibility, optional gear suggestions, inventory health dashboard, attachment slot schema decision, templates/presets, and database-configurable equipment guidance.

### Recently Archived: May post-backlog UI and item cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/may-post-backlog-ui-item-cleanup-2026-05-07.md`:

- Avatar + shadcn Cleanup through Derived Bulk Unit QR Scans.

### Recently Split: Admin helper and low-priority systemic follow-ups (2026-06-19)

Moved to `tasks/admin-helper-followups.md`:

- Shipped helpers: Admin Fix Today queue, Battery unit cockpit, Inventory hygiene center, and pending-pickup auto-expiry.
- Remaining helper slices: kiosk admin follow-through, People offboarding assistant, Admin exception review, Renewal and expiry calendar, and Admin-only morning digest.
- Remaining low-priority systemic follow-ups: generic SystemConfig admin surface and mobile staff parity review narrowed to GAP-34 and GAP-36.

### Recently Archived: Codex readiness and legacy tail cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/codex-readiness-legacy-tail-cleanup-2026-05-05.md`:

- Codex Readiness and completed legacy Reservations, Users, Known Bugs, Scan Flow, and Phase B entries.

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)

---

### Recently Archived: Wins Sprint cleanup (2026-06-18)

Archived to `tasks/archive/completed-2026-06/wins-sprint-cleanup-2026-04-30.md`:

- Wins Sprint from 2026-04-30.
