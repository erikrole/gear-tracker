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
| ~~PD-1~~ | ~~D-009: Escalation recipient model~~ | ~~AREA_NOTIFICATIONS~~ | ~~Resolved~~ | ~~Requester + all admins; admin-configurable fatigue controls~~ |
| PD-2 | Venue mapping governance — who owns regex-to-location mapping table? | AREA_EVENTS | Medium | No |
| PD-3 | Event sync refresh cadence — Vercel Cron schedule and staleness thresholds | AREA_EVENTS | Medium | No |
| ~~PD-4~~ | ~~B&H metadata cache TTL target~~ | ~~AREA_ITEMS~~ | ~~N/A~~ | ~~No — D-005 withdrawn~~ |
| ~~PD-5~~ | ~~Student mobile KPI definitions~~ | ~~AREA_MOBILE~~ | ~~Resolved~~ | ~~Taps-to-checkout ≤3, scan success ≥95%, task completion <30s~~ |

---

## Open Gaps

| ID | Description | Owner Area | Status | Notes |
|---|---|---|---|---|
| ~~GAP-1~~ | ~~`BRIEF_STUDENT_MOBILE_V1.md` not written~~ | ~~AREA_MOBILE~~ | ~~Closed~~ | ~~Brief written, V1 hardening shipped 2026-03-15~~ |
| ~~GAP-2~~ | ~~Draft persistence model underspecified~~ | ~~AREA_DASHBOARD~~ | ~~Closed~~ | ~~Shipped 2026-03-16: DRAFT booking CRUD + dashboard section + auto-save on cancel~~ |
| GAP-3 | Equipment guidance: only 1 rule in production | AREA_CHECKOUTS | Low priority | D-016 defers admin-config to Phase C |
| GAP-4 | Phase C features unscoped and unbriefed | NORTH_STAR | Expected | Kiosk, templates, analytics — intentionally deferred |
| ~~GAP-5~~ | ~~D-009 alert fatigue controls undefined~~ | ~~AREA_NOTIFICATIONS~~ | ~~Closed~~ | ~~Admin-configurable intervals + per-booking caps; D-009 accepted~~ |
| ~~GAP-6~~ | ~~Email notification channel not wired~~ | ~~AREA_NOTIFICATIONS~~ | ~~Closed~~ | ~~Resend email service wired; dual-channel (in-app + email) shipped 2026-03-16~~ |

---

## Phase B Deferred Features

| Feature | Owner Area | Decision Ref | Notes |
|---|---|---|---|
| ~~Asset financial fields UI~~ | ~~AREA_ITEMS~~ | ~~D-018~~ | ~~Shipped 2026-03-16: Procurement section in item detail Info tab~~ |
| Department filter/display | AREA_ITEMS | D-019 | Schema ready, optional grouping |
| Kit management UI + kit-based checkout | AREA_CHECKOUTS | D-020 | Full schema exists, zero UI. Simple parent-child accessories shipped via D-023. |
| Dashboard saved filters | AREA_DASHBOARD | — | Deferred from V1 |
| Dashboard filter chips (Sport, Location) | AREA_DASHBOARD | — | Deferred from V1 |
| Notification center polish (pagination, mark-as-read) | AREA_NOTIFICATIONS | — | After D-009 acceptance |
| Multi-recipient escalation | AREA_NOTIFICATIONS | D-009 | Pending recipient model decision |
| ~~Picker improvements (multi-select, scan-to-add)~~ | ~~AREA_CHECKOUTS~~ | ~~—~~ | ~~Shipped 2026-03-15~~ |
| Calendar source health UI | AREA_EVENTS | — | Enable/disable + sync status display |
| ~~Shift scheduling (replaces Asana/WhenToWork)~~ | ~~AREA_SHIFTS~~ | ~~—~~ | ~~Shipped 2026-03-16: sport configs, auto-generation, assignment, trade board~~ |
| Shift notification channel (email for trade claims) | AREA_SHIFTS | — | V1 = in-app audit only; email deferred |
| Student availability tracking | AREA_SHIFTS | — | Students declare unavailable dates; deferred to Phase B |
| Scheduling + gear deep linking (shiftAssignmentId FK on Booking) | AREA_SHIFTS / AREA_CHECKOUTS | — | Phase 3 of integration; see `tasks/scheduling-gear-integration-research.md` |

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
| ~~GAP-E~~ | Bulk items lack individual loss tracking | 2026-03-14 | D-022: numbered bulk units with trackByNumber flag, unit picker, and per-unit status |

---

## Change Log
- 2026-03-11: Initial registry created from docs hardening pass. Consolidated from NORTH_STAR.md gaps, DECISIONS.md pending items, and scattered AREA file TODOs.
- 2026-03-14: Closed GAP-E (bulk items lack individual loss tracking) — D-022 shipped.
- 2026-03-15: Picker improvements shipped — multi-select, per-section search, availability preview, scan-to-add.
- 2026-03-15: Closed PD-1 (escalation recipients: requester + all admins), PD-5 (student KPIs defined), GAP-5 (fatigue controls: admin-configurable). D-009 formally accepted.
- 2026-03-15: Closed GAP-1 (student mobile brief written, V1 hardening shipped).
- 2026-03-16: Closed GAP-6 (email notification channel wired via Resend + Vercel Cron every 15min).
- 2026-03-16: Sentry error tracking wired (optional DSN, source maps, global error boundary). Vercel Blob image upload wired (POST/DELETE /api/assets/:id/image).
- 2026-03-16: UI overhaul — modern minimal design system. Removed liquid glass, warm neutrals, #202020 dark sidebar, Wisconsin red for brand moments only, neutral dark primary buttons.
- 2026-03-16: Closed GAP-2 (draft persistence). D-017 shipped: DRAFT CRUD API, dashboard Drafts section, auto-save on cancel, resume pre-fill. D-018 marked shipped (financial fields already in UI).
