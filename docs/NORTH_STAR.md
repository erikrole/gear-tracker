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

### Phase A — Now (Partially Complete)
| Item | Status |
|---|---|
| Checkout UX V2 (action gating, event defaults, sectioned picker, partial check-in) | ✅ Complete |
| Calendar sync hardening (crash isolation, batch DB ops, Date.UTC, diagnostics) | ✅ Complete |
| Events page improvements (upcoming default, source deletion) | ✅ Complete |
| Reservations V1 (lifecycle, detail sheet, list page, action gating) | ✅ Complete |
| Items V1 (list, create, detail, inline edit, item-kind form) | ✅ Complete |
| ~~B&H metadata enrichment~~ | ❌ Withdrawn (scraping blocked) |
| Student mobile hardening (brief + implementation) | ⬜ Not started |
| Equipment guidance rules expansion (lens+body, audio, drone) | ⬜ Not started |

### Phase B — Next
1. Dashboard expansion: draft recovery UX, lane tuning, overdue banner polish
2. Notifications escalation: D-009 acceptance — recipient model, alert fatigue controls, formal spec
3. Picker improvements: multi-select, availability preview, scan-to-add during checkout
4. Calendar source health UI: enable/disable per source, sync status and last-error display

### Phase C — Later
1. Kiosk mode (self-serve scan station)
2. Reservation and checkout templates
3. Board / ops view for game-day coordinators
4. Advanced analytics (only after workflows stabilize)
5. Multi-source event ingestion beyond UW Badgers ICS

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

## 11. Gaps in Current Planning (as of 2026-03-11)

These are open items that must be resolved before implementing related features:

1. ~~`AREA_NOTIFICATIONS.md` missing~~ — **Closed**: file exists, escalation schedule documented
2. Student mobile KPI definitions not yet defined (pending in DECISIONS.md)
3. Venue mapping governance owner not assigned
4. Event sync refresh cadence and staleness thresholds not formalized
5. B&H metadata cache TTL target not defined
6. Phase C features (kiosk, templates, analytics) unscoped and unbriefed
7. Draft persistence model underspecified — referenced in AREA_DASHBOARD.md but no owning spec
8. ~~DRAFT booking state not formally specced~~ — **Closed**: D-017 accepted, documented in AREA_CHECKOUTS.md
9. Equipment guidance rules hardcoded with only 1 rule; no admin-configuration path defined (D-016 defers to Phase C)
10. Calendar source enable/disable not specced — only delete is implemented

---

## 12. Recommended Next 3 Planning Docs

**Priority 1: D-009 Recipient Model Acceptance**
- `AREA_NOTIFICATIONS.md` exists; D-009 escalation schedule is shipped
- Still pending: recipient model for +24h escalation, alert fatigue controls
- Blocks: notification center polish, overdue escalation wiring, dashboard badge counts
- Action: finalize D-009 acceptance criteria before Phase B begins

**Priority 2: `BRIEF_STUDENT_MOBILE_V1.md`**
- D-015 accepted but no implementation brief exists
- KPI definitions (taps-to-action, task-completion time, scan success rate) are pending
- Needed to hold the mobile-first line during upcoming dashboard expansion

**Priority 3: `BRIEF_BH_ENRICHMENT_V1.md`**
- Priority #2 per D-010; not started
- Must be scoped (server-side fetch boundary, parser fallback behavior, image source policy) before implementation begins

---

## Feature Improvement Suggestions (Not Yet Scheduled)

These are tracked here as candidates for future planning cycles:

1. **More equipment guidance rules** — Current system has 1 rule. High-value additions: `lens-needs-body` (warn if lens added without body), `audio-with-video` (remind about audio when selecting video camera), drone battery and prop check.
2. **Calendar source enable/disable** — Can delete sources but not pause them. An `enabled` toggle on CalendarSource would let admins suspend a feed without losing configuration.
3. **Sync health dashboard** — Production sync diagnostics are in code but have no admin UI. A "Last synced / X events / last error" display on the Events page would reduce support burden.
4. **Scan-to-add in checkout picker** — Scanning a QR code during equipment picker should instantly add the item to the cart, accelerating physical handoff for staff.
5. **Partial check-in item checklist UX** — The service supports partial check-in; the UI could be more explicit with a per-item return confirmation list rather than relying on scan flow alone.

---

## Change Log
- 2026-03-09: Initial north star document created. Synthesized from all AREA_*.md, DECISIONS.md, prompts/, and codebase review as of PR #32.
- 2026-03-11: Docs hardening — closed gaps #1 (AREA_NOTIFICATIONS exists) and #8 (DRAFT specced in D-017 + AREA_CHECKOUTS). Added Reservations V1 and Items V1 to Phase A shipped. Updated B&H enrichment status. Refreshed planning doc priorities.
