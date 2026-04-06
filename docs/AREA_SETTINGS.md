# Settings Area Scope

## Document Control
- Area: Settings
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-06
- Status: Active
- Version: V1

## Direction
Admin-only configuration hub for system-wide settings. Each sub-page is a focused domain. Keep pages self-contained with clear feedback loops (toasts, inline saves).

## Core Rules
1. All settings pages require ADMIN or STAFF role (enforced at API layer and client-side layout guard).
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

### Calendar Sources (`/settings/calendar-sources`)
- Enable/disable ICS calendar sources for event sync.
- Sync status badges (green/yellow/red based on `lastFetchedAt` staleness).
- Manual "Sync Now" button. Add/delete sources.
- Per D-026: daily cron sync at 6 AM UTC + manual refresh.

### Venue Mappings (`/settings/venue-mappings`)
- Admin-only regex-to-location mapping table.
- Pattern validation on create/update (rejects invalid regex).
- Priority + longest-match tie-breaking.
- Per D-027: ADMIN-only, STAFF cannot access.

### Allowed Emails (`/settings/allowed-emails`)
- Admin-managed email allowlist for registration gating (D-029).
- Add email with pre-assigned role (STAFF can add STUDENT only, ADMIN can add both).
- Delete unclaimed entries. Claimed entries preserved (audit trail).
- Filter by status (all/unclaimed/claimed).

## Acceptance Criteria
- [x] AC-1: Tab-based navigation across all settings pages
- [x] AC-2: Categories: tree CRUD with search and sort
- [x] AC-3: Sports: shift config table + roster management
- [x] AC-4: Escalation: toggle-based rule management + fatigue cap
- [x] AC-5: Database: on-demand diagnostics with status badges
- [x] AC-6: Mobile-responsive layouts for all sub-pages
- [x] AC-7: Component extraction for maintainability (Sports, Categories)
- [x] AC-8: Calendar sources: enable/disable, sync status, health badges, add/delete
- [x] AC-9: Venue mappings: admin-only CRUD with regex validation
- [x] AC-10: Allowed emails: add/delete with role pre-assignment, registration gating enforced

## Breadcrumb Roadmap

Navigation breadcrumb versioned roadmap: `tasks/breadcrumbs-roadmap.md`

All versions shipped. Duplicate breadcrumb removed; parent-level sibling quick-jump dropdown on "Settings" crumb navigates between sub-pages.

## Change Log
- 2026-03-17: Initial area doc created. Settings layout upgraded to tab navigation pattern. Sports page extracted into ShiftConfigTable + RosterPanel + types. Categories page extracted into CategoryRow + KebabMenu + types + tree utils. Mobile card layouts added for sports and roster. Role badges standardized (ADMIN=purple, STAFF=blue, STUDENT=gray). Escalation and Database pages polished with data-table-wrap for mobile scroll. Sidebar titles normalized to h2 (layout provides h1).
- 2026-03-19: Calendar source health UI shipped (`/settings/calendar-sources`) — enable/disable toggle, sync status badges, error display, add/delete sources.
- 2026-03-24: Venue mappings shipped (`/settings/venue-mappings`) — admin-only regex-to-location mapping, pattern validation, priority tie-breaking (D-027).
- 2026-03-25: Breadcrumb V1–V3 + polish shipped. Duplicate removed, entity names on detail pages, sibling quick-jump on Settings/Reports parent crumbs, loading skeleton, recently visited entities.
- 2026-04-03: Allowed emails shipped (`/settings/allowed-emails`) — registration gating (D-029). Add/delete email allowlist entries with role pre-assignment. STAFF adds STUDENT only; ADMIN adds both. Claimed entries preserved.
- 2026-04-06: Doc sync — added 3 missing sub-page sections (Calendar Sources, Venue Mappings, Allowed Emails). ACs expanded from 7 to 10. Changelog backfilled.
