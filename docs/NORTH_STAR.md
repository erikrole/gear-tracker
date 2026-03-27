# Gear Tracker — North Star

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Product: Gear Tracker
- Created: 2026-03-09
- Status: Authoritative — read this first in any Claude session
- Purpose: Define what Gear Tracker is, who it serves, what principles guide every decision, and what comes next

---

## Executive Summary

Gear Tracker replaces Cheqroom as the internal gear management system for Wisconsin Athletics Creative. It is not a generic inventory platform — it is an event-driven, athletics-specific operational system built for the daily realities of game-day media operations at Camp Randall Stadium and Kohl Center.

The system's primary value is **operational speed, clarity, and trust** for check-outs, reservations, and gear handling. The right metric is not how many features it has. It is: can a student check out a camera kit in three taps, and does the staff coordinator know — without guessing — who has what gear and when it comes back?

---

## 1. What Gear Tracker Is Trying To Be

- **The operational gear layer** for Wisconsin Athletics Creative's daily and game-day workflows
- **Event-driven**: the athletics schedule is the default booking context, not a separate view
- **Mobile-first**: students — the highest-frequency users — execute most workflows on phones in the field
- **Admin-powerful**: staff can act on anything, override when needed, and audit everything that happened
- **Tag-first**: gear is identified by physical sticker and tag, not by product catalog name or database ID
- **Accountability-native**: every mutation is auditable; custody is never ambiguous
- **Trustworthy**: the system's status is always correct because it is always computed, never assumed

---

## 2. What It Is Explicitly Not Trying To Be

- A generic inventory or ERP system
- A chart-first analytics product
- A procurement or finance lifecycle platform
- A native mobile app (mobile-first web is the target)
- A campus-wide or multi-department asset management system — scope is Wisconsin Athletics Creative only
- A Cheqroom clone — we are selectively improving on Cheqroom's patterns, not porting them

---

## 3. Primary Users

### Mode 1: Students (Highest-Frequency Operators)
- **Who**: Student crew members handling gear for game-day productions
- **Context**: On their phone, often in a stadium or arena, sometimes in a hurry
- **Primary jobs**: Check gear out for an event, scan items in/out, return gear when done, view what they currently have checked out
- **What they need**: Role-adaptive actions (only their own work), overdue visibility, fast scan access, zero admin clutter
- **Success metric**: Find and act on own due or overdue checkouts within two taps from dashboard

### Mode 2: Staff (Operational Control)
- **Who**: Full-time Wisconsin Athletics Creative staff
- **Context**: Desktop and mobile, managing all users, all gear, all bookings
- **Primary jobs**: Create and manage bookings for any user, handle game-day logistics, override exceptions, field escalations
- **What they need**: Global mutation access, clear overdue and active-checkout status, location exception control, quick access to any booking
- **Success metric**: Can act on any booking from dashboard without navigating deeper than one click

### Mode 3: Admins (Governance + Oversight)
- **Who**: Technical administrators and senior staff leads
- **Context**: Desktop-primary, lower frequency
- **Primary jobs**: User and role management, audit log review, calendar source configuration, escalation response, configuration changes
- **What they need**: Full access, reliable audit trail, clear system health signals
- **Success metric**: Can investigate and resolve any incident from audit log alone

---

## 4. Highest-Frequency Workflows (Ranked by Operational Frequency)

1. **Check out gear** — Event-linked, fast, scan-confirmed. Zero manual title/date entry for event-linked flows.
2. **Check in / return gear** — Partial + full, scan-driven. Unambiguous what was returned and when.
3. **Reserve gear for upcoming event** — BOOKED state, transitions to OPEN at handoff. No conflict surprises at handoff time.
4. **View and act on overdue or due-soon items** — Dashboard action lane + overdue banner. Zero mystery about who has what.
5. **Look up item status and history** — Scan QR or search → full custody context in under 2 seconds.
6. **Import / onboard new gear** — CSV upload → dry run → fix errors → import. Full audit, no status drift from Cheqroom data.

---

## 5. What "Great" Looks Like for Each Workflow

### Check out gear
- Staff selects sport → system auto-picks next event → title, date, location prefilled
- Student selects equipment from sectioned picker with guidance hints (e.g., "You selected a camera body — don't forget batteries")
- Booking created in 3 taps; no typing required for standard event-linked checkouts

### Check in / return gear
- Scan QR code → system identifies open checkout → confirm return
- Partial returns update booking status in real-time; booking stays OPEN until all items back
- Completed checkout auto-transitions with zero manual state change

### Reserve gear
- Create reservation → conflict check runs before commit → no surprises at handoff
- Equipment panel shows live conflict badges if items become unavailable
- "Proceed to check-out" CTA is always one tap when it's time to convert

### Overdue handling
- Dashboard opens with red overdue banner showing count + top 3 items
- Staff can extend, check in, or view detail from dashboard row without navigating away
- 24h escalation sends to admin recipients automatically (after D-009 recipient model accepted)

### Item lookup
- Scan QR → item detail with current status, active bookings, custody history
- Status always derived and accurate — never stale from manual edits

### Import
- Upload CSV → dry run shows counts and errors per row
- Fix issues → re-run → import with full source payload preserved
- Cheqroom "Status" stored as traceability metadata only, never written as live status

---

## 6. Product Principles

These govern every feature decision and tradeoff. Any proposal that conflicts with principles 1, 3, or 7 requires explicit architecture review.

1. **Derived status is the law** — Asset availability is always computed from active allocations, never stored as an authoritative field. No exceptions.
2. **Operational speed over feature breadth** — A faster checkout beats smarter analytics every time. Ship fewer things, each working excellently.
3. **Mobile is a first-class surface** — Not a stripped desktop. Every dashboard and list change must be validated against `AREA_MOBILE.md`.
4. **Event context is the booking default** — Athletics is event-driven. Generic ad-hoc flows are the fallback, not the primary path.
5. **Tag-first identity** — Staff identify gear by physical label, not product name. `tagName` is always the primary label in every surface.
6. **Audit everything** — Every mutation must be auditable with actor, diff, and timestamp. Audit logging is a product feature, not backend scaffolding.
7. **Integrity before velocity** — SERIALIZABLE transactions and overlap-prevention constraints are non-negotiable. No feature may bypass them for speed.
8. **Student-first mobile UX** — Low cognitive load, action-first, role-adaptive. Students see only their work, with overdue surfaced prominently.
9. **Fail gracefully** — Missing event data, B&H failures, ICS errors must never block core booking operations. Always provide an ad-hoc fallback path.
10. **Simple role model** — `ADMIN > STAFF > STUDENT`, inheritance-based, predictable. Never add role complexity without a decision record.

---

## 7. Decision Filters

Use these questions before adding any feature:

| Question | If yes → | If no → |
|---|---|---|
| Does it make the checkout or check-in faster? | Prioritize | Scrutinize |
| Does it risk D-001 (derived status)? | Requires architecture review | Proceed normally |
| Does it work on mobile for students within 2 taps? | Validate against AREA_MOBILE.md | Push back or redesign |
| Does it add reporting before workflows are solid? | Defer to Phase C | Proceed |
| Does it require a new role tier or permission model? | Add a Decision record first | Proceed |
| Is there a brief or Decision record for it? | Proceed with implementation | Write the brief first |

---

## 8. Tradeoffs We Will Make

- **Fewer features, higher operational quality** — We will defer analytics, templating, and kiosk mode until core workflows are excellent.
- **Read-path complexity** for derived status over write-path simplicity of stored status.
- **Mobile-first** over desktop power-user optimization in all layout and interaction decisions.
- **Operational trust** over reporting richness in every release through Phase B.
- **Explicit failure handling** over silent success — conflicts, overlaps, and escalations are always surfaced.

## Tradeoffs We Will NOT Make

- Data integrity for development speed — no bypassing SERIALIZABLE or overlap constraints.
- Audit completeness — every mutation path must emit audit records, no exceptions.
- Student UX safety for admin convenience — role-adaptive surfaces must remain enforced.
- Derived-status architecture for any stored-status shortcut, no matter how "temporary."
- Generic inventory patterns that conflict with athletics-specific identity and workflow models.

---

## 9. Near-Term Roadmap

### Phase A — Now (Complete)
| Item | Status |
|---|---|
| Checkout UX V2 (action gating, event defaults, sectioned picker, partial check-in) | ✅ Complete |
| Calendar sync hardening (crash isolation, batch DB ops, Date.UTC, diagnostics) | ✅ Complete |
| Events page improvements (upcoming default, source deletion) | ✅ Complete |
| Reservations V1 (lifecycle, detail sheet, list page, action gating) | ✅ Complete |
| Items V1 (list, create, detail, inline edit, item-kind form) | ✅ Complete |
| ~~B&H metadata enrichment~~ | ❌ Withdrawn (scraping blocked) |
| Student mobile hardening V1 (scan permissions, ownership gating, role-adaptive sidebar) | ✅ Complete |
| Equipment guidance rules (body-needs-batteries, lens-needs-body, audio-with-video) | ✅ Complete (3 rules; admin-configurable rules deferred to Phase C per D-016) |
| shadcn/ui full migration (11 slices + 6 deep integrations) | ✅ Complete |
| Booking detail unification (checkout + reservation merged into BookingDetailPage) | ✅ Complete |
| Security & data integrity hardening (13 fixes, TOCTOU, privilege escalation) | ✅ Complete |
| 5-pass page hardening (dashboard, items, users, scan, auth, profile) | ✅ Complete |
| Scheduling + gear integration (6 slices: shift banner, My Shifts, Gear Up, Event Command Center) | ✅ Complete |

### Phase B — Complete (Beta Release 2026-03-27)
| Item | Status |
|---|---|
| ~~Picker improvements: multi-select, availability preview, scan-to-add~~ | ✅ Shipped 2026-03-15 (Equipment Picker V2) |
| ~~Calendar source health UI: enable/disable, sync status, error display~~ | ✅ Shipped 2026-03-19 |
| ~~Dashboard V2/V3: ops-first layout, live countdown, draft recovery~~ | ✅ Shipped 2026-03-12 |
| ~~Notification center: in-app + email delivery, Resend, Vercel Cron~~ | ✅ Shipped 2026-03-16 |
| ~~iPhone polish: input zoom, tap highlight, overscroll, responsive stacking~~ | ✅ Shipped 2026-03-22 |
| ~~Notifications escalation: D-009 recipient model, alert fatigue controls~~ | ✅ Shipped 2026-03-15 (D-009 accepted; recipient model + fatigue controls implemented) |
| ~~Kit management UI (D-020 — CRUD, members, archive, audit)~~ | ✅ Shipped 2026-03-24 |
| ~~Dashboard filter chips (Sport, Location)~~ | ✅ Shipped 2026-03-23/24 (sport + location filters, saved views) |
| ~~Kit-to-booking integration (kitId FK, selector, display)~~ | ✅ Shipped 2026-03-25 |
| ~~React Query adoption for cross-page caching~~ | ✅ Shipped 2026-03-26 (GAP-11 closed) |
| ~~Reports with charts (utilization donut, checkout trends, overdue bars)~~ | ✅ Shipped 2026-03-26 |
| ~~Search overhaul (debounced auto-search, users scope, recent searches)~~ | ✅ Shipped 2026-03-26 |
| ~~Favorites UI surface~~ | ✅ Shipped 2026-03-26 |

### Phase B+ — Post-Beta Polish
| Item | Status |
|---|---|
| Student availability tracking (declare unavailable dates) | ⬜ Deferred |
| Shift email notifications (trade claims via Resend) | ⬜ Deferred |
| Inline dashboard actions (extend/checkin on overdue rows) | ⬜ Planned |
| Cross-page state awareness (eventId propagation, scroll preservation) | ⬜ Planned |

### Phase C — Later
1. Kiosk mode (self-serve scan station)
2. Reservation and checkout templates
3. Board / ops view for game-day coordinators (Game-Day Readiness Score — deferred from scheduling integration)
4. Advanced analytics (only after workflows stabilize)
5. Multi-source event ingestion beyond UW Badgers ICS
6. Admin-configurable equipment guidance rules (D-016)

---

## 10. Risks / Drift to Avoid

| Risk | Early signal | Defense |
|---|---|---|
| Analytics creep | Chart widget requests before checkout is complete | Invoke Phase C deferral; link this doc |
| Status drift | Any PR that writes to a `status` field as authoritative | D-001 is a hard gate; block at review |
| Generic inventory thinking | Features that make sense for any business but not athletics ops | Ask: would Cheqroom have this by default? |
| Mobile as afterthought | Dashboard or list changes without AREA_MOBILE.md review | Scope rule: mobile review is mandatory |
| Scope expansion without a brief | Features shipped without BRIEF_*.md or Decision record | CLAUDE.md rule: no brief = no implementation |
| Premature Phase C | Kiosk/templates work starting before Phase A/B is solid | Roadmap sequencing enforced by this doc |
| Equipment guidance stagnation | Only 1 guidance rule in production | Quarterly rule audit; add rules with operator input |

---

## 11. Gaps in Current Planning (as of 2026-03-23)

Open items that must be resolved before implementing related features:

1. ~~Student mobile KPI definitions~~ — Resolved (PD-5): taps-to-checkout ≤3, scan success ≥95%, task completion <30s. Telemetry to measure them deferred to Phase B.
2. Venue mapping governance owner not assigned (PD-2)
3. Event sync refresh cadence and staleness thresholds not formalized (PD-3)
4. Phase C features (kiosk, templates, analytics) unscoped and unbriefed
5. ~~Kit management UI has full schema but zero UI (D-020)~~ — Shipped 2026-03-24

---

## 12. Recommended Next 2 Planning Docs

~~**Priority 1: D-009 Recipient Model Acceptance**~~ — Resolved 2026-03-15. D-009 accepted: requester + all admins at +24h, admin-configurable fatigue controls. See AREA_NOTIFICATIONS.md.

**Priority 1: `BRIEF_KIT_MANAGEMENT_V1.md`**
- D-020 accepted; full Prisma schema exists (Kit, KitItem models)
- Zero UI — needs brief before implementation
- Scope: kit CRUD, kit-to-booking integration, kit availability derived from member items

---

## Feature Improvement Suggestions (Not Yet Scheduled)

These are tracked here as candidates for future planning cycles:

1. **Drone equipment guidance** — 3 rules shipped (body-needs-batteries, lens-needs-body, audio-with-video). Remaining: drone battery and prop check rule.
2. **Partial check-in item checklist UX** — The service supports partial check-in; the UI could be more explicit with a per-item return confirmation list rather than relying on scan flow alone.
3. **Game-Day Readiness Score** — Deferred from scheduling integration (Slice 5). Aggregate metric showing shift coverage, gear availability, and checkout status for an upcoming event.
4. **Booking templates** — Save and reuse common booking configurations (sport + equipment combos) to accelerate repeat workflows.

---

## Change Log
- 2026-03-09: Initial north star document created. Synthesized from all AREA_*.md, DECISIONS.md, prompts/, and codebase review as of PR #32.
- 2026-03-11: Docs hardening — closed gaps #1 (AREA_NOTIFICATIONS exists) and #8 (DRAFT specced in D-017 + AREA_CHECKOUTS). Added Reservations V1 and Items V1 to Phase A shipped. Updated B&H enrichment status. Refreshed planning doc priorities.
- 2026-03-15: Docs sync — closed gap #5 (B&H withdrawn, N/A), closed gap #10 (calendar enable/disable shipped). Marked Picker V2 and Calendar Health UI as shipped in Phase B.
- 2026-03-23: Major refresh — Phase A marked complete (student mobile V1, equipment guidance 3 rules, shadcn migration, booking unification, security hardening, 5-pass page audits, scheduling integration all shipped). Phase B updated with shipped items and remaining work. Cleaned closed gaps from section 11. Scrapped B&H from planning priorities; replaced with Kit Management V1 brief. Updated feature suggestions to reflect shipped items (calendar source health, scan-to-add, 3 guidance rules). Added Game-Day Readiness Score and booking templates as candidates.
- 2026-03-25: Doc sync — marked PD-5 (student KPIs) resolved in §11. Phase B: D-009 escalation marked shipped (was "Not started"). §12 Priority 1 (D-009 acceptance) marked resolved; Kit Management promoted to Priority 1.
- 2026-03-27: **Alpha → Beta release.** Phase B marked complete. All shipped items updated (dashboard filters, kit integration, React Query, reports charts, search overhaul, favorites UI). Created Phase B+ section for post-Beta polish items (student availability, shift email, inline actions, state awareness). Version bumped to 0.2.0.
