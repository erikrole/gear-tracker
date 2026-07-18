# Native Reservation Setup Interaction Polish

## Goal

- Make schedule source the first reservation decision, keep event selection explicit, and make gear quantities and power guidance impossible to miss.

## Route

- Owner area: Mobile Operations
- Secondary area: Reservations
- Ledger: this plan, then `tasks/archive/completed-2026-07/` after verification
- Existing reference: `tasks/archive/completed-2026-07/ios-reservation-setup-final-polish-plan.md`

## Source Checks

- `ScheduleEvent.sportCode` distinguishes athletics events from non-games; `isHome` distinguishes Home, Away, and Neutral for sport events.
- `/api/assets?sort=popular` ranks serialized and counted gear from recent booking and scan activity.
- The native picker currently replaces that server ranking with category and display-name sorting.
- Multi-event selection remains capped at three and reservation availability remains server-authoritative.

## Stop Conditions

- Stop if event classification requires a new API field or if restoring popularity order changes the reservation payload.
- Stop if the battery checkpoint cannot preserve the selected gear and current reservation draft.

## Slices

- [x] Put Event or Manual first, reveal the title only when its source is known, and add All, Home, Away, Neutral, and Non-game event filters.
- [x] Preserve server popularity order, fit all five gear categories, and expose explicit quantity controls on counted-item rows.
- [x] Move power guidance to a dismissible bottom card and intercept Review until the user resolves or deliberately dismisses the current recommendation.
- [x] Update focused source contracts and shipped-area documentation.

## Verification

- [x] Focused native reservation source-contract tests.
- [x] Full native source-contract suite.
- [x] iOS source drift and audit-gap checks.
- [x] Generic iOS Simulator Xcode build.
- [x] `npm run codemap` and `npm run verify:docs` when required.
- [x] `git diff --check`.

## Review

- Shipped: schedule-source-first Details, event scope filters, server-ranked popular gear, compact categories, explicit counted-item steppers, and a dismissible bottom power checkpoint that intercepts Review.
- Verified: 23 focused native contracts; 251 full native source contracts; iOS drift and gap audits; generic Simulator Xcode build; documentation and diff gates.
- Deferred: a post-build simulator screenshot pass remains available for subjective visual tuning.
- Blocked: `npm run ios:project:check` still reports the pre-existing dirty `project.pbxproj` XcodeGen drift; it was not regenerated because that could overwrite unrelated user work.
- Proof artifacts: source-contract output and `** BUILD SUCCEEDED **` from the iOS Simulator build.
- Next slice or stop: stop; this interaction slice is independently complete.
