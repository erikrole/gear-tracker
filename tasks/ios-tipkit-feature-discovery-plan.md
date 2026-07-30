# Native TipKit Feature Discovery Plan - 2026-07-29

## Goal
- Help eligible native iOS users discover reservation creation, reservation
  minimization, and Schedule Open Work without turning first launch into a tour.
- Extend the same restrained system to Shift Calendar, student Availability,
  reservation Gear scanning, and the minimized reservation resume card only
  after behavior makes each prompt relevant.

## Route
- Owner area: Mobile Operations
- Secondary areas: Reservations and Shift Calendar & Scheduling
- Ledger: `tasks/ios-tipkit-feature-discovery-plan.md`
- Existing plan/archive references:
  - `tasks/archive/completed-2026-07/ios-reservation-drafts-plan.md`
  - `tasks/ios-schedule-availability-trade-redesign-plan.md`

## Source Checks
- Native iOS is action-first, role-adaptive, and system-control-first.
- Reservation creation is capability-gated and owned by `BookingsView`.
- The reservation composer already exposes a visible minimize control and keeps
  draft state in `ReservationDraftStore`.
- Schedule exposes Open Work through its Trade Board toolbar action and gates
  that action with the existing schedule capabilities.
- Search already has a prominent scan empty state and the camera flow already
  owns permission education, so Scan does not need a redundant TipKit prompt.
- Schedule's overflow owns Shift Calendar, while Profile owns a dedicated
  student-only My Availability row; separate anchors avoid competing popovers.
- Reservation Gear already supports continuous scan from its toolbar, and the
  tab shell already owns the persistent minimized-reservation card.
- The iOS 26 deployment baseline supports TipKit without availability branches.
- The checked-in Xcode project and several touched Swift files contain unrelated
  user work. This slice must not regenerate the project or rewrite those edits.

## Stop Conditions
- Stop if TipKit requires changing capability, reservation, trade, or custody
  behavior.
- Stop if a tip cannot attach to the existing native control without replacing
  its system interaction.
- Stop if project membership changes become necessary.
- Stop if focused source contracts or either affected target build expose
  behavior outside this feature-discovery slice.

## Slices
- [x] Configure TipKit once for the main Wisconsin app and define three
  persistent, single-purpose tips using the existing Swift files.
- [x] Attach tips to New Reservation, Minimize Reservation, and Schedule Open
  Work, invalidating each when the user performs the advertised action.
- [x] Add focused source-contract coverage for configuration, eligibility,
  attachment, invalidation, and the deliberate Scan exclusion.
- [x] Sync Mobile, Reservations, and Shifts documentation plus gap/risk review.
- [x] Add repeated-Schedule eligibility for Shift Calendar and student
  Availability, attached to the overflow control and Profile row respectively.
- [x] Add Gear-step eligibility for reservation scanning and post-minimize
  eligibility for the persistent resume card.
- [x] Extend focused contracts, runtime proof, and area-document reconciliation
  for the second discovery slice.

## Verification
- [x] Focused TipKit source-contract tests.
- [x] Affected existing reservation and Schedule source-contract tests.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin simulator build.
- [x] Wisconsin generic-device build.
- [x] WisconsinKiosk simulator build to prove target isolation.
- [ ] `npm run codemap` if generated maps become stale. Deferred because the
  generated codemap files contained unrelated user changes before this slice.
- [ ] `npm run verify:docs` remains blocked by that preserved codemap drift.
- [x] `git diff --check`
- [x] Simulator runtime proof, or record why authenticated tip presentation is
  unavailable.

## Review
- Shipped: Seven one-display TipKit prompts for New Reservation, reservation
  minimization and resumption, reservation Gear scanning, Schedule Open Work,
  Shift Calendar, and student Availability. Action-dependent tips are ineligible
  until the relevant workflow is used; calendar and availability tips require
  three Schedule visits.
- Verified: 74 focused source-contract tests, TypeScript, iOS drift, audit-gap
  coverage, Wisconsin simulator build/install/launch, unsigned Wisconsin
  generic-device build, and WisconsinKiosk iPad simulator build.
- Deferred: Reservation popover screenshots. Runtime proof covers both immediate
  Schedule Open Work presentation and event-gated Shift Calendar presentation.
- Blocked: `npm run verify:docs` reports pre-existing drift in
  `docs/CODEMAPS/architecture.md` and `docs/CODEMAPS/backend.md`. Regeneration
  was not run because both files contained unrelated user work before this
  slice.
- Proof artifacts: Authenticated iPhone 17 simulator showed the Open Work and
  trades popover attached to the Schedule Trade Board control, then showed the
  Shift Calendar popover attached to the Schedule overflow control after
  repeated Schedule use.
- Next slice or stop: Stop. Do not add more tips until actual usage shows
  another non-obvious workflow needs discovery.
