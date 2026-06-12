# iOS Scan Bulk Unit QR Plan

Date: 2026-06-11

## Problem

Sony Battery unit QR labels such as `94e068d1-7` resolve on the server through `/api/assets?qr=...` as `bulkItems`, but native iOS scan search only reads the serialized `data` array. The app therefore treats a valid numbered battery QR as not found.

## Slice

- [x] Decode item-family `bulkItems` from the existing assets response without changing server shape.
- [x] Include decoded item-family results in native scan/search emptiness and result rendering.
- [x] Preserve lookup-only app scan behavior; do not route battery pickup/return through regular Scan.
- [x] Add source-contract coverage for the iOS/API contract.
- [x] Sync Scan, Mobile, and Bulk Inventory docs.
- [x] Run focused tests plus iOS verification checks.

## Review

Implemented native decoding/rendering for `/api/assets.bulkItems`, including Scan result rows, global search item-family rows, and QR shortcut item-family matches.

Verification passed: focused Vitest contract suite, `npm run drift:ios`, `npm run audit:ios:gaps` with the known unrelated `Components/UserAvatarView.swift` unregistered warning, `git diff --check`, and escalated iOS Simulator build for `ios/Wisconsin.xcodeproj` scheme `Wisconsin`. `npx tsc --noEmit` is still blocked by the unrelated existing `tests/bulk-unit-adjustment-routes.test.ts:171` undefined-object error.
