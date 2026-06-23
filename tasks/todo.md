# Task Queue

Last updated: 2026-06-23

---

## Active: Battery Ops booking context hotfix (2026-06-23)

Plan: fix checked-out battery units that show "Unknown" and "No booking context" even though they are linked to active checkout bookings.

- [x] Audit Battery Ops area docs, checkout/kiosk scan contracts, D-022, gaps, schema, page, API route, and peer allocation read models.
- [x] Patch the Battery Ops API to derive checked-out holder/booking context from active `BookingBulkUnitAllocation` rows, with a bounded fallback for orphaned checked-out unit rows.
- [x] Add focused route regression coverage for active allocation context, the live orphaned unit shape, and stale orphaned `CHECKED_OUT` statuses that should read available.
- [x] Sync Bulk Inventory docs and record verification results.
- [x] Run focused tests and closeout gates.

### Review
- 2026-06-23: Live read-only Neon evidence showed `CO-0048` has an open unit-tracked Sony Battery bulk item with planned quantity but no active `BookingBulkUnitAllocation` rows, while several Sony Battery units are marked `CHECKED_OUT`. Battery Ops now prefers active allocation rows, then falls back to matching open unit-tracked checkout bulk items for the same SKU, capped by outstanding planned quantity and assigned to the most recently updated orphaned checked-out units. Focused regression coverage added in `tests/battery-ops-route.test.ts`.
  Follow-up live evidence showed Sony Battery units #29 and #31 have stale `CHECKED_OUT` flags with no allocation rows, while Football Media Day is a future `BOOKED` reservation with quantity intent rather than exact unit links. Battery Ops now returns orphaned `CHECKED_OUT` units as Available when no active checkout context exists.
  Verification passed with focused Battery Ops route Vitest and TypeScript after the fallback patch. Earlier verification also passed docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`. Full `npm run build` was attempted but stopped at the migration deploy preflight because sandboxed DNS to Neon failed; escalation was rejected because the script can apply migrations to the shared database.

---

## Active: iOS kiosk scanner phase focus hotfix (2026-06-23)

Plan: hotfix from live iPad testing on iPadOS 17.7.11 before Start Scanning.

- [x] Trace checkout detail focus ownership between visible native fields and the hidden HID scanner field.
- [x] Gate HID scanner capture behind an explicit scan-armed state set only by Start Scanning.
- [x] Disable scanner capture when editing checkout context, leaving checkout, or completing checkout.
- [x] Add source-contract coverage so the scanner cannot mount from checkout-context readiness alone.

### Review
- 2026-06-23: Checkout details no longer arm the hidden HID scanner just because event/purpose/return-time context is complete. `KioskCheckoutView` now uses explicit scanner-capture state that turns on only from Start Scanning and turns off for edit, disappear, and completion paths, so visible native text fields and date/time pickers keep keyboard/tap ownership before scan mode. Verification passed with focused scanner/API contract tests, docs check, iOS drift, iOS audit gaps, whitespace check, WisconsinKiosk simulator build, Wisconsin simulator build, and WisconsinKiosk generic iOS device compile. The physical 10.5-inch iPad was visible to CoreDevice but unavailable, so install/launch was not possible in this pass.

---

## Deferred: Kiosk extraction and consolidation debt (2026-06-22)

Status: Deferred by user. Do not start until explicitly resumed.

Plan: future slice should preserve the current `WisconsinKiosk` target split while reducing the debt created by recent kiosk velocity.

- [ ] Extract `KioskCheckoutDetailSheet` and its edit/item-row subviews out of `KioskIdleView.swift`.
- [ ] Move active checkout mutation logic from `/api/kiosk/checkout/[id]` into a focused kiosk checkout service.
- [ ] Add service-level tests for update details, scan-add serialized item, scan-add numbered bulk unit, remove serialized item, and remove numbered bulk unit.
- [ ] Keep `WisconsinKiosk` as a separate iOS 17 target, not a separate repo or product fork.
- [ ] Continue requiring both `WisconsinKiosk` and full `Wisconsin` builds before shipping kiosk changes.

### Rationale
- 2026-06-22: Extraction plan is sound as a target split, but not as a full fork. The next work should be consolidation rather than features: shrink the oversized kiosk idle/detail drawer file, move custody mutations out of the route handler, and pin behavior with service tests.

---

## Active: iOS kiosk input and student hub recovery (2026-06-22)

Plan: hotfix from live iPad testing on iPadOS 17.7.11.

- [x] Keep checkout detail text entry on the native iOS keyboard while removing the iPad shortcut/suggestion assistant bar.
- [x] Make student-context decoding tolerant of partial checkout/pickup/reservation rows.
- [x] Replace generic "check your connection" first-load copy with classified network/session/server/decode handling.
- [x] Run focused source-contract tests, iOS drift/audit gates, and kiosk/full-app builds.

### Review
- 2026-06-22: Live iPad hotfix installed on the connected iPad Pro 10.5. Checkout detail text entry now uses a native UIKit text field that keeps the iOS keyboard but clears the assistant/suggestion bar, including the hidden scanner field. Student hub loads now wait through brief connectivity loss, decode partial context rows lossily, route 401 back to activation, ignore cancellations, and show network/server/decode/not-found failures distinctly instead of always blaming the internet. Verification passed with focused iOS contract tests, drift check, iOS audit gaps, XcodeGen project check, kiosk simulator build, kiosk generic iOS build, full Wisconsin simulator build, signed device build, clean uninstall/install, and launch on the connected iPad.

---

## Active: Kiosk active checkout edits (2026-06-22)

Plan: `tasks/archive/kiosk-active-checkout-edit-plan.md`

- [x] Add kiosk-authenticated active checkout mutation routes.
- [x] Add native kiosk drawer controls for title/due-back edit, scan-add, and remove.
- [x] Add route/source contract coverage.
- [x] Sync docs and run verification.

### Review
- 2026-06-22: Active checkout edit slice shipped locally and installed on the connected iPad Pro 10.5. `/api/kiosk/checkout/[id]` now supports kiosk-scoped PATCH/POST/DELETE mutations for detail updates, scan-add, and remove-one-item, with availability checks, serializable transactions, allocation/bulk-unit updates, and audit entries. Native kiosk detail drawers expose title/due-back editing, scan-add, and remove controls using native input/date controls and refresh dashboard data after successful mutations. Verification passed with TypeScript, focused Vitest, docs/codemap check, iOS drift/audit gates, whitespace check, WisconsinKiosk simulator build, Wisconsin simulator build, WisconsinKiosk generic iOS device compile, signed device build, normal device install, and launch.

---

## Active: iOS kiosk counter/list skew hotfix (2026-06-22)

Plan: hotfix from live iPad testing on iPadOS 17.7.11.

- [x] Diagnose why dashboard counters can decode while Items Out / Checkouts / student active-checkout rows appear empty.
- [x] Make kiosk API date decoding accept server ISO timestamps with and without fractional seconds.
- [x] Run focused source-contract tests, iOS drift/audit gates, and kiosk/full-app builds.
- [x] Install and launch the rebuilt kiosk app on the connected iPad.

### Review
- 2026-06-22: Counter/list skew hotfix installed on the connected iPad Pro 10.5. Root cause was kiosk row models requiring `Date` fields while the default Swift ISO8601 decoder can reject server timestamps with fractional seconds, letting numeric counters decode while Items Out, Checkouts, and student hub rows decode to empty. `KioskAPIClient` now accepts ISO dates with and without fractional seconds. Verification passed with focused iOS contract tests, runtime warning contract, scanner focus, idle cancellation, all-day tests, iOS drift, iOS audit gaps, whitespace check, kiosk simulator build, kiosk generic iOS build, full Wisconsin simulator build, signed device build, clean uninstall/install, and launch on the connected iPad.

---

## Active: iOS 17 kiosk compatibility (2026-06-22)

Plan: `tasks/ios17-kiosk-compat-plan.md`

- [x] Back out the whole-app target downgrade and keep non-kiosk SwiftUI views untouched.
- [x] Add a native iOS 17 kiosk-only app target for the dedicated iPad.
- [x] Generate the Xcode project and build the kiosk target.
- [x] Sync mobile/kiosk docs and record verification.

### Review
- 2026-06-22: Native iOS 17 kiosk-only target shipped locally. `WisconsinKiosk` is an iPad-only app target that starts directly in kiosk mode, includes only kiosk source/resources, and builds for iOS 17.0. The full `Wisconsin` app and tests remain on iOS 26.0, with non-kiosk SwiftUI views untouched. Verification passed with XcodeGen project check, focused iOS source-contract Vitest, iOS drift, iOS audit gaps, docs codemap check, diff whitespace, kiosk simulator build, and full app simulator build.

---

## Active: Largest ownership files policy closeout (2026-06-22)

Plan: `tasks/largest-ownership-files-policy-plan.md`

- [x] Re-check current largest-file evidence in `docs/CODEMAPS/architecture.md`.
- [x] Confirm the touched hotspot, `EquipmentPicker.tsx`, received one stable render-only extraction.
- [x] Leave untouched ownership hotspots for future related work instead of splitting them speculatively.
- [x] Sync `DESLOPPIFY.md` and close the plan checklist.
- [x] Run documentation verification gates.

### Review
- 2026-06-22: Largest ownership files policy closed locally. The oversized-source watchlist in `docs/CODEMAPS/architecture.md` now keeps current hotspots visible, N4 already extracted one stable render-only responsibility from the touched `EquipmentPicker.tsx` hotspot, and the remaining large ownership files are explicitly left for future related area work rather than a speculative standalone split. Verification passed with docs/codemap check, migration prefix check, and diff whitespace check.

---

## Active: Equipment picker render split (2026-06-22)

Plan: `tasks/equipment-picker-render-split-plan.md`

- [x] Inspect `EquipmentPicker.tsx`, existing picker helpers, and N4 backlog guidance.
- [x] Keep the slice render-only: no search, scan, conflict-check, or data-hook changes.
- [x] Extract the selected-items shelf into a presentational component.
- [x] Add focused source-contract coverage.
- [x] Sync `DESLOPPIFY.md`, generated codemaps, and task ledger.
- [x] Run focused tests and closeout gates.

### Review
- 2026-06-22: Equipment picker render split shipped locally. The selected-items shelf moved into `src/components/equipment-picker/SelectedEquipmentShelf.tsx` as a presentational component, while `EquipmentPicker.tsx` still owns search, scan lookup, conflict checks, section data, and selection state. `tests/equipment-picker-render-split-source.test.ts` pins the split boundary. Verification passed with focused Vitest, TypeScript, codemap regeneration/docs check, migration prefix check, diff whitespace check, and `npm run build:app`.

---

## Active: Hook dependency escape hatch cleanup (2026-06-22)

Plan: `tasks/hook-dependency-escape-hatch-plan.md`

- [x] Inspect M4 target files and current `react-hooks/exhaustive-deps` / `as unknown as` usage.
- [x] Remove safe dependency suppressions from primitive-key cache update callbacks and URL/keyed effects.
- [x] Add rationale coverage for remaining derived-key suppressions.
- [x] Add focused source-contract coverage.
- [x] Sync `DESLOPPIFY.md`, generated codemaps if needed, and close the plan checklist.
- [x] Run focused tests and closeout gates.

### Review
- 2026-06-22: Hook dependency escape hatch cleanup shipped locally. Avoidable `react-hooks/exhaustive-deps` suppressions were removed from last-audit lookup, booking detail cache patching, booking list background-error toasts, booking wizard defaults, item detail keyboard tabs, notifications cache patching, and items cache patching. Remaining derived-key suppressions in event context and equipment conflict checks now carry rationale comments, and `tests/hook-escape-hatches-source.test.ts` pins documented suppressions plus primitive cache keys. Verification passed with focused Vitest, TypeScript, codemap regeneration/docs check, migration prefix check, diff whitespace check, and `npm run build:app`.

---

## Active: Oversized file watchlist (2026-06-22)

Plan: `tasks/oversized-file-watchlist-plan.md`

- [x] Inspect `DESLOPPIFY.md`, `scripts/generate-codemaps.mjs`, generated codemaps, and `tasks/todo.md`.
- [x] Choose an informational codemap section without adding hard line-count policy.
- [x] Add the generated watchlist and regenerate codemaps.
- [x] Sync `DESLOPPIFY.md` and close the plan checklist.
- [x] Run doc-focused verification and record results.

### Review
- 2026-06-22: Oversized file watchlist shipped locally. `scripts/generate-codemaps.mjs` now generates an informational top-20 TypeScript/TSX source file table in `docs/CODEMAPS/architecture.md`, with explicit copy that line count is not a failure threshold. Verification passed with codemap regeneration, docs/codemap check, migration prefix check, and diff whitespace check.

---

## Active: Plan ledger navigation cleanup (2026-06-22)

Plan: `tasks/plan-ledger-navigation-plan.md`

- [x] Inspect `plans/README.md`, `tasks/README.md`, `tasks/INDEX.md`, `tasks/todo.md`, and `DESLOPPIFY.md`.
- [x] Add explicit current-vs-historical navigation guidance to `plans/README.md`.
- [x] Add a start-here note to `tasks/INDEX.md`.
- [x] Sync `DESLOPPIFY.md` and close the plan checklist.
- [x] Run doc-focused verification and record results.

### Review
- 2026-06-22: Plan ledger navigation cleanup shipped locally. `plans/README.md` now identifies itself as a historical improve-plan registry and points current cleanup work to `DESLOPPIFY.md`, `tasks/todo.md`, and `tasks/INDEX.md`; `tasks/INDEX.md` now has a start-here note that separates active backlog execution from historical plan context. Verification passed with docs/codemap check, migration prefix check, and diff whitespace check.

---

## Active: Decision contract tests (2026-06-22)

Plan: `tasks/decision-contracts-plan.md`

- [x] Inspect decision text, helper ownership, existing focused tests, and app/web route surfaces.
- [x] Add `tests/decision-contracts.test.ts` for the three target decisions.
- [x] Run focused Vitest and closeout gates.
- [x] Sync `DESLOPPIFY.md` and `tasks/todo.md`.

### Review
- 2026-06-22: Decision contract tests shipped locally. `tests/decision-contracts.test.ts` now pins D-025 booking status label/display behavior, D-027 venue mapping regex validation and admin-only deterministic matching, and D-040 app/web reservation-first custody boundaries. Verification passed with focused Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

---

## Active: Testing guide refresh (2026-06-22)

Plan: `tasks/testing-guide-refresh-plan.md`

- [x] Inspect `docs/TESTING.md`, `plans/README.md`, `package.json`, current test inventory, helpers, and `BUG:` usage.
- [x] Replace stale suite counts and known-bug table with current inventory and conventions.
- [x] Document when to run focused Vitest, TypeScript, docs/codemap, migration-prefix, build, and iOS gates.
- [x] Add a reusable test inventory refresh command.
- [x] Sync `plans/README.md`, `DESLOPPIFY.md`, and `tasks/todo.md`.
- [x] Run doc-focused verification and record results.

### Review
- 2026-06-22: Testing guide refresh shipped locally. `docs/TESTING.md` now reflects 242 test files, 1,430 static test declarations, current `BUG:` usage, current helper files, verification gate guidance, and reusable inventory commands. `plans/README.md` now points readers to `docs/TESTING.md` for current inventory instead of historical improve-plan counts. Verification passed with the documented inventory commands, `npm run verify:docs`, `npm run db:migrate:check`, and `git diff --check`.

---

## Active: Booking status display cleanup (2026-06-22)

Plan: `tasks/booking-status-display-cleanup-plan.md`

- [x] Audit D-025, booking detail helpers, booking list helpers, item booking history, and existing status-label tests.
- [x] Add a shared display-only booking status helper.
- [x] Keep existing detail/list imports stable through wrappers or re-exports.
- [x] Migrate item booking history/calendar rows away from local status switches.
- [x] Delete impossible legacy booking-status branches from item history UI.
- [x] Add focused regression and source-contract coverage.
- [x] Sync DESLOPPIFY, relevant area docs, codemaps, and task ledger.
- [x] Run focused Vitest, TypeScript, docs, migration, whitespace, and app-build gates.

### Review
- 2026-06-22: Booking status display cleanup shipped locally. Booking details, booking-list visuals, item booking overview/history, upcoming item reservations, and item schedule agenda rows now use `src/lib/booking-status-display.ts` for labels and badge/status colors. The item tab's local booking status switch and legacy booking states were removed. Verification passed with focused Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

---

## Active: Venue mapping contract cleanup (2026-06-22)

Plan: `tasks/venue-mapping-contract-plan.md`

- [x] Audit D-027 source, schema, docs, route, sync, and tests.
- [x] Add shared venue mapping contract helpers.
- [x] Enforce ADMIN-only route access and invalid-regex rejection.
- [x] Apply deterministic matching in calendar sync and audit helpers.
- [x] Add focused regression tests and sync docs.
- [x] Run verification and record results.

### Review
- 2026-06-22: D-027 venue mapping contract cleanup shipped locally. Venue mappings now share regex validation/matching/ordering helpers; API reads are ADMIN-only; create rejects invalid regexes; calendar sync applies priority plus longest-pattern matching; audit and sync no longer use substring fallback for invalid regex patterns. Verification passed with focused Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

---

## Active: Booking action policy cleanup (2026-06-22)

Plan: `tasks/booking-action-policy-cleanup-plan.md`

- [x] Audit D-040 docs, client action helper, server rules, list menu usage, and tests.
- [x] Extract shared DB-free booking action policy.
- [x] Remove stale app/web `checkin` action exposure.
- [x] Update focused client/server action tests.
- [x] Sync DESLOPPIFY and relevant docs.
- [x] Run verification and record results.

### Review
- 2026-06-22: Booking action policy cleanup shipped locally. App/web booking list actions and server booking rules now share DB-free booking action policy helpers, so OPEN checkouts no longer expose `checkin` in regular app/web menus under D-040. Verification passed with focused booking action Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

---

## Active: Assets gap query bounds (2026-06-22)

Plan: `tasks/assets-gap-query-bounds-plan.md`

- [x] Audit missing-field asset route, Gap Wizard consumer, docs, and tests.
- [x] Bound standard item and item-family gap reads at the database query layer.
- [x] Preserve totals and return suggestion cap metadata.
- [x] Add focused route tests.
- [x] Sync DESLOPPIFY and relevant docs.
- [x] Run verification and record results.

### Review
- 2026-06-22: Assets gap query bounds shipped locally. Missing-category and missing-department cleanup now counts standard items and item families separately, pages source reads at the database layer, and reports capped suggestion matching to the Gap Wizard. Verification passed with focused missing-gap route Vitest, category cleanup wizard source-contract Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

---

## Active: Schedule role-slot hardening (2026-06-20)

Plan: `tasks/schedule-role-slot-hardening-plan.md`

- [x] Add role-slot mismatch detection to shared Schedule data quality and health.
- [x] Add explicit staff/admin repair route for historical role-slot mismatches.
- [x] Return assignment reroute metadata and surface honest assignment toast copy.
- [x] Split export columns into assigned role and planned slot context.
- [x] Add picker/copy-forward/Open Work hardening coverage and docs.
- [x] Run final verification and record results.

### Review
- 2026-06-20: Role-slot hardening shipped locally. Schedule data quality now flags active assignments whose assigned role disagrees with the planned slot, readiness highlights crew role-slot mismatches, `POST /api/shift-assignments/[id]/repair-role-slot` repairs historical mismatches through the same matching-slot rules, assignment APIs return role-slot outcome metadata for honest UI toasts, pickers explain when a matching slot will be used, exports split Assigned Role from Planned Slot, auto-fill preview labels planned versus assigned role, and Open Work defensively prevents Staff slots from becoming student pickup actions. Verification passed with focused Vitest, TypeScript, diff whitespace, and `npm run build:app`.

---

## Active: Schedule list simplification (2026-06-20)

Plan: compact the expanded Schedule list row so it stays focused on staffing and call time.

- [x] Remove linked/reserved gear badges and reservation-prep actions from the Schedule list.
- [x] Remove repeated inline add-slot controls from expanded shift rows.
- [x] Keep assignment, remove, trade, and one-call-time controls visible.
- [x] Group repeated call times and hide redundant filled-row Staff/Student labels.
- [x] Remove parent-row call-time summary copy from desktop and mobile list rows.
- [x] Sync source-contract tests and Schedule docs.
- [x] Run focused verification and record results.

### Review
- 2026-06-20: Schedule list simplification shipped locally. Expanded Schedule rows now show area, assigned person/open slot, one call-time editor, and minimal assignment actions; repeated add-slot controls plus linked/reserved gear badges and reserve-gear actions were removed from the Schedule list. Detailed gear readiness remains in Event detail and gear queues. Verification passed with focused source-contract Vitest, TypeScript, codemap/docs check, diff whitespace, and `npm run build:app`.
- 2026-06-20: Follow-up simplification grouped repeated expanded-row call times behind one "Most rows" call summary, kept only exception call-time controls visible, renamed the expanded section to Crew, and hid filled-row Staff/Student labels when they match the planned slot. Verification passed with focused source-contract Vitest, TypeScript, docs check, whitespace, and `npm run build:app`.
- 2026-06-20: Follow-up correction removed parent-row call-time preview copy from desktop and mobile Schedule list rows. Call time now lives only in expanded Crew rows, with common and exception call times shown there. Verification recorded after focused checks.
- 2026-06-20: Browser-smoke follow-up started a clean local dev server on `127.0.0.1:3060`; protected `/schedule` redirected to `/login`, but the documented seed admin credentials did not authenticate against the current Neon-backed environment, so authenticated Schedule visual proof remains blocked. Source-contract tests, TypeScript, docs check, whitespace, and `npm run build:app` remain the accepted verification for this local slice.

---

## Active: Schedule staffing class model (2026-06-20)

Plan: `tasks/schedule-staffing-class-plan.md`

- [x] Add `User.staffingType` schema field and migration backfilled from current role.
- [x] Wire Schedule display/routing/scoring/export logic to scheduling class while leaving permissions on `User.role`.
- [x] Surface editable Scheduling class on user detail.
- [x] Add focused regression coverage and sync Schedule docs/gaps.
- [x] Run local verification and record results.
- [x] Deploy pending migration and rerun live migration health.

### Review
- 2026-06-20: Explicit Schedule worker-class model implemented locally. `User.staffingType` now separates scheduling identity from app permission role, backfills existing users from current role, appears as editable Scheduling class on user detail, and drives Schedule labels, direct assignment routing, candidate scoring, copy-forward, auto-fill preview, exports, data-quality checks, Open Work pickup, and trade eligibility. Local verification passed with Prisma format/generate/validate, migration prefix check, focused Vitest schedule tests, TypeScript, codemap generation, docs verification, whitespace check, and `npm run build:app`. Live migration health reached Neon and reported `0082_user_staffing_type` pending; `npm run db:migrate:deploy` was blocked by the approval system before execution, so deploy plus final health remain open.
- 2026-06-20: Live migration follow-up completed. `npm run db:migrate:health` reached Neon and reported all 84 local migrations applied, newest local migration `0082_user_staffing_type` applied, no pending local migrations, no unresolved failed rows, and no DB-only migrations.

---

## Active: Schedule staff/student display cleanup (2026-06-20)

Plan: `tasks/schedule-role-label-cleanup-plan.md`

- [x] Audit Schedule filled-row, assignment, detail-panel, and readiness copy for planned-slot labels leaking into assigned-person labels.
- [x] Patch assigned rows/cards to display the assigned user role, while reserving Staff/Student slot copy for open planning slots.
- [x] Replace role-specific needs summary copy with neutral crew/people copy where the UI is counting open slots.
- [x] Add focused regression coverage and sync Schedule docs.
- [x] Run focused verification and record results.

### Review
- 2026-06-20: Staff/student display cleanup shipped locally. Filled Schedule rows and shift cards now show Staff or Student from the assigned user's role, open rows keep Staff slot/Student slot language, assignment buttons use generic open-slot copy, and coverage/readiness copy says Needs crew or Needs n people instead of Needs n students. Verification passed with focused Vitest, TypeScript, diff whitespace, and `npm run build:app`.
- 2026-06-20: Follow-up correction removed inferred worker classification from roster/profile metadata. Schedule MVP now treats `User.role` as the only current Staff/Student identity source for filled assignments, keeps `Shift.workerType` as the planned open-slot source, and tracks the smarter explicit scheduling-classification model as `PENDING-SCHEDULE-01` in `docs/GAPS_AND_RISKS.md`.

---

## Active: shadcn UI polish pass (2026-06-20)

Plan: goal-tracked cross-cutting UI polish across shared shadcn-centered surfaces.

- [x] Audit Settings/Reports tab rails against the lighter breadcrumb treatment and current docs.
- [x] Patch Settings/Reports rails to use a shared lighter section-nav treatment with clear active states and 40px+ targets.
- [x] Sync Settings/Reports docs and record nav-rail verification.
- [x] Run focused TypeScript, build, docs, whitespace, and browser smoke checks for the nav-rail slice.
- [x] Audit and patch FilterChip plus active filter chips.
- [x] Audit and patch OperationalToolbar.
- [x] Audit and patch SaveableField.
- [x] Audit and patch avatar/UserAvatar adoption.
- [x] Audit and patch hand-rolled empty states.

### Review
- 2026-06-20: Started the goal-tracked shadcn UI polish pass with the Settings/Reports navigation rail slice. Breadcrumb polish established the quieter navigation chrome direction; this slice is consolidating the matching section navigation treatment before moving to FilterChip and active filter chips.
- 2026-06-20: Settings/Reports nav rail slice shipped locally. Added shared `SectionNav` chrome with a translucent shell, 40px+ link targets, horizontal active underline, and desktop Settings rail active accent. Settings and Reports now consume the helper, area docs are synced, and verification passed with TypeScript, app build, docs check, whitespace check, and authenticated browser smoke on `/settings/notifications` plus `/reports/checkouts`.
- 2026-06-20: FilterChip and active-filter chip slice shipped locally. Shared filter chips now use lighter borders, clearer active underline treatment, truncated values, 40px trigger/clear targets, and quieter removable active-filter buttons across operational toolbars. Items, Checkouts, Reservations, and Reports docs are synced; verification is recorded after the focused checks and browser smoke.
- 2026-06-20: OperationalToolbar shell slice shipped locally. The shared toolbar now uses lighter translucent chrome so list command rows read as page controls instead of bordered cards, while children keep their existing layout and 40px control contracts. Design language plus Items, Checkouts, Reservations, and Users docs are synced; verification is recorded after focused checks and browser smoke.
- 2026-06-20: SaveableField slice shipped locally. Shared inline-edit rows now have a quieter hover treatment, visible dirty accent, status pills, and 40px save/cancel buttons with existing field-specific accessible names preserved. Design language plus Items, Checkouts, Reservations, Users, and Kits docs are synced; verification is recorded after focused checks and browser smoke.
- 2026-06-20: UserAvatar slice shipped locally. The shared people avatar now object-fits uploaded photos, strengthens deterministic initials fallback styling, and Items custody/status badges use the semantic `xs` avatar size instead of a custom 18px override. Design language plus Items and Users docs are synced; verification is recorded after focused checks and browser smoke.
- 2026-06-20: Empty-state slice shipped locally. Kit detail add-member misses and empty item-family membership now use shared inline `EmptyState` treatment instead of text-only placeholders. Design language and Kits docs are synced; verification is recorded after focused checks and browser smoke.

---

## Active: shadcn hand-rolled UI cleanup follow-up (2026-06-20)

Plan: tighten older route-local UI that still duplicates shadcn primitives after the shared polish pass.

- [x] Replace the raw global error actions and inline styling with shadcn `Button` plus semantic tokens.
- [x] Replace image-picker text-only search notices and selectable image tile controls with shared shadcn primitives.
- [x] Replace onboarding dialog local metric/status panels with shadcn `Card` composition.
- [x] Sync design/users/items docs and record verification.
- [x] Run TypeScript, app build, docs, whitespace, and browser smoke checks.

### Review
- 2026-06-20: Started the follow-up after the shadcn usage audit. Scope is intentionally narrow: global error fallback actions, image-picker search placeholders/selection tile controls, and onboarding dialog metric/status panels.
- 2026-06-20: Follow-up shipped locally. `global-error` now uses shadcn `Button` and semantic tokens instead of inline-styled raw controls; `ChooseImageModal` uses shadcn `Empty` for search notices and shadcn `Button` for result selection; `OnboardingDialog` metric/status counts use shadcn `Card` without nested cards, and the account-status singular copy now reads correctly. Verification passed with TypeScript, docs/codemap check, app build, diff whitespace, and authenticated browser smoke for the image picker plus onboarding dialog.

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

### Follow-up
- [x] Remove duplicate slot + assignment call-time controls from filled Schedule rows, event detail shift cards, and `/schedule/assign` cells.
- [x] Add regression coverage that filled rows use one assignment-target call editor and open slots use one slot-target call editor.
- [x] Run focused verification and record results.

### Follow-up Review
- 2026-06-20: Duplicate call-time controls removed. Filled Schedule rows, Event detail shift cards, and `/schedule/assign` assigned cells now render a single assignment-target call editor; open slots render the slot-target editor. Verification passed with focused Vitest, TypeScript, diff whitespace, and `npm run build:app`.

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
