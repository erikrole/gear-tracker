---
name: gt-ios-slice
description: Gear Tracker iOS implementation workflow. Use when the user runs /gt-ios-slice, asks to implement or polish an iOS Wisconsin screen, handles API payload changes consumed by iOS, or wants native app readiness work.
---

# /gt-ios-slice

Implement one iOS slice while respecting the web API contract and production rollout skew.

## Required Reads

1. `docs/AREA_MOBILE.md`
2. Relevant feature `docs/AREA_*.md`
3. `docs/DECISIONS.md`
4. `docs/GAPS_AND_RISKS.md`
5. Target SwiftUI view in full
6. Dependent models, stores, API clients, and services
7. Web API route returning payloads consumed by the iOS screen
8. Existing audit or plan files for the iOS surface

## Workflow

1. Define the user-facing slice.
2. Check whether API payload changes need backward-compatible decoding.
3. Implement the smallest coherent Swift or shared API change.
4. Keep Home action-first and student-core flows clear.
5. Update mobile and feature area docs.
6. Run iOS drift and gap checks after meaningful changes.

## Verification

- `npx tsc --noEmit` when shared TypeScript/API changed
- `npm run drift:ios`
- `npm run audit:ios:gaps`
- `git diff --check`
- `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`

## Rules

- Do not call iOS ready until drift, gap audit, and simulator build pass.
- New decoded fields must tolerate old production payloads unless the server deploy is guaranteed first.
- iOS phone workflows matter more than mobile web parity.
