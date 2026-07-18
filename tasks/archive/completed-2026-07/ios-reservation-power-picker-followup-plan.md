# Native Reservation Power and Picker Follow-up - 2026-07-18

## Goal

- Make event context, popularity ordering, power recommendations, battery quantities, Review routing, and the shipped icon behave as one predictable native reservation flow.

## Route

- Owner area: Mobile Operations
- Secondary areas: Reservations and Items
- Ledger: this plan, then `tasks/archive/completed-2026-07/` after verification
- Existing references:
  - `tasks/archive/completed-2026-07/ios-reservation-flow-consistency-polish-plan.md`
  - `tasks/archive/completed-2026-07/ios-reservation-setup-interaction-polish-plan.md`
  - `docs/DECISIONS.md` D-016 and D-022

## Source Checks

- The event picker currently omits event time and formats the abbreviated month without the requested punctuation.
- `/api/assets?sort=popular` already returns mixed serialized and item-family order through `itemOrder`; the native reservation view model currently discards that mixed order for category browsing.
- Power recommendations currently expose only the first non-dismissed suggestion and use fixed Sony, Gold Mount, Monitor ordering instead of asset-selection order.
- Review currently redirects whenever any recommendation remains missing, even after the user has already added suggested power.
- Canonical numbered item families already expose `availableQuantity` and `currentQuantity`, but `/api/form-options` was filling the denominator from a stale balance instead of the effective numbered-unit roster.
- The updated Icon Composer candidate differs from the active icon only by the intended Block W scale change from `1.72` to `1.75`.

## Stop Conditions

- Stop if mixed popularity cannot be recovered from the existing `AssetsResponse.itemOrder` without changing booking or availability truth.
- Stop if recommendation order would require persisted server state rather than the current creation-session selection order.
- Stop if the icon candidate contains asset or composition changes beyond the user-authored scale adjustment.
- Stop if a new Swift source file or Xcode project regeneration becomes necessary in the current dirty project.

## Slices

- [x] Format event picker metadata as `Wednesday, Aug. 5 at 1:00 PM • Venue`, with a raw-calendar venue fallback for unmapped events.
- [x] Define Other as every reservable item outside Cameras, Lenses, and Batteries, preserving mixed server popularity order.
- [x] Render every active power recommendation as one compact grouped stack ordered by the triggering gear's selection time.
- [x] Keep each power recommendation persistent after quantity changes, with independent swipe or close dismissal, and remove `Add` from the visible title.
- [x] Make battery decrement and increment controls visually match and show `available/current available` copy such as `42/46 available`.
- [x] Let Review advance after the user has added suggested power instead of repeatedly redirecting to Batteries; keep the zero-power reminder recovery.
- [x] Promote the updated Icon Composer candidate into the active app icon package.
- [x] Add focused source contracts and sync Mobile, Reservations, and Items documentation.

## Verification

- [x] Focused reservation and item-family source-contract tests.
- [x] Complete native iOS source-contract suite.
- [x] `npm run drift:ios`.
- [x] `npm run audit:ios:gaps`.
- [x] Generic iOS Simulator build, launch, and runtime interaction proof.
- [x] Signed physical-device build and install on Erik's iPhone.
- [x] `npm run codemap` and `npm run verify:docs`.
- [x] `git diff --check`.

## Review

- Shipped: exact event metadata with venue fallback; mixed popularity categories; grouped, persistent power recommendations; symmetric battery steppers; effective availability fractions; corrected Review routing; complete Review gear; updated icon.
- Verified: focused contracts, all 58 native contract files, Swift drift and audit gates, TypeScript, lint, production app build, simulator build and live reservation interaction.
- Deferred: none.
- Blocked: automatic launch on Erik's iPhone was denied because the device was locked; the signed build is installed and ready to open.
- Proof artifacts: simulator accessibility snapshots verified exact McClimon copy, the Sony and Monitor recommendation stack, battery increments, and successful Review progression.
- Next slice or stop: stop after documentation and final diff gates.
