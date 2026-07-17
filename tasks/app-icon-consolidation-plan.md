# App Icon Consolidation Plan - 2026-07-17

## Goal
- Ship the finalized Block W Icon Composer document as the Wisconsin app's only icon and remove the alternate-icon picker and unused candidate assets.

## Route
- Owner area: Mobile Operations
- Ledger: this plan and `docs/AREA_MOBILE.md`
- Existing references: the 2026-07-11 icon entries in `docs/AREA_MOBILE.md`

## Source Checks
- `ios/project.yml` currently compiles `AppIcon.icon` plus four alternate icon names for the main Wisconsin target.
- `ios/Wisconsin/AppIcons` contains the primary icon and four alternate `.icon` packages.
- `ios/Wisconsin/Views/AppIconSettingsView.swift` and Settings expose runtime alternate-icon selection.
- `ios/IconSources/IconComposerCandidates/vintage-helmet/BlockW.icon` is the manually finalized Block W source selected by the user.
- The dedicated WisconsinKiosk target uses its fixed asset-catalog icon and remains out of scope.

## Stop Conditions
- Stop if the finalized Block W package does not compile as `AppIcon.icon` or if XcodeGen removes unrelated current project membership.
- Stop before upload, archive submission, commit, or push because none were requested.

## Slices
- [x] Replace the wired primary Icon Composer package with the finalized Block W package.
- [x] Remove alternate icon build settings, picker UI, preview assets, and unused candidate packages.
- [x] Regenerate the Xcode project while preserving current source membership.
- [x] Sync Mobile documentation and record verification.

## Verification
- [x] Focused iOS Settings source-contract test.
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] Wisconsin simulator Xcode build.
- [x] Confirm the built app bundle contains one `CFBundleIcons` primary contract and no alternate-icon contract.

## Review
- Shipped: Block W is the only main-app Icon Composer package; alternate packages, picker UI, previews, build settings, and discarded candidates are removed. The kiosk fallback icon remains unchanged.
- Verified: Focused Vitest passed 5/5; XcodeGen project check, iOS drift, 100% gap audit, docs verification, whitespace check, simulator build, and generic-device build passed. The built device app plist contains only `CFBundlePrimaryIcon` named `AppIcon` for iPhone and iPad and no alternate-icon dictionary.
- Deferred: Physical-device Home Screen inspection and any App Store upload.
- Blocked: None.
- Proof artifacts: `$TMPDIR/gear-tracker-xcode-derived-data/Build/Products/Debug-iphoneos/Wisconsin Creative.app/Info.plist`
- Next slice or stop: Stop. Do not upload until the icon receives physical-device visual approval.
