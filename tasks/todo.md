# Current Task Queue

Last updated: 2026-03-10

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

### Items Page Finish (2026-03-09)
- ✅ Slice 1: Items List — Columns, Filters, Pagination
- ✅ Slice 2: Item Detail — Tab Structure + Layout
- ✅ Slice 3: Item Detail — Inline Edit on Info Tab
- ✅ Slice 4: Create Flow — Item-Kind-Aware Form

### Items Page Polish + Checkout UX Fixes (2026-03-10)
- ✅ Equipment picker: 5 tabs (Cameras, Lenses, Batteries, Accessories, Others) with DB category batching
- ✅ Equipment picker: assetTag as bold headline, item name as subtitle reference
- ✅ Equipment picker: color status dots (green/red/purple/amber) for all items including unavailable
- ✅ Equipment picker: computedStatus enrichment via deriveAssetStatuses in form-options API
- ✅ Items list page: assetTag as big name, item name (not brand+model) as subline
- ✅ Sport abbreviations fixed: MHO→MHKY, WHO→WHKY, MTF→MTRACK, WTF→WTRACK
- ✅ Tie-to-event fix: calendar API date filter on startsAt instead of endsAt
- ✅ Categories page: hookrightarrow renders as Unicode ↪

---

### Future — Item Detail Dashboard Overview Tab
- [ ] Add Dashboard tab back as landing page with check-outs, reservations, and events overview on one page
- [ ] Distinct from the dedicated Check-outs and Reservations tabs (which remain for filtered views)

### Phase A Remaining

- [x] **B&H Metadata Enrichment** — Slice 1: Parser + API + Create Form ✅
  - Brief: `docs/BRIEF_BH_ENRICHMENT_V1.md`
  - Parser: `src/lib/services/bh-parser.ts` (JSON-LD + OG + title fallbacks)
  - API: `POST /api/enrichment/bh` (server-side fetch, domain validation)
  - UI: "Paste B&H URL" in create form, auto-prefills brand/model/name
  - Tests: `tests/bh-parser.test.ts` (15 tests)

- [x] **Equipment Guidance Rules** ✅ (shipped in Checkout UX V2)
  - `body-needs-batteries`, `lens-needs-body`, `audio-with-video` all live
  - `drone-battery-check`: deferred — needs drone items first

- [ ] **Student Mobile Hardening** — D-015 accepted, brief missing
  - Write `docs/BRIEF_STUDENT_MOBILE_V1.md` first
  - Define student KPIs: taps-to-action, task-completion time, scan success rate
  - Scope: student dashboard actions, scan parity, owned-work list UX
  - Ref: AREA_MOBILE.md, AREA_DASHBOARD.md, DECISIONS.md D-015

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
