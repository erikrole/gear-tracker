# Settings Area Scope

## Document Control
- Area: Settings
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-17
- Status: Active
- Version: V1

## Direction
Admin-only configuration hub for system-wide settings. Each sub-page is a focused domain. Keep pages self-contained with clear feedback loops (toasts, inline saves).

## Core Rules
1. All settings pages require ADMIN role (enforced at API layer).
2. Settings layout provides unified tab navigation — sub-pages should not render their own page-level `<h1>`.
3. Each sub-page uses the `settings-split` layout: sidebar (title + description) and main (forms/tables).
4. Mutations should provide immediate feedback via toast notifications.

## Sub-Pages

### Categories (`/settings/categories`)
- Hierarchical tree of equipment categories with inline rename, subcategory creation, and delete.
- Search filters the tree (preserves parent nodes for structure).
- Sort toggles A→Z / Z→A.
- Delete is guarded: blocked if category has items or children.

### Sports (`/settings/sports`)
- Toggle sports active/inactive for shift generation.
- Configure home/away shift counts per area (Video, Photo, Graphics, Comms).
- Expandable roster panel per sport — add/remove users.
- Mobile: card layout replaces dense table for shift configs.

### Escalation (`/settings/escalation`)
- Configure overdue notification triggers (timing, recipients, enabled state).
- Fatigue controls: max notifications per booking (prevents alert fatigue).
- Per D-009: escalation schedule is -4h, 0h, +2h, +24h relative to booking.endsAt.

### Database (`/settings/database`)
- On-demand schema health diagnostics.
- Checks: migration table, tables, enums, extensions, column drift.
- Shows remediation steps when issues detected.

## Acceptance Criteria
1. [x] Tab-based navigation across all settings pages
2. [x] Categories: tree CRUD with search and sort
3. [x] Sports: shift config table + roster management
4. [x] Escalation: toggle-based rule management + fatigue cap
5. [x] Database: on-demand diagnostics with status badges
6. [x] Mobile-responsive layouts for all sub-pages
7. [x] Component extraction for maintainability (Sports, Categories)

## Breadcrumb Roadmap

Navigation breadcrumb versioned roadmap: `tasks/breadcrumbs-roadmap.md`

All versions shipped. Duplicate breadcrumb removed; parent-level sibling quick-jump dropdown on "Settings" crumb navigates between sub-pages.

## Change Log
- 2026-03-25: Breadcrumb V1–V3 + polish shipped. Duplicate removed, entity names on detail pages, sibling quick-jump on Settings/Reports parent crumbs, loading skeleton, recently visited entities.
- 2026-03-17: Initial area doc created. Settings layout upgraded to tab navigation pattern. Sports page extracted into ShiftConfigTable + RosterPanel + types. Categories page extracted into CategoryRow + KebabMenu + types + tree utils. Mobile card layouts added for sports and roster. Role badges standardized (ADMIN=purple, STAFF=blue, STUDENT=gray). Escalation and Database pages polished with data-table-wrap for mobile scroll. Sidebar titles normalized to h2 (layout provides h1).
