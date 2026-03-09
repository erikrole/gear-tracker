# Gear Tracker Architectural and Product Decisions

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Product: Gear Tracker
- Last Updated: 2026-03-02
- Status: Living decision log
- Purpose: track durable decisions, rationale, and downstream constraints

## Decision Index
- D-001: Asset status is derived, not stored
- D-002: Booking is a unified reservation + checkout model
- D-003: Event-centric checkout flow with default linkage
- D-004: Tag-first asset identity in UI
- D-005: B&H enrichment is isolated and non-destructive
- D-006: Data integrity is protected with SERIALIZABLE + exclusion constraints
- D-007: Audit logging is a product feature, not a backend afterthought
- D-008: Mixed-location operations are first-class
- D-009: Notification escalation threshold for overdue
- D-010: Scope and sequencing priorities
- D-011: Tiered role model with inheritance and ownership checks
- D-012: Booking lifecycle transition guardrails for checkout and reservation flows
- D-013: Item identity and item-kind behavior are explicit and non-interchangeable
- D-014: Cheqroom importer must be lossless and non-authoritative for live status
- D-015: Student-first mobile operations contract with role-adaptive action surfaces
- D-016: Equipment picker sections and guidance rules are code-defined in V1
- D-017: DRAFT booking state is valid but informally specced until a future brief formalizes it

---

## D-001: Asset Status Is Derived, Not Stored
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Stored status fields drift and become operationally wrong.
- Decision:
  - Asset availability/status is computed from active allocations and booking lifecycle context.
- Consequences:
  - Fewer manual correction workflows.
  - Read-path complexity increases and requires robust query/test coverage.
- Guardrails:
  - No feature may treat stored status as authoritative.

## D-002: Booking Is Unified Reservation + Checkout
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Separate entities increase workflow friction and reconciliation risk.
- Decision:
  - Booking remains the single lifecycle container with states `BOOKED`, `OPEN`, `COMPLETED`, `CANCELLED`.
- Consequences:
  - Simpler user mental model.
  - State transition policy must be explicit and validated.

## D-003: Event-Centric Checkout with Default Linkage
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Athletics operations are event-driven; generic checkout defaults waste time.
- Decision:
  - Checkout creation defaults to event linkage with sport selection and upcoming event picker.
- Consequences:
  - Faster booking creation and stronger operational context.
  - Requires reliable event ingest and fallback UX for no-event cases.

## D-004: Tag-First Identity in UI
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Staff identify gear by sticker/tag, not product catalog name.
- Decision:
  - `tagName` is always primary label in list and picker surfaces.
  - `productName + brand/model` is secondary metadata.
- Consequences:
  - Faster physical lookup.
  - Import and enrichment logic must not overwrite tag identity.

## D-005: B&H Enrichment Is Isolated and Non-Destructive
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Metadata quality is inconsistent, manual entry is slow.
- Decision:
  - Implement enrichment as isolated service boundary with strict domain validation and parser fallbacks.
  - Never mutate `tagName` through enrichment.
  - Auto-prefill product metadata and image when available, while allowing user edits before save.
  - Import failures must degrade gracefully to manual entry.
- Consequences:
  - Better data quality with controlled blast radius.
  - Parser maintenance required as source markup changes.

## D-006: Integrity via SERIALIZABLE Transactions + Exclusion Constraints
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Overlapping reservations and race conditions are critical failure modes.
- Decision:
  - Preserve SERIALIZABLE transaction strategy for booking mutations.
  - Preserve PostgreSQL exclusion constraints for overlap prevention.
- Consequences:
  - High safety for concurrent operations.
  - Engineering changes must be tested for lock/retry behavior.

## D-007: Audit Logging Is a Product Feature
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Student-heavy operations require accountable change history.
- Decision:
  - New mutation paths must include auditable logs with meaningful diffs.
- Consequences:
  - Stronger trust and incident resolution.
  - Additional implementation overhead for every new flow.

## D-008: Mixed-Location Is First-Class
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Inventory and return behavior span Camp Randall and Kohl Center.
- Decision:
  - Mixed location support (`itemLocations`, `locationMode`) is part of baseline behavior.
- Consequences:
  - Every picker and return flow must account for location plurality.
  - UX needs clear return-location guidance.

## D-009: Overdue Escalation Policy
- Date: 2026-03-01
- Status: Partially Implemented — schedule and dedup shipped; recipient model pending acceptance
- Context:
  - Overdue notifications exist, but multi-recipient escalation is not formalized.
- Decision (Implemented):
  - Escalation schedule: -4h, 0h, +2h, +24h relative to `booking.endsAt`
  - Dedup key: `"{bookingId}:{type}"` — prevents re-fire per booking per window
  - Current behavior: all 4 triggers notify the checkout requester only
  - Implementation: `src/lib/services/notifications.ts`
- Decision (Pending Acceptance):
  - Define admin/manager escalation recipients for the +24h trigger
  - Define alert fatigue controls (per-booking cap, opt-out)
  - Define email failure retry behavior
- Consequences:
  - Faster recovery of missing gear once full escalation is wired.
  - Needs policy controls to avoid alert fatigue.
- Exit Criteria to Formally Accept:
  - Escalation recipient model approved and documented.
  - Multi-recipient escalation implemented and tested.
  - Alert fatigue controls defined and implemented.

## D-010: Sequencing Priorities
- Date: 2026-03-01
- Status: Accepted (updated 2026-03-09 to reflect shipped items)
- Context:
  - Multiple initiatives compete for near-term bandwidth.
- Decision:
  - Prioritize in this order:
    1. ✅ Checkout UX v2 — Complete (PRs 20–25)
    2. ✅ Items page finish — Complete (list columns/filters/pagination, status dot + booking popover, detail tabs, inline edit, item-kind create form)
    3. B&H metadata enrichment — Not started; next up
    4. ✅ Event sync phase 1 — Complete (ICS ingest, hardening PRs 26–30)
    5. ✅ Equipment picker upgrade — Complete (sectioned picker, guidance rules, PRs 22–25)
    6. Notification center improvements — Partial (escalation schedule shipped; D-009 acceptance pending)
    7. Student dashboard baseline — Not started; brief needed
- Consequences:
  - Maximizes immediate operational impact.
  - Advanced reporting intentionally deferred.

## D-011: Tiered Role Model with Inheritance
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Operations need broad staff control while preserving student ownership boundaries.
- Decision:
  - Roles follow inheritance: `ADMIN > STAFF > STUDENT`.
  - `ADMIN` can do everything.
  - `STAFF` can add/edit all users, items, reservations, and check-outs.
  - `STAFF` can promote and demote users between roles.
  - `STAFF` can force location exceptions.
  - `STUDENT` can view all users, items, reservations, and check-outs.
  - `STUDENT` can add/edit only their own reservations and check-outs.
  - V1 delete policy uses cancel/archive patterns, not hard delete.
- Consequences:
  - Clear, predictable authorization behavior across dashboard and mutation paths.
  - Requires consistent ownership checks and row-level action filtering.

## D-012: Booking Lifecycle Transition Guardrails
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Checkout and reservation flows are the highest-frequency workflows and the highest risk for integrity bugs.
- Decision:
  - Use explicit transition guardrails:
    - `BOOKED -> OPEN` allowed.
    - `BOOKED -> CANCELLED` allowed by role/policy.
    - `OPEN -> COMPLETED` only when all allocations are returned.
    - `OPEN -> CANCELLED` disallowed in normal flow.
    - `COMPLETED` and `CANCELLED` are terminal in V1.
  - All availability-impacting edits must re-run overlap/conflict validation.
  - Partial check-in is supported but must not complete booking early.
- Consequences:
  - Reduces invalid state transitions and custody gaps.
  - Requires strict action gating in UI and server enforcement on all mutations.

## D-013: Item Identity and Item-Kind Behavior
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Items need clearer operational identity and fewer data-shape ambiguities across list, create, and detail workflows.
- Decision:
  - Serialized assets are tag-first (`tagName`) and must preserve distinct identity semantics.
  - Bulk items follow quantity-first semantics and separate validation path.
  - UI status shown for items is derived from active allocations; no direct editable authoritative status.
  - Eligibility toggles (reserve/check-out/custody) are policy flags, not live status values.
- Consequences:
  - Lower risk of identity drift and status confusion.
  - Requires explicit branching in form validation and mutation endpoints.

## D-014: Cheqroom Importer Is Lossless and Non-Authoritative for Status
- Date: 2026-03-01
- Status: Accepted
- Context:
  - Migration data includes many columns, mixed quality, and legacy status labels that conflict with Gear Tracker derived-status architecture.
- Decision:
  - Importer must parse all source columns and preserve unmapped values in source payload metadata.
  - Source `Status` is stored for traceability only and never written as authoritative asset status.
  - Import process supports dry run, create-only, and upsert modes with row-level diagnostics.
- Consequences:
  - Low migration data loss risk and better auditability.
  - Additional implementation complexity in staging and reporting.

## D-015: Student-First Mobile Operations Contract
- Date: 2026-03-02
- Status: Accepted
- Context:
  - Students are primary day-to-day users on phones.
  - Cheqroom-style mobile can become cluttered when admin actions and dashboards are not role-adaptive.
- Decision:
  - Mobile UX is action-first and role-adaptive across dashboard, reservations, check-outs, and items.
  - V1 mobile prioritizes overdue and due-soon execution, scan access, and owned-work actions for students.
  - Event sync remains operational context for booking flows, not a required standalone dashboard module in V1.
- Consequences:
  - Lower cognitive load and faster student task completion.
  - Every area touching dashboard or list interactions must validate behavior against `AREA_MOBILE.md`.

## D-016: Equipment Picker Sections and Guidance Rules Are Code-Defined in V1
- Date: 2026-03-09
- Status: Accepted
- Context:
  - The checkout picker uses a sectioned kit-first flow with context-aware guidance hints.
  - Configuring sections and rules via a database admin UI adds complexity without clear near-term need.
- Decision:
  - Equipment sections are defined in `src/lib/equipment-sections.ts`.
  - Guidance rules are defined in `src/lib/equipment-guidance.ts`.
  - New sections or rules are added via code PR, not an admin UI.
  - Database-configurable rules are deferred to Phase C.
- Consequences:
  - Fast to add new rules; requires a code deployment.
  - Operators cannot self-serve rule changes without engineering support.
- Guardrails:
  - New guidance rules must be reviewed against actual equipment workflows, not added speculatively.

## D-017: DRAFT Booking State Is Valid but Informally Specced
- Date: 2026-03-09
- Status: Accepted (behavior) / Proposed (full formalization)
- Context:
  - `checkout-rules.ts` handles a `DRAFT` booking state (allows `edit` and `cancel`) but AREA_CHECKOUTS.md and DECISIONS.md did not formally document this state.
- Decision:
  - DRAFT is a valid pre-BOOKED state for interrupted checkout creation flows.
  - DRAFT allows edit and cancel only; no transitions to OPEN or COMPLETED from DRAFT.
  - DRAFT records appear in dashboard Drafts section only; excluded from main checkout list.
  - Full DRAFT lifecycle (creation trigger, auto-expiry, recovery UI) should be formalized in a future brief before extending DRAFT behavior.
- Consequences:
  - Dashboard Drafts section recovers interrupted flows.
  - DRAFT state must be explicitly excluded from checkout list queries.
- Guardrails:
  - No new DRAFT behavior (auto-expiry, promotion rules, sharing) without a formal brief.

---

## Decision Rules for Future Changes
1. Any proposal that risks D-001 or D-006 requires explicit architecture review.
2. Any workflow change touching students must preserve mobile-first usability and low cognitive load.
3. Any new ingestion or enrichment integration must be isolated and failure-tolerant.
4. Major scope changes must update both this file and `PRODUCT_SCOPE.md` in the same PR.
5. Any dashboard/list/scan UX change must also be reflected in `AREA_MOBILE.md`.

## Active Risks and Mitigations
- Risk: Event data staleness or malformed ICS input.
  - Mitigation: idempotent imports, observability, fallback ad hoc booking path.
- Risk: Parser breakage from B&H markup changes.
  - Mitigation: precedence-based parser strategy, graceful partial returns.
- Risk: Alert fatigue from escalation.
  - Mitigation: threshold controls + dedup keys + policy review.

## Pending Decisions
1. Event sync refresh cadence and staleness thresholds.
2. Venue mapping governance owner.
3. Metadata enrichment cache TTL target.
4. Student mobile KPI definitions (task completion time, taps to action, scan success rate).

## Change Log
- 2026-03-01: Initial decision log created from project memory dump.
- 2026-03-02: Added student-first mobile operations contract decision.
- 2026-03-09: Updated D-009 to reflect partial implementation and pending acceptance criteria. Updated D-010 to mark shipped items. Added D-016 (code-defined picker sections/rules) and D-017 (DRAFT booking state).
