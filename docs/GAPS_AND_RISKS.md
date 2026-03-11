# Gear Tracker — Gaps, Pending Decisions, and Risks

## Document Control
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-11
- Status: Living registry — update when shipping features or resolving decisions
- Purpose: Single file listing every open gap, pending decision, and known risk across all docs

---

## Pending Decisions

| ID | Description | Owner Area | Priority | Blocker? |
|---|---|---|---|---|
| PD-1 | D-009: Escalation recipient model — who receives +24h overdue notifications? | AREA_NOTIFICATIONS | High | Blocks Phase B notification polish |
| PD-2 | Venue mapping governance — who owns regex-to-location mapping table? | AREA_EVENTS | Medium | No |
| PD-3 | Event sync refresh cadence — Cloudflare Cron schedule and staleness thresholds | AREA_EVENTS | Medium | No |
| PD-4 | B&H metadata cache TTL target | AREA_ITEMS | Low | No |
| PD-5 | Student mobile KPI definitions — taps-to-action, task-completion time, scan success rate | AREA_MOBILE | High | Blocks BRIEF_STUDENT_MOBILE_V1.md |

---

## Open Gaps

| ID | Description | Owner Area | Status | Notes |
|---|---|---|---|---|
| GAP-1 | `BRIEF_STUDENT_MOBILE_V1.md` not written | AREA_MOBILE | Open | D-015 accepted, brief needed before implementation |
| GAP-2 | Draft persistence model underspecified | AREA_DASHBOARD | Open | D-017 covers DRAFT state; recovery UX is Phase B |
| GAP-3 | Equipment guidance: only 1 rule in production | AREA_CHECKOUTS | Low priority | D-016 defers admin-config to Phase C |
| GAP-4 | Phase C features unscoped and unbriefed | NORTH_STAR | Expected | Kiosk, templates, analytics — intentionally deferred |
| GAP-5 | D-009 alert fatigue controls undefined | AREA_NOTIFICATIONS | Open | Required for D-009 formal acceptance |
| GAP-6 | Email notification channel not wired | AREA_NOTIFICATIONS | Phase B | V1 = in-app only per D-009 |

---

## Phase B Deferred Features

| Feature | Owner Area | Decision Ref | Notes |
|---|---|---|---|
| Asset financial fields UI (purchasePrice, warrantyDate, residualValue) | AREA_ITEMS | D-018 | Schema ready, expose in Settings tab for admins |
| Department filter/display | AREA_ITEMS | D-019 | Schema ready, optional grouping |
| Kit management UI + kit-based checkout | AREA_CHECKOUTS | D-020 | Full schema exists, zero UI |
| Dashboard saved filters | AREA_DASHBOARD | — | Deferred from V1 |
| Dashboard filter chips (Sport, Location) | AREA_DASHBOARD | — | Deferred from V1 |
| Notification center polish (pagination, mark-as-read) | AREA_NOTIFICATIONS | — | After D-009 acceptance |
| Multi-recipient escalation | AREA_NOTIFICATIONS | D-009 | Pending recipient model decision |
| Picker improvements (multi-select, scan-to-add) | AREA_CHECKOUTS | — | Phase B roadmap |
| Calendar source health UI | AREA_EVENTS | — | Enable/disable + sync status display |

---

## Phase C Deferred Features

| Feature | Owner Area |
|---|---|
| Kiosk mode (self-serve scan station) | AREA_CHECKOUTS |
| Reservation and checkout templates | AREA_RESERVATIONS |
| Board / ops view for game-day coordinators | AREA_DASHBOARD |
| Advanced analytics | NORTH_STAR |
| Multi-source event ingestion beyond UW Badgers ICS | AREA_EVENTS |
| Database-configurable equipment guidance rules | AREA_CHECKOUTS (D-016) |

---

## Active Risks

| Risk | Early Signal | Defense | Owner |
|---|---|---|---|
| Analytics creep | Chart widget requests before workflows solid | Invoke Phase C deferral; link NORTH_STAR.md | Product |
| Status drift | Any PR writing to `status` as authoritative | D-001 is a hard gate; block at review | Engineering |
| Generic inventory thinking | Features that fit any business but not athletics ops | Decision filter: "would Cheqroom have this by default?" | Product |
| Mobile as afterthought | Dashboard/list changes without AREA_MOBILE.md review | Scope rule: mobile review mandatory | Engineering |
| Scope expansion without brief | Features shipped without BRIEF_*.md or Decision record | CLAUDE.md rule 12: no brief = no implementation | Product |
| Premature Phase C | Kiosk/templates work before Phase A/B solid | Roadmap sequencing enforced by NORTH_STAR.md | Product |
| Equipment guidance stagnation | Only 1 guidance rule in production | Quarterly rule audit with operator input | Product |
| Alert fatigue from escalation | Repeated overdue notifications overwhelm staff | D-009 fatigue controls required before Phase B | Engineering |

---

## Closed Items (for reference)

| ID | Description | Closed Date | Resolution |
|---|---|---|---|
| ~~GAP-A~~ | AREA_NOTIFICATIONS.md missing | 2026-03-11 | File exists, escalation schedule documented |
| ~~GAP-B~~ | DRAFT booking state not formally specced | 2026-03-11 | D-017 accepted, documented in AREA_CHECKOUTS.md |
| ~~GAP-C~~ | Calendar source enable/disable not specced | 2026-03-11 | Implemented: enabled toggle + sync health UI shipped |
| ~~GAP-D~~ | Sync health dashboard no admin UI | 2026-03-11 | Implemented: source table shows event count, last synced, error badge |

---

## Change Log
- 2026-03-11: Initial registry created from docs hardening pass. Consolidated from NORTH_STAR.md gaps, DECISIONS.md pending items, and scattered AREA file TODOs.
