# Kiosk Windowing And Compiler Cleanup

## Goal

Remove the iOS 26 kiosk target warnings while keeping the managed iPad kiosk usable in landscape, portrait, and resized scenes.

## Scope

- Retire `UIRequiresFullScreen` and declare all iPad orientations.
- Set a practical kiosk scene minimum using SwiftUI window resizability.
- Make the remaining fixed split kiosk flows stack below the existing compact breakpoint.
- Remove the HID scanner Swift 6 default-argument isolation warning.

## Out Of Scope

- Kiosk navigation, custody, scanner protocol, or backend behavior changes.
- A new kiosk visual design.
- The separate Swift 6 language-mode migration.

## Checklist

- [x] Add adaptive split layout for scan and student-hub screens.
- [x] Remove the deprecated full-screen target setting and support all orientations.
- [x] Correct the scanner focus gate's default argument isolation.
- [x] Add source contracts and sync kiosk/mobile docs.
- [x] Verify both iOS targets and repository checks.
- [ ] Confirm resizing/orientation behavior on the managed M2 iPad Air.

## Review

- 2026-07-09: Removed `UIRequiresFullScreen`, declared every iPad orientation, and added a 640×540 SwiftUI content minimum. `KioskAdaptiveSplit` preserves the landscape work/rail layout above the existing compact breakpoint and stacks active checkout scanning, pickup, return, student-hub content, and checkout setup below it. The scanner suppression API now resolves its default duration inside the `@MainActor` method, removing the future Swift 6 warning. Verification passed: 310 Vitest files / 1,871 tests, iOS drift and gap audits, XcodeGen parity, docs/codemaps, whitespace, production app build, and simulator plus generic-device builds for `WisconsinKiosk` and `Wisconsin`. The kiosk build now has no warnings. Managed M2 iPad Air orientation/resizing confirmation remains open.
