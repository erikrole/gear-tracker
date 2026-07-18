# iOS Reservation Gear and Review Polish

## Scope

Polish steps 2 and 3 of native New Reservation without changing reservation, availability, scan, or submission contracts.

## Implementation

- [x] Keep selected gear and known conflicts visible in the equipment picker without requiring the cart sheet.
- [x] Reduce picker density while preserving search, category browsing, scanning, bulk quantities, and selection recovery.
- [x] Replace the review hero with concise editable Schedule and Gear summaries.
- [x] Give known conflicts an explicit route back to Gear while retaining server-side availability as final authority.
- [x] Move Create Reservation to a quiet bottom action consistent with the Details step.

## Verification

- [x] Update focused native source-contract coverage.
- [x] Run focused tests, the complete iOS source-contract suite, drift and gap audits, and an iOS simulator build.
- [x] Inspect the final diff and sync the mobile and reservations area docs.

## Evidence

- Focused reservation contracts: 18 tests passed.
- Full native source contracts: 233 tests passed across 56 files.
- `npm run drift:ios`: no anti-patterns across 79 Swift files.
- `npm run audit:ios:gaps`: 51 of 51 audit-worthy surfaces covered.
- `npm run verify:docs`: codemaps current.
- Wisconsin generic iOS Simulator build: `BUILD SUCCEEDED`.
