# iOS Booking Detail Item Alignment Plan - 2026-07-17

## Goal

- Bring Booking Detail into the accepted Item Detail custody hierarchy: holder-led identity, live timing beside the title, explicit operational rows, a clean gear list, and a persistent primary action.

## Route

- Owner area: Mobile Operations
- Secondary area: Bookings API read model
- Ledger: `tasks/ios-booking-detail-item-alignment-plan.md`
- Existing reference: `tasks/archive/completed-2026-07/ios-booking-detail-sheet-redesign-plan.md`

## Source Checks

- Item Detail places the status rail, holder avatar, booking title, live due timing, and holder name in one compact custody card.
- Booking Detail currently repeats live timing in a separate operational card and keeps Extend in scroll content.
- The booking read model omits the serialized asset `name` field, so native Booking Detail cannot show the product name before brand/model fallback.
- Serialized allocation status distinguishes returned rows; physical custody changes remain kiosk-owned.

## Stop Conditions

- Stop if the booking response cannot add optional asset `name` without changing lifecycle or authorization behavior.
- Stop if a bottom inset would expose Extend for a role, status, or upcoming-need state that the existing action matrix blocks.

## Slices

- [x] Align the header with Item Detail and remove the checked-out badge and internal reference.
- [x] Anchor eligible Extend above the native tab bar while keeping Cancel in contextual scroll content.
- [x] Split Details into Requester, Pickup Time, Return Time, Location, Pickup Kiosk, and optional Notes rows.
- [x] Simplify gear rows, use product name as the secondary identity, and visually quiet early-returned gear.
- [x] Add tolerant API/model support and focused source-contract coverage.
- [x] Sync Mobile documentation and the Booking Detail audit.

## Density and finish follow-up

- [x] Move requester identity into the hero beneath the booking title and remove the duplicate Details row.
- [x] Remove the year from Booking Detail pickup and return presentation without changing shared date formats elsewhere.
- [x] Remove Pickup Location and refine the remaining operational rows with stronger icon, spacing, and divider rhythm.
- [x] Update focused source contracts, runtime proof, and Mobile documentation.

## Schedule normalization follow-up

- [x] Return Schedule rows to standard subheadline sizing, smaller icon anchors, and tighter vertical rhythm.
- [x] Use Today, Tomorrow, Yesterday, and near-term weekday labels before falling back to abbreviated month/day dates.
- [x] Re-run native contracts, simulator build, runtime proof, and documentation closeout.

## Verification

- [x] Focused booking API and native hierarchy tests.
- [x] Full native iOS source-contract suite.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] iOS drift, audit-gap, and Xcode build gates.
- [ ] `npm run ios:project:check` remains blocked by pre-existing Xcode 26 project serialization drift in the dirty worktree; the affected target still builds successfully.
- [x] Runtime screenshot proof if an already-booted simulator is available; otherwise record the blocker.

## Review

- Shipped: Item Detail-aligned holder header, live timing, bottom Extend, explicit operational rows, clean Gear list, and product-name read model.
- Verified: focused contracts, all native source contracts, TypeScript, generic iOS Simulator build, and authenticated iPhone 17 Pro runtime inspection.
- Deferred: reconcile the pre-existing checked-in Xcode project serialization with XcodeGen in its owning slice.
- Blocked: no Booking Detail behavior; only the unrelated project-generation parity gate remains red.
- Proof artifacts: authenticated iPhone 17 Pro simulator runtime at 368 x 800 in dark mode.
- Next slice or stop: stop after repository closeout gates pass.
- Follow-up: final density correction verified in the authenticated iPhone 17 Pro runtime; Schedule uses standard row sizing, pickup reads `Today at 12:04 PM`, return reads `Monday at 8:30 AM`, and the header remains the sole countdown owner.
