# Current Task Queue

Last updated: 2026-03-11

---

## Active Work

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

## Next Up (Unstarted)

- [ ] **Item Detail Dashboard Overview Tab** — Add landing page with check-outs, reservations, and events overview
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
