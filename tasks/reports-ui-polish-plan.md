# Reports UI Polish Plan

Date: 2026-05-09

## Goal

Make `/reports` feel like one engineered analytics surface instead of six adjacent pages with similar pieces built slightly differently.

## Slice 1: Shared Reports Shell

- [x] Add shared report UI helpers for toolbar rhythm, metric grids, section cards, and loading skeletons.
- [x] Migrate report pages to the shared helpers without changing API contracts or report data shape.
- [x] Improve scan rhythm: tabular numbers, balanced section headers, consistent action placement, and tighter responsive wrapping.
- [x] Keep the pass read-only from a product standpoint. No new filters, permissions, report semantics, or schema work.

## Slice 2: Chart And Dense Data Polish

- [x] Move report charts onto the shared section-card wrapper.
- [x] Share the report chart palette instead of redefining color arrays per chart file.
- [x] Normalize chart content padding, heights, numeric legends, and table/card numeric alignment.
- [x] Keep behavior unchanged: no API, permissions, filters, or data semantics changes.

## Slice 3: Filter Control Polish

- [x] Add a shared Reports segmented-control helper backed by shadcn `ToggleGroup`.
- [x] Replace hand-rolled period and phase button loops on Checkouts, Scans, and Audit reports.
- [x] Preserve URL sync, page reset behavior, and selected-filter semantics.

## Slice 4: Report State Polish

- [x] Add shared report helpers for error, empty, and pagination states.
- [x] Replace duplicated report error alerts with the shared retry block.
- [x] Replace one-off empty-state calls with report-specific empty copy.
- [x] Normalize paginated footer layout on Scans and Audit without changing query-param behavior.

## Slice 5: Row And Dense List Polish

- [x] Add shared report row/link helpers for table links, mobile cards, and compact list rows.
- [x] Migrate checkout and scan booking links to the shared table-link treatment.
- [x] Migrate mobile report rows and utilization/bulk-loss list rows to the shared row rhythm.
- [x] Replace overdue disclosure text arrows with lucide chevrons while preserving click and keyboard behavior.

## Slice 6: Export Action Polish

- [x] Add a shared `ReportExportButton` with a download icon.
- [x] Add shared CSV escaping and browser download helper for report exports.
- [x] Migrate Utilization, Checkouts, Overdue, Scans, and Audit exports to the shared helper.
- [x] Keep exported report content equivalent while making CSV escaping consistent.

## Slice 7: Loading And Row Adoption Cleanup

- [x] Add a shared report chart-loading helper.
- [x] Replace hand-built dynamic chart loading cards on Utilization and Checkouts.
- [x] Migrate the remaining Checkouts mobile requester rows to the shared list-row helper.
- [x] Keep loading dimensions and report behavior unchanged.

## Slice 8: Overdue Presentation Cleanup

- [x] Let `ReportTableLink` accept click handlers for nested row interactions.
- [x] Replace the expanded Overdue mobile booking links with the shared report link helper.
- [x] Replace Overdue inline red text styles with report-compatible text utility classes.
- [x] Preserve Overdue expansion behavior and detail navigation.

## Slice 9: Metadata Line Polish

- [x] Add a shared report metadata-line helper for compact row details.
- [x] Replace raw middle-dot metadata strings in Checkouts mobile rows.
- [x] Replace raw middle-dot metadata strings in expanded Overdue rows.
- [x] Preserve displayed metadata and link behavior.

## Verification

- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Browser smoke the Reports routes when a local session is available. Completed authenticated Chrome DevTools smoke with the seeded admin session across `/reports/utilization`, `/reports/checkouts`, `/reports/overdue`, `/reports/bulk-losses`, `/reports/scans`, and `/reports/audit`. The smoke used the app login API to set the browser session because input automation failed on the login form. Report routes rendered authenticated content with 200 report API responses; a Recharts sizing warning found during smoke was fixed in the shared chart wrapper and rechecked clean on Utilization.

## Review Notes

Slice 1 shipped shared report UI helpers in `src/app/(app)/reports/report-ui.tsx`, updated the Reports layout tabs and header, and migrated Utilization, Checkouts, Overdue, Scans, Bulk Losses, and Audit to the shared toolbar, metric grid, section card, and loading patterns. Product behavior stayed read-only.

Slice 2 moved all Reports chart components onto the shared chart card wrapper, centralized the chart color palette, added tabular legends where counts render inline, and stopped the utilization breakdown chart from mutating its input array during sort.

Slice 3 replaced report filter button loops with the shared `ReportSegmentedControl`, keeping the same query-param behavior while making the segmented controls consistent and accessible.

Slice 4 added shared error, empty, and pagination helpers so report states now use the same retry language, responsive action layout, and explanatory empty-state copy across Utilization, Checkouts, Overdue, Scans, Bulk Losses, and Audit.

Slice 5 added shared row primitives for dense report lists, normalized table link focus/hover treatment, reused the mobile card/list-row rhythm, and replaced text disclosure arrows in Overdue with chevrons without changing navigation or expansion semantics.

Slice 6 added an icon-backed shared export button and centralized CSV generation/escaping for every Reports page with an export action, replacing five one-off Blob/download implementations.

Slice 7 finished the visible adoption cleanup by moving dynamic chart placeholders onto `ReportChartLoading` and removing the last simple one-off mobile requester rows from Checkouts.

Slice 8 tightened the Overdue report by removing the remaining inline red text styling, reusing `ReportTableLink` inside expanded mobile rows, and keeping row expansion clicks separate from booking navigation.

Slice 9 normalized compact metadata rows with `ReportMetaLine`, replacing raw separator strings in Checkouts and Overdue while keeping the same requester, location, item-count, due-date, and item-name content.

Authenticated browser smoke completed after Slice 9. The seeded admin session rendered all six Reports routes, confirmed the tab shell, report controls, metric content, chart/list surfaces, empty states where applicable, and export actions. A stale Audit tab initially showed Utilization content until hard navigation; the refreshed Audit route rendered the audit trail correctly. A Recharts initial sizing warning was fixed centrally in `src/components/ui/chart.tsx` with stable responsive-container dimensions.
