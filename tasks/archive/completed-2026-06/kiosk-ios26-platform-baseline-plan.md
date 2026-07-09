# Kiosk iOS 26 Platform Baseline

## Goal

Move the dedicated `WisconsinKiosk` app from its retired iOS 17 compatibility baseline to the current managed M2 iPad Air fleet on iOS 26.

## Scope

- Raise the `WisconsinKiosk` deployment target from iOS 17.0 to iOS 26.0.
- Preserve the dedicated kiosk target and native-only custody architecture.
- Regenerate and verify the Xcode project.
- Update source contracts, area docs, task ledgers, and hardware assumptions.
- Allow future kiosk slices to use iOS 26 SwiftUI and Liquid Glass APIs without availability fallbacks.

## Out Of Scope

- A broad Liquid Glass visual redesign.
- Swift 6 language-mode adoption.
- Changing kiosk authentication, scanner ownership, or custody APIs.

## Checklist

- [x] Update the XcodeGen kiosk deployment target and regenerate the project.
- [x] Update the target-split contract for a shared iOS 26 minimum.
- [x] Reconcile Kiosk/Mobile docs, gaps, lessons, and active hardware checks.
- [x] Run focused tests, project/drift/docs checks, and the kiosk Xcode build.

## Review

- 2026-07-09: `WisconsinKiosk` now targets iOS 26.0 in XcodeGen and the generated project while remaining a separate iPad-only native target. Current Kiosk/Mobile docs identify the managed M2 iPad Air fleet, the target-split contract pins both apps to iOS 26, and legacy fixed-device comments no longer describe the retired 10.5-inch/iPadOS 17 baseline. Verification passed: focused Vitest (3 files, 8 tests), TypeScript, XcodeGen project check, iOS drift/gap audit, docs/codemaps, whitespace, and escalated `npm run ios:xcode:verify:kiosk` simulator plus generic-device builds. The two initially documented warnings were resolved later that day by the kiosk windowing/compiler cleanup.

## Deferred Follow-ups

- Resolved 2026-07-09: kiosk orientation/windowing now supports all iPad orientations and compact scene stacking without `UIRequiresFullScreen`.
- Keep Swift 6 language-mode adoption separate; the scanner default-argument warning was fixed without changing language mode.
