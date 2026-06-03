# Audit: kiosk battery scan recovery (iOS) - 2026-05-30

**MVP verdict:** READY after typed-code fallback.
**Audit type:** source audit plus targeted recovery fix.

Scope: `ios/Wisconsin/Kiosk/KioskPickupView.swift`, `ios/Wisconsin/Kiosk/KioskReturnView.swift`, `ios/Wisconsin/Kiosk/KioskBarcodeCameraView.swift`, `ios/Wisconsin/Kiosk/KioskAPIClient.swift`, kiosk pickup/checkin scan routes, and `src/lib/services/bulk-unit-scans.ts`.

## Finding
- [x] P1: HID scanner failure had camera fallback, but unreadable labels, camera denial, or unsupported camera hardware had no typed-code recovery. This forced staff to either keep trying scanners or abandon the flow. The fix adds typed barcode/unit-QR entry inside the kiosk camera fallback and denied/unsupported camera states. Typed values call the same pickup/return scan APIs as camera and HID scans, so exact unit custody is still enforced server-side.

## Custody Check
- Pickup still binds numbered battery units only through `/api/kiosk/pickup/[id]/scan`, which delegates to `scanKioskPickupBulkUnit`.
- Return still verifies numbered battery units only through `/api/kiosk/checkin/[id]/scan`, which delegates to `scanKioskCheckinBulkUnit`.
- Confirm/complete still depend on server state, not local optimistic UI.
- There is no manual override that can mark an unscanned battery unit as picked up or returned.

## Existing Strengths
- Pickup and return screens show battery unit scan progress and exact unit chips.
- Camera fallback receives in-sheet scan feedback.
- Server scan errors remain specific: wrong family, missing/retired, duplicate, not in booking, over quantity, not checked out, already returned.
- iOS surfaces API error text and announces scan feedback for accessibility.

## Verification
- XcodeBuildMCP `build_sim` succeeded for `Wisconsin`, Debug, iPad Pro 13-inch (M5), iOS Simulator.
- `npm run drift:ios` passed with 0 anti-patterns across 45 Swift files.
