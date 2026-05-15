# Task Queue

Last updated: 2026-05-14

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

### Trade Board UX/UI Ownership Pass (2026-05-14)
- [x] **Plan:** Audit the current Trade Board against docs, schema, API routes, service behavior, and peer schedule list patterns.
- [x] **Scenarios:** Work through student open/own trade flows, staff claimed-trade review, filters, empty/error states, duplicate clicks, and invalid API filters.
- [x] **Implementation:** Tighten the sheet layout, status language, event/shift context, visible notes/approval context, action states, and API filter validation.
- [x] **Verification:** Run focused trade tests, static checks, production build, and a browser smoke of the Trade Board sheet.

**Review**
- Trade Board now uses compact card rows that fit the right-side sheet instead of a dense six-column table.
- Rows show cleaned schedule titles, shift time, area, approval mode, poster/claimer, notes, and clearer status helper text.
- The normal Schedule list `Trade` shortcut now opens a notes dialog before posting, so the board's note field has a real lightweight entry path outside the full event detail sheet.
- Stale open/claimed trades whose shifts have already started are no longer postable, claimable, approvable, listed as actionable, or counted in the Schedule header badge.
- Trade Board rows now receive opponent and home-away event fields from the API, so their titles use the same cleanup rules as the rest of Schedule.
- Student actions focus on claiming and cancelling their own posts; staff/admin actions focus on approve/decline for claimed trades.
- Mutation handlers now clean up on auth redirects/network failures and use a ref-backed guard against duplicate submits.
- The trade list API now rejects invalid `status` and `area` filters with 400s before querying.
- Verified with focused trade tests, TypeScript, migration-prefix check, whitespace check, and production Next build. Codex browser reached the local dev server and redirected to `/login` without console errors; authenticated sheet review is available on `http://127.0.0.1:3012`.


### Schedule Browser UI Prototype (2026-05-14)
- [x] **Normal schedule hierarchy:** Promote `Assign shifts` as the primary staff action, quiet repeated open-slot badges, and move `Next call` to the first readiness card.
- [x] **Verification:** Browser-check `/schedule`, run focused static checks, and ask for feedback before changing schedule subpages.

**Review**
- `Assign shifts` is now the primary staff/admin action in the Schedule header.
- `Needs staff` remains a filter control, but no longer repeats the count already shown in the readiness strip.
- `Next call` now leads the readiness strip and gets stronger visual treatment.
- The list header now shows the event count only; open-slot totals live in the readiness strip and per-row needs chips.
- Normal schedule rows now use Staff as the generic open-slot label and derive expanded-row Staff/Student labels from the assigned user's role.
- Per-row `Needs ... staff` chips now match the smaller row-badge scale instead of reading louder than coverage badges.
- Rows assigned to the signed-in user now get a subtle primary tint instead of an `Assigned`/`Confirmed` badge; pending requests still keep their badge in My Shifts context.
- Follow-up naming pass: generic schedule coverage copy now uses Staff/covered language, while expanded assignment rows stay role-aware.
- Expanded assignment rows now have a same-area plus action, quieter empty assign rows without dashed boxes, and a hover/focus X for staff/admin assignment removal.
- Hide-event hardening shipped: the visibility API now validates a strict boolean payload, wraps the event update and audit log in one transaction, blocks malformed body drift, shows row-level hiding state, and offers Undo from the hide success toast.
- Assign page polish shipped: `/schedule/assign` now uses the shared schedule title cleanup and venue-tone derivation, trims imported `[N]`/Wisconsin prefixes, shows venue and filled/open slot context in the sticky event column, and uses quieter assignment/no-slot cells with hover remove overlays.
- Assign page area-slot cleanup shipped: the grid no longer has Staff/Student sub-sections, each area column now owns all of its slots, and staff/admin users can add a slot or remove an empty slot inline.
- Assign page current-work cleanup shipped: the grid now follows the normal Schedule list default by showing only active events from today forward, removes past rows and archived shift groups from the current assignment workflow, disables navigation into fully past months, replaces repeated `Add slot`/`Open` text controls with quieter row-style affordances, and uses compact overlapping avatar stacks for assigned people.
- Assigned avatars now use app-styled hover tooltips for names and a small explicit hover/focus X for removal, so the whole avatar is no longer the destructive target.
- Direct assignment now syncs shift worker type from the assigned user's role, keeping the hidden `FT`/`ST` data aligned with the Staff/Student labels derived in the UI.
- Event titles now share one formatter across list, week, and calendar views; matchup text stays primary while dash-suffix event context moves to smaller secondary text.
- Venue indicators now use one shared treatment: Home green, Away orange, Neutral gray. The dashboard Upcoming Events control now includes a Neutral tab.
- Follow-up hardening audit resolved: `/schedule/assign` is now server-gated for staff/admin, assignment mutations use ref-backed duplicate-submit guards with success feedback, and calendar/shift date APIs reject invalid or inverted dates with 400 responses.
- Normal `/schedule` peer pass resolved the remaining current findings from the older audit: inline assignment success feedback, shared week-start math, direct trade-count refetching, stale helper removal, and tokenized conflict colors.
- Follow-up verified with focused Vitest coverage, TypeScript, migration-prefix check, whitespace check, and production Next build.
- Verified with `npx tsc --noEmit`, `git diff --check`, and a live `/schedule` browser refresh with no console warnings or errors.

### Dashboard Browser UI Prototype (2026-05-14)
- [x] **Plan:** Use the live browser audit to prototype a narrower Dashboard visual pass without changing API behavior.
- [x] **Header:** Quiet the refresh/filter controls and keep checkout/reservation creation as the clear primary actions.
- [x] **Stats:** Reduce the weight of zero-value metrics and make nonzero action states easier to spot.
- [x] **Rows/empty states:** Compress empty personal sections and strengthen the active booking row affordance.
- [x] **Verification:** Check the updated Dashboard in browser, run focused static checks, and ask for product feedback before touching the next page.

**Review**
- Prototype only: no API, permission, schema, or booking action behavior changed.
- Header groups refresh/filter as secondary controls and makes `New checkout` the stronger primary action.
- Zero metric cards are quieter, while nonzero metric cards keep stronger foreground treatment and visible link affordance.
- Empty personal gear state is one compact card with direct reserve/check-out actions instead of two tall empty sections.
- Booking rows keep their compact height with a subtle open affordance on hover/focus.
- Follow-up correction: My Gear empty states now use a medium-height centered body, between the original compact row and the larger Team Activity empty cards.
- My Gear reservation rows now use the same purple reservation rail as other reservation rows.
- My Gear checkout rows now use the same blue checkout rail as other checkout rows.
- Verified with `npx tsc --noEmit`, `git diff --check`, and live browser refresh of `/` with no console warnings or errors.

### Focused UI Opportunity Audit (2026-05-14)
- [x] **Plan:** Audit current docs, task notes, route surfaces, and shared UI patterns before choosing any implementation slice.
- [x] **Inventory:** Review all signed-in web surfaces for concrete layout/functionality polish opportunities.
- [x] **Rank:** Produce a repo-grounded short list of focused UI improvement slices with source evidence and suggested verification.

**Review**
- Best next slice: fix booking deep-link/workflow drift first (`sheetTab` ignored, sport filter options derived from current page only, event CTAs detour through list redirects).
- Strong cross-cutting follow-ups: settings/global command-palette collision, duplicate offline banners, settings role-nav flicker, and PageHeader action wrapping at compact widths.
- Strong specialized follow-ups: kits detail item-family add/remove completion, Missing Units filters, Guides body-search parity, and item-family detail tab normalization.

### Bulk Item Families Follow-Through (2026-05-13)
- [x] **Labels parity:** Include item-family parent/bin QR labels in the global print-label queue alongside serialized item labels.
- [x] **Admin/report copy:** Replace remaining normal-user-facing SKU/bulk wording in touched Battery Ops, item-family settings, and missing-unit reporting surfaces.
- [x] **Report naming:** Rename the report tab to Missing Units so staff see the operational problem, not item-family jargon.
- [x] **Creation naming:** Change Add Item tracking choices to Standard, Units, and Quantity with examples, and keep list/picker rows focused on availability instead of type badges.
- [x] **Detail naming:** Polish item-family details so availability, unit grids, QR, settings, and status actions read as normal item detail language with Missing instead of Lost where the UI describes staff follow-up work.
- [x] **Battery Ops naming:** Align Battery Ops and Missing Units report with Missing and Units language instead of Lost, numbered, or implementation-heavy terms.
- [x] **Ops navigation naming:** Rename the admin battery surface to Battery Ops and the item-family operations handoff to Stockroom view.
- [x] **Booking picker guidance:** Recommend compatible battery families from selected cameras, label item-family quantities as requested, and keep exact unit binding at kiosk pickup.
- [x] **Scan lookup polish:** Show exact unit QR scans inside the parent item-family context with explicit unit status and checkout custody details, while keeping app scan lookup-only.
- [x] **Kiosk battery clarity:** Make native kiosk pickup/return battery progress show required/scanned unit counts, exact scanned unit chips, and disabled-confirm guidance.
- [x] **Doc sync:** Update bulk inventory, reports, and the bulk item families plan with the follow-through outcome.
- [x] **Verification:** Run TypeScript, migration-prefix check, whitespace check, and app build.

**Review**
- Naming is now centered on Missing Units for the report surface, battery families for low-stock operations, and item-family/unit language where the UI still needs the family model.
- Add Item now maps Standard to serialized assets, Units to numbered/scannable item families, and Quantity to count-only item families.
- Item-family detail pages now use normal item wording, compact tracking labels, QR copy without web-print assumptions, and Missing language for unit exception states.
- Battery cockpit and Missing Units report now describe battery families using Units and missing-unit events without exposing old numbered/lost wording.
- The admin nav now says Battery Ops, and `/items/bulk-{id}` points staff toward a Stockroom view instead of generic admin operations.
- Booking picker guidance now supports the "request quantity now, scan exact units at pickup" model for battery families.
- App scan exact unit QR results now show the parent item family, unit number, Missing/Checked out/Available status, and checked-out custody context when present.
- Native kiosk pickup and return now show battery unit progress as required/scanned counts, exact scanned/returned unit chips, and clearer disabled pickup-confirm copy when unit scans are still missing.
- Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`.

### iOS Home Event Queue Cleanup (2026-05-13)
- [x] **Header cleanup:** Remove the debug Kiosk button from iOS Home, move Profile to the top-left toolbar, and leave notifications on the top-right.
- [x] **Queue controls:** Remove the inline create button from the Next Up card and remove the shift row calendar shortcut.
- [x] **Freshness placement:** Move the "Updated now" signal into the stat strip so it reads as metadata for the numbers, not a stray page element.
- [x] **Event core model:** Add a dashboard `myEventWork` payload that ties a user's event shift to gear through primary event, `BookingEvent`, and shift-assignment links.
- [x] **Event grouping:** Render event-linked shift and gear work as one Home queue row and suppress the linked standalone gear rows.
- [x] **Event detail:** Open one event page from Home with shift call time and gear reservation or reserve-now action together.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace checks, and the Wisconsin simulator build.

**Review**
- Dashboard booking summaries now include all linked event IDs, and `/api/dashboard` exposes `myEventWork` as the event-centric source of truth for a user's shift plus gear.
- Home keeps the bottom-right create action, removes duplicate card-level create and shift calendar buttons, and moves sync freshness into the stat strip as "Synced now" metadata.
- Combined event rows now suppress every event-linked gear booking and show student-facing sublines like "Pickup gear at 10:00 AM" plus "Call time at 10:30 AM"; if no reserved gear exists, the row says "Reserve gear now."
- Event detail now carries the same event work context so the gear action and call time live on one page instead of sending students to separate shift and booking views.
- Follow-up fix: iOS dashboard decoding now defaults new event-linkage fields when the app talks to a server that has not deployed the new `myEventWork` payload yet.
- Verification passed with `npx tsc --noEmit`, `npm run drift:ios`, `npm run audit:ios:gaps`, scoped `git diff --check`, the Wisconsin iOS simulator build, and compile-only `npx next build`.

### Battery Audit Reporting (2026-05-13)
- [x] **GAP-37:** Missing Units now reports unit-tracked battery missing units by unit number, missing rate by family, recent checkout history, and repeated missing family/requester patterns.
- [x] **Shared battery detection:** Battery cockpit and report aggregation now use the same term-boundary SKU matcher.
- [x] **Verification:** Focused report service coverage and TypeScript passed before closeout.

**Review**
- `tasks/archive/battery-audit-reporting-plan.md` tracks the one-slice implementation and doc sync.
- `docs/GAPS_AND_RISKS.md` closes GAP-37 with the shipped Missing Units reporting behavior.

### Gap Reliability Closure (2026-05-13)
- [x] **GAP-58:** Kiosk dashboard now uses partial-result fallbacks instead of failing the idle screen when one read fails.
- [x] **GAP-54:** Deleted the unscheduled `archive-shifts` cron route and documented `morning-refresh` as the single scheduled shift-archive path.
- [x] **GAP-33:** Morning-refresh auto-expires stale pending-pickup checkouts after 48h with allocation, bulk-stock, numbered-unit, scan-session, and system-audit cleanup.
- [x] **Verification:** Run focused tests, TypeScript, migration checks, full build, and doc sync.

**Review**
- `tasks/gap-reliability-plan.md` tracks the three-slice implementation.
- `docs/GAPS_AND_RISKS.md` closes GAP-33, GAP-54, and GAP-58 with the shipped behavior.

### Prisma + Neon Health Runbook (2026-05-13)
- [x] **Replace raw status:** Route `npm run db:migrate:status` through the repo's Neon-backed health checker instead of raw `prisma migrate status`.
- [x] **Add explicit health command:** Add `npm run db:migrate:health` to compare local migration folders with live `_prisma_migrations`.
- [x] **Fail on drift:** Flag pending local migrations, unresolved failed rows, applied DB-only migrations, and newest-local-not-applied state.
- [x] **Document operations:** Add a Prisma + Neon runbook covering `DATABASE_URL`, `DIRECT_URL`, deploy, health, and recovery rules.

**Review**
- Migration status now uses the same source of truth as production recovery: direct Neon inspection through `DIRECT_URL`.
- The health checker is import-safe and covered by focused regressions for clean, pending, failed, DB-only, and rolled-back migration history.
- `docs/PRISMA_NEON_RUNBOOK.md` is the short operational reference for future schema and deploy work.

### Prisma + Neon Cleanup (2026-05-12)
- [x] **Retire one-off migration helpers:** Delete superseded `scripts/apply-migration-0042.mjs`, `0059`, `0060`, and `0061` now that the shared deploy wrapper owns fallback behavior.
- [x] **Tighten fallback safety:** Require `DIRECT_URL` for Neon HTTP migration fallback instead of allowing DDL through pooled `DATABASE_URL`.
- [x] **Cover SQL splitting:** Add focused regression coverage for quoted semicolons, comments, and dollar-quoted blocks in the migration wrapper.
- [x] **Refresh stale notes:** Update active task notes that still said `npm run build` was blocked by Prisma's schema engine.

**Review**
- The migration fallback is now import-safe and testable, with `splitSqlStatements` exported for focused coverage.
- `DIRECT_URL` is mandatory for fallback migration execution. `DATABASE_URL` remains the pooled runtime URL.
- Old migration-specific recovery scripts are gone, so future deploy recovery has one supported path.

### Admin User Photo Management (2026-05-12)
- [x] **UI access:** Let admins open the existing profile-photo menu on any user detail page, while preserving self-service upload for the signed-in user.
- [x] **Permission contract:** Keep the avatar API admin-only for other users and prove staff cannot change another user's photo.
- [x] **Docs and verification:** Sync Users docs and run focused avatar route tests plus TypeScript/whitespace checks.

**Review**
- User detail profiles now render the photo upload/remove menu for the signed-in user or any admin. Staff still see a read-only avatar when viewing someone else.
- `/api/users/[id]/avatar` keeps the other-user mutation boundary admin-only, with dead staff-target role checks removed and clearer profile-photo error wording.
- Focused coverage proves admins can upload/remove another user's profile photo and staff cannot. Verified with `npx vitest run tests/user-avatar-route.test.ts`, `npx tsc --noEmit`, `git diff --check`, and `npm run build`.

### Prisma + Neon Migration Reliability (2026-05-12)
- [x] **Diagnose current failure:** Confirm schema validation and migration prefix checks pass while Prisma DB-facing commands still hit the blank schema-engine error against Neon.
- [x] **Align config with Neon guidance:** Add explicit Prisma config and document pooled runtime vs direct migration URLs.
- [x] **Build-safe migration deploy:** Keep normal `prisma migrate deploy` first, with a Neon HTTP fallback for the known blank schema-engine failure.
- [x] **Verification:** Apply the pending migration, prove Neon migration history is current, and run build-safe checks.

**Review**
- Added `prisma.config.ts` so Prisma CLI uses the direct Neon URL for migration work, while app runtime keeps using the pooled `DATABASE_URL`.
- Added `scripts/prisma-migrate-deploy.mjs` and wired `build`, `migrate`, and `db:migrate:deploy` through it. The wrapper runs standard `prisma migrate deploy` first and only falls back to Neon HTTP when Prisma exits with the known blank schema-engine failure.
- Applied pending migration `0065_add_booking_completed_at` through the fallback. Neon now has `_prisma_migrations.finished_at` for `0065_add_booking_completed_at`, and `bookings.completed_at` exists as a nullable timestamp.
- Verified with `npx prisma validate`, `node --check scripts/prisma-migrate-deploy.mjs`, `npm run db:migrate:check`, idempotent `npm run db:migrate:deploy`, direct Neon inspection, and full `npm run build`.

### iOS Staff TestFlight Feedback Fixes (2026-05-12)
- [x] **Home ownership:** Keep Home's number strip global, but make Home action rows show only the signed-in user's shifts, checkouts, pickups, and reservations.
- [x] **Home controls:** Remove row icons from the Home queue, move profile to the top right, and put creation behind a bottom-right action button.
- [x] **Schedule student fit:** Keep students out of past-event browsing and staff creation/crew setup controls.
- [x] **Navigation feel:** Reset tab-local stacks/filters where expected when users reselect a tab, while preserving native back buttons and swipe-back.
- [x] **Scan reliability:** Stop QR scans from opening the same item page twice.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace checks, and the Wisconsin simulator build.

**Review**
- Home now keeps the existing top metrics, but the action queue is personal: overdue/due checkouts, pickups requested by the signed-in user, their reservations, and their shifts.
- Home rows use tone rails instead of ambiguous calendar icons, the profile/avatar action moved to the top right, and booking creation now lives in the bottom-right action button above the tab bar.
- Schedule hides the past-events toggle from students and resets it off for student sessions, while staff/admin users keep the historical browsing control.
- Reselecting tabs now clears local navigation and filters on Home, Bookings, Items, Scan, Schedule, and Users, without disabling the native navigation back button or swipe-back gesture.
- Scan now dedupes repeat QR callbacks in both the sheet-level scanner and the Scan tab lookup flow, so the same sticker does not push the item page twice.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npm run drift:ios`, `npm run audit:ios:gaps`, and the Wisconsin iOS simulator build.

### Awards Collection UI (2026-05-12)
- [x] **Collection shelves:** Rework the web profile badge tab from a flat gallery-first layout into Apple Fitness-inspired award collection shelves.
- [x] **Artifact medallions:** Upgrade the shared badge medallion into a reusable CSS/SVG award object with rarity finish, clean rim, locked state, and category shape options.
- [x] **Category drill-in:** Let users open a collection to browse that award family with existing earned/locked/manual/rare filters and badge detail modal.
- [x] **Docs and verification:** Sync badge docs and run TypeScript, whitespace, app build, and local browser smoke where auth allows.

**Review**
- The web profile Badges tab now opens as an awards collection shelf instead of a flat gallery. Gear Flow, Reliability, Scans, Teamwork, and Staff Picks each show a featured award artifact, preview stack, earned/visible counts, and Show all affordance.
- Opening a collection shows the existing browsable award grid with all, earned, locked, manual, and rare filters plus the current detail modal, so the Apple Fitness structure does not remove operational metadata.
- Shared `BadgeMedallion` now renders a CSS/SVG award artifact with category shapes, a clean rim, locked grayscale state, rarity finish, and scalable icon sizing. The first browser pass removed busy internal linework because it competed with the glyph.
- Closeout audit fixed stale `RETURN` category handling to the shipped `ON_TIME` schema category on web and iOS, and added a regression proving shift request approval does not emit shift badge completion.
- Verified with focused badge/shift tests, `npx tsc --noEmit`, `git diff --check`, `npx next build`, iOS drift/audit checks, and the Wisconsin iOS simulator build.
- Browser smoke found the existing 3000 and 3001 servers were stale, so a temporary clean server on 3010 was used. `/users?tab=badges` compiled and redirected to `/login` with no Chrome console warnings or errors; no authenticated browser session was available.

### iOS Badge Gallery Polish (2026-05-12)
- [x] **Compact profile entry:** Keep the native profile badge card restrained and add a See all action.
- [x] **Full gallery sheet:** Add a native Badge Gallery sheet with all, earned, locked, manual, and rare filters.
- [x] **Expandable details:** Let users tap a badge to see title, description, earned date, source, category, rarity, trigger, note, and progress.
- [x] **Native feel:** Add rarity medallions, recent-award glow, hidden-surprise copy, and haptic feedback.
- [x] **Verification:** Run iOS drift/audit checks, scoped whitespace check, and simulator build.

**Review**
- Native User Detail now mirrors the web gallery model without turning the profile into a trophy wall. Earned badges stay in the profile card; See all opens the full gallery.
- The gallery shows visible earned and locked badges, keeps surprise badges hidden until earned, and supports filters for all, earned, locked, manual, and rare.
- Badge detail sheets expose the badge story and metadata with native SwiftUI layout and progress display where supported.
- Verified with `npm run drift:ios`, `npm run audit:ios:gaps`, `git diff --check -- ios/Wisconsin/Views/UserDetailView.swift`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

### Badge Gallery UI Polish (2026-05-12)
- [x] **Gallery model:** Replace the split earned/available badge tab with one browsable badge gallery.
- [x] **Filtering:** Add all, earned, locked, manual, and rare filters without adding a top-level nav item.
- [x] **Expandable details:** Let users open any visible badge to see title, description, earned date, source, category, rarity, note, trigger metadata, and progress.
- [x] **Special feel:** Add tactile tile interaction, subtle hover lift, recent-award "New" state, and rarity glow while keeping profile hero clean.
- [x] **Verification:** Run TypeScript, focused badge tests, build, and browser smoke.

**Review**
- The web profile Badges tab now behaves as a full gallery instead of separate earned and available lists. The gallery keeps the existing profile-first placement, adds all/earned/locked/manual/rare filters, and preserves hidden surprise badge behavior.
- Badge tiles are clickable and open a shadcn dialog with the full badge story: title, description, earned date, source, category, rarity, staff note, trigger metadata, and progress for supported locked badges.
- Visual polish added tactile press scale, hover lift, recent-award "New" treatment, and rarity-aware glow without adding badge chrome to the profile hero.
- Verified with `npx tsc --noEmit`, focused badge Vitest coverage, `git diff --check`, `npx next build`, and unauthenticated Chrome smoke of `/users?tab=badges` redirecting to `/login` with no console errors.

### iOS Badge Profile Surface (2026-05-12)
- [x] **Vercel enablement:** Add `BADGES_ENABLED=true` to Vercel Production and Development environments; Preview still needs branch-scope resolution in the Vercel CLI/dashboard.
- [x] **Native badge profile:** Add iOS badge profile models and API client support for `/api/badges/user/{id}`.
- [x] **User profile UI:** Show earned badges on native user profiles without crowding the profile header, and keep badge loading non-blocking when disabled or not visible.
- [x] **Notification routing:** Route iOS `badge_awarded` inbox rows to the awarded user's native profile.
- [x] **Verification:** Run iOS drift/audit checks and Swift build.

**Review**
- Vercel now lists `BADGES_ENABLED` in Production and Development. Preview env creation still needs Vercel branch-scope resolution because the CLI rejected both the multi-environment add and the all-preview non-interactive add with `git_branch_required`.
- Native user profiles now load badge data from `/api/badges/user/{id}` without blocking profile load if badges are disabled or hidden, and earned badges render below the profile header.
- iOS `badge_awarded` notification rows now use trophy styling and route to the awarded user's native profile through the `userId` payload.
- Verified with `npm run drift:ios`, `npm run audit:ios:gaps`, scoped `git diff --check`, and `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

### Custom Badge Awarding (2026-05-12)
- [x] **API path:** Let admins create an active custom manual badge definition while awarding a user, without schema changes or evaluator side effects.
- [x] **Award dialog:** Add a custom-badge mode to the existing user admin Award badge dialog so an admin can create "Guinea Pig" once and award it immediately.
- [x] **Catalog reuse:** Keep custom badges in the normal active catalog so the second and third staff awards can reuse the same definition.
- [x] **Docs and verification:** Sync badge docs and run focused badge tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, full tests, app build, and local browser smoke.

**Review**
- Custom badge creation is part of the existing admin-only manual award endpoint. It creates active `custom_` keyed `BadgeDefinition` rows as `MILESTONE` / `RULE` / `manual`, then awards the target user in the same manual-award flow.
- The user detail Award badge dialog now has Existing and Custom modes. A custom "Guinea Pig" badge can be created and awarded on the first staff profile, then reused from the Existing selector for the next staff profiles.
- Custom awards keep the existing manual-award audit entry, staff attribution, optional note, inbox notification, and profile badge refresh behavior.
- Verification passed with focused badge tests, full Vitest, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, and a local unauthenticated `/users` browser smoke with no console errors.

### Users Invite and Password Reset Fixes (2026-05-12)
- [x] **New-user temp password contract:** Mark Users > Add User temporary passwords as forced-change credentials and keep the allowlist record visible as claimed for directly-created staff/student users.
- [x] **Allowed-email feedback:** Stop showing "added" when the API skipped an address that is already allowlisted or registered.
- [x] **No-email reset path:** Keep admin reset password as the working direct temporary-password path while email delivery is not configured.
- [x] **Docs and verification:** Sync Users docs, add focused regressions, and run targeted auth/allowed-email/user tests.

**Review**
- `POST /api/users` now creates temp-password accounts with `forcePasswordChange: true` and atomically creates or claims a visible allowlist row for directly-created staff/student users.
- Settings > Allowed Emails now distinguishes a skipped add from a newly-created row, and newly-created single entries appear immediately while the list refreshes.
- Follow-up fix: adding an address that already has a registered user now backfills a visible claimed allowlist row when one is missing, instead of returning the skipped no-op path.
- Forgot password no longer creates unusable reset tokens or promises an email when `RESEND_API_KEY` is missing; the working recovery path is the admin-generated temporary password.
- Verified with focused Vitest coverage, `npx tsc --noEmit`, `git diff --check`, and `npx next build`.

### Item Thumbnail Reliability (2026-05-12)
- [x] **Trace current thumbnail paths:** Confirm item images flow through the shared gear thumbnail primitives and item detail header.
- [x] **Shared render fix:** Normalize item image URLs, reset failed image state on source changes, and avoid optimizer-dependent rendering for item thumbnails.
- [x] **Docs and verification:** Sync Items docs, add focused regression coverage, and run TypeScript plus focused tests.

**Review**
- Shared `AssetImage` now trims stored URLs, upgrades legacy `http://` item image sources to `https://`, resets fallback state when a row/detail image source changes, and renders item photos without relying on Next image optimization.
- `ItemThumbnailStack` now uses a real lazy image with an error fallback instead of a CSS background image that could fail silently.
- Item detail header uses the same normalization and optimizer bypass as shared thumbnails.
- Verified with `npx vitest run tests/asset-image.test.ts`, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and a local browser smoke of `/items` redirecting cleanly to `/login` with no console errors. Authenticated thumbnail visual smoke was not run because the current in-app browser session is unauthenticated.

### Security Audit and Patches (2026-05-12)
- [x] **Dependency advisory audit:** Confirm TanStack exposure, run current `npm audit --omit=dev`, and record any actionable package patches.
- [x] **App security audit:** Re-verify open auth/kiosk/cron/API risks against current source before patching.
- [x] **Patches:** Ship the smallest confirmed fixes for high-value security findings.
- [x] **Docs and verification:** Sync relevant area/risk docs and run focused tests plus build-safe checks.

**Review**
- TanStack exposure is limited to `@tanstack/react-query`, `@tanstack/react-table`, and related packages, with no compromised versions found in the current lockfile.
- Production dependency audit is clean after resolving the nested Next/PostCSS advisory with a direct dependency override and refreshed lockfile. `npm ls next postcss --depth=2` shows Next deduping to `postcss@8.5.14`.
- Package-manager cooldowns now require newly resolved npm package versions to be at least 7 days old across npm, pnpm, Yarn, and Bun project configs.
- Closed GAP-52, GAP-53, and GAP-55: forced-password users are routed to `/change-password` and blocked from regular app/API access, kiosk sessions have DB-backed server expiry, and notification cron keeps independent job successes when one job fails.
- Focused regressions passed: `npx vitest run tests/api-wrapper.test.ts tests/auth-hardening.test.ts tests/api-hardening-wave11.test.ts tests/kiosk-session-auth.test.ts tests/notification-cron.test.ts`.

### Creation Flow System (2026-05-12)
- [x] **Audit/standard:** Inventory high-impact create flows and define the shared creation-flow standard in `tasks/creation-flow-system-plan.md`.
- [x] **Items slice:** Harden the Items New asset sheet for safe submit, visible form errors, disabled controls, and explicit post-create handoff.
- [x] **Schedule/Users/Kits/Settings propagation:** Standardize the next high-impact create surfaces without converting simple forms into wizards.
- [x] **Docs:** Sync `AREA_ITEMS.md`, `AREA_EVENTS.md`, `AREA_SHIFTS.md`, `AREA_USERS.md`, `AREA_KITS.md`, `AREA_SETTINGS.md`, creation-flow task notes, and relevant gap notes.
- [x] **Verification:** Run TypeScript, focused checks where applicable, migration check, diff whitespace, Next build, and browser smoke on changed creation paths.

**Review**
- Shipped the Items `New asset` creation slice with guarded submit, disabled controls during save, form-level error handling, auth redirect handling, and explicit post-create actions.
- Shipped Schedule New Event, event crew setup/add shift, shift trade post, Kits New Kit, and high-use settings catalog add propagation so those flows now show form-level errors and clearer post-submit handoffs.
- Confirmed Users Add User already matched the standard in current source, and the security patch closes the forced temporary-password follow-up.
- Browser smoke found a real Schedule New Event persistence bug: manual events were modeled as `sourceId: null` in Prisma/source but the database migration history still had `calendar_events.source_id NOT NULL`. Added migration `0063_allow_manual_calendar_events_source_null` and a focused route regression.
- Browser smoke exposed and fixed a real API mismatch: asset creation rejected valid UUID-shaped department IDs from current data as invalid CUIDs.
- Final build exposed and fixed a pre-existing kiosk schema mismatch: the code enforced `sessionExpiresAt`, but Prisma schema/migration lacked the column. GAP-53 is closed and `AREA_KIOSK.md` is synced.
- Verified with `npx prisma validate`, `npm run db:migrate:check`, focused Vitest coverage for assets, manual events, auth, settings catalogs, allowed emails, shifts, kiosk session expiry, and notification cron, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/items`, `/schedule`, `/kits`, `/settings/categories`, and `/users`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper now handles this blank schema-engine failure and `npm run build` reaches Next compilation after checking/applying migrations.
- Remaining creation-system work is ranked in `tasks/creation-flow-system-plan.md`; deferred admin/specialized surfaces should be handled as focused slices.

### Wisconsin iOS Home Action Queue (2026-05-12)
- [x] **Plan:** Rework `HomeView` from a passive dashboard stack into an iOS-native action queue using the current dashboard payload.
- [x] **Home implementation:** Keep a compact triage strip, promote overdue/due-today/awaiting-pickup/reservation/shift work, and make each row open the relevant booking, shift, or tab target.
- [x] **Docs:** Update `AREA_MOBILE.md`, `IOS_DEVICE_WALKTHROUGH.md`, `hig-audit-ios.md`, and this task note to match the new Home direction.
- [x] **Verification:** Run `npm run drift:ios`, `npm run audit:ios:gaps`, and `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`.

**Review**
- Home now starts from a compact triage strip and a `Next Up` action queue instead of passive dashboard cards.
- Action rows prioritize overdue gear, due-today returns, awaiting pickup, upcoming reservations, and upcoming shifts, with direct booking or schedule navigation.
- Removed redundant Home scan/search actions: no awaiting-pickup scan button, no Scan gear queue row, and no bottom search FAB.
- Removed the old Home-only Upcoming Events/My Checkouts/Team Checkouts/Team Reservations dashboard stack; staff/admin exception context now sits below the queue.
- Verified after the follow-up cleanup: `npm run drift:ios` passed; `npm run audit:ios:gaps` passed; exact simulator build command passed with `BUILD SUCCEEDED`.
- Remaining questions are real-device/user-feedback checks: VoiceOver and Dynamic Type behavior on the compact strip, whether the due-today fallback needs richer API payload, and how much staff exception work belongs on Home after field use.

### Wisconsin iOS TestFlight Readiness Reconciliation (2026-05-11)
- [x] **Audit reconciliation:** Rechecked current iOS audit records against source for Home, Bookings, Items, Schedule, Scan, Profile, Notifications, Kiosk, and parity drift.
- [x] **Automated checks:** Ran `npm run drift:ios` and `npm run audit:ios:gaps`; both passed on the current checkout.
- [x] **Simulator build:** Built the `Wisconsin` iOS Simulator target through XcodeBuildMCP and with the exact requested `xcodebuild` command.
- [x] **Docs and QA handoff:** Updated mobile readiness docs and left a TestFlight readiness report with remaining hardware-only QA.

**Review**
- Source-verifiable iOS audit blockers are closed. Remaining unchecked audit entries are explicitly deferred P2 parity/polish items or real-device-only checks.
- Verified: `npm run drift:ios` -> no anti-patterns across 45 Swift files; `npm run audit:ios:gaps` -> 34/34 audit-worthy surfaces covered, no gaps; `xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` -> `BUILD SUCCEEDED`.
- Remaining TestFlight work is real-device QA only: camera/DataScanner, haptics, APNs, VoiceOver, Dynamic Type, Bluetooth HID scanner, and unstable-network behavior.
- Caveat: exact shell `xcodebuild` needed CoreSimulator access outside the sandbox; the first sandboxed attempt failed on simulator service permissions, then the escalated exact command succeeded.

### Status/Data Wiring Ship Fixes (2026-05-10)
- [x] **Item status contract:** Treat `PENDING_PICKUP` as an active item state in server read models, item filters, and web/iOS status presentation.
- [x] **Mutation safety:** Make user deactivation cancel pending-pickup work with the same allocation/session cleanup used for reservations.
- [x] **Route semantics:** Harden booking/search/calendar route filters so explicit statuses are not silently widened or overridden.
- [x] **Docs and verification:** Sync area docs and run focused status, route, TypeScript, and build-safe checks.

**Review**
- Shipped: `PENDING_PICKUP` now appears as `Awaiting pickup` in item read models, filters, web/iOS item UI, event command summaries, and status color helpers.
- Shipped: Future reservations stay future context until their window starts; cancelled/completed/draft bookings stay out of active calendar/search/status surfaces.
- Shipped: Cancelling pending-pickup or open checkouts restores outstanding bulk stock and scanned numbered units, and deactivating owners restores pending-pickup bulk stock while `OPEN` checkout custody still blocks deactivation.
- Verified: focused status and cancellation regressions, booking status/query regressions, TypeScript, build-safe checks, and iOS build attempt documented in the final handoff.

### Bookings Status Ship Fixes (2026-05-10)
- [x] **Active checkouts default:** Make `/bookings?tab=checkouts` show checked-out and pending-pickup work together.
- [x] **Stale reservations:** Add a separate dashboard attention surface for past-due `BOOKED` reservations without changing checkout overdue counts.
- [x] **Docs and verification:** Sync area docs, archive the task record, and run focused checks plus build.

**Review**
- Shipped: Checkouts default now includes `OPEN` and `PENDING_PICKUP`, while explicit status filters still narrow to a single lifecycle state.
- Shipped: Dashboard Team Activity now shows past-due `BOOKED` reservations in a separate Stale reservations card linked to the reservation overdue filter, without changing checkout overdue metrics.
- Verified: focused status Vitest slice, TypeScript, whitespace diff check, migration-prefix check, Next production build, and Chrome DevTools smoke on `/bookings?tab=checkouts` plus dashboard `/`.
- Deferred: Checkout overdue stats remain custody-only; `PENDING_PICKUP` auto-expiry remains GAP-33.

### Items Ownership Pass (2026-05-10)
- [x] **Mixed row hardening:** Prevent bulk SKU rows from flowing into serialized-item selection, favorites, labels, and lifecycle mutations.
- [x] **UX/UI polish:** Tighten Items toolbar, summary, and pagination controls without changing the page architecture.
- [x] **Preference safety:** Make persisted density and column visibility hydration-safe.
- [x] **Docs and verification:** Sync Items docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/items` now restores density and column visibility after hydration instead of reading localStorage during the initial render.
- Shipped: Item-family rows now open their item detail route but cannot be selected for serialized bulk actions, favorited from the Items list, printed as serialized asset labels, or sent through serialized lifecycle actions.
- Shipped: The Items toolbar and pagination controls now use larger hit areas, cleaner pagination copy, and a bulk-only footer that does not expose an invalid rows-per-page selector.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `npx vitest run tests/asset-action-hardening.test.ts tests/api-hardening-wave12.test.ts`, `git diff --check -- src/app/(app)/items/page.tsx src/app/(app)/items/data-table.tsx src/app/(app)/items/columns.tsx src/app/(app)/items/components/items-toolbar.tsx src/app/(app)/items/components/items-pagination.tsx src/app/(app)/items/hooks/use-bulk-actions.ts docs/AREA_ITEMS.md tasks/todo.md tasks/archive/items-ownership-pass.md`, `npx next build`, and authenticated browser smoke on `/items`, `/items?type=bulk`, and `/items?type=serialized`.

### Schedule Ownership Pass (2026-05-10)
- [x] **Core Schedule:** Tighten summary counts, filters, list/week/calendar controls, and schedule empty states.
- [x] **Assignment flows:** Improve `/schedule/assign` and shared assignment controls for touch targets, labels, and filtered recovery.
- [x] **Connected surfaces:** Align event detail, dashboard Upcoming Events, and schedule-feeding settings with the same schedule semantics.
- [x] **Docs and verification:** Sync Schedule/Events/Settings/Dashboard docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/schedule` now has a clearer readiness snapshot, larger filter/view controls, stronger list/week/calendar empty states, stable hydrated view preferences, and corrected all-day event creation.
- Shipped: `/schedule/assign` now has larger navigation/filter controls, accessible assignment/remove targets, filtered-empty recovery, no-shift labels, and hydration-stable assignment data.
- Shipped: Event detail, shared shift controls, Dashboard Upcoming Events, and Settings Sports now align with Schedule semantics through away-event wording, stronger crew/travel controls, less duplicate open-slot copy, and shared Switch controls.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `npx vitest run tests/shift-assignments.test.ts tests/shift-trades.test.ts tests/calendar-events-query.test.ts tests/event-defaults.test.ts`, `npx next build`, and authenticated Chrome DevTools smoke on `/`, `/schedule`, `/schedule/assign`, `/events/cmmgnauku006rx10l0rkdv1cp`, and `/settings/sports`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper now handles this blank schema-engine failure and full `npm run build` passes.

### Kits Ownership Pass (2026-05-10)
- [x] **Structure:** Reframe `/kits` with a current list-page summary, toolbar, and row/card hierarchy.
- [x] **UX/UI:** Make search and filters shareable, add filtered-empty recovery, and replace fake row links with real navigation targets.
- [x] **Hardening:** Count serialized and bulk kit contents together, search descriptions, and expose create-sheet validation.
- [x] **Docs and verification:** Sync Kits docs, archive the task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/kits` now has summary metrics, URL-backed search/sort/filter state, a stronger toolbar, real detail links, clearer desktop/mobile rows, bulk-aware content counts/status, description search, single-toast create success, and visible New Kit validation.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/kits/page.tsx src/app/(app)/kits/new-kit-sheet.tsx src/app/(app)/kits/hooks/use-kits-query.ts src/lib/services/kits.ts docs/AREA_KITS.md tasks/archive/kits-ownership-pass.md tasks/todo.md`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/kits` across desktop and mobile.
- Deferred: Kit detail add/remove composition polish stays out of this list-page pass.

### Items Hygiene Ownership Pass (2026-05-10)
- [x] **Structure:** Turn `/items/hygiene` into a focused cleanup queue with priority, progress, and view controls.
- [x] **UX/UI:** Improve issue cards, sample rows, clean states, touch targets, and refresh feedback while keeping repair links read-only.
- [x] **Hardening:** Surface partial API failures and make labels align with tag-first item identity.
- [x] **Docs and verification:** Sync item docs, task record, and run focused checks plus browser smoke.

**Review**
- Shipped: `/items/hygiene` now has priority sorting, a cleanup queue summary, checklist progress, needs-work/all/clean views, partial API failure warning state, refresh toast feedback, stronger sample rows, and tag-first API sample labels.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/items/hygiene/page.tsx src/app/api/inventory-hygiene/route.ts docs/AREA_ITEMS.md tasks/archive/items-hygiene-ownership-pass.md tasks/todo.md`, `npx next build`, and authenticated Chrome DevTools smoke on `http://localhost:3002/items/hygiene` across desktop and mobile.
- Deferred: No mutation or auto-fix flow was added; repair still launches existing item, kit, and bulk surfaces.

### Guides Review Fixes (2026-05-10)
- [x] **Full-text guide search** — Make `/guides` search match full guide Markdown or legacy guide text, not only the visible summary.
- [x] **Reader heading IDs** — Keep rendered Markdown heading IDs aligned with table-of-contents IDs when headings contain links, emphasis, or code.
- [x] **Featured rank PATCH semantics** — Preserve or clear `featuredRank` from the final featured state instead of optional PATCH field presence.
- [x] **Docs and verification** — Sync Guides docs and run focused regressions.

**Review**
- Shipped: Landing search now indexes full Markdown/plain guide body text, rendered Markdown headings use visible React text for IDs, and guide PATCH rank updates are derived from the final featured state.
- Verified: `npx vitest run tests/guides-service.test.ts tests/markdown-reader.test.ts tests/guide-content.test.ts tests/guide-ranking.test.ts tests/guide-freshness.test.ts`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check -- src/lib/guides.ts src/lib/guide-content.ts src/components/guides/MarkdownReader.tsx tests/guides-service.test.ts tests/markdown-reader.test.ts tests/guide-content.test.ts docs/AREA_GUIDES.md tasks/todo.md`, and `npx next build`.
- Deferred:

### Dashboard Cleanup Polish (2026-05-10)
- [x] **Banner cleanup:** Fix flagged-items banner token classes and remove the dead `status=flagged` inventory link.
- [x] **Filtered counts:** Make dashboard section counts reflect visible filtered rows while preserving unfiltered totals for overflow links.
- [x] **Transient cards:** Hide Awaiting Pickup when a dashboard filter removes every pending-pickup row.
- [x] **Touch polish:** Keep inline dashboard row actions reachable on touch-sized layouts without reintroducing nested actions.
- [x] **Docs and verification:** Sync Dashboard docs and run focused checks.

**Review**
- Shipped: Fixed the flagged-items banner styling and CTA, filtered header counts, filtered pending-pickup hiding, first-run detection coverage, and touch-visible dashboard row actions.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/app/(app)/page.tsx src/app/(app)/dashboard/my-gear-column.tsx src/app/(app)/dashboard/team-activity-column.tsx src/app/(app)/dashboard/flagged-items-banner.tsx docs/AREA_DASHBOARD.md tasks/todo.md`, `npx next build`, and Chrome smoke on `http://localhost:3001/?sport=MBB` redirecting cleanly to `/login` with no console errors.
- Deferred: Authenticated dashboard visual smoke was not run because the current browser session is unauthenticated; the protected route redirect was verified instead.

### Component Audit Track — 6 Surfaces (2026-05-10)
- [x] **1. Forms** — Inputs, textareas, selects, native selects, labels, invalid states, disabled states, and field sizing.
- [x] **2. Overlays** — Dialog, AlertDialog, Sheet, Drawer, popover/menu padding, backdrop, scroll, and elevation contracts.
- [x] **3. Button/loading/motion** — Button variants, icon buttons, loading spinners, reduced motion, and motion helper defaults.
- [x] **4. Avatar/image identity** — UserAvatar, Avatar, AvatarGroup, AssetImage, thumbnail stacks, and people-vs-gear identity rules.
- [x] **5. EquipmentPicker** — Picker search, availability states, scan-to-add, selected-item summary, and booking edit/create reuse.
- [x] **6. Row/action patterns** — List rows, dashboard rows, table links, inline actions, filter clears, and nested-interactive guardrails.

**Forms review**
- Current repo already had most Bucket 1 findings fixed: input shadow/transition parity, NativeSelect invalid styles, `SelectTrigger size="sm"` adoption, and dead `data-size` removal.
- Closed the live drift by making `SelectTrigger size="sm"` own `text-sm`, aligning `NativeSelect` default type with mobile-safe input sizing, and removing redundant small-select text overrides from Schedule assignment, Settings Sports call-time controls, and User Availability.
- Follow-up candidates remain intentionally outside this slice: re-audit `Label` layout after checking checkbox/inline-label consumers, and migrate high-value forms to the installed `form.tsx` primitive when a specific form is being touched.

**Overlays review**
- Current repo already had the original backdrop and radius drift fixed across Dialog, AlertDialog, Sheet, and Drawer.
- Closed the live interaction drift by aligning Dialog and Drawer close-button hover/focus transition treatment with Sheet.
- Kept Drawer as a separate primitive for the scan item-preview bottom sheet, but added matching elevation so it no longer feels flatter than the rest of the overlay family.
- Parked padding-contract and AlertDialog-composition changes because they have broad call-site implications and should be handled as their own migration.

**Button/loading/motion review**
- Current repo already had the main primitive upgrades from the audit: `Button loading`, app-level `MotionConfig reducedMotion="user"`, dead button attributes removed, dead `icon-lg` removed, motion re-export cleanup, and Schedule assignment icon button labels.
- Closed the remaining live drift by migrating high-value license actions and Settings Database diagnostics to the shared `Button loading` API, preserving their busy copy while adding consistent spinner, busy semantics, and automatic disabled behavior.
- Left refresh-icon spinners and inline autosave indicators alone because they are different interaction patterns, not plain primary-action loading buttons.

**Avatar/image identity review**
- Current repo had already made `AvatarGroup` layout-only, removed the dead raw `Avatar lg` branch, and separated dashboard gear thumbnails from people avatars.
- Closed the live size-ownership drift by moving the full `xs` through `xl` people-avatar scale into `Avatar`, making `UserAvatar` consume that primitive size prop, and sizing `AvatarGroupCount` from the same value.
- Kept `AssetImage` and `ItemThumbnailStack` as separate equipment identity primitives, because square gear thumbnails and compact gear stacks should not inherit circular person-avatar behavior.

**EquipmentPicker review**
- Kept this as a targeted hardening pass instead of reopening the larger item-picker decomposition roadmap.
- Closed scan-to-add drift by rejecting unavailable serialized gear with clear scanner feedback, preserving conflict-warning override behavior for otherwise available items, and capping scanned bulk SKUs at available quantity.
- Added in-place retry for picker search/load errors, empty-state recovery actions for search and available-only filters, corrected search match counts to include bulk rows, and tightened the selected shelf so availability checking and Clear all occupy one stable action area.

**Row/action patterns review**
- Confirmed the dashboard booking row already uses the desired pattern: a primary row button with sibling inline actions.
- Brought booking cards, booking mobile rows, and item mobile rows closer to that pattern by replacing fake `role="button"` containers with real primary open buttons and keeping overflow/checkbox controls as sibling actions.
- Adjusted the desktop booking table row so keyboard open behavior lives on a real button in the primary cell, while the overflow menu remains a separate action target.

**Closeout browser smoke**
- Authenticated as the seeded local admin and smoke-tested the touched surfaces across `/bookings`, `/items`, `/licenses`, `/settings/database`, `/schedule/assign`, `/settings/sports`, a student profile Availability tab, and `/checkouts/new`.
- Mobile viewport smoke confirmed checkout cards expose real `View booking` and `More actions` sibling buttons, and item cards expose real `View item` plus selection sibling buttons with no visible fake `div role="button"` row wrappers.
- License add/bulk/renew overlays opened cleanly, the checkout wizard reached the EquipmentPicker step with search, availability-only, scan, select-visible, and item add controls visible, and `/settings/database` diagnostics no longer emits duplicate React key warnings after the key fix.

### Guides Freshness Closeout (2026-05-10)
- [x] **Schema** — Add nullable guide verification fields and migration.
- [x] **API/service** — Let allowed guide editors mark a guide verified with audit coverage.
- [x] **Reader and landing UI** — Show verified/needs-review state on guide cards and reader headers.
- [x] **Docs and verification** — Sync Guides docs and run focused checks plus build.

**Review**
- Guides now store `lastVerifiedAt` and `lastVerifiedById`, with migration `0061_add_guide_freshness` applied and recorded.
- Allowed editors can mark a guide verified from the reader. The mutation uses the existing guide update permissions, writes a `guide_verified` audit entry, and sends `expectedUpdatedAt` so stale pages cannot verify over newer guide edits.
- `/guides` cards and individual reader headers now show Verified or Needs review state, including who last verified the guide when available.
- Verified with `npx vitest run tests/guide-content.test.ts tests/guide-sanitize.test.ts tests/guide-ranking.test.ts tests/guide-freshness.test.ts`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, authenticated `/guides` and guide-reader HTTP 200 smoke, and authenticated mark-verified API smoke.

### Breadcrumbs First-Class UX Pass (2026-05-10)
- [x] **Audit current breadcrumb system** — Confirm global ownership, route derivation, entity labels, sibling jumps, recents, role filtering, and mobile constraints.
- [x] **Interaction polish** — Make breadcrumb links, dropdown triggers, ellipsis, and current page states feel like deliberate navigation controls with accessible hit targets.
- [x] **Dropdown UX** — Add clearer sibling/recent menu framing, current-location indicators, descriptions where available, and predictable truncation.
- [x] **Verification and docs** — Run focused checks and sync the breadcrumb roadmap docs.

**Review**
- Global breadcrumbs now render as a shell-owned navigation strip with stronger current-page treatment, exact hover/focus/press states, and taller skeletons that match final crumb height.
- Link, dropdown, ellipsis, and current-page crumb targets measured 40px tall on desktop and 44px tall on mobile in browser smoke.
- Settings/Reports sibling menus now have explicit menu labels, preserve role filtering, show current-location checkmarks, and include Settings section descriptions from shared nav metadata.
- Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check -- src/components/PageBreadcrumb.tsx docs/AREA_MOBILE.md docs/AREA_SETTINGS.md tasks/todo.md`, `npx next build`, and browser smoke on `/settings/notifications` at desktop and mobile widths.

### Guides URL Navigation (2026-05-10)
- [x] **URL-backed landing filters** — Make reference, area, category, and search state reload-safe and shareable from `/guides`.
- [x] **Contact directory entry links** — Ensure `/guides?view=contacts` opens the live Contacts directory directly.
- [x] **Docs and verification** — Sync Guides docs and run focused checks.

**Review**
- `/guides` now reads `q`, `category`, `view`, and `area` from query params instead of hiding landing-page state in component-only memory.
- Reference links such as `/guides?view=contacts`, `/guides?view=media-drive`, `/guides?view=server-paths`, and `/guides?view=recent` now restore the correct highlighted card and filtered view after reload.
- Area links such as `/guides?area=video` now open directly into that Creative discipline.
- Verified focused Guides tests, TypeScript, migration-prefix check, whitespace check, `npx next build`, and authenticated HTTP 200 smoke for Contacts, Media Drive, Video area, and category-plus-search URLs.

### Guides Contacts Filters (2026-05-10)
- [x] **Role and area filters** — Add Contacts-directory controls for role and Creative area without changing the Users API.
- [x] **Contact hygiene filters** — Add missing phone and missing Slack views for staff/admin cleanup.
- [x] **Docs and verification** — Sync Guides docs and run focused checks.

**Review**
- `/guides` Contacts now filters active user profiles by role and Creative area without adding another API endpoint.
- Staff/admin users get cleanup filters and count badges for missing phone and missing Slack profile data; student readers only get the normal browsing filters.
- Search still includes contact fields, including Slack handle/profile URL text, and filtered empty states now explain that Contacts filters are active.
- Verified focused Guides tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, authenticated `/guides` HTTP 200, and authenticated `/api/users` payload shape for Contacts data.

### Guides Slack Profile Links (2026-05-10)
- [x] **Schema** — Add a nullable `slackProfileUrl` user field for reliable Slack profile links.
- [x] **API/Profile wiring** — Return and edit the URL through `/api/users`, `/api/users/[id]`, and `/api/profile` with validation.
- [x] **Guides Contacts UI** — Show `@handle` as text and make it open Slack only when a profile URL exists.
- [x] **Docs and verification** — Sync Users/Guides docs and run focused checks.

**Review**
- Added `User.slackProfileUrl` backed by `users.slack_profile_url`, with Slack-only HTTPS URL validation and null normalization.
- `/api/users`, `/api/users/[id]`, and `/api/profile` now return the profile URL; profile and staff/admin user edits can save it with audit diffs.
- `/guides` Contacts now displays `@handle` as text/search data and only turns the Slack line into a link when `slackProfileUrl` exists.
- Verified focused Guides tests, Prisma validation, migration-prefix check, whitespace check, TypeScript, `npx next build`, Neon HTTP fallback application of migration `0060`, authenticated `/guides` HTTP 200, authenticated `/api/users` payload containing `slackProfileUrl`, and invalid non-Slack profile URL rejection.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper supersedes the one-off migration `0060` fallback and full `npm run build` passes.

### Guides Live Contacts Directory (2026-05-10)
- [x] **Live source** — Use the Users API as the source of truth for guide Contacts instead of duplicating staff/student contact fields in Markdown.
- [x] **Contacts UI** — Show active users with avatar, name, title/year, role, area, location, email, phone, and Slack handle when the Contacts reference view is active.
- [x] **Slack seed** — Add a synced `slackHandle` user profile field so Slack contact info follows the user record.
- [x] **Docs and verification** — Sync Guides docs and prove the Contacts view updates from current user profile data.

**Review**
- `User.slackHandle` is now stored as `users.slack_handle`, normalized to `@handle`, editable through user detail/profile self-edit APIs, and returned by `/api/users`, `/api/users/[id]`, and `/api/profile`.
- `/guides` Contacts now uses active Users API data and shows current email, phone, Slack handle, title/year, area, location, avatar, and profile link.
- Verified focused Guides tests, TypeScript, Prisma validation, migration-prefix check, whitespace check, `npx next build`, Neon HTTP fallback application of migration `0059`, authenticated `/guides` HTTP 200, and authenticated `/api/users` payload containing `slackHandle`.
- Follow-up 2026-05-12: the shared Prisma/Neon migration wrapper supersedes the one-off migration `0059` fallback and full `npm run build` passes.

### Guides Reference Navigation (2026-05-10)
- [x] **Category framing** — Treat Contacts, Building Numbers, Media Drive, and Server Paths as distinct reference categories.
- [x] **Landing navigation** — Split Guides quick cards into area browsing and reference browsing while preserving ranked guide order.
- [x] **Authoring templates** — Add starter templates for Media Drive overview and Building Numbers entries.
- [x] **Verification and docs** — Run focused Guides checks and sync `AREA_GUIDES.md`.

**Review**
- `/guides` now shows separate Browse by area and Reference library sections. Media Drive filters as its own reference category instead of being conflated with Server Paths.
- `/guides/new` now offers Contacts, Building Numbers, Media Drive, Server Paths, SOP, and Troubleshooting starter templates, and the category datalist includes the new reference categories.
- Verified with focused Guides tests, TypeScript, migration-prefix check, whitespace check, production build, authenticated browser smoke on `/guides`, and authenticated route smoke on `/guides/new`.

### Mobile Web Nav Polish (2026-05-10)
- [x] **Bottom nav IA** — Keep the V1 mobile destinations intact while making Scan read as the primary one-tap action.
- [x] **Badges and active states** — Surface urgent checkout counts in the mobile nav and tighten active, hover, focus, and press states.
- [x] **Mobile shell spacing** — Adjust safe-area padding and hit areas so content clears the refined bottom bar.
- [x] **Verification and docs** — Run focused checks and update `AREA_MOBILE.md` with the shipped polish.

**Review**
- `npx tsc --noEmit`, `npm run db:migrate:check`, and `git diff --check` passed.
- `npx next build` compiled successfully, then failed during page-data collection for existing route resolution errors: `/events` and `/guides/[slug]/edit`.
- Dev server browser smoke reached `/login` at mobile width after a cache-bypassing reload. Authenticated app-shell smoke was not completed because signing in with seed credentials would create a real session and login audit event.

### Protected App Console Cleanup (2026-05-09)
- [x] **Production console diagnosis** — Vercel production logs were clean, but unauthenticated `/reports/badges` browser smoke showed three expected-but-noisy 401 resource errors before redirect.
- [x] **Server-side app auth gate** — Move the protected `(app)` layout to `requireAuth()` on the server and redirect unauthenticated users to `/login` before client shell APIs mount.
- [x] **Shell polling guard** — Seed the current-user React Query cache from the server user and only fetch notification/dashboard badge counts after an authenticated user exists.
- [x] **Verification** — Reran TypeScript, focused auth/API tests, full tests, Prisma validation, migration-prefix check, whitespace check, app build, and browser console smoke.

### Student Badge Achievements Slice 1 (2026-05-09)
- [x] **Schema and seed** — Add badge catalog, earned badge, streak tables, user relations, peer-visibility SystemConfig default, and 20 idempotent badge definitions.
- [x] **Service skeleton** — Add a flag-gated badge service API that returns before evaluator work while disabled.
- [x] **Docs and decisions** — Create AREA_BADGES and record the durable launch decisions from v4.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, focused badge test, full `npm test`, `npx tsc --noEmit`, and `npx next build` passed. `npm run db:migrate:status` failed with Prisma's blank Schema engine error against Neon even after read-only network escalation.

### Student Badge Achievements Slice 2 (2026-05-09)
- [x] **Checkout opened events** — Wire kiosk direct checkout and kiosk pickup confirmation to `onCheckoutOpened` after audit success.
- [x] **Checkout returned events** — Emit `onCheckoutReturned` from `markCheckoutCompleted`, partial serialized auto-complete, bulk auto-complete, and kiosk check-in auto-complete.
- [x] **Evaluator logic** — Award checkout count, on-time count, and on-time streak badges with `StudentBadge` idempotency and `BadgeStreak.lastSourceKey` dedupe. On-time counts now use durable `Booking.completedAt` with a legacy `updatedAt` fallback, so later booking edits do not corrupt badge eligibility.
- [x] **Verification** — Focused badge/checkout tests, full `npm test`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `npm run lint` is blocked by the deprecated interactive `next lint` setup prompt.

### Student Badge Achievements Slice 3 (2026-05-09)
- [x] **Kiosk scan events** — Wire checkout, pickup, and check-in kiosk scan routes to feature-flagged `onScanResult` calls for success and failure outcomes.
- [x] **Scan streaks** — Add a dedicated scan success counter streak type while keeping clean-scan streak resets separate.
- [x] **Legacy contract** — Keep regular app scan stubs kiosk-gated 403 routes that award no badges.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, focused badge/scan route tests, full `npm test`, `npx tsc --noEmit`, `git diff --check`, and `npx next build` passed. XcodeBuildMCP could not run an iOS simulator build because this session has no configured project/scheme defaults and this checkout exposes no `.xcodeproj`, `.xcworkspace`, or `Package.swift`.

### Student Badge Achievements Slice 4 (2026-05-09)
- [x] **Badge APIs** — Add active catalog and user badge profile endpoints with self/staff/peer visibility rules.
- [x] **Profile tab** — Add a user-wide `Badges` tab on `/users/{id}` using shadcn primitives, with no badge chrome in the profile hero.
- [x] **Historical display** — Hide inactive definitions from discovery while still showing earned historical inactive awards.
- [x] **Flag-off path** — Badge APIs return disabled/empty payloads before badge table queries while `BADGES_ENABLED` is off.
- [x] **Verification** — `npx prisma validate`, `npm run db:migrate:check`, focused badge API tests, full `npm test`, `npx tsc --noEmit`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/users/{id}?tab=badges` passed.

### Student Badge Achievements Slice 5 (2026-05-09)
- [x] **Trade completion events** — `claimTrade` immediate completion and `approveTrade` now queue trade badge events after the `COMPLETED` transition, awarding both poster and claimer exactly once through badge idempotency.
- [x] **Manual awards** — Admins can award active badges from the existing user admin actions menu with an optional note. The API persists `source=MANUAL`, `awardedById`, and rejects duplicate awards.
- [x] **Award notifications** — Manual awards create persistent inbox notifications that link to `/users/{id}?tab=badges` and respect `notificationPrefs.badges`.
- [x] **Seed fallback** — `prisma/seed.mjs` now uses the Neon adapter when `DATABASE_URL` points at Neon, and `tasks/badge-definitions-neon-seed.sql` is available for badge-only SQL Editor seeding when full `db:seed` is too broad.
- [x] **Verification** — Focused Slice 5 tests, full `npm test`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx tsc --noEmit`, and `npx next build` passed. Browser smoke on `/users/{student}` verified the Admin actions Award badge dialog and Badges tab render cleanly with no console errors; connected Neon currently has 0 badge definitions until the badge-only seed SQL is run.

### Student Badge Achievements Slice 7 Staff Report (2026-05-09)
- [x] **Badge report API** — Added `GET /api/reports/badges` behind existing report permissions with aggregate award metrics, leaderboard, distribution, and recent awards.
- [x] **Report page** — Added `/reports/badges` to the shared Reports tab set after Audit, using existing report primitives and CSV export. It remains staff analytics, not the primary profile badge surface.
- [x] **Badge hardening** — Badge evaluator transactions now use Serializable isolation with one Prisma conflict retry, flag-off service calls perform no badge transaction work, and `captureBadgeError` forwards to Sentry when `SENTRY_DSN` is configured while preserving structured logs.
- [x] **User-wide recognition** — Badge profiles and manual awards now apply to every active user role, including staff and admins, and the catalog includes ten fun manual-recognition badges for clean workflows, clutch coverage, event help, reliability, and above-and-beyond moments.
- [x] **Game-feel polish** — Badge cards show schema-free rarity labels, surprise badges stay hidden until earned, and manual award selection includes admin guidance for fun badges.
- [x] **Verification** — `npm test -- tests/badges-report-route.test.ts`, full `npm test`, `npx tsc --noEmit`, `npx prisma validate`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke on `/reports/badges` passed with no console errors.

### Student Badge Achievements Front-End Polish (2026-05-09)
- [x] **Deferred schema cleanup** — Keep the legacy `StudentBadge` model/table name for now and document the later rename as a dedicated migration cleanup, not a UI polish change.
- [x] **Badge medallions** — Replace plain icon wells with a reusable rarity-aware medallion using existing lucide icons and shadcn-compatible styling.
- [x] **Earned details** — Show manual award notes, recent-award "New" state, and visible surprise badge count on the profile badge tab.
- [x] **Motion polish** — Add restrained staggered grid entrance using existing motion primitives.
- [x] **Progress display** — Add real progress counts for supported threshold badges without inventing progress for manual/deferred badges.
- [x] **Reports insight polish** — Make `/reports/badges` more staff-useful with manual award rate, underused definitions, and recent manual recognition details.
- [x] **Verification** — Focused badge tests, full `npm test`, TypeScript, Prisma validation, migration-prefix check, whitespace check, and app build passed. Local browser smoke reached the login wall on `localhost:3000`; authenticated visual smoke remains pending.

### Labels UI Polish (2026-05-09)
- [x] **Print queue framing** — Add header context, matching/selected/ready metrics, and an Items escape link without changing browser-print output.
- [x] **Selector cleanup** — Replace the raw checklist with a searchable queue, selected count badge, accessible checkbox labels, and filtered-empty recovery.
- [x] **Row clarity** — Keep tag-first identity, surface location and scan codes, add selected-state icon rhythm, and provide item-detail links for misqueued gear.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/labels` passed; smoke caught and fixed nested row/link semantics plus the missing search input `id`/`name`.

### Notifications UI Polish (2026-05-09)
- [x] **Action inbox summary** — Add unread, read, and total metrics above the notification list.
- [x] **Toolbar and role cleanup** — Add explicit refresh, keep URL-backed unread filtering, and show overdue processing only to STAFF/ADMIN users.
- [x] **Row clarity** — Add notification type badges, clearer unread/read state, named destination actions, and stronger hover/focus rhythm without changing delivery or API contracts.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke passed; smoke caught and fixed reservation notifications falling back to checkout links when `bookingKind` was absent.

### Settings Control Map Polish (2026-05-09)
- [x] **Overview nav state** — Add `/settings` as an active Overview entry in the shared Settings nav.
- [x] **Role-aware map polish** — Surface current role, visible section counts, group counts, and destination role badges on the Settings control map.
- [x] **Interaction polish** — Tighten group card headers, link row hover/focus treatment, and tabular count badges without changing settings permissions or subpage behavior.
- [x] **Verification** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke on `/settings` plus `/settings/departments` passed.

### Reports UI Polish Slice 1 (2026-05-09)
- [x] **Shared Reports shell** — Add shared toolbar, metric-grid, section-card, and loading patterns for Reports.
- [x] **Six-page migration** — Apply the shared rhythm to Utilization, Checkouts, Overdue, Scans, Missing Units, and Audit without changing data contracts.
- [x] **Verification + browser smoke** — TypeScript, migration-prefix, whitespace, and app build gates pass; authenticated Chrome DevTools smoke rendered Utilization, Checkouts, Overdue, Missing Units, Scans, and Audit with the seeded admin session.

### Reports Chart Runtime Cleanup (2026-05-09)
- [x] **Recharts sizing guard** — Add stable responsive-container sizing in the shared shadcn chart wrapper after authenticated browser smoke exposed an initial width/height warning.
- [x] **Verification** — Reloaded Utilization in Chrome DevTools and confirmed no console warnings after the chart wrapper fix.

### Reports Chart Polish Slice 2 (2026-05-09)
- [x] **Chart-card consistency** — Move report chart components onto the shared report chart-card wrapper.
- [x] **Shared chart palette** — Replace per-file color arrays with one Reports palette and tighten numeric chart legends.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Filter Polish Slice 3 (2026-05-09)
- [x] **Shared segmented controls** — Add a Reports segmented-control helper using shadcn ToggleGroup.
- [x] **Filter migration** — Replace hand-rolled period and phase button loops on Checkouts, Scans, and Audit reports without changing URL behavior.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports State Polish Slice 4 (2026-05-09)
- [x] **Shared states** — Add report-level error, empty, and pagination helpers.
- [x] **Page migration** — Utilization, Checkouts, Overdue, Scans, Missing Units, and Audit now share retry/error handling where applicable.
- [x] **Empty copy** — Report empty states explain what data would populate the section instead of stopping at terse labels.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Row Polish Slice 5 (2026-05-09)
- [x] **Shared row primitives** — Add report-level table-link, mobile-card, mobile-card-link, and compact-list-row helpers.
- [x] **List migration** — Checkouts, Scans, Utilization, Missing Units, and Overdue use the shared row rhythm where applicable.
- [x] **Disclosure polish** — Overdue expandable rows use lucide chevrons while preserving click and keyboard expansion.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Export Polish Slice 6 (2026-05-09)
- [x] **Shared export action** — Add a report-level CSV export button with a download icon.
- [x] **CSV helper** — Centralize browser CSV download and escaping for report exports.
- [x] **Page migration** — Utilization, Checkouts, Overdue, Scans, and Audit now use the shared export helper.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Loading Cleanup Slice 7 (2026-05-09)
- [x] **Shared chart loading** — Add a report-level chart loading helper for dynamic chart imports.
- [x] **Placeholder migration** — Utilization and Checkouts chart fallbacks now use the shared loading helper.
- [x] **Row adoption cleanup** — Checkouts requester mobile rows now use the shared report list row.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Overdue Presentation Slice 8 (2026-05-09)
- [x] **Shared nested links** — Let `ReportTableLink` accept click handlers and use it for expanded Overdue mobile booking links.
- [x] **Color cleanup** — Replace Overdue inline red text styles with report-compatible utility classes.
- [x] **Behavior preservation** — Keep row expansion and booking navigation separate.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Reports Metadata Line Slice 9 (2026-05-09)
- [x] **Shared metadata helper** — Add a report-level metadata line for compact row details.
- [x] **Checkout row migration** — Replace raw separator strings in mobile checkout rows.
- [x] **Overdue row migration** — Replace raw separator strings in expanded overdue booking rows.
- [x] **Verification** — TypeScript, migration-prefix, whitespace, and app build gates pass.

### Scan Route Gate Contract Slice (2026-05-08)
- [x] **Stale scan-rate-limit correction** — Verify the regular app checkout/check-in scan endpoints are kiosk-gated 403 stubs, so the old per-session rate-limit TODO no longer describes an active execution path.
- [x] **Verification + docs** — Add a regression contract, sync scan docs and the task registry, then rerun the safe verification gates.

### Public Endpoint Abuse Contract Testing Slice (2026-05-08)
- [x] **Public abuse-control inventory** — Add a static regression that every intentionally public unauthenticated API route is either rate-limited by client IP or explicitly disabled behind the seed endpoint gate.
- [x] **Verification + docs** — Run focused contract tests plus the safe verification gates and document the coverage.

### High-Impact Regression Testing Slice (2026-05-08)
- [x] **RBAC route contract matrix** — Add a static regression that verifies every route-level `requirePermission()` call references a defined permission.
- [x] **Booking lifecycle route contracts** — Add focused route tests for required optimistic locking, stale edit rejection, and checkout/reservation update dispatch.
- [x] **Verification + docs** — Run focused tests, TypeScript, migration-prefix, whitespace, and build checks; sync docs with coverage benefits.

### API Wrapper Contract Testing Slice (2026-05-08)
- [x] **Route wrapper inventory** — Add a static regression that every exported API HTTP method is wrapped by `withAuth`, `withKiosk`, `withHandler`, or `withCron`, including shared handler aliases.
- [x] **Verification + docs** — Run focused contract tests plus the safe verification gates and document the coverage.

### API Hardening Wave 13 (2026-05-08)
- [x] **Booking/check-in hardening** — Verify booking search indexes, tighten conflict expectations, add damage-report dedup, and reduce orphan-photo risk.
- [x] **Kiosk/user/calendar/report bounds** — Add rate limits, cursor validation, result caps, and list caps across remaining hot read/write routes.
- [x] **Shift/catalog/license/upload bounds** — Add Serializable isolation, rate limits, filename sanitization, and bounded histories.
- [x] **Regression coverage + docs** — Add focused tests, close audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 12 (2026-05-08)
- [x] **Import conflict feedback** — Stop silently masking asset tag or scan-code conflicts during asset import.
- [x] **Asset/bulk route bounds** — Add rate limits, limit caps, timeout guards, and transaction isolation where missing.
- [x] **Bulk list/activity hardening** — Verify list balance loading is already batched and scope activity cursors to their SKU.
- [x] **Regression coverage + docs** — Add focused tests, close audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 11 (2026-05-08)
- [x] **Admin reset-password containment** — Stop returning reusable temp-password state without a forced-change marker.
- [x] **Bulk inventory mutation bounds** — Add upper quantity bounds and verify numbered-unit status updates are already transactional.
- [x] **Reservation race guards** — Confirm convert re-checks status inside `createBooking` and block duplicate from terminal reservations after reload.
- [x] **Report/audit/kiosk request bounds** — Cap report lookback, bound audit-log cursors to the booking, and harden kiosk enumeration/activation rate limits.
- [x] **Shift regenerate auditability** — Correct stale finding: regenerate adds missing shifts only, skips manual groups, and already audits added count.
- [x] **Regression coverage + docs** — Add focused tests, close the audit bullets, sync area docs, and run safe checks.

### API Hardening Wave 10 (2026-05-08)
- [x] **Shift ICS public feed bounds** — Reject malformed tokens, rate-limit by IP and token, serve only active-user feeds, and cap assignment reads to a 500-row rolling calendar window.
- [x] **Calendar source sync lease** — Add database-backed per-source sync lease fields and guard manual sync plus post-sync shift generation from concurrent execution.
- [x] **Asset lifecycle/favorite hardening** — Move retire read/update/audit into one SERIALIZABLE transaction and add explicit `asset.favorite` permission plus asset existence validation.
- [x] **Regression coverage** — Add focused tests for ICS feed hardening, sync lease behavior, asset action hardening, and `asset.favorite` RBAC.
- [x] **Verification + docs** — Sync area docs/audit registry and run safe checks.

### API Hardening Wave 9 (2026-05-08)
- [x] **Allowed-email enumeration guard** — Return generic skip success for already-registered or already-allowlisted emails instead of revealing membership via 409 or skipped email lists.
- [x] **Allowed-email regression coverage** — Update route tests for generic skip behavior.
- [x] **Verification + docs** — Sync users/settings docs and run safe checks.

### API Hardening Wave 8 (2026-05-08)
- [x] **License CSV injection guard** — Add shared CSV escaping that neutralizes formula-like values and apply it to license and user exports.
- [x] **CSV helper regression coverage** — Cover formula prefixes plus quoting for commas, quotes, and newlines.
- [x] **Verification + docs** — Sync license hardening docs and run safe checks.

### API Hardening Wave 7 (2026-05-08)
- [x] **Guide content sanitization** — Sanitize guide BlockNote JSON recursively before create/update storage.
- [x] **Guide sanitizer regression coverage** — Cover scriptable string stripping and prototype-pollution key removal.
- [x] **Verification + docs** — Sync guide hardening docs and run safe checks.

### API Hardening Wave 6 (2026-05-08)
- [x] **Cron auth wrapper** — Extract shared `withCron()` bearer-token validation and migrate all cron routes to it.
- [x] **Cron auth regression coverage** — Cover missing secret, bad token, and accepted token behavior.
- [x] **Verification + docs** — Sync cron hardening docs and run safe checks.

### API Hardening Wave 5 (2026-05-08)
- [x] **Nudge spam scope** — Add active-assignment validation plus per-actor hourly, per-assignment, and per-recipient nudge rate limits.
- [x] **Nudge regression coverage** — Cover student denial, inactive assignment rejection, and layered rate-limit calls.
- [x] **Verification + docs** — Sync notification hardening docs and run safe checks.

### API Hardening Wave 4 (2026-05-08)
- [x] **Calendar travel roster scope** — Rejected the read-access finding: students are allowed to see staffing/travel roster context for all events; route now only verifies the event exists before listing.
- [x] **Calendar travel mutation guard coverage** — Add regressions proving STUDENT cannot add or remove event travel members.
- [x] **Verification + docs** — Sync hardening docs and run safe checks.

### API Hardening Wave 3 (2026-05-08)
- [x] **User export PII scope** — Redact staff/admin athletics email and phone fields from STAFF exports while preserving ADMIN full export and student operational contact rows.
- [x] **Org chart hierarchy scope** — Restrict org chart API and nav entry to STAFF/ADMIN so STUDENT callers cannot read direct-report chains.
- [x] **Form-options directory scope** — Stop returning email and limit STUDENT callers to their own user option instead of the full active-user directory.
- [x] **Verification + docs** — Add focused regression coverage, sync docs, and run safe checks.

### API Hardening Wave 2 (2026-05-08)
- [x] **Dashboard read resilience** — Convert dashboard, dashboard-stats, inventory hygiene, and items-page-init query bundles to partial-failure handling.
- [x] **Mutation audit coverage** — Add audit entries for shift attendance, event creation, event visibility, and force-delete metadata.
- [x] **Verification + docs** — Add focused coverage where useful, sync docs, and run safe checks.

### API Hardening Wave 1 (2026-05-08)
- [x] **Profile password sessions** — Make self-service password changes update the hash and invalidate existing sessions atomically.
- [x] **Reset token consumption** — Consume reset tokens inside the transaction so a concurrent request cannot reuse the same token window.
- [x] **Seed route hard gate** — Disable `/api/seed` unless explicitly enabled, and keep production/admin gating as a second layer.
- [x] **Shift permission contract** — Add the missing `shift.manage` permission used by shift group and travel mutation routes.
- [x] **Verification + docs** — Add focused tests, sync hardening docs, and run safe checks.

### Next.js May 2026 Security Patch (2026-05-08)
- [x] **Patch dependency floor** — Updated Next.js to `15.5.16` and aligned React packages to `19.2.6`.
- [x] **Verify runtime dependency tree** — Confirmed installed `next@15.5.16`, `react@19.2.6`, and `react-dom@19.2.6` after lockfile refresh.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and `npm audit --omit=dev` completed; audit still reports Next's nested PostCSS advisory until upstream Next updates that dependency.

### Items List Context Menu (2026-05-07)
- [x] **Row context menu** — Add right-click actions for open, open in new tab, select/deselect, copy tag, favorite, print label, duplicate, maintenance, and retire.
- [x] **Bulk row guardrails** — Keep bulk inventory rows on safe navigation/copy/selection actions and remove serialized-only mutations from the existing kebab menu.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. `AREA_ITEMS.md` synced.

### Damage Report Photos + Avatar Polish (2026-05-07)
- [x] **Report photo evidence** — Add optional photo evidence to damaged/lost check-in reports without restoring scrubbed checkout/check-in condition-photo gates.
- [x] **User photo polish** — Resize profile avatars before upload and surface an admin roster cue for users missing profile photos.
- [x] **Verification + docs** — `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and checkout/scan/users docs synced.

### Active Backlog Index (2026-05-06)
- [x] **Next recommended slice: Admin Fix Today queue** — Shipped `/admin/fix-today` as an admin-only read queue for overdue gear, pending pickup handoffs, offline kiosks, flagged maintenance items, low batteries, calendar sync failures, and license expirations.
- [x] **Battery follow-through** — Shipped the explicit kiosk battery scan step: typed numbered-battery rows and scan-summary counts in checkout detail, plus dedicated iOS pickup/return battery progress cards.
- [ ] **Admin helpers** — Work through Admin Helper Backlog in this order: Fix Today queue, Kiosk admin cockpit, People offboarding assistant, Inventory hygiene center, Admin exception review, Renewal and expiry calendar, Morning digest.
- [ ] **Ops V2/V3 deferred work** — Keep deeper battery reporting, inventory health, attachment slot schema, and templates/presets behind slice plans.
- [ ] **Low-priority systemic gaps** — Keep SystemConfig UI and scan endpoint rate limiting visible but behind daily-ops work.

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

### Bulk Battery Hardening (2026-05-05)
- [x] **Kiosk-scanned numbered batteries** — Treat battery booking as quantity at creation, then bind/return specific numbered units through kiosk unit QR scans. Add low-availability camera-model battery warnings at creation. Verified with focused tests, TypeScript, migration-prefix check, local Next build, and whitespace check.
- [x] **Kiosk battery client and labels** — Include batteries in iOS kiosk pickup/return checklists, block pickup confirm until planned units are scanned, align compatibility rules to the current import snapshot, and improve Brother P-Touch unit labels. Verified with focused tests, TypeScript, migration-prefix check, local Next build, iOS simulator build, and whitespace check.
- [x] **Battery Unit Cockpit** — Added `/bulk-inventory/batteries` plus an Admin nav entry for active unit-tracked battery families, unit status counts, low-stock signals, checked-out aging, booking/requester context, and audited unit status actions.
- [x] **Kiosk battery mismatch polish** — Kiosk pickup/return now distinguishes wrong battery type, duplicate scans, units checked out elsewhere, units not checked out on the booking, and lost/retired units.
- [x] **Battery compatibility lows** — Battery Ops now flags low compatible battery families by matching active camera inventory against existing battery compatibility rules.
- [ ] **Kiosk explicit battery scan step** — Make pickup clearly call out required battery unit scans before confirm, while preserving current unit-binding behavior.
- [ ] **Kiosk admin override visibility** — Preserve admin override, but make battery-related override use visible and audit-friendly in the pickup flow.
- [ ] **Booking-create battery guidance polish** — Make compatible battery warnings feel like actionable guidance instead of generic alerts, without requiring unit selection before pickup.
- [ ] **Booking-create optional gear suggestions** — Suggest compatible support gear such as batteries, media, readers, and cages from selected camera context.
- [ ] **Attachment management polish** — Improve camera attachment attach, detach, and replace flows while keeping slot identity display-only for now.
- [x] **Battery audit/reporting** — Add missing batteries by unit, loss rate by family, unit checkout history, repeated missing-unit patterns, and aging checked-out battery reporting.
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
- Next.js May 2026 Security Patch shipped: package and lockfile now pin the patched 15.x framework floor (`next@15.5.16`) plus React `19.2.6`, matching the disclosed React Server Components patch floor. The local dependency tree confirms those installed versions, and the production Next build compiled successfully on `Next.js 15.5.16`. `npm audit --omit=dev` still reports the separate nested `next -> postcss@8.4.31` moderate advisory; a scoped override made npm mark the Next dependency invalid, so that was backed out and left for an upstream Next release.
- Page Ownership Skill shipped: added a project skill for end-to-end web page and page-slice execution passes, including orientation, peer comparison, structure/UX/UI/consistency/hardening lenses, verification, docs sync, and propagation candidates. `audit-page-web` now points full-page implementation requests at the new skill while staying a diagnostic readiness audit. Verification passed for frontmatter/heading scan and `git diff --check`.
- Dashboard Upcoming Events Parity shipped: the dashboard Upcoming Events card now uses schedule-style read-only coverage metadata from `/api/dashboard`, shows event title, time, location, home/away state, staffing avatars, filled/total coverage, open-slot warnings, and home call time when available. Quick-create controls were removed from the widget, keeping `/schedule` as the management surface. Verification passed for TypeScript, migration-prefix check, whitespace, and local Next build.
- Item Detail Tabs Final Polish shipped: Schedule now pairs the month grid with a compact agenda row list, continuous week-spanning booking bars, quieter Today control, completed trailing calendar cells, and filters cancelled bookings out of occupied schedule and quick Past Bookings views. QR details are owned by the QR preview instead of a separate visible action. Calendar booking clicks keep users in context with a lighter booking preview sheet that matches the current app chrome, uses requester/creator avatars for human context, and routes deeper work to the full booking page. Insights now uses completion audit activity for return timing when available, labels the metric honestly, and shows item age in years for older gear. Attachments now hides the travel rule when no children exist and explains when fixed accessories should be added. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, authenticated Chrome DevTools tab checks, and console review.
- Item Detail Tabs Follow-up shipped: Schedule now uses clickable continuation/end markers instead of repeating long booking names across every occupied day. Past Bookings now pulls requester avatar URLs through the detail API and renders compact rows with title, requester, date range, kind, and status. History now has All / Item updates / Bookings scopes, backend scope filtering, cursor pagination, cleaner legacy audit labels, and quieter import metadata handling. Verified with TypeScript, migration-prefix check, whitespace check, local route checks, and authenticated Chrome DevTools checks on Info, Schedule, and History.
- Item Detail Tab Direction Pass shipped: the detail tab rail now uses a quieter thin active underline, removes the redundant Bookings tab, renames Calendar to Schedule, and removes visible shortcut numerals. Info now includes Past Bookings beneath upcoming reservations with requester avatars and clearer booking context. Insights is a compact signal view, History is framed around the full item touch log, Attachments has operational summary/direction, and Settings reads as workflow eligibility policy. Verification passed for TypeScript, migration-prefix check, whitespace, local route checks, and `npx next build`.
- Item Detail Data Form Hardening shipped: shared inline save controls now use a ref guard against rapid duplicate saves, show saving state instead of competing save/cancel controls, disable text/select/date/notes/QR inputs while requests are active, and toast actual save errors. Asset PATCH now trims incoming strings, accepts clearable nullable fields, allows zero-value financial fields, saves department by ID, and parses server error bodies consistently. The shared API CSRF guard now compares against the actual request origin, so localhost item saves are not rejected before auth/permissions while bad origins still return 403. The info card now uses consistent gray picker surfaces for select/category/date/year controls, a year-only Fiscal Year picker, a shared Admin badge, and a top-aligned notes row.
- Home Dashboard Focused Pass shipped: dashboard rows now use one shared row component, no longer nest action buttons inside clickable row buttons, and use a safer mobile layout with predictable truncation. Filter clear no longer nests a focusable pseudo-button inside the popover trigger. Docs synced in `AREA_DASHBOARD.md`. Verification passed for TypeScript, migration-prefix check, and local Next build. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.
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
- Camera Attachments shipped: item detail now uses grouped Attachments, SD card slot labels render for tags such as `MBB 17 IV 1A`, scan lookup shows parent/slot context, and docs lock QR-coded batteries to numbered bulk semantics. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.
- Derived Bulk Unit QR Scans shipped: QR values generated by the numbered bulk QR tab, such as `94e068d1-7`, now submit as one validated numbered unit under the parent SKU without converting batteries into serialized items.
- Bulk Battery Hardening shipped: kiosk pickup/check-in now scans numbered battery unit QRs one by one, lookup resolves unit QRs, checkout creation warns on low compatible battery availability, and camera-battery guidance is no longer a hard gate.
- Battery Unit Cockpit shipped: admins/staff now have `/bulk-inventory/batteries` for active unit-tracked battery families, low-stock signals, checked-out aging, booking/requester context, and audited quick unit actions.
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
- Kiosk Pickup Scan Guard shipped: live staff checkout smoke found that failed serialized scans did not block pickup confirmation. Kiosk pickup scans now record successful serialized scan evidence, confirmation blocks until every serialized item has that evidence, serial-number scanner input resolves through kiosk lookup, and the smoke checkout/kiosk test data was cleaned up. Verified with focused route tests, full Vitest, TypeScript, migration-prefix check, whitespace check, production Next build, and live API smoke.
- Busy Day Availability Stress shipped: mocked a same-day run of overlapping reservations, pending-pickup checkout, non-overlapping reuse, exact handoff edges, and bulk media commitments through the live API. Fixed the two edge cases it exposed: `PENDING_PICKUP` serialized allocations now block overlapping bookings, and overlapping `BOOKED` bulk reservations reduce available quantity before create. Confirmed `endsAt === next.startsAt` is allowed while one-minute overrun fails. All temporary stress bookings were cancelled during cleanup.
- Future Booking Context shipped: `/api/availability/check` now returns the next future serialized commitment for selected assets, and the shared picker plus booking Equipment tab show exact "Back before" timing so staff can see when an item is needed next before extending or editing.
- Turnaround Risk Guard shipped: availability preview now stays advisory but calls out short handoff windows, next-use location transfers, recent damage/lost check-in reports, and tight future bulk bookings directly on serialized and bulk rows.

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
- [x] ~~**Server-side rate limiting on scan endpoints**~~ — Reconciled 2026-05-08: `/api/checkouts/[id]/scan` and `/checkin-scan` are kiosk-gated 403 stubs, so the old per-session rate-limit risk no longer applies to an active execution path. Kiosk scan execution remains under `withKiosk`; broader Redis/Upstash migration remains tracked by GAP-32.
- [x] ~~**Device context never sent from client**~~ — Shipped 2026-04-14: `use-scan-submission.ts` now sends `deviceContext: navigator.userAgent` on all scan POST requests (both `submitScan` and the numbered-bulk inline fetch).

---

## Phase B Backlog (needs briefs before implementation)

- [x] ~~**Shift email notifications**~~ — Trade lifecycle emails shipped for claimed, completed, approved, and declined trades; broader assignment emails remain out of scope
- [x] ~~**Student availability tracking**~~ — Shipped as recurring weekly unavailability blocks with profile Availability tab and assignment conflict indicators; date-specific exceptions remain optional follow-up
- [x] ~~**Date range grouping**~~ — Already shipped in `BookingInfoTab`: the booking detail "When" field shows connected start/end values with duration. Reconciled 2026-05-05.
- [x] ~~**Game-Day Readiness Score**~~ — Scrubbed 2026-05-13. We are not planning a readiness-score / ops-view surface.

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
- [x] Run `npm run build` (follow-up 2026-05-12: full build now passes through the shared Prisma/Neon migration wrapper)

### Review
- Shipped low-effort hardening on booking + scan client paths and added missing operational indexes.
- Verification complete for compilation. Follow-up 2026-05-12: full `npm run build` succeeds through the shared Prisma/Neon migration wrapper. Test suite was red at the time for unrelated pre-existing failures.
