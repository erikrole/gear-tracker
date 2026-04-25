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

### Bookings (`/settings/bookings`)
- Configure the extend-due-date presets shown when extending a booking.
- Up to 10 presets, each with a free-text label and a duration picked from a fixed list (15m → 1 month).
- Save button is always rendered (disabled when clean → "Saved", enabled when dirty → "Save changes").
- Browser `beforeunload` guard warns before navigating away with unsaved presets.
- Persisted to `system_config.extend_presets` (ADMIN-only PUT).

### Kiosk Devices (`/settings/kiosk-devices`)
- Manage iPad kiosk stations for self-serve checkout (admin-only).
- Create device → server returns a one-shot 6-digit activation code; admin enters it on the iPad at `/kiosk` to bind the device.
- Pending-activation devices have a "Regenerate code" affordance — invalidates the prior hash and surfaces a fresh code in the same dialog.
- Activated kiosks can't regenerate (must deactivate first; server returns 409).
- Toggle active/inactive (deactivating clears the session token), delete, and inspect last-seen timestamp.

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
- 2026-04-07: Hardening pass — all 7 settings pages migrated from raw fetch() to useFetch hook (AbortController, 401→login redirect, visibility refresh). All mutations hardened with handleAuthRedirect(returnTo) + classifyError + isAbortError. CategoryRow component also hardened. Database page uses on-demand fetch with classifyError. Hardening score 2/5 → 4/5.
- 2026-04-25: MVP audit (slice 1) — settings tabs are now role-aware. `SETTINGS_SECTIONS` carries a `requiredRole` and the layout filters tabs the current user can't use (Bookings / Escalation / Kiosk / Database hidden for STAFF). Layout shell (header + tab nav) renders immediately while `/api/me` resolves, replacing the blank-page flicker on every settings nav with a content-shaped skeleton. Tab nav scrolls horizontally on narrow viewports.
- 2026-04-25: MVP audit (slice 2) — UI hardening pack. Categories Add input now guards against the onBlur+Enter double-submit race (no more duplicate categories on slow networks). Database page no longer surfaces raw server error strings (replaced with intent-based messages). Escalation timing column rendered as muted read-only text with a header hint that timings are fixed (D-009). Allowed Emails claimed-row trash icon is now a disabled icon with a tooltip explaining the user must be deactivated instead of removed.
- 2026-04-25: MVP audit (slice 3+4) — Bookings save button is now always rendered (disabled when clean → "Saved", enabled when dirty → "Save changes"), and a beforeunload guard warns before navigating away with unsaved presets. Sports group cards now show "applies to MXC + WXC" when a group writes to multiple sport codes, replacing the bare code-list that masked the silent cross-write. Kiosk Devices: pending-activation devices now have a "Regenerate code" button (POST /api/kiosk-devices/[id]/regenerate-code) so an accidentally-closed activation dialog no longer forces a delete-and-recreate. Activated kiosks reject regenerate with 409 (must deactivate first).
- 2026-04-25: MVP audit (slice 5) — per-user rate limits applied to every settings mutation endpoint (categories, calendar-sources, location-mappings, sport-configs, allowed-emails, kiosk-devices, locations, escalation, extend-presets, kiosk regenerate). Default budget is 60 writes/min/user via the new `SETTINGS_MUTATION_LIMIT` preset; calendar sync is tighter at 10/min/user since it hits an external ICS URL. Adds `enforceRateLimit` helper that throws HttpError(429) with a Retry-After hint.
- 2026-04-25: MVP audit (slice 6) — doc backfill. Sub-page sections added for Bookings (extend presets) and Kiosk Devices, both shipped previously without an AREA narrative entry.
