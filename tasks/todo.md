# Task Queue

Last updated: 2026-03-25

---

## Active Work

_No active slices._

---

## Backlog

### Deferred from Active Work
- [ ] **Date range grouping** — From/To as connected range on booking detail (deferred from Round 3)
- [ ] **Game-Day Readiness Score** — Aggregate shift coverage + gear availability per event (deferred from scheduling Slice 5)

### Phase B Remaining
- [x] **Kit management UI** (D-020) — shipped 2026-03-24
- [x] **Dashboard filter chips** (Sport, Location) — shipped 2026-03-23/24
- [x] **Dashboard saved filters** — shipped 2026-03-24
- [x] **Department filter/display** (D-019) — shipped 2026-03-21
- [ ] **Notification center pagination** — list grows unbounded
- [ ] **Shift email notifications** — V1 = in-app audit only
- [ ] **Student availability tracking** — students declare unavailable dates
- [ ] **Dashboard AC-4: 7-day reservation filter** — spec says next 7 days, code has no date window
- [ ] **Items export** — specced in AREA_ITEMS but never built (AC-12)

---

## Pending Decisions

All pending decisions resolved — see `docs/DECISIONS.md` for D-026 (event sync cadence) and D-027 (venue mapping governance).

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
