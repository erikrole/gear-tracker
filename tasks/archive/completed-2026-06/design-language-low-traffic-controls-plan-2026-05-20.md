# Design Language Low-Traffic Controls Plan

## Objective

Execute the next practical design-language batch across lower-traffic but still operational surfaces:

1. Notifications metric/action cleanup.
2. Licenses metric/header control cleanup.
3. Resources filter/control cleanup.

## Required Reads

- [x] `AGENTS.md`
- [x] `.agents/skills/gt-page/SKILL.md`
- [x] `docs/DESIGN_LANGUAGE.md`
- [x] `tasks/design-language-route-conformance-checklist.md`
- [x] `docs/AREA_NOTIFICATIONS.md`
- [x] `docs/AREA_LICENSES.md`
- [x] `docs/AREA_RESOURCES.md`
- [x] `docs/AREA_ITEMS.md`
- [x] Relevant `docs/BRIEF_*` files.
- [x] `docs/DECISIONS.md`
- [x] `docs/GAPS_AND_RISKS.md`
- [x] `prisma/schema.prisma`
- [x] Target route source files and shared components in full.

## Slice 1: Notifications

- [x] Replace route-local summary metric cards with `OperationalMetricCard`.
- [x] Raise header, retry, destination, and mark-read actions to the 40px target baseline.
- [x] Keep the page list-first and notification-center specific.

## Slice 2: Licenses

- [x] Replace route-local summary metric cards with `OperationalMetricCard`.
- [x] Raise compact header icon and admin controls to the 40px target baseline.
- [x] Preserve the 2-slot license table behavior and masking model.

## Slice 3: Resources

- [x] Move removable active-filter badges to `OperationalActiveFilterChips`.
- [x] Replace raw sort `<select>` with shadcn `Select`.
- [x] Raise resource search/filter/sort/contact link targets and focus affordances without changing the rail exception.

## Verification

- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Authenticated browser smoke for `/notifications`, `/licenses`, and `/resources`.

## Review

- Completed all three requested low-traffic control slices.
- Static checks passed after fixing narrow pre-existing type breaks in Settings data export, Settings profile, bookings export, and profile audit metadata.
- Authenticated smoke covered `/notifications`, `/licenses`, and `/resources?filter=contacts&q=erik&sort=recent`; console review found no warnings, errors, or issues.
- Local smoke required overriding the stale `.env.development.local` database URL with the working Neon URLs from `.env`.
