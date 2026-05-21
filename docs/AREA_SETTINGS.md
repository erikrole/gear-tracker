# Settings Area Scope

## Document Control
- Area: Settings
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-21
- Status: Active
- Version: V1

## Direction
Single Settings surface for both **personal preferences** (visible to every authenticated user) and **system configuration** (admin/staff only, hidden by role-aware nav). Each sub-page is a focused domain. Keep pages self-contained with clear feedback loops (toasts, inline saves).

Design language reference: `docs/DESIGN_LANGUAGE.md`.

## Core Rules
1. The Settings surface is open to any authenticated user (STUDENT / STAFF / ADMIN). Each sub-page declares its own `requiredRole`; the layout filters tabs accordingly. STUDENTs only see the Personal group.
2. Settings layout provides unified role-aware section navigation — sub-pages should not render their own page-level `<h1>`.
3. Each sub-page uses `SettingsPageShell`: compact intro rail (title + description) and main content for forms, tables, loading states, and errors.
4. Mutations should provide immediate feedback via toast notifications and visible form-level errors for create/add forms.
5. Personal-group preferences belong in **Personal** (top group). System configuration belongs in **People · Inventory · Scheduling · Devices · System**.

## Sub-Pages

### Security (`/settings/security`) -- Personal
- Change password: verify current password, set new one (min 8 chars), optional "sign out of all other devices" checkbox. Client-side confirm-password match before submit.
- Active sessions list: shows each non-expired session with creation date, expiry date, and "This device" badge for the current session. Per-session "Sign out" button (cannot revoke the current session). "Sign out all other devices" bulk action.
- `POST /api/me/change-password` (5/min rate limit -- brute-force protection; verifies bcrypt, sets new hash, optionally deletes other sessions).
- `GET /api/me/sessions` (30/min; lists non-expired sessions with `isCurrent` flag -- tokenHash never exposed to client).
- `DELETE /api/me/sessions/:id` (10/min; rejects current session with 400, confirms ownership before delete).
- `DELETE /api/me/sessions` (10/min; revokes all sessions except current).
- Available to every authenticated user (STUDENT included).

### Overview (`/settings`)
- Role-aware control map for every visible settings section.
- Groups settings into Personal, People, Inventory, Scheduling, Devices, and System with short descriptions.
- Preserves the previous last-tab behavior as a "Resume" action instead of immediately redirecting.

### Profile (`/settings/profile`) — Personal
- Self-service identity editing for every authenticated user.
- Editable: `name` (required), `phone`, `avatarUrl`, `primaryArea` (Video/Photo/Graphics/Comms), `title`, `athleticsEmail`, `slackHandle`. NOT `email` (login email stays admin-gated).
- Avatar managed via the existing `/api/users/[id]/avatar` endpoint (POST upload + DELETE remove) -- separately from the profile form save.
- `GET/PUT /api/me/profile` (rate-limited at `SETTINGS_MUTATION_LIMIT`). Validates + trims all fields; blocks duplicate `athleticsEmail` with 409. Changes audit-logged as `profile_updated`.

### Notifications (`/settings/notifications`) — Personal
- "Quiet hours" pause (1 hour / 1 day / 1 week) — sets `pausedUntil` on the user's prefs row; while active, all email + push delivery skips. The in-app inbox always continues.
- Channel toggles: Email and Push (master switches per channel). Disabled while a pause is active.
- Persisted server-side in `users.notification_prefs` JSONB (added in migration `0046_user_notification_prefs`). Null = receive everything (matches pre-feature behavior).
- Enforced in `sendPushToUser` / `sendEmailToUser` wrappers in `src/lib/services/notifications.ts` and `src/lib/services/licenses.ts`. Other dispatch sites (shift trades, password reset, system mails) intentionally bypass — system / security mails always send.
- API: `GET/PUT /api/me/notification-preferences` (rate-limited at the standard settings budget).

### Appearance (`/settings/appearance`) — Personal
- Theme picker: Light / Dark / System (follows OS preference).
- Theme switching is shared with the Sidebar footer control through `src/lib/theme.ts`; choosing Light/Dark writes `localStorage.theme`, choosing System removes the override and follows OS changes.
- User-initiated theme switches use a short root-level animation via the View Transitions API when available, with a CSS fallback and reduced-motion opt-out.
- Text size picker: Small / Default / Large / Extra large (0.9 → 1.3 multiplier on the `--text-scale` CSS variable; all `--text-*` tokens scale proportionally).
- Saved per-device in `localStorage` (`theme`, `text-scale`); the cold-load script in `src/app/layout.tsx` applies both on first paint to avoid FOUC.
- Available to every authenticated user (STUDENT included).

### Categories (`/settings/categories`)
- Hierarchical tree of equipment categories with inline rename, subcategory creation, and delete.
- Search filters the tree (preserves parent nodes for structure).
- Sort toggles A→Z / Z→A.
- Delete is guarded: blocked if category has items or children.
- Duplicate names are blocked within the same tree level, and rows show last audit actor/time when audit history exists.

### Departments (`/settings/departments`)
- Staff/admin catalog of inventory ownership groups used by item forms, filters, bulk SKUs, and utilization reports.
- Add a department, inline rename by clicking the name, and deactivate/reactivate without breaking existing item or bulk references.
- Active departments appear in new item and bulk SKU pickers; inactive departments are hidden from pickers but remain on existing records.
- Usage counts show how many serialized items and bulk SKUs still reference each department.
- Rows show the last audit actor/time when audit history exists.

### Sports (`/settings/sports`)
- Toggle sports active/inactive for shift generation.
- Configure home/away shift counts per area (Video, Photo, Graphics, Comms).
- Expandable roster panel per sport — add/remove users.
- Mobile: card layout replaces dense table for shift configs.

### Escalation (`/settings/escalation`)
- Configure overdue notification triggers (timing, recipients, enabled state).
- Fatigue controls: max notifications per booking (prevents alert fatigue).
- Per D-009: escalation schedule is -4h, 0h, +2h, +24h relative to booking.endsAt.

### Data Export (`/settings/data-export`) — System, ADMIN
- Admin-only hub for exporting data as CSV.
- Five exports: Items (assets), Users, Licenses, Bookings (checkouts + reservations), Audit Log.
- Bookings and Audit Log are new -- the other three surface existing endpoints in one place.
- All exports capped at 5,000 rows; `X-Truncated` + `X-Total-Count` response headers surface truncation; the UI shows a warning toast when capped.
- `GET /api/bookings/export` (ADMIN, 5/min, optional `?from=&to=&kind=`).
- `GET /api/audit/export` (ADMIN, 5/min, optional `?from=&to=&entity_type=`).

### Database (`/settings/database`)
- On-demand schema health diagnostics.
- Checks: migration table, tables, enums, extensions, column drift.
- Shows remediation steps when issues detected.

### Locations (`/settings/locations`)
- Admin-only catalog of physical locations referenced by items, kiosks, calendar events, and venue mappings.
- Add a location with optional address; toggle isHomeVenue inline; rename inline by clicking the name.
- Deactivate (soft-delete) hides a location from new pickers but keeps existing references intact. Deactivated locations show in their own card with the count of references that still point at them, and can be reactivated.
- Hard delete is intentionally not exposed — locations are referenced by many models (FK constraints would block it anyway).
- This tab also owns Home Venue toggling, which previously lived under Venue Mappings.

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
- Home venue toggling moved to the Locations tab as of 2026-04-25.

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
- Kiosk sessions are **always-on**: a bound device has no server-side session expiry and stays active until an admin deactivates it. The HTTP-only cookie is rolled forward on every authenticated kiosk request (~395-day window) to stay under browser cookie-lifetime caps without ever forcing a re-activation on a live device.
- Toggle active/inactive (deactivating clears the session token, which ends the session immediately), delete, and inspect last-seen timestamp.

### Allowed Emails (`/settings/allowed-emails`)
- Admin-managed email allowlist for registration gating (D-029).
- Add email with pre-assigned role (STAFF can add STUDENT only, ADMIN can add both).
- Delete unclaimed entries. Claimed entries preserved (audit trail).
- Filter by status (all/unclaimed/claimed).

## Acceptance Criteria
- [x] AC-1: Role-aware grouped navigation across all settings pages
- [x] AC-2: Categories: tree CRUD with search and sort
- [x] AC-3: Sports: shift config table + roster management
- [x] AC-4: Escalation: toggle-based rule management + fatigue cap
- [x] AC-5: Database: on-demand diagnostics with status badges
- [x] AC-6: Mobile-responsive layouts for all sub-pages
- [x] AC-7: Component extraction for maintainability (Sports, Categories)
- [x] AC-8: Calendar sources: enable/disable, sync status, health badges, add/delete
- [x] AC-9: Venue mappings: admin-only CRUD with regex validation
- [x] AC-10: Allowed emails: add/delete with role pre-assignment, registration gating enforced
- [x] AC-11: Departments: staff/admin CRUD surface for inventory ownership groups

## Breadcrumb Roadmap

Navigation breadcrumb versioned roadmap: `tasks/breadcrumbs-roadmap.md`

All versions shipped. Duplicate breadcrumb removed; parent-level sibling quick-jump dropdown on "Settings" crumb navigates between sub-pages.

## Change Log
- 2026-05-21: Security settings (roadmap slice 4). New `/settings/security` (Personal, all roles) adds change-password form (current password verify, new password min-8, confirm, optional sign-out-others checkbox) and active sessions list (per-session sign-out, bulk sign-out-all-others). New `POST /api/me/change-password` (5/min), `GET/DELETE /api/me/sessions` (30/10 per min), `DELETE /api/me/sessions/:id` (10/min). Current session identified server-side by hashing the cookie token -- tokenHash never exposed to client.
- 2026-05-21: Profile settings (roadmap slice 3). New `/settings/profile` (Personal, all roles) lets every authenticated user edit their name, phone, primary area, title, athletics email, and Slack handle. Avatar managed via the existing user avatar endpoint. New `GET/PUT /api/me/profile` -- rate-limited, audit-logged, 409 on duplicate athleticsEmail.
- 2026-05-21: Data Export settings (roadmap slice 2). New `/settings/data-export` (System, ADMIN) surfaces all five CSV exports in one place. Items, Users, and Licenses reuse existing endpoints; new `GET /api/bookings/export` and `GET /api/audit/export` added. All capped at 5,000 rows with truncation headers + toast warning.
- 2026-05-20: Kiosk always-on sessions (Settings roadmap slice 1). Removed the 7-day kiosk session expiry — `createKioskSession` no longer stamps `sessionExpiresAt` and `requireKiosk` no longer rejects on elapsed time, so a bound iPad stays active until an admin deactivates it. The kiosk cookie is now rolled forward on every authenticated kiosk request (~395-day expiry) to survive browser cookie-lifetime caps. Deactivation still clears `sessionToken`, ending the session at once. Removed the now-dead "Session expiring" badge, "Session expires" footer, and `sessionExpiresAt` exposure from the kiosk-devices list. The `session_expires_at` column is retained (unused, nullable) — a pure-hygiene drop can follow later.
- 2026-05-21: Design language Area 4 Settings follow-through shipped. Settings sub-pages were inventoried for `SettingsPageShell`, shared inline empty states, shared row actions, destructive confirmation copy, and sub-40px controls. Extend Presets remove controls, Kiosk pending-pickup/copy/cancel controls, Allowed Emails add-mode controls, and Database initial empty state were aligned with the shared operational baseline.
- 2026-05-20: Settings actions, empty states, and warning copy cleanup shipped. Calendar Sources, Venue Mappings, Locations, Departments, Allowed Emails, and Kiosk Devices now use the shared row-action trigger where rows have destructive or multi-step actions; remaining text-only empty states moved to shared inline empty states; destructive confirmations now name the target and operational consequence.
- 2026-05-20: Settings shell cleanup shipped. Settings sub-pages now share one `SettingsPageShell` for the intro column and main content, reducing repeated split-grid markup and keeping loading, error, and normal states aligned under the new grouped rail.
- 2026-05-20: Settings navigation rail shipped. Large desktop Settings now uses a grouped left rail for Overview, Personal, People, Inventory, Scheduling, Devices, and System while preserving the horizontal section scroller on smaller screens, role-gated visibility, search palette, and last-tab resume behavior.
- 2026-05-20: Design language slice 7. Settings Categories and Departments now use shared inline empty states instead of local text-only placeholders, keeping first-run and filtered-empty recovery copy aligned with the rest of the app.
- 2026-05-20: Design language slice 6. Settings Categories row actions now use the shared `OperationalRowActions` trigger, replacing the page-local kebab button while preserving rename, add subcategory, and delete behavior.
- 2026-05-20: Design language slice 4. Settings now links to the shared design-language reference while preserving the Settings-specific layout rule that the layout owns the page header and tab navigation.
- 2026-05-13: Appearance polish. Light/Dark/System switching now runs through a shared theme controller used by both Appearance and the Sidebar, keeps System as a no-override localStorage state, and adds a short reduced-motion-safe theme transition without animating first paint.
- 2026-05-12: Creation flow standardization. Categories, Departments, Locations, and Allowed Emails add forms now show visible form-level validation/API/network errors and keep submit/cancel controls in a clear disabled state during slow saves.
- 2026-05-12: Security audit patch. Kiosk device deactivation now clears both the stored session token and `sessionExpiresAt`, matching the server-side kiosk expiry model documented in `AREA_KIOSK.md`.
- 2026-05-10: Schedule ownership pass. Sports shift-generation activation now uses the shared Switch control with an explicit Active/Off badge, keeping the schedule-feeding settings page aligned with the rest of the app's control system.
- 2026-05-10: Component audit closeout. Database diagnostics now keeps result-list React keys stable even when duplicate migration/table labels are returned, clearing the console warning found during authenticated Settings smoke.
- 2026-05-10: Breadcrumb first-class UX pass. The Settings/Reports parent crumb dropdowns now inherit the stronger global breadcrumb shell treatment, keep role filtering intact, and show clearer menu framing with current-page indicators plus Settings section descriptions from `nav-sections.ts`.
- 2026-05-09: Settings control-map UI polish. `/settings` is now represented as an active Overview tab in the shared settings nav, and the role-aware control map now surfaces current role, visible section/group counts, destination role badges, tighter group cards, and stronger focus/hover row treatment without changing section permissions or subpage behavior.
- 2026-05-08: API hardening Wave 9. Allowed Emails add/bulk-add no longer reveals registered or already-allowlisted addresses via 409s or skipped-address lists; duplicate inputs return generic skipped success/counts.
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
- 2026-04-25: MVP audit (slice 7, final P1) — Sports group updates are now atomic. New `POST /api/sport-configs/group` accepts a list of codes and a single patch, applying all upserts inside one Prisma transaction (Serializable isolation) — replaces the prior client-side loop of N sequential PATCHes that could half-apply on partial failure. Shift-count edits, call-time edits, and the active toggle on grouped sports (Cross Country, Golf, Rowing, Soccer, Swimming, Tennis, Track) all flow through it. Settings audit P1 list now fully closed.
- 2026-04-25: P2 polish pack — feedback toasts on Categories rename / add / Sports group save / Escalation toggles; Categories search keeps the full ancestor chain visible; Categories sort indicator switched to Lucide ArrowDownAZ/ArrowUpAZ; Calendar Sources stale threshold bumped 24h → 30h; Kiosk Devices show an "Offline" badge after 24h without a check-in; Allowed Emails gains a bulk-paste mode (up to 50 per batch) and live counts on the All / Pending / Claimed filter; Kiosk Devices page brought up to par with the 2026-04-07 hardening pattern (returnTo on useFetch, classifyError + isAbortError on every catch). D-027 reconciliation: location and location_mapping permissions tightened to ADMIN-only to match the spec (was STAFF+ in code), and the Venue Mappings settings tab now requires ADMIN.
- 2026-05-01: Breadcrumb sibling-jump dropdown is now role-aware. STUDENT users no longer see ADMIN-only entries (Locations, Venue Mappings, Database, Escalation, Kiosk, Bookings) when opening the Settings parent crumb on a page they can access (Notifications / Appearance) — clicking a hidden entry would have landed them on a blocked route. Filtering reuses the new `meetsRoleRequirement(required, role)` helper in `nav-sections.ts`. Same audit dropped 19 redundant `LABEL_MAP` entries, lifted the per-render `localStorage` read in `PageBreadcrumb` into a `useMemo`, and aligned the recents-cap constants (`MAX_RECENT_PER_SECTION` / `MAX_RECENT_TOTAL`).
- 2026-04-25: P2 — `/settings` index now resumes the user's last-visited tab from localStorage (`settings:last-tab`), validated against `SETTINGS_SECTIONS`. Layout writes the key on every navigation. Falls back to Categories on first visit or when storage is unavailable.
- 2026-04-25: P2 — new `/settings/locations` tab (ADMIN-only). Full CRUD for the locations catalog: add with optional address, inline rename, inline isHomeVenue toggle, soft-delete (deactivate) that preserves FK references and surfaces a deactivated section with reference counts. New endpoints: `GET /api/locations?includeInactive=1` (admin gets inactive too, plus `_count` of users/assets/bookings/kiosks/mappings) and `POST /api/locations` (rate-limited; rejects duplicate names with 409). Home Venue toggling removed from `/settings/venue-mappings` and folded into Locations; that page is now venue-pattern-only.
- 2026-04-25: P2 — inline "last edited by/when" context. New `POST /api/audit/last` accepts `{ entityType, entityIds[] }` and returns the most-recent audit entry per id (action, createdAt, actor) in one round trip — backed by the existing `(entityType, entityId, createdAt)` index on AuditLog. Wired via `useLastAudit` hook + tiny `LastEditedHint` component into the Locations and Allowed Emails surfaces (highest-leverage admin tables). Renders nothing when no audit entry exists, so untouched rows aren't visually disrupted.
- 2026-04-25: Personal — Notifications + text-size picker. New `/settings/notifications` (everyone-visible) ships pause-everything (1h / 1d / 1w) plus Email and Push channel master switches. Backed by a new nullable `users.notification_prefs` JSONB column (migration `0046_user_notification_prefs`); null = receive-everything so existing users have zero behavior change. Enforcement wired through the existing `sendPushToUser` wrappers in `notifications.ts` + `licenses.ts` and a new `sendEmailToUser` wrapper for the four email dispatch sites in the booking/escalation/shift-gear-up paths. New `GET/PUT /api/me/notification-preferences` is the admin/staff/student API. Appearance also gains a Text size picker (Small / Default / Large / Extra large = 0.9 → 1.3 multiplier on a new `--text-scale` CSS var); cold-load script applies both choices on first paint.
- 2026-04-25: IA — Settings is no longer admin-only. New top-of-nav **Personal** group hosts user-preference tabs that every authenticated user sees, including STUDENTs. First entry is **Appearance** (Light / Dark / System theme picker, saved to `localStorage:theme`, mirrors the cold-load script in `src/app/layout.tsx`). Layout auth gate relaxed from "ADMIN | STAFF" to "any authenticated role"; non-auth users still bounce to `/login`. The `/settings` index now picks the user's last-visited tab if their role still has access, otherwise falls back to the first section their role can see (so a STUDENT lands on Appearance, not Categories). `SettingsRole` is now a tri-state with rank ordering (STUDENT < STAFF < ADMIN); `isSectionVisible` uses the rank instead of two ad-hoc cases. Notifications preferences are the next planned Personal tab — needs schema work and is tracked separately.
- 2026-04-25: P2 — Test-before-save affordances. Calendar Sources Add form has a "Test" button next to the URL input that probes the feed via new `POST /api/calendar-sources/test` (8s timeout, 5 MB cap, 10 probes/min/user). Result panel reports reachability, content type, byte size, parsed event count, and the first three event summaries — admins see whether they pasted a valid feed before committing. Venue Mappings Add form pairs the pattern input with a live regex tester: a sample-text box + immediate "✓ Matches X" / "✗ Does not match" / "✗ Invalid regex: Y" feedback, all client-side.
- 2026-04-25: P2 — settings IA + density pass. `SETTINGS_SECTIONS` now carries `group` (People · Inventory · Scheduling · Devices · System) and `description` + `keywords` for each section. The tab nav is reordered into those groups with thin dividers between them. The `/settings/bookings` tab is relabeled to **Extend Presets** (route unchanged for compatibility). New ⌘K / `/` search palette (`SettingsCommand`) opens a CommandDialog over the visible-to-this-role sections; matches by label, description, and keyword aliases (so admins can find pages by intent — e.g. "allowlist", "cron", "home venue"). Sidebar density: every settings sub-page bumped from `max-md:` to `max-lg:` — the 260px decorative sidebar collapses to a one-line subhead at <1024px, giving 13" laptops more horizontal room for the actual table without rewriting any layout.
- 2026-05-06: Ownership pass - added `/settings/departments` under Inventory so staff/admins can manage department names and active state from Settings instead of relying on import side effects or item forms. Department APIs now support include-inactive reads with serialized/bulk usage counts plus PATCH rename/deactivate/reactivate with audit logging and settings rate limits. Extend Presets now accepts an empty saved list, matching the UI's "custom option only" empty state.
- 2026-05-06: Ownership pass slice 2 - `/settings` now renders a role-aware control map instead of immediately redirecting to the last visited tab. The previous last-tab behavior is preserved as a Resume action so direct Settings navigation is useful while still supporting fast return workflows.
- 2026-05-06: Ownership pass slice 3 - Departments now show last-edited audit context, matching the higher-signal admin catalog pattern from Locations and Allowed Emails. Department create now writes first and handles Prisma unique conflicts, preserving inactive reactivation behavior without a find-then-create race.
- 2026-05-06: Ownership pass slice 4 - Categories adopted the useful catalog hardening without adding a new active-state model. Category create/rename now trims names, blocks same-level duplicates with clear 409s, prevents moving a category under its own descendant, and surfaces last-edited audit context in the tree.
- 2026-05-08: API hardening Wave 13 - Category parent checks now have a bounded depth cap, system-config audit rows include an explicit first-create `before` state, and audit last-lookups are rate-limited by actor.
