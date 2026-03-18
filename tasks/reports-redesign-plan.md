# Reports Page Redesign Plan

## Goal
Align the reports hub with the redesigned Users/Settings pages: component extraction, proper CSS classes, mobile responsiveness, skeleton loading, and consistent layout patterns.

## Current State
- 5 report sub-pages: utilization, checkouts, overdue, scans, audit
- Layout uses inline-styled buttons for tab navigation
- No mobile responsiveness (tables don't adapt)
- Simple spinner loading (no skeleton states)
- No EmptyState component usage
- All logic inline in page files (no component extraction)

## Changes

### Slice 1: Layout & Navigation
- [ ] Update `layout.tsx`: Replace inline-styled tab buttons with `item-tabs` / `item-tab` pattern (matching Settings layout)
- [ ] Add `page-header` with `<h1>Reports</h1>` before tabs
- [ ] Remove breadcrumb (redundant with page header + tabs, same as Settings)

### Slice 2: Component Extraction & Shared Types
- [ ] Create `reports/types.ts` for shared report types
- [ ] Extract metric cards to `reports/MetricCard.tsx` (reusable summary card)
- [ ] Extract `reports/ReportTable.tsx` — wrapper that handles desktop table + mobile card pattern

### Slice 3: Utilization Page
- [ ] Use `SkeletonTable` for loading state
- [ ] Use `EmptyState` for error state
- [ ] Mobile cards for location/type/department tables
- [ ] Extract status badge map to shared types

### Slice 4: Checkouts Page
- [ ] Use `SkeletonTable` for loading
- [ ] Use `EmptyState` for error / no-data
- [ ] Mobile cards for recent checkouts table
- [ ] Mobile cards for top requesters table

### Slice 5: Overdue Page
- [ ] Use skeleton loading
- [ ] Use `EmptyState` for error
- [ ] Mobile card layout for leaderboard entries (expandable)

### Slice 6: Scans & Audit Pages
- [ ] Both: skeleton loading, EmptyState for errors
- [ ] Both: mobile card layout for event/entry rows
- [ ] Remove duplicate `formatDateTime` — use shared `@/lib/format` or add to it

### Slice 7: Build Verification & Commit
- [ ] Run `npm run build` — must pass
- [ ] Single commit: `feat: redesign Reports pages with component extraction, tab nav, and mobile support`
