# Docs Hardening & Workflow Optimization Plan

**Created**: 2026-03-11
**Goal**: Sync all docs to shipped reality, eliminate Cheqroom cargo-culting, and optimize workflows based on what we've actually built.

---

## Phase 1: Sync Docs to Reality

### 1.1 Archive completed plan files
- [ ] Create `tasks/archive/` directory
- [ ] Move `checkout-ux-v2-plan.md` → archive (shipped PRs 20-25)
- [ ] Move `item-detail-expansion-plan.md` → archive (shipped 2026-03-09)
- [ ] Move `reservations-v1-plan.md` → archive (shipped 2026-03-10)
- [ ] Move `usage-analysis.md` → archive (recommendations either adopted or stale)

### 1.2 PRODUCT_SCOPE.md refresh
- [ ] Change B&H enrichment brief status from "Pending creation" to "Ready"
- [ ] Update "Last Updated" date
- [ ] Add shipped status markers to Phase A briefs (Checkout UX V2, Items V1, Reservations V1)

### 1.3 AREA_RESERVATIONS.md refresh (9 days stale)
- [ ] Update to reflect shipped action-gating matrix from `booking-rules.ts`
- [ ] Confirm detail surface tabs match actual `BookingDetailsSheet` behavior
- [ ] Remove "Reserve again" vs "Repeat reservation" distinction — **simplify to one clone action** (see Phase 2)
- [ ] Mark shipped V1 slices in change log
- [ ] Remove "Cheqroom-Inspired" section heading — document OUR actions menu

### 1.4 AREA_CHECKOUTS.md refresh
- [ ] Verify action matrix matches actual `booking-rules.ts` (code has unified rules now)
- [ ] Update equipment guidance rules section — confirm which rules ship vs planned
- [ ] Note that `BookingDetailsSheet` is now unified (shared between checkouts and reservations)

### 1.5 NORTH_STAR.md gap reconciliation
- [ ] Close gap #1 (AREA_NOTIFICATIONS.md) — it exists now
- [ ] Close gap #8 (DRAFT booking state) — D-017 formalizes it
- [ ] Update B&H enrichment status from "Not started" to "Brief ready"
- [ ] Review remaining 8 gaps for accuracy

### 1.6 DECISIONS.md cleanup
- [ ] D-009: Remove duplicated escalation criteria (point to AREA_NOTIFICATIONS.md as source of truth)
- [ ] D-010: Add PR references for shipped slices
- [ ] D-017: Move from "Proposed" to "Accepted" — it's implemented

### 1.7 Mark shipped briefs
- [ ] BRIEF_CHECKOUT_UX_V2.md — add "Status: Shipped" header
- [ ] BRIEF_ITEMS_V1.md — add "Status: Shipped" header
- [ ] BRIEF_RESERVATIONS_V1.md — add "Status: Shipped" header

---

## Phase 2: Workflow Optimizations (Not Just Cheqroom Copies)

### 2.1 Simplify reservation clone action
**Current**: Two confusing actions — "Reserve again" and "Repeat reservation"
**Problem**: Distinction unclear, adds cognitive load with no clear user value
**Proposed**: Single "Duplicate" action that clones the reservation with new dates. Same as how item "Duplicate" works. Consistent language across the app.
**Update**: AREA_RESERVATIONS.md, remove Cheqroom action mapping table entirely

### 2.2 Eliminate AREA_PLATFORM_INTEGRITY.md duplication
**Current**: Thin doc that restates principles already in DECISIONS.md (D-001, D-006, D-007)
**Problem**: Maintenance burden, drift risk, no unique content
**Proposed**: Fold key invariants into a "Platform Invariants" section in DECISIONS.md. Delete AREA_PLATFORM_INTEGRITY.md. Update PRODUCT_SCOPE.md index.

### 2.3 Resolve "optional if low effort" ambiguity
**Current**: AREA_DASHBOARD.md and AREA_ITEMS.md have hedged features ("included only if low effort", "optional in V1")
**Problem**: Ambiguity creates scope creep and indecision
**Proposed**: For each hedged item, decide YES or NO:
- Dashboard saved filters → **NO for V1** (remove ambiguity)
- Dashboard keyboard shortcuts → Already decided NO
- Notifications mark-as-read → **Already shipped** (remove "optional" qualifier)

### 2.4 Decide on unused schema fields
**Current**: Schema has fields with no UI exposure:
- `purchasePrice`, `warrantyDate`, `residualValue` on Asset
- `uwAssetTag` on Asset (UW-specific, university asset tag)
- `departmentId` on Asset (FK exists, no filter/display in UI)
- Kit/KitMembership models (full schema, zero UI)
**Problem**: Schema promises features the UI doesn't deliver. Creates confusion about what's shipped.
**Proposed decisions to add to DECISIONS.md:
- D-018: Asset financial fields (purchasePrice, warrantyDate, residualValue) → **Phase B** — expose in item detail Settings tab when admin
- D-019: Department model → **Phase B** — optional organizational grouping, not blocking
- D-020: Kit management → **Phase B** — kit creation UI, kit-based checkout. Schema is ready.
- D-021: UW asset tag → Keep as optional import field, expose in item detail for admins

### 2.5 Unify booking action rules documentation
**Current**: Action matrices described separately in AREA_CHECKOUTS.md and AREA_RESERVATIONS.md, but code uses unified `booking-rules.ts`
**Problem**: Two docs describing one system = drift
**Proposed**: Create a single "Action Gating" section in each AREA file that points to `booking-rules.ts` as source of truth. Remove inline matrix tables (they'll go stale). Instead, document the PRINCIPLES: "staff+ can edit active bookings, only admins can cancel OPEN checkouts, terminal states are frozen."

### 2.6 Notification channel decision
**Current**: Schema supports IN_APP + EMAIL. Only IN_APP is wired. AREA_NOTIFICATIONS.md lists email as out-of-scope V1.
**Problem**: D-009 acceptance criteria reference email retry behavior — contradicts "out of scope V1"
**Proposed**: Add to D-009 clarification: email is Phase B. V1 acceptance = in-app escalation only. Remove email retry criteria from V1 acceptance.

### 2.7 Importer: Don't cargo-cult Cheqroom column mapping
**Current**: AREA_IMPORTER.md has a massive Cheqroom-specific column mapping table
**Problem**: We're building OUR system. The importer should be a generic CSV mapper that HAPPENS to have a Cheqroom preset, not a Cheqroom-specific tool.
**Proposed**: Restructure AREA_IMPORTER.md:
- Generic CSV import with column mapping UI
- Cheqroom preset = pre-filled column mapping (one of potentially many presets)
- This makes the feature useful beyond Cheqroom migration

---

## Phase 3: Governance Improvements

### 3.1 Doc sync policy (add to CLAUDE.md)
New rule: **When shipping a feature, the PR must update the relevant AREA file's change log and mark acceptance criteria as met.** No feature is "done" until its area doc reflects reality.

### 3.2 Consolidated gap registry
- [ ] Create `docs/GAPS_AND_RISKS.md` — single file listing all pending decisions, unresolved gaps, and known risks
- [ ] Pull from: NORTH_STAR gaps (11 items), DECISIONS.md pending (4 items), and scattered area file TODOs
- [ ] Each entry: ID, description, owner (which area), priority, blocker status

### 3.3 Plan file lifecycle
Add to CLAUDE.md: Plan files in `tasks/` follow this lifecycle:
1. `tasks/[feature]-plan.md` — created during planning
2. Active during implementation (slices checked off)
3. Moved to `tasks/archive/` when all slices ship
4. Never deleted — archive preserves decision context

### 3.4 Refresh todo.md
- [ ] Remove completed work archive (it's in git history)
- [ ] Keep only: active work, pending decisions, and next-up queue
- [ ] Add cross-references to GAPS_AND_RISKS.md for pending decisions

---

## Execution Order

1. **Phase 1** first (sync to reality) — ~30 min
2. **Phase 2** decisions need your input on each optimization
3. **Phase 3** governance rules after we've established the pattern

---

## Verification

After all updates:
- [ ] `npm run build` passes
- [ ] Every AREA file's "Last Updated" reflects today
- [ ] PRODUCT_SCOPE.md index matches actual files in docs/
- [ ] No doc references features as "planned" that are actually shipped
- [ ] No doc references Cheqroom patterns without justification
- [ ] GAPS_AND_RISKS.md accounts for every pending item across all docs
