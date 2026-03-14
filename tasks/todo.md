# Current Task Queue

Last updated: 2026-03-11

---

## Active Work

### Polish Items & Reservations Pages

- [x] Items list: wrap reload in useCallback, add debounced search, consolidate filter styles, error states, Unicode entities
- [x] Items detail: useCallback for loaders, try/catch + feedback for actions, loading states, Unicode entities
- [x] Reservations list: error feedback on convert/cancel failures
- [x] Reservations detail: Unicode entities, try/catch on cancel, loading during refetch, error reset
- [x] Build & verify, commit & push

### Phase A Remaining

- [ ] **Student Mobile Hardening** — D-015 accepted, brief missing
  - Write `docs/BRIEF_STUDENT_MOBILE_V1.md` first
  - Define student KPIs: taps-to-action, task-completion time, scan success rate
  - Scope: student dashboard actions, scan parity, owned-work list UX
  - Ref: AREA_MOBILE.md, AREA_DASHBOARD.md, DECISIONS.md D-015
  - Blocked by: PD-5 (KPI definitions)

### Phase B Prep

- [ ] **D-009 Recipient Model Acceptance**
  - Define escalation recipient model (who gets +24h escalation?)
  - Define alert fatigue controls (per-booking cap, opt-out)
  - Update D-009 from Partially Implemented to Accepted once resolved
  - Ref: docs/AREA_NOTIFICATIONS.md, docs/DECISIONS.md D-009, docs/GAPS_AND_RISKS.md PD-1

---

## Recently Shipped

- [x] **Dashboard V2** — Ops-first split layout with live countdown timers (2026-03-11)
- [x] **Item Detail: UW Asset Tag Mirror** — uwAssetTag shown in page header (2026-03-11)
- [x] **Item Detail: Calendar Grid** — Month-view calendar with booking blocks (2026-03-11)
- [x] **Item Detail: Booking Refresh Fix** — BookingDetailsSheet onUpdated wired to reload data (2026-03-11)

---

## Next Up (Unstarted)

- [ ] **Duplicate/Clone Action** — Single "Duplicate" action for reservations (deferred from V1 shipped)

---

## Pending Decisions

See `docs/GAPS_AND_RISKS.md` for the full registry. Key blockers:

1. **PD-1**: D-009 escalation recipients — blocks Phase B notification polish
2. **PD-5**: Student mobile KPIs — blocks BRIEF_STUDENT_MOBILE_V1.md

---

## Notes

- Always write a BRIEF_*.md or Decision record before implementing any new feature
- Run `npm run build` before any commit — build failures are avoidable
- Every mutation endpoint needs audit logging — do not skip
- NORTH_STAR.md is the first read for any new Claude session
- When shipping a feature, update the relevant AREA file and GAPS_AND_RISKS.md (CLAUDE.md rule 12)
