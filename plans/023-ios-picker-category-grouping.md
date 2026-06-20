# Plan 023 - iOS picker category grouping

Date: 2026-06-19
Status: Done on main

## Goal

Make native reservation creation easier to scan by grouping available serialized equipment by category after the user chooses a pickup location. Keep the slice client-side and bounded, using the design decision from Plan 022.

## Source Checks

- `docs/DESIGN_ios-picker-grouping.md` accepted a bounded full fetch for one location.
- `/api/assets` already returns category labels and supports `status`, `sort=name`, and pagination.
- Plan 020 already aligned `/api/assets?sort=name` with the row display name.

## Scope

- Extend the native API client with `location_id` support for asset listing.
- Fetch up to 300 available serialized assets for the selected location when the Equipment step loads.
- Group the native picker rows by category, with Uncategorized last.
- Preserve existing search, selected equipment, and scan-to-add behavior.
- Show search recovery copy when more matching equipment exists past the bounded fetch cap.

## Out of Scope

- Server-side grouped response shapes.
- Category-level counts.
- Bulk SKU grouping changes.
- Web reservation UI changes.

## Implementation Checklist

- [x] Add `locationId` query support to `APIClient.assets`.
- [x] Change `CreateBookingSheet` to request the selected location with a bounded 300-row fetch.
- [x] Add category grouping view-model state and render grouped SwiftUI sections.
- [x] Add overflow/search recovery copy for capped result sets.
- [x] Add source-contract tests for the query contract and grouped picker UI.
- [x] Sync docs and task ledger.
- [x] Run focused and repo-level verification.

## Verification Plan

- `npx vitest run tests/ios-create-booking-picker-parity.test.ts`
- `npx tsc --noEmit`
- `npm run drift:ios`
- `npm run test`
- `npm run lint`
- `npm run verify:docs`
- `git diff --check`

## Review

- 2026-06-19: Native reservation creation now requests available serialized assets for the selected pickup location with `location_id`, `sort=name`, `limit=300`, and `offset=0`, then groups the Equipment picker by category with Uncategorized last. The old row-appearance pagination path is removed for this picker, and capped result sets show search recovery copy.
- Verification: `npx vitest run tests/ios-create-booking-picker-parity.test.ts`; `npx tsc --noEmit`; `npm run drift:ios`; `npm run test`; `npm run lint`; `npm run verify:docs`; `git diff --check`; XcodeBuildMCP `build_sim` for `Wisconsin` on iPhone 17 iOS 26.5.
