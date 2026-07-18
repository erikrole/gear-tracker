# iOS Browse Navigation Plan - 2026-07-17

## Goal
- Make Browse -> Items -> Item Detail feel like one native navigation flow with stable loading chrome, a normal detail push, and Back returning to Items.
- Remove the same nested-navigation failure mode from the adjacent Users destination and make a repeated Browse-tab selection return to the Browse menu.

## Route
- Owner area: Native iOS navigation, with Items as the primary affected feature area.
- Ledger: `tasks/todo.md` active Browse follow-up and `tasks/audit-browse-ios.md`.
- Existing plan/archive references: `tasks/archive/completed-2026-07/ios-browse-tab-plan.md` established Browse as the compact parent menu.

## Source Checks
- `BrowseView` owns the compact tab's `NavigationStack`, but its Items and Users destinations currently create nested stacks.
- Guides and Licenses already support the correct embedded pattern with `wrapsInNavigationStack: false`.
- `ItemsView` owns item-detail and booking-detail destinations and currently appends completed reservations to a private `NavigationPath`.
- `AppState.selectTab` emits `tabResetToken` for repeated tab selection, but `BrowseView` does not currently consume it.
- Physical-device screenshot evidence showed Items' automatic search placement overlaying the first loaded row; Guides and the equipment picker already use `.navigationBarDrawer(displayMode: .always)` for stable search geometry.
- No API payload, permission, schema, or custody contract is involved.

## Stop Conditions
- Stop if removing the child stacks prevents item, user, or completed-reservation destinations from registering on the Browse stack.
- Stop if the current Xcode target or focused source-contract tests contradict Browse ownership of compact navigation.

## Slices
- [x] Slice 1: Make Browse the only stack owner for embedded Items and Users, preserve standalone wrappers, and move Browse tab-reset behavior to the parent path.
- [x] Slice 2: Preserve Items' post-reservation booking push without relying on a child-owned path and add regression coverage for all affected routes.
- [x] Slice 3: Sync the Browse audit, Items/Mobile docs, and task review with verified behavior.

## Verification
- [x] Focused native Browse/Items/Users source-contract tests.
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run ios:xcode:verify`
- [ ] Simulator launch and interaction proof for Browse -> Items -> Item Detail -> Back, plus repeated Browse-tab reset when an authenticated runtime is available.

## Review
- Shipped: Browse owns the compact navigation path; Items, Guides, Licenses, and Users use that parent stack when embedded; Item/User detail Back behavior and Browse-tab reset follow the parent hierarchy; completed reservation creation from Items still routes to booking detail.
- Verified: Focused Browse, Items, Settings, and native-control Vitest contracts cover parent-stack ownership and explicit search-drawer placement; XcodeGen project check; zero iOS drift findings; 51/51 audit coverage; Wisconsin simulator build, XCTest suite, and generic-device build through `npm run ios:xcode:verify`.
- Deferred: None in source scope.
- Blocked: The original search overlap is confirmed by the user's physical-device screenshot. Interactive proof of the patched build remains unavailable because no simulator was booted when the runtime debugger inspected the device list. The debugger workflow does not boot a simulator without an explicit run request.
- Proof artifacts: Native verifier output reported `OK: iOS Xcode verification passed for Wisconsin.`
- Next slice or stop: Stop after docs verification. Repeat the exact interaction on the next authenticated simulator or physical-device smoke pass.
