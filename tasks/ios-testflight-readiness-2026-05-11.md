# Wisconsin iOS TestFlight Readiness - 2026-05-11

## Verdict

**Automated readiness: PASS.**

The Wisconsin iOS app is materially closer to TestFlight readiness because the source-verifiable audit drift is reconciled, the two automated iOS readiness checks pass, and the simulator target builds successfully. The remaining checklist is real-device QA only.

## Reconciled Audit State

Current iOS audit inventory covers **34/34 audit-worthy surfaces**. No source-verifiable P0/P1 blocker remains open for the prioritized daily operations surfaces:

- Home / Dashboard
- Bookings list and detail
- Items list and detail
- Schedule and event detail
- Scan
- Profile
- Notifications
- Kiosk activation, idle, student hub, checkout, pickup, return, and success flows

Still-live source-level gaps are intentionally deferred V1 parity/polish items, not TestFlight blockers:

- `GAP-34`: iOS Bookings list omits full web status filters and column sorting.
- `GAP-35`: iOS Booking detail omits per-item conflict badges.
- `GAP-36`: iOS Item detail omits web-only admin lifecycle actions: Duplicate, Retire, Delete, Needs Maintenance.
- Schedule web parity items remain deferred: Week view, My Hours stat strip, full Sport/Area/Coverage/Time filter bar, and web ShiftDetailPanel.

## Verified Commands

```sh
npm run drift:ios
```

Result: passed. `ios-drift-check` reported no anti-patterns across 45 Swift files.

```sh
npm run audit:ios:gaps
```

Result: passed. 34 audit-worthy surfaces, 34 covered, 0 missing audit docs, `✓ no audit gaps`.

```sh
xcodebuild -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build
```

Result: passed after granting CoreSimulator access outside the sandbox. `** BUILD SUCCEEDED **`.

Additional build proof: XcodeBuildMCP compile-only simulator build also passed for scheme `Wisconsin`, configuration `Debug`, iOS Simulator target `iPhone 17 Pro`, with zero warnings and zero errors.

## Hardware-Only QA Remaining

These cannot be closed by source audit or simulator build:

- Camera / DataScanner permission, scanning, torch, denied-permission recovery
- Real haptics
- APNs registration, foreground delivery, notification tap routing
- VoiceOver pass on high-traffic rows and kiosk surfaces
- Dynamic Type through accessibility sizes
- Bluetooth HID scanner kiosk checkout path
- Real network instability: airplane mode, Wi-Fi/cellular swap, stale-write races under slow network
- Real-device install/signing on the TestFlight candidate build

Use `docs/IOS_DEVICE_WALKTHROUGH.md` as the remaining QA runbook.

## Notes

- The first sandboxed shell `xcodebuild` attempt failed because CoreSimulator services and Xcode caches were not accessible from the sandbox. The exact same command succeeded once run with the needed CoreSimulator access.
- The only build warning observed in the successful shell build was the known AppIntents metadata notice: no `AppIntents.framework` dependency found. The device walkthrough already treats this as acceptable for current readiness.
