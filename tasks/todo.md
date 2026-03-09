# Current Task Queue

Last updated: 2026-03-09

---

## ✅ Completed Work (Archive)

### Checkout UX V2 (PRs 20–25)
- ✅ Slice 1: action gating (checkout-rules.ts), event defaults, partial check-in
- ✅ Slice 2: allowedActions wired into UI
- ✅ Slice 3: equipment picker on checkout create
- ✅ Slice 4: kit-first sectioned equipment picker
- ✅ Picker hardening: locked forward progression, battery hint guidance rule
- ✅ Availability visibility: conflict feedback in picker, equipment guidance system

### Events + Calendar Sync (PRs 25–30)
- ✅ Events page: default to upcoming events (startsAt >= now)
- ✅ Source deletion: DELETE /api/calendar-sources/[id] with SET NULL on booking eventIds
- ✅ Calendar sync hardening: crash isolation, per-event error handling
- ✅ Batch DB ops to stay within Cloudflare Worker subrequest limits
- ✅ Date.UTC consistency in ICS date parsing
- ✅ Production-safe sync diagnostics

### Other Shipped (PRs 31–32)
- ✅ Usage pattern analysis + skills/CLAUDE.md rules update
- ✅ Error boundaries added to prevent blank crash pages

### Planning Docs Sync (2026-03-09)
- ✅ Created docs/NORTH_STAR.md
- ✅ Updated docs/AREA_NOTIFICATIONS.md to full V1 spec
- ✅ Updated docs/AREA_CHECKOUTS.md: picker, guidance, DRAFT state
- ✅ Updated docs/AREA_EVENTS.md: source deletion, upcoming default, sync hardening
- ✅ Updated docs/DECISIONS.md: D-016, D-017, D-009 partial status, D-010 shipped items
- ✅ Updated docs/PRODUCT_SCOPE.md: NORTH_STAR.md reference, phase status, brief queue

---

## 🔴 Active — Items Page Finish (Pre-Import Hardening)

### Slice 1: Items List — Columns, Filters, Pagination
- [ ] Update table columns per spec: Name cell (tagName primary, brand/model secondary), Category, Location, Status
- [ ] Add location filter dropdown (from /api/form-options)
- [ ] Add CHECKED_OUT and RESERVED to status filter (derived statuses)
- [ ] Change rows per page from 20 to 25
- [ ] Fix pagination text to "Showing X to Y of Z"
- [ ] Add Import link in top bar actions

### Slice 2: Item Detail — Tab Structure + Layout
- [ ] Replace Dashboard tab with Reservations + Check-outs tabs
- [ ] Reservations tab: filter bookings to RESERVATION kind
- [ ] Check-outs tab: filter bookings to CHECKOUT kind
- [ ] Fix details-grid direction (info wider, side panels narrower)

### Slice 3: Item Detail — Inline Edit on Info Tab
- [ ] Make metadata fields editable for ADMIN/STAFF
- [ ] Wire PATCH /api/assets/[id] for saves
- [ ] Show success/error feedback with role-based visibility

### Slice 4: Create Flow — Item-Kind-Aware Form
- [ ] Replace inline create with proper create card
- [ ] Add item-kind selector (serialized vs bulk)
- [ ] Enforce required fields per kind
- [ ] Optional metadata section (collapsed by default)

---

### Phase A Remaining

- [ ] **B&H Metadata Enrichment** — Priority #2 per D-010
  - Write `docs/BRIEF_BH_ENRICHMENT_V1.md` first
  - Scope: server-side fetch boundary, parser fallback behavior, image source policy
  - Key constraint: never overwrite tagName; import failures must not block item creation
  - Ref: AREA_ITEMS.md §B&H Product Import

- [ ] **Student Mobile Hardening** — D-015 accepted, brief missing
  - Write `docs/BRIEF_STUDENT_MOBILE_V1.md` first
  - Define student KPIs: taps-to-action, task-completion time, scan success rate
  - Scope: student dashboard actions, scan parity, owned-work list UX
  - Ref: AREA_MOBILE.md, AREA_DASHBOARD.md, DECISIONS.md D-015

- [ ] **Equipment Guidance Rules Expansion**
  - Add `lens-needs-body` rule: warn if lens selected without a camera body
  - Add `audio-with-video` hint: remind about audio gear for video body selections
  - Add `drone-battery-check`: spare batteries + prop guard reminder for drone items
  - File to edit: `src/lib/equipment-guidance.ts`
  - Ref: NORTH_STAR.md §Feature Improvement Suggestions

### Phase B Prep

- [ ] **AREA_NOTIFICATIONS.md — D-009 Acceptance**
  - Define escalation recipient model (who gets +24h escalation?)
  - Define alert fatigue controls (per-booking cap, opt-out)
  - Update D-009 from Proposed to Accepted once resolved
  - Ref: docs/AREA_NOTIFICATIONS.md, docs/DECISIONS.md D-009

- [ ] **Calendar Source Enable/Disable**
  - Add `enabled` boolean toggle to CalendarSource
  - Sync job skips disabled sources
  - UI: enable/disable per-source in Events page source management table
  - Ref: AREA_EVENTS.md §Next

- [ ] **Sync Health Admin UI**
  - Show "Last synced at / event count / last error" per source on Events page
  - Source: `CalendarSource.lastFetchedAt`, `lastError` fields already exist in schema
  - Ref: AREA_EVENTS.md §Next

---

## Pending Decisions (Must Resolve Before Related Features)

1. D-009: Escalation recipient model — who receives 24h escalation notifications?
2. Venue mapping governance owner — who owns the regex-to-location mapping table?
3. Event sync refresh cadence — what is the Cloudflare Cron schedule?
4. B&H cache TTL — how long to cache enrichment results?
5. Student mobile KPI definitions — taps-to-action target, scan success rate threshold?

---

## Notes

- Always write a BRIEF_*.md or Decision record before implementing any new feature
- Run `npm run build` before any commit — build failures are avoidable
- Every mutation endpoint needs audit logging — do not skip
- NORTH_STAR.md is the first read for any new Claude session
