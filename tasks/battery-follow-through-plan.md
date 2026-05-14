# Battery Follow-Through Plan - 2026-05-13

## Goal
- Make numbered battery scans explicit in kiosk pickup and return flows instead of treating battery slots as anonymous generic items.
- Keep booking creation quantity-based and keep actual unit binding at kiosk pickup.

## Current evidence
- `/api/kiosk/checkout/[id]` already returns pending numbered battery slots and checked-out numbered units, but every row has the same generic shape.
- iOS `KioskPickupView` and `KioskReturnView` only know `items`, so their main instruction can only say "Scan each item."
- Existing pickup confirmation already blocks until planned battery units are scanned.

## Plan
- [x] API: add item `type`, SKU id, SKU name, unit number, and scan summary metadata to kiosk checkout detail.
- [x] iOS models: decode the new metadata while staying compatible with the existing `items` array.
- [x] iOS pickup/return UI: surface a compact battery scan instruction and battery progress separate from total item count.
- [x] Tests: update kiosk detail route coverage for pending battery slots and checked-out battery units.
- [x] Docs: sync Bulk Inventory and Kiosk area docs.
- [x] Verification: run focused tests, TypeScript, diff check, and iOS compile check if the touched native files require it.

## Review
- Shipped: kiosk checkout detail now identifies numbered battery rows and exposes scan-summary counts; iOS kiosk pickup and return screens show dedicated numbered-battery scan progress.
- Verified: `npx vitest run tests/kiosk-bulk-detail-routes.test.ts tests/bulk-unit-kiosk-scans.test.ts`, `npx tsc --noEmit`, `git diff --check`, `npm run db:migrate:check`, `npx next build`, and generic iOS simulator `xcodebuild`.
- Deferred: booking-create gear suggestion expansion. This slice only fixes the kiosk handoff clarity gap.
