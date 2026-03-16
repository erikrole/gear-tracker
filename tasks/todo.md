# Current Task Queue

Last updated: 2026-03-16

---

## Active Work

(empty)

---

## Recently Shipped

- [x] **Dashboard Drafts (D-017 / GAP-2)** — DRAFT booking CRUD, dashboard section, auto-save on cancel, resume pre-fill (2026-03-16)
- [x] **D-018 Doc Sync** — Asset financial fields already in UI; docs updated to reflect shipped (2026-03-16)
- [x] **Dark mode contrast sweep** — 14 elements fixed across 2 commits (2026-03-16)
- [x] **Equipment Picker V2** — Multi-select, per-section search, availability preview, scan-to-add (2026-03-15)
- [x] **Dashboard V2/V3** — Ops-first split layout with live countdown timers (2026-03-11/12)
- [x] **Item Detail: UW Asset Tag Mirror** — uwAssetTag shown in page header (2026-03-11)
- [x] **Item Detail: Calendar Grid** — Month-view calendar with booking blocks (2026-03-11)
- [x] **Item Detail: Booking Refresh Fix** — BookingDetailsSheet onUpdated wired to reload data (2026-03-11)
- [x] **Duplicate/Clone Action** — Duplicate button on reservation detail + list context menu (2026-03-14)

---

## Phase B Remaining

- [ ] **Dashboard filter chips** (Sport, Location) — deferred from V1
- [ ] **Dashboard saved filters** — deferred from V1
- [ ] **Kit management UI** (D-020) — full schema, zero UI
- [ ] **Department filter/display** (D-019) — schema ready, no UI
- [ ] **Notification center pagination** — list grows unbounded
- [ ] **Shift email notifications** — V1 = in-app audit only
- [ ] **Student availability tracking** — students declare unavailable dates

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
