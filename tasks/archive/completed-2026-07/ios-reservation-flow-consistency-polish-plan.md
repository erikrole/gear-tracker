# Native Reservation Flow Consistency Polish - 2026-07-18

## Goal

- Make event selection, gear quantities, battery guidance, selected gear, and final review read as one calm reservation workflow with consistent semantics.

## Route

- Owner area: Mobile Operations
- Secondary area: Reservations
- Ledger: this plan, then `tasks/archive/completed-2026-07/` after verification
- Existing references:
  - `tasks/archive/completed-2026-07/ios-reservation-setup-interaction-polish-plan.md`
  - `tasks/archive/completed-2026-07/ios-reservation-gear-review-polish-plan.md`
  - `tasks/archive/completed-2026-07/ios-reservation-schedule-editor-fix-plan.md`

## Source Checks

- Schedule event rows use a left rail with green for home, orange for away, and gray for neutral or non-game events.
- The reservation picker already receives server popularity order for browse results, but category-filtered serialized rows re-sort alphabetically.
- The battery reminder currently disappears after the minimum recommendation is satisfied and spends two rows on explanatory copy.
- Selected Gear currently separates serialized equipment and counted supplies into different sections.
- Review currently truncates the gear list after three product rows.
- Reservation progression already uses the semantic purple status token, while several picker selection and Review actions still inherit blue or the app-wide red accent.

## Stop Conditions

- Stop if the event payload cannot distinguish home, away, neutral, and non-game without inventing new server data.
- Stop if category popularity would require fabricated ranking for counted items that the API does not provide.
- Stop if keeping battery guidance visible would also keep Review blocked after the minimum battery recommendation is satisfied.
- Stop if the final SwiftUI changes require a new source file or Xcode project regeneration in the current dirty project.

## Slices

- [x] Match event-picker rails to Schedule and use scope plus venue-oriented event metadata.
- [x] Make reservation selection, quantity, confirmation, and progression controls consistently purple while preserving red for destructive or urgent states.
- [x] Preserve server popularity order inside category-filtered serialized gear and keep counted-item ordering truthful to its existing API order.
- [x] Replace the battery reminder with a compact persistent quantity control that remains useful after one battery is added.
- [x] Merge serialized and counted selections into one Selected Gear list with smaller quantity controls.
- [x] Render every selected product on Review and remove the hidden remainder summary.
- [x] Update focused source contracts and mobile/reservations documentation.

## Verification

- [x] Focused reservation source-contract tests.
- [x] Complete native iOS source-contract suite.
- [x] `npm run drift:ios`.
- [x] `npm run audit:ios:gaps`.
- [x] Generic iOS Simulator Xcode build and runtime launch.
- [x] Physical-device build, install, and launch on Erik's iPhone when connected.
- [x] `npm run codemap` and `npm run verify:docs`.
- [x] `git diff --check`.

## Review

- Shipped: Schedule-matched event rails and metadata, semantic purple reservation actions, API-order category results, a compact persistent battery quantity card, a unified Selected Gear list, and a complete Review gear list.
- Verified: 31 focused tests, 257 native source-contract tests, iOS drift and gap audits, generic Simulator and signed physical-device builds, simulator launch and interaction, physical iPhone install and launch, codemap generation, docs verification, and diff whitespace checks.
- Deferred: No new reservation-flow behavior is deferred from this slice.
- Blocked: `npm run ios:project:check` remains blocked by pre-existing `project.pbxproj` drift already present in the shared dirty worktree. This slice added no source file and did not regenerate the project.
- Proof artifacts: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_23491df6-d707-41d8-bb08-aef39e9820a6.jpg`; simulator `D0A5A085-F6B9-483E-A0FA-EE3751BB7C49`; physical device `E171C35B-F8A7-5B3F-A38E-3A0C31911A8E`.
- Next slice or stop: Stop. Exercise one Event Linked reservation and one Manual reservation on the physical phone before choosing another redesign slice.
