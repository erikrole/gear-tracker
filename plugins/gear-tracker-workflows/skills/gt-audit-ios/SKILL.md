---
name: gt-audit-ios
description: Gear Tracker iOS readiness audit. Use when the user runs /gt-audit-ios, asks to audit an iOS screen, asks whether a SwiftUI screen is ready, or wants iOS findings before fixes.
---

# /gt-audit-ios

Run a source-grounded audit of one Wisconsin iOS screen. Do not fix during the audit.

## Required Reads

1. `docs/AREA_MOBILE.md`
2. Relevant feature `docs/AREA_*.md`
3. `docs/DECISIONS.md`
4. `docs/GAPS_AND_RISKS.md`
5. `ios/Wisconsin/App/WisconsinApp.swift`
6. `ios/Wisconsin/App/AppDelegate.swift`
7. Target `ios/Wisconsin/Views/*View.swift` or `ios/Wisconsin/Kiosk/*View.swift`
8. Dependent models, stores, API clients, and services
9. Prior `tasks/audit-*-ios.md`

## Lenses

- Student core flow coverage
- Loading, empty, error, success, offline, expired-session paths
- Role-specific affordances
- SwiftUI navigation and sheet behavior
- Safe area, Dynamic Type, dark mode, tap targets, SF Symbols
- API rollout skew for models consumed by production iOS
- Web/iOS parity as informational unless it blocks a student core flow

## Output

Write `tasks/audit-<screen>-ios.md`.

Chat response should lead with:

```text
Audit: <screen> (iOS) - MVP verdict: READY | NOT READY
Record: tasks/audit-<screen>-ios.md
```

Ask for fix, skip, or defer decisions.
