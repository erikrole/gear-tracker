# Task Queue

Last updated: 2026-03-25

---

## P0 — Critical (bugs, broken features, data integrity)

### Notifications
- [x] **Fix icon type mapping** — Removed dead UPPER_CASE type cases from `notifIcon()` and `notifIconClass()`. Only service-created snake_case types remain.
- [x] **Fix cron schedule mismatch** — Daily 8AM is correct for Hobby plan (once/day limit). Sub-hourly escalation requires Pro plan upgrade. Documented constraint in AREA_NOTIFICATIONS.md.

### Importer
- [x] **Add `sourcePayload` to schema + importer** — Field existed in schema. Fixed `buildAssetData()` to store only unmapped CSV columns in `sourcePayload` (D-014 lossless parsing), not mixed with notes-style fields.
- [x] **Fix BulkSku routing** — Verified: `Kind=Bulk` rows correctly route to BulkSku + BulkStockBalance via `consumable` flag. Cheqroom preset maps `Kind` column. Audit was outdated.

### Items
- [x] **Wire Export button** — Already wired: Export button in items page header, visible to ADMIN/STAFF, downloads filtered CSV via `/api/assets/export`.
- [x] **Add assetTag uniqueness check on create** — Added onBlur check in SerializedItemForm. Inline error shown when duplicate tag detected.

### Dashboard
- [x] **Fix reservation 7-day window filter** — Added `startsAt: { gte: now, lte: sevenDaysFromNow }` to stats count query. AC-4 now enforced.

### Events
- [x] **Harden Events list page** — Old `/events` list removed. Unified `/schedule` page is 117 lines, fully decomposed with hooks + leaf components.
- [x] **Harden Event detail page** — 606 lines, fully hardened: AbortController, error differentiation, high-fidelity skeleton, manual refresh.

### Settings
- [x] **Auth guard verified** — Layout (ADMIN+STAFF) and Sidebar (ADMIN+STAFF) both enforce correctly. Updated AREA_SETTINGS.md to reflect ADMIN+STAFF policy (was incorrectly documented as ADMIN-only).

---

## P1 — High (hardening, security, UX gaps)

### Notifications
- [x] **Harden notification center** — Full rewrite: pre-shadcn CSS → Tailwind, skeleton loading, error state with retry (network/server differentiation), shadcn Switch for filter, proper CardContent structure.
- [ ] **Add Zod + audit to nudge endpoint** — Missing input validation and audit logging.
- [ ] **Add audit logging to mark-as-read** — Mutation without audit trail.

### Settings
- [x] **Harden Categories page** — Error state UI with retry, skeleton loading, inline styles → Tailwind, pre-shadcn CSS → Tailwind.
- [x] **Harden Sports page** — Error state UI (network/server differentiation) with retry, skeleton loading, consistent error handling.
- [x] **Harden Escalation page** — pre-shadcn `data-table` → shadcn Table components, toggle buttons → shadcn Switch, inline styles → Tailwind, error state with retry, skeleton loading.
- [x] **Fix layout double breadcrumb** — Settings pages render own breadcrumb + AppShell breadcrumb. Fixed: removed settings layout `.breadcrumb` div, events detail custom breadcrumb, and items detail duplicate `<PageBreadcrumb />`. Added `events→Schedule` route alias + mobile truncation.

### Shifts
- [x] **Harden schedule page** — Decomposed 1,012→117 lines + 4-pass hardening (2026-03-25).
- [ ] **Wrap decline/remove in transactions** — TOCTOU risk on concurrent shift operations.

### Reservations
- [x] **Harden BookingListPage** — Already hardened: AbortController, skeleton, error handling, double-submit guards all present.

### Items
- [x] **Harden item detail page** — Already hardened: AbortController, comprehensive skeleton, error states with retry, double-submit guards. Fixed 2 remaining inline styles → Tailwind `size-[120px]`.
- [x] **Add double-submit guard to NewItemSheet** — Already implemented: `submitting` flag disables button, shows "Adding..." text.

### Importer
- [ ] **Add Zod validation on mapping JSON** — Raw JSON accepted without schema validation.
- [x] **Harden import page** — Full rewrite: pre-shadcn CSS (`data-table`, `summary-grid`, `metric-value`, `alert-error`) → shadcn Table + Tailwind. Hardcoded `#fffbeb` → dark-mode-safe `bg-amber-50 dark:bg-amber-950/20`. All inline styles → Tailwind. `<a href>` → Next.js `<Link>`. `useToast` → sonner.

### Mobile/Scan
- [ ] **Fix dark mode unit picker** — Hardcoded `bg-white`, `bg-blue-100` on unit buttons. Will break in dark mode.

### Events
- [ ] **Resolve duplicate source management** — Multiple calendar sources can create duplicate events.

### Dashboard
- [ ] **Implement student role-adaptive dashboard** (BRIEF AC-3) — Students should see only "My Gear" on mobile.
- [ ] **Add owned-booking visual distinction** (BRIEF AC-5) — Ownership accent not visible in dashboard lanes.

### Users
- [ ] **Add audit logging to avatar upload/delete** — Mutation without audit trail.

---

## P2 — Medium (polish, tests, doc completion)

### Notifications
- [ ] **Implement dashboard badge counts** — Unread notification count on nav items.

### Events
- [ ] **Replace `<a href>` with `<Link>`** — Missing Next.js client navigation in events pages.
- [ ] **Add server-side eventId filter for shift groups** — Currently fetches all, filters client-side.

### Items
- [ ] **Verify numbered bulk item UI end-to-end** — D-022 feature not thoroughly tested.
- [ ] **Add audit to favorite toggle** — Missing audit trail.

### Reservations
- [ ] **Resolve equipment conflict badges** (AC-8) — Conflict detection exists but badge display may be incomplete.
- [ ] **Expand test coverage** — Reservation lifecycle transitions.

### Shifts
- [ ] **Add pagination to shift groups + trade board** — Lists grow unbounded.
- [ ] **Tighten trade claim area eligibility** — Students can claim trades outside their sport area.

### Settings
- [ ] **Clean up legacy CSS** — Dead styles from pre-shadcn era.

### Users
- [ ] **Add user deactivation brief** — No way to deactivate users with active bookings.
- [ ] **Add sport/area assignment CRUD** — Currently read-only display.
- [ ] **Write authorization integration tests** — Role escalation, ownership gating.
- [ ] **Add pagination to activity endpoint** — Unbounded response.

### Dashboard
- [ ] **Fix `defaultLocationId()` error handling** — Silent failure on location resolution.

### Importer
- [ ] **Add progress indicator** — Large imports show no feedback.
- [ ] **Add import mode toggle** — Create-only vs upsert mode.

### Mobile/Scan
- [ ] **Improve camera permission UX** — Add explicit "How to enable camera" instructions on denial.

---

## P3 — Low (future planning, nice-to-haves)

### Events
- [ ] **Better opponent/venue normalization** — Inconsistent naming from ICS source.

### Items
- [ ] **Implement draft recovery or descope** — Item creation draft persistence.

### Shifts
- [ ] **Clean up inline styles** — Shift pages have remaining non-Tailwind styles.

### Importer
- [ ] **Implement dry-run mode** — Preview import results before committing.

### Mobile/Scan
- [ ] **Plan Phase B scan telemetry** — KPI measurement (scan success rate, task completion timing).
- [ ] **Deduplicate statusColor helper** — Scan page reimplements logic from booking-details helpers.

### Notifications
- [ ] **Write BRIEF for Phase B escalation work** — Plan file for remaining escalation features.

---

## Phase B Backlog (needs briefs before implementation)

- [x] **Kit management UI** (D-020) — shipped 2026-03-24
- [x] **Dashboard filter chips** (Sport, Location) — shipped 2026-03-23/24
- [x] **Dashboard saved filters** — shipped 2026-03-24
- [x] **Department filter/display** (D-019) — shipped 2026-03-21
- [ ] **Shift email notifications** — V1 = in-app only
- [ ] **Student availability tracking** — Declare unavailable dates
- [ ] **Date range grouping** — Connected From/To on booking detail (deferred from Round 3)
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Pending Decisions

All pending decisions resolved — see `docs/DECISIONS.md` for D-026 (event sync cadence) and D-027 (venue mapping governance).

Remaining open question:
- **Cron frequency**: Resolved — daily 8AM is correct for Hobby plan (once/day limit). Sub-hourly requires Pro upgrade.

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
