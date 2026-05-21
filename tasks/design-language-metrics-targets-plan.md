# Design Language Metrics And Target Cleanup Plan

## Objective

Execute the next three design-language slices:

1. Reports metric-card consolidation.
2. Kits and Battery Ops metric-card strip cleanup.
3. Labels and Search action-target audit.

## Required Reads

- [x] `AGENTS.md`
- [x] `docs/BRIEF_*` relevant to kits and adjacent operational surfaces.
- [x] `docs/AREA_REPORTS.md`
- [x] `docs/AREA_KITS.md`
- [x] `docs/AREA_BULK_INVENTORY.md`
- [x] `docs/DESIGN_LANGUAGE.md`
- [x] `docs/DECISIONS.md`
- [x] `docs/GAPS_AND_RISKS.md`
- [x] `prisma/schema.prisma`
- [x] Target and peer page source files in full.

## Slice 1: Reports Metrics

- [x] Inventory existing report metric usage.
- [x] Consolidate report metric presentation with `OperationalMetricCard` without losing report-specific links, hints, or string values.
- [x] Update reports and design-language docs.

## Slice 2: Kits And Battery Ops Metrics

- [x] Inventory Kits and Battery Ops metric strips.
- [x] Move local metric strips to the shared operational metric primitive.
- [x] Update area/design docs.

## Slice 3: Labels And Search Target Audit

- [x] Audit Labels controls for 40px target size, labels, focus, and shadcn usage.
- [x] Audit Search controls/result actions for 40px target size, labels, focus, and shadcn usage.
- [x] Patch concrete mismatches only.
- [x] Update checklist/docs with what changed.

## Verification

- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Authenticated browser smoke for changed visible routes.

## Verification Notes

- `npx tsc --noEmit` passed after running it serially; the earlier parallel run conflicted with `next build` regenerating `.next/types`.
- `npm run db:migrate:check` passed with 70 migrations and no prefix collisions.
- `git diff --check` passed.
- `npx next build` passed. It still prints the known Node `[DEP0205] module.register()` warning.
- Authenticated browser smoke passed for `/reports/utilization`, `/kits`, `/bulk-inventory/batteries`, `/labels`, and `/search?q=sony`.
- Browser console review found no route errors after the Search input received stable `id` and `name` attributes.

## Review

- Completed all three requested slices.
- Reports metrics now go through the shared `OperationalMetricCard` adapter while preserving report-specific links and tooltip behavior.
- Kits and Battery Ops now use the shared operational metric primitive instead of local metric cards.
- Labels and Search compact clear/open/result controls now meet the 40px operational target baseline with visible focus states.
- Remaining design-language work should stay page-specific: low-traffic detail routes after their owning pass, and `OperationalToolbar` for Kits only if the filter set grows.
