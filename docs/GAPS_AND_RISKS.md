# Gear Tracker — Active Gaps, Pending Decisions, and Risks

## Document Control

- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-07-15
- Status: Active registry
- Purpose: Track only open gaps, pending decisions, active risks, and intentionally deferred scope.
- Historical record: [GAPS_AND_RISKS_HISTORY.md](archive/GAPS_AND_RISKS_HISTORY.md)

## Pending Decisions

No open pending decisions are currently tracked here. Accepted decisions and their rationale live in [DECISIONS.md](DECISIONS.md). Add a pending decision here only when it has an unresolved owner, consequence, or product/architecture choice.

## Open Gaps

| ID | Description | Owner Area | Status | Notes |
|---|---|---|---|---|
| GAP-21 | `SystemConfig` has no generic all-key admin surface | AREA_SETTINGS | Expected | Low priority. Operator-facing pages exist for specific keys such as checkout policies and reservation rules. A generic key/value UI remains deferred until more keys need direct admin ownership. |
| GAP-34 | iOS Bookings list lacks the status scope filters and column sorting available on web | AREA_MOBILE | Expected | iOS currently uses `activeOnly: true`, which is acceptable for the V1 student bar. Power-user parity remains deferred. Source: `tasks/audit-bookings-ios.md`. |
| GAP-36 | iOS Item detail does not expose AC-8 admin actions: Duplicate, Retire, Delete, and Needs Maintenance | AREA_MOBILE | Expected | These destructive and lifecycle actions remain web-only by design for V1. Track staff-mobile parity separately from student operational work. Source: `tasks/audit-items-ios.md`. |
| GAP-59 | Firmware watch does not cover every live camera body | AREA_ITEMS | Expected | The inventory-driven seed covers verified Sony pages. DJI, GoPro, Insta360, and JVC remain deferred until official-source adapters exist for each vendor's page format. Source: `tasks/firmware-watch-inventory-report.md`. |

## Deferred Product Scope

| Feature | Owner Area | Decision or rationale |
|---|---|---|
| Reservation and checkout templates | AREA_RESERVATIONS | Phase C; defer until repeatable operator habits justify template ownership. |
| Board or operations view for game-day coordinators | AREA_DASHBOARD | Phase C; do not add another command surface before current queues prove insufficient. |
| Advanced analytics | NORTH_STAR | Phase C; operational workflows and trustworthy history take priority. |
| Multi-source event ingestion beyond UW Badgers ICS | AREA_EVENTS | Defer until another source is operationally required. |
| Database-configurable equipment guidance rules | AREA_CHECKOUTS | D-016 keeps V1 guidance code-defined. Revisit when operators need direct rule ownership. |

## Active Risks

| Risk | Early Signal | Defense | Owner |
|---|---|---|---|
| Analytics creep | Chart requests arrive before a workflow has a clear decision owner | Apply the Phase C filter in NORTH_STAR and keep reports read-only and operationally grounded | Product |
| Status drift | A feature writes to a stored status as authoritative | Enforce D-001 in review and keep derived status tests close to allocation logic | Engineering |
| Generic inventory thinking | A feature could ship unchanged for any business | Ask whether it reflects athletics operations, custody, events, crews, batteries, or staffed handoffs | Product |
| Mobile as afterthought | Web or dashboard changes omit native iOS review | Review AREA_MOBILE and the relevant iOS contract before closing the slice | Engineering |
| Scope expansion without brief | Behavior ships without a relevant brief, decision, or area contract | Follow the pre-implementation audit in AGENTS.md | Product |
| Premature Phase C | Templates, broad analytics, or extra ingestion starts before current workflows are stable | Keep deferred scope here and in NORTH_STAR until an operator habit or launch need is confirmed | Product |
| Equipment guidance stagnation | The three production guidance rules no longer cover recurring operator mistakes | Run a periodic rule audit with operator input before adding generic configurability | Product |
| Audit log growth | Retention deletes continue while export-before-delete evidence is still unavailable | Keep bounded retention observable and plan export-before-delete before the dataset reaches the agreed scale threshold | Engineering |
| Decision or migration provenance drift | A decision references a migration or constraint that is not present in the local migration chain | Reconcile the decision, schema, live migration health, and runbook before schema work; never recreate history by hand | Engineering |

## Change Log

- 2026-07-11: Split the active registry from the full historical ledger. Resolved gap rows, decisions, and dated reconciliation notes remain in [GAPS_AND_RISKS_HISTORY.md](archive/GAPS_AND_RISKS_HISTORY.md); this file now contains only active follow-up and deliberate deferral.
