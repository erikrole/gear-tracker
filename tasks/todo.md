# Task Queue

Last updated: 2026-03-25

---

## P0 — Critical (bugs, broken features, data integrity)

### Notifications
- [ ] **Fix icon type mapping** — UI and service use different type strings for notification icons. Notifications render with wrong/missing icons.
- [ ] **Fix cron schedule mismatch** — `vercel.json` says daily 8AM but escalation windows need sub-hourly checks. Decide: is daily correct (doc updated), or should it be `*/15 * * * *`? Product decision needed.

### Importer
- [ ] **Add `sourcePayload` to schema + importer** — D-014 requires lossless parsing. Unmapped columns are currently silently dropped. Critical data integrity violation.
- [ ] **Fix BulkSku routing** — Bulk items created as wrong entity type during import.

### Items
- [ ] **Wire Export button** — Specced in AREA_ITEMS AC-12, button missing from UI. Either build it or formally descope.
- [ ] **Add assetTag uniqueness check on create** — No duplicate detection on tag name during item creation.

### Dashboard
- [ ] **Fix reservation 7-day window filter** — AC-4: code fetches all BOOKED reservations without date filter. Add `startsAt` bounds.

### Events
- [ ] **Harden Events list page** — 817-line monolith, no loading states, no error recovery, no AbortController. Run /harden-page.
- [ ] **Harden Event detail page** — 475 lines, same issues.

### Settings
- [ ] **Add client-side auth guard** — Non-admin users see settings shell + 403 errors. Block at navigation level.

---

## P1 — High (hardening, security, UX gaps)

### Notifications
- [ ] **Harden notification center** — No loading skeleton, no error recovery, no pagination guard. Run /harden-page.
- [ ] **Add Zod + audit to nudge endpoint** — Missing input validation and audit logging.
- [ ] **Add audit logging to mark-as-read** — Mutation without audit trail.

### Settings
- [ ] **Harden Categories page** — Run /harden-page.
- [ ] **Harden Sports page** — Run /harden-page.
- [ ] **Harden Escalation page** — Run /harden-page.
- [ ] **Fix layout double breadcrumb** — Settings pages render own breadcrumb + AppShell breadcrumb.

### Shifts
- [x] **Harden schedule page** — Decomposed 1,012→117 lines + 4-pass hardening (2026-03-25).
- [ ] **Wrap decline/remove in transactions** — TOCTOU risk on concurrent shift operations.

### Reservations
- [ ] **Harden BookingListPage** — Shared between checkouts and reservations. Needs full hardening pass.

### Items
- [ ] **Harden item detail page** — Missing 5-pass treatment. Loading states, error recovery, double-submit guards.
- [ ] **Add double-submit guard to NewItemSheet** — Can fire multiple create requests.

### Importer
- [ ] **Add Zod validation on mapping JSON** — Raw JSON accepted without schema validation.
- [ ] **Harden import page** — Run /harden-page.

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
- **Cron frequency**: Is daily 8AM correct for notification checks, or should it be every 15 minutes?

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
