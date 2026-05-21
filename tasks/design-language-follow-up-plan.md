# Design Language Follow-Up Plan

## Objective

Execute the next three design-language follow-ups in the requested order:

1. Repo hygiene and shipment cleanup.
2. Lower-traffic route conformance checklist.
3. Schedule filter cleanup.

## Slice 4: Repo Hygiene

- [x] Confirm completed design-language plan files are safe to archive.
- [x] Keep proof screenshots local and ignored instead of committing large browser-smoke artifacts.
- [x] Move completed follow-up plan files to `tasks/archive/`.
- [x] Record the local database-env mismatch without exposing secrets.

### Repo Hygiene Notes

- Archived completed follow-up plans:
  - `tasks/archive/design-language-goal-plan.md`
  - `tasks/archive/design-language-shared-component-consolidation-plan.md`
  - `tasks/archive/design-language-state-copy-audit-plan.md`
  - `tasks/archive/design-language-touch-target-batch-plan.md`
  - `tasks/archive/settings-consistency-follow-through-plan.md`
- Kept `tasks/design-language-route-conformance-checklist.md` active because it is being extended in the next slice.
- Added `tasks/design-language-proof-*.png` to `.gitignore`; these browser-smoke screenshots are local proof artifacts, not durable source docs.
- Local env mismatch remains: `.env` and `.env.development.local` point at different Neon hosts. The working browser-smoke path used `.env`; `.env.development.local` still points at the stale host and should be fixed by updating the local secret file outside git.

## Slice 3: Lower-Traffic Conformance Checklist

- [x] Extend `tasks/design-language-route-conformance-checklist.md` beyond Dashboard, Schedule, Items, Bookings, Users, and Settings.
- [x] Cover Kits, Licenses, Resources, Labels, Notifications, Search, Reports, Bulk Inventory, and high-traffic detail pages.
- [x] Identify only concrete next fixes.

### Lower-Traffic Checklist Notes

- Updated stale checklist entries for Bookings and Settings to reflect the completed toolbar and Settings follow-through work.
- Added route summaries and details for Kits, Licenses, Resources, Labels, Notifications, Search, Reports, Battery Ops, Bulk SKU detail, and detail pages.
- Concrete next fixes are now limited to Schedule filters, Reports metrics, and follow-on local metric-card strips in Kits and Battery Ops.

## Slice 2: Schedule Filters

- [x] Read current Schedule area docs and filter source.
- [x] Replace raw schedule segmented controls with shadcn-backed controls where the behavior matches.
- [x] Keep schedule as a documented domain-specific command-bar exception rather than forcing `OperationalToolbar`.

### Schedule Filter Notes

- Replaced the View and Venue raw segmented button groups with shadcn `ToggleGroup` and `ToggleGroupItem`.
- Preserved Schedule as a domain-specific command bar because the controls switch calendar/list/week modes, venue semantics, coverage, my shifts, past events, and schedule-specific filters.
- Updated `docs/AREA_SHIFTS.md`, `docs/DESIGN_LANGUAGE.md`, and the route conformance checklist.

## Verification

- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Browser-smoke changed visible routes.

### Verification Notes

- Authenticated `/schedule` smoke passed at `http://localhost:3017/schedule`.
- Browser a11y snapshot showed the View controls as `Schedule view` radio group entries and the Venue controls as `Venue filter` radio group entries.
- Browser console had no warnings, errors, or issues after the Schedule smoke.
- Local screenshot proof captured at `tasks/design-language-proof-schedule-togglegroup-followup.png`; this path is intentionally ignored by git.
- `npx next build` still prints the existing Node `[DEP0205] module.register()` warning, but the production build completed successfully.

## Review

- Completed the requested 4, 3, 2 batch: repo hygiene, lower-traffic conformance checklist expansion, and Schedule filter cleanup.
- The remaining high-impact design-language work is now better bounded: reports metrics consolidation first, then local metric-card strips in Kits and Battery Ops, then Labels/Search target audit.
