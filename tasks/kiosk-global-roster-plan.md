# Kiosk Global Operations Plan - 2026-08-03

## Goal

- Show every active, visible user, checkout, reservation, active item, and kiosk custody record at every kiosk, regardless of its saved location.
- Treat kiosk location as the physical destination only when gear is checked in. A check-in moves the returned serialized asset, or restores the returned bulk-stock balance, to that kiosk.
- Do not rewrite an item's saved location during a checkout scan, checkout completion, active-checkout edit, or pickup scan.

## Route

- Owner area: `AREA_KIOSK`
- Secondary area: `AREA_USERS`
- Ledger: this plan
- Existing contract: D-032 currently limits operational reads and writes to `kiosk.locationId`; it must be amended before implementation.

## Source Checks

- The shipped roster change already made manual roster, Wiscard identity, scan identity, and student-context eligibility global while preserving `active`, `hiddenFromRoster`, and collaborator-policy boundaries.
- `src/app/api/kiosk/dashboard/route.ts` still filters stats, active serialized items, active numbered bulk units, open checkout cards, and active pickup-window counts by `kiosk.locationId`.
- `src/app/api/kiosk/student/[userId]/route.ts` still filters pending pickups, due reservations, and upcoming reservations by `kiosk.locationId`, although active checkouts are global.
- `src/app/api/kiosk/resolve-scan/route.ts` and `src/app/api/kiosk/pickup/[id]/confirm/route.ts` reject a reservation owned by another location.
- `src/app/api/kiosk/checkout/[id]/route.ts` only permits active-checkout edits at the kiosk location and changes a serialized asset's location when adding it.
- `src/app/api/kiosk/checkout/scan/route.ts` changes a serialized asset's location during a preflight scan; `checkout/complete` changes every serialized asset's location on checkout; `pickup/[id]/scan` does the same on pickup.
- `src/lib/services/bookings-checkin.ts` already moves a serialized asset to `kioskLocationId` on kiosk check-in. `src/lib/services/bulk-unit-scans.ts` instead restores a numbered unit's balance to the booking's original location, so it needs the return kiosk location as an explicit input.
- `Asset.locationId` represents one serialized asset's physical location. `BulkSku.locationId` is family-level metadata and must not be changed on an individual return; `BulkStockBalance` and `BulkStockMovement` record the correct per-location bulk transfer.

## Stop Conditions

- Stop if removing the remaining read/write location predicates would expose hidden, inactive, or private user data.
- Stop if a route needs a bulk family-level location rewrite to represent one returned unit. The correct implementation is a stock-balance movement at the return kiosk.
- Stop if the native response models cannot tolerate the globalized existing response shapes.

## Slices

- [x] Slice 1: Globalize person discovery while preserving identity visibility boundaries.
- [x] Slice 2: Amend D-032 and kiosk documentation: kiosk data and custody actions are globally addressable, while a check-in is the explicit location-transfer event.
- [x] Slice 3: Globalize dashboard, student checkout/reservation data, reservation scan resolution and confirmation, and active-checkout management; preserve actor, state, allocation, and availability controls.
- [x] Slice 4: Remove all checkout/pickup location mutations. Keep direct checkout's booking location and availability source at the authenticated kiosk, because direct handoff still originates there.
- [x] Slice 5: Send serialized check-ins and numbered bulk check-ins to the kiosk's location, with stock movement evidence for bulk. Do not alter generic web check-in behavior.
- [x] Slice 6: Add regression coverage for cross-location dashboard data, pickup, active-checkout edits, no checkout/pickup relocation, and serialized/numbered-bulk check-in transfer.
- [x] Slice 7: Run focused tests and repository gates, then record device proof boundaries.

## Verification

- [x] Focused kiosk dashboard, student, scan resolution, pickup, active-checkout, check-in, and bulk-ledger Vitest coverage
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed TypeScript files
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [ ] Authenticated kiosk runtime proof, or record why it is unavailable
- [ ] Managed M2 iPad Air proof remains a separate hardware gate

## Review

- Implemented: Every kiosk now reads the complete operational dashboard and student custody data, permits cross-location reservation pickup and active-checkout management, and preserves saved gear locations through checkout and pickup. Kiosk check-in transfers serialized assets or numbered bulk stock to the return kiosk.
- Verified: 85 focused Vitest tests, TypeScript, focused ESLint, production build, codemap/doc verification, and diff validation passed.
- Deferred: Authenticated Kohl Center runtime walkthrough and managed iPad hardware proof remain separate from server and source-contract gates.
- Blocked: None. Existing asset and bulk-stock structures express the required check-in transfer without a schema migration.
- Proof artifacts: Dashboard, student, scan, pickup, checkout, and check-in routes listed above; `BulkStockBalance` and `BulkStockMovement` are the bulk-location source of truth.
- Next slice or stop: Deploy only when authorized, then use the Kohl Center kiosk to confirm global checkout visibility and a cross-location serialized and numbered-bulk return.
