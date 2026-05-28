# iOS First-Class Upgrade Plan — 2026-05-28

## Context

The 2026-05-13 consolidated audit (`tasks/audit-all-pages-ios.md`) found the iOS
app **MVP-READY**: zero P0/P1 blockers, drift-check clean, all 34 surfaces covered.
Re-confirmed today: `scripts/ios-drift-check.sh` passes (no anti-patterns), and only
two iOS-adjacent commits shipped since (kiosk health cockpit on web Settings, item
families) — neither closes a documented iOS gap.

So this pass is **not** bug-fixing to an MVP bar. It is elevating from "MVP ready"
to "first-class": closing the documented P2 parity gaps and running cross-cutting
polish sweeps. The goal-skill "one MVP commit" shape does not apply — this is
multi-slice work, one shippable slice at a time.

## Two workstreams

### Stream A — P2 parity slices (documented backlog)

Each maps to one independently shippable slice. Still open in `docs/GAPS_AND_RISKS.md`:

| Slice | Gap | Scope | Effort |
|---|---|---|---|
| A1 | GAP-35 | Booking detail per-item conflict badges. Needs `/api/availability/check` client + per-row badge in `ItemsSection`. Server enforcement already authoritative — this is preflight signal. | M |
| A2 | GAP-36 | Item detail lifecycle actions (Duplicate / Retire / Delete / Needs Maintenance), STAFF/ADMIN-gated. Web-owned today by design — only pursue if staff-mobile is now in scope. | M |
| A3 | GAP-34 | Bookings list status-scope filters + sorting (DRAFT/BOOKED/OPEN/OVERDUE/CANCELLED/COMPLETED). Desk-style power filtering — least student-core. | M |
| A4 | Kiosk | Roster search/filter, manual tag entry, wrong-person undo. `AREA_KIOSK.md` treats these as acceptable V1 tradeoffs — confirm direction before building. | M |

### Stream B — Cross-cutting polish sweeps (one checklist each, burn down)

Systematic codebase-wide queries, NOT per-screen audits.

- **B1 States sweep** — every `.task {` / `await` / `AsyncImage` has skeleton/empty/error branches; no silent `try?`. (drift-check already covers `try?`; this covers UX states.)
- **B2 A11y sweep** — every `Button`, icon-only control, `Image(systemName:)`, and gesture has an `.accessibilityLabel`; Dynamic Type doesn't clip; contrast passes.
- **B3 Polish sweep** — changing-number `Text(` uses `.monospacedDigit()`; icon-only tap targets ≥ 44pt; animations reduce-motion guarded; transitions/optical alignment per `make-interfaces-feel-better`.
- **B4 Color sweep** — run `color-audit` once across iOS for dark-mode parity + status taxonomy.

## Execution rules

- One coherent slice per change set (Rule 10). Stop after one slice per turn unless told to continue.
- Build stays green: `xcodegen generate` (then restore `Wisconsin.entitlements`) + Xcode build.
- Doc sync (Rule 12): update `AREA_MOBILE.md` / relevant `AREA_*` + flip the gap in `GAPS_AND_RISKS.md` when a slice ships.
- Commit shape: `feat: <slice outcome>` per slice, not a goal-level mega-commit.

## Slice 1 recommendation

**B-sweeps first, then A1.** The polish sweeps (B1–B4) are pure quality, no product-direction
question, and produce a concrete punch list that makes "first-class" measurable. The
A2/A3/A4 slices each carry an open product question (is staff-mobile parity now in scope?),
so they need a direction call. A1 (conflict badges) is the cleanest parity slice with no
direction ambiguity.

## Stream C — Schedule cross-role polish (staff + students)

iOS Schedule has the capabilities for both roles but feels event-centric and thin
on triage. Slices (independently shippable):

- **S1 — Visible row-action affordance (shipped 2026-05-28).** Assign/Request/Approve/Decline
  in `EventDetailSheet` were already visible buttons (initial "buried in context menu" read was
  wrong on full inspection) but under-styled; restyled as proper tinted/sized buttons.
- **S2 — Staff coverage/triage at the Schedule list level.** Show crew fill + open-slot/pending
  signal without drilling into each event. **Needs a calendar-payload change** (`ScheduleEvent`
  carries no coverage today — coverage lives only on the per-event `ShiftGroup`). Not thin.
- **S3 — Smarter assign (shipped 2026-05-28, re-scoped).** Original framing was "scope to roster +
  surface conflicts." On inspection, web's assign cell does NOT roster-scope (it uses all users
  filtered by name/area) — so roster-only filtering was dropped to avoid diverging from web. The
  real gap was the **availability-conflict warning**, which `AssignStudentSheet` now shows (orange
  "Conflict" pill + note, "Checking availability…" indicator, non-blocking) via the new
  `APIClient.shiftConflicts(shiftId:)` → `/api/shifts/[id]/conflicts`.
- **S4 — Student findability.** Mine/All segmentation (default students to Mine), sport filter,
  unify open-slot request with the trade board.
- **S5 — Availability editor on iOS.** Students manage class-conflict blocks (web-only today).

## Status log

- 2026-05-28: Plan created. Baseline re-confirmed (drift clean, gaps open).
- 2026-05-28: **Slice 1 (B-sweeps) shipped.** Ran B1 states / B2 a11y / B3 polish / B4 color sweeps across all surfaces.
  Verdict: codebase is mature — no broad gaps. B4 color clean (literals centralized in `Brand.swift`, light/dark variants; `.white` usages are legit camera-overlay/badge-on-color). B2 a11y mature (253 annotations). B3 monospacedDigit broad (16 files); only continuous-loop animation was the skeleton shimmer.
  **Fix:** base `Skeleton` now respects Reduce Motion (static placeholder, no `repeatForever` pulse) + `.accessibilityHidden(true)` at primitive level. One change covers every loading state app-wide. Build green, drift clean.
  **Remaining sweep nits (deferred, low value):** transient kiosk feedback `withAnimation` flashes are unguarded but non-looping (acceptable). No other cross-cutting issues found.
  Next: Stream A parity slices (A1 conflict badges recommended) once direction confirmed.
- 2026-05-28: **Slice A1 (GAP-35 conflict badges) shipped.** Booking detail `ItemsSection` now renders per-item conflict badges (red "Conflict" pill + "Conflicts with {title}" caption + combined VoiceOver label) via `APIClient.checkAvailability` on active bookings with `excludeBookingId`. While wiring this, found and fixed `checkAvailability` had been silently broken since inception (wrong key `assetIds`, missing required `locationId` → server 400 swallowed by `try?`), so the CreateBookingSheet preflight had never worked; threaded `selectedLocationId` through and added 401 `.sessionDidExpire` broadcast (R3). GAP-35 closed; web AC-8 parity. Build green, drift clean.
  **Deferred follow-ups (non-blocking, noted by advisor):**
  - `loadConflicts` has no task cancellation on rapid pull-to-refresh (web uses AbortController). Add only if flicker observed.
  - CreateBookingSheet has no `.onChange(of: selectedLocationId)` re-trigger for `scheduleConflictCheck` on step 2 (pre-existing; the fn never worked before so no regression).
  - Consider surfacing `upcomingCommitments` / `turnaroundRisks` on iOS too (web shows them) — separate slice if staff want full Equipment-tab parity.
- 2026-05-28: **Stream C started; slice S1 (shift-row affordance) shipped.** Correction logged: the
  primary Schedule actions were already visible, not context-menu-only — restyled Assign/Request to
  tinted `.bordered` buttons and Approve/Decline from `.mini` to `.small` (Approve prominent green,
  Decline outlined red, wider spacing). Both roles. Build green, drift clean. Next lever: S3 (smarter
  assign — roster scoping + availability conflicts) is the biggest true gap; S2 needs a backend
  payload change first.
- 2026-05-28: **Slice S3 (smarter assign) shipped — re-scoped after verification.** Intended to add
  roster scoping + conflict warnings; found web's assign picker is NOT roster-scoped, so kept the
  all-users + name search (web parity) and added the genuine gap: student availability-conflict
  warnings in `AssignStudentSheet` (orange Conflict pill + note, non-blocking, "Checking
  availability…" indicator) via `APIClient.shiftConflicts`. Build green, drift clean.
  Remaining Stream C: S2 (list coverage, needs backend payload change), S4 (student findability),
  S5 (availability editor on iOS).
