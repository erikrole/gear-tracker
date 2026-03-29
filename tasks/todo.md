# Task Queue

Last updated: 2026-03-29

**Current release**: Beta — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## Open Items

### Reservations (P2)
- [ ] **Resolve equipment conflict badges** (AC-8) — Conflict detection exists in EquipmentPicker; booking detail display pending.

### Users (P2)
- [ ] **Add sport/area assignment CRUD** — Currently read-only. Needs new API endpoints + edit UI (deferred to V2 per users roadmap).

### Known Bugs (documented with proof tests)
- [ ] **Fix `claimTrade()` missing isolation** — No SERIALIZABLE on `$transaction`, double-claim possible. See `tests/shift-trades.test.ts`.
- [ ] **Fix bulk scan TOCTOU** — Quantity guard reads outside increment transaction. See `tests/bulk-scan-race.test.ts`.
- [ ] **Fix `markCheckoutCompleted` double-return** — Returns `checkedOutQuantity` without subtracting `checkedInQuantity`. See `tests/mark-checkout-completed.test.ts`.
- [ ] **Fix CSRF bypass with missing Origin** — `withAuth` skips CSRF check when Origin header absent. See `tests/api-wrapper.test.ts`.

---

## Phase B Backlog (needs briefs before implementation)

- [ ] **Shift email notifications** — V1 = in-app only
- [ ] **Student availability tracking** — Declare unavailable dates
- [ ] **Date range grouping** — Connected From/To on booking detail (deferred from Round 3)
- [ ] **Game-Day Readiness Score** — Aggregate metric per event (deferred from scheduling Slice 5)

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
