# Current Task Queue

Last updated: 2026-03-16

---

## Active Work

### Feature 1: Dashboard Drafts (D-017 / GAP-2)

**Context**: DRAFT is in the BookingStatus enum, action matrix supports edit+cancel, status rendering exists. But nothing creates DRAFTs, dashboard doesn't query them, and there's no persistence or recovery UI.

**Approach**: When a user starts a checkout or reservation creation flow and navigates away (or closes the modal), auto-save as DRAFT. Dashboard shows a Drafts section with Resume/Discard. Resume pre-fills the create form.

#### Slice 1: API + Dashboard query (backend wiring)
- [ ] Add `myDrafts` query to `/api/dashboard/route.ts` — fetch DRAFT bookings for current user (both kinds), ordered by `updatedAt desc`, take 5
- [ ] Add draft count to dashboard stats
- [ ] Add `POST /api/bookings/draft` endpoint — creates a DRAFT booking with partial data (title, kind, startsAt, endsAt, eventId, locationId, notes)
- [ ] Add `PATCH /api/bookings/[id]/draft` endpoint — updates existing DRAFT (same fields)
- [ ] Add `DELETE /api/bookings/[id]/draft` endpoint — deletes (not cancels) a DRAFT
- [ ] Ensure existing create endpoints can "promote" a DRAFT to BOOKED/OPEN (accept optional `draftId` param → update instead of create)

#### Slice 2: Dashboard Drafts UI section
- [ ] Add Drafts section to dashboard page below My Gear column
- [ ] Show draft type (Checkout/Reservation), title, last edited, item count
- [ ] Resume button → navigates to create page with `?draftId=xxx` pre-fill
- [ ] Discard button → DELETE call + refresh
- [ ] Empty state when no drafts

#### Slice 3: Create flow draft persistence
- [ ] Checkout create: auto-save as DRAFT when form has data and user navigates away (beforeunload + route change)
- [ ] Reservation create: same auto-save behavior
- [ ] Create pages: detect `?draftId=xxx` query param → load and pre-fill form from DRAFT data
- [ ] On successful booking creation with draftId → promote draft (update status, don't create new)

#### Slice 4: Build + verify + docs
- [ ] Build passes
- [ ] Update AREA_DASHBOARD.md — mark Drafts section as shipped
- [ ] Update GAPS_AND_RISKS.md — close GAP-2
- [ ] Update DECISIONS.md D-017 — mark as fully implemented

### Feature 2: Equipment Guidance Expansion (D-016)

- [ ] Add `drone-battery-check` rule — warn when drone items selected without batteries
- [ ] Add `drone-prop-check` rule — info reminder about prop inspection before flight
- [ ] Verify rules render in checkout picker
- [ ] Build + commit

### Feature 3: Asset Financial Fields (D-018) — Doc Update Only

**Finding**: Already implemented! Procurement section (purchasePrice, purchaseDate, residualValue, warrantyDate) exists in item detail Info tab, gated to non-STUDENT. API supports all fields. Only docs need updating.

- [ ] Update DECISIONS.md D-018 status from "Phase B" to "Shipped"
- [ ] Update GAPS_AND_RISKS.md Phase B deferred table
- [ ] Update NORTH_STAR.md if needed

---

## Recently Shipped

- [x] **Dark mode contrast sweep** — 14 elements fixed across 2 commits (2026-03-16)
- [x] **Equipment Picker V2** — Multi-select, per-section search, availability preview, scan-to-add (2026-03-15)
- [x] **Dashboard V2** — Ops-first split layout with live countdown timers (2026-03-11)
- [x] **Item Detail: UW Asset Tag Mirror** — uwAssetTag shown in page header (2026-03-11)
- [x] **Item Detail: Calendar Grid** — Month-view calendar with booking blocks (2026-03-11)
- [x] **Item Detail: Booking Refresh Fix** — BookingDetailsSheet onUpdated wired to reload data (2026-03-11)
- [x] **Duplicate/Clone Action** — Duplicate button on reservation detail + list context menu (2026-03-14)

---

## Pending Decisions

See `docs/GAPS_AND_RISKS.md` for the full registry. Key items:

1. **PD-2**: Venue mapping governance — who owns regex-to-location mapping table?
2. **PD-3**: Event sync refresh cadence — Vercel Cron schedule and staleness thresholds

---

## Notes

- Always write a BRIEF_*.md or Decision record before implementing any new feature
- Run `npm run build` before any commit — build failures are avoidable
- Every mutation endpoint needs audit logging — do not skip
- NORTH_STAR.md is the first read for any new Claude session
- When shipping a feature, update the relevant AREA file and GAPS_AND_RISKS.md (CLAUDE.md rule 12)
