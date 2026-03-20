# Current Task Queue

Last updated: 2026-03-20

---

## Active Work

### shadcn Avatar Integration (Slice 1.5 of shadcn plan)

- [ ] Add shadcn Avatar component (Avatar, AvatarImage, AvatarFallback)
- [ ] Create AvatarGroup component for stacked/overlapping avatars
- [ ] Migrate Sidebar avatar (sidebar-avatar-lg → Avatar)
- [ ] Migrate UserRow mobile avatar (user-mobile-avatar → Avatar)
- [ ] Migrate UserDetail page avatar (user-detail-avatar → Avatar)
- [ ] Add stacked avatars to ShiftDetailPanel pending requests
- [ ] Add stacked avatars to schedule page coverage indicators
- [ ] Clean up old avatar CSS classes from globals.css
- [ ] npm run build — verify zero regressions
- [ ] Commit & push

### Scheduling + Gear Integration (Research: `tasks/scheduling-gear-integration-research.md`)

**Persona priority**: Student-first | **Gear suggestion**: Event pre-fill only

- [x] Research: competitive analysis + integration strategy (2026-03-17)
- [x] **Slice 1**: Shift context banner on checkout creation form (2026-03-17)
- [x] **Slice 2**: "My Shifts" dashboard widget with gear status (2026-03-17)
- [x] **Slice 3**: "Gear Up" notification on shift assignment approval (2026-03-17)
- [x] **Slice 4**: Event Command Center — unified staff view (2026-03-18)
- [ ] **Slice 5** (future): Game-Day Readiness Score
- [x] **Slice 6**: Shift-Checkout linking (shiftAssignmentId FK) (2026-03-18)

---

## Recently Shipped

- [x] **shadcn/ui Slice 1** — Foundation + Button/Badge/Skeleton (2026-03-20)
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
