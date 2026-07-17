# iOS App Store Toggle and Row Polish Plan - 2026-07-17

## Goal
- Make Notifications, Settings, and Home read clearly in dark mode before App Store submission, using familiar native control semantics and one consistent row language.

## Route
- Owner area: Mobile Operations
- Secondary areas: Notifications and Dashboard
- Ledger: this bounded plan
- Screenshot evidence: the three user-provided iPhone captures from 2026-07-17

## Source Checks
- `ProfileView` applies `.tint(.primary)` to the settings navigation stack, which makes enabled switches visually white in dark mode.
- The same inherited tint makes the push pre-permission sheet's prominent button white with an unreadable white label in dark mode.
- The medium-height pre-permission sheet compresses its value statement to a single truncated line on iPhone.
- Accessibility Large smoke reveals the full-screen camera pre-prompt also truncates its explanation and bullet labels without explicit multiline height.
- `NotificationSettingsView` uses native toggles but does not override that inherited tint or block competing saves.
- `SettingsView` already had the right compact colored-tile identity, but its button and external-link accessories were inconsistent.
- `HomeView.StatStrip` renders four card buttons whenever any metric is nonzero, leaving inactive zero cards beside the actionable count.

## Apple Design Decisions
- Switches retain native behavior but use an explicit green on-state, with the system-provided neutral off-state.
- The push pre-permission primary action owns an explicit Wisconsin red tint so its label remains legible in every appearance.
- The pre-permission value statement owns its multiline height, and the sheet starts at a taller fractional detent with a large expansion option.
- Camera pre-prompt explanations and bullet labels also own their multiline height at accessibility text sizes.
- Root Settings retains compact colored icon tiles, with familiar grouped rows, short trailing values, chevrons for in-app destinations, and square-arrow accessories for external destinations.
- Dense preference lists use single-line switch labels. Explanations move to section footers and VoiceOver hints so scanning remains fast without losing meaning.
- Home shows only actionable nonzero metrics as compact disclosure rows. An all-zero dashboard keeps its existing quiet all-clear summary.
- No decorative animation is added. Native press feedback, existing selection haptics, Dynamic Type, and Reduce Motion behavior remain intact.

## Stop Conditions
- Stop if shared-row reuse changes destination behavior or role gating.
- Stop if source-contract tests reveal a notification preference or Home routing contract mismatch.
- Stop if the simulator cannot reproduce the authenticated screens; report visual proof separately from compile proof.

## Slices
- [x] Fix notification toggle contrast, saving-state behavior, and row consistency.
- [x] Fix the dark-mode push pre-permission primary-action contrast.
- [x] Preserve the full push pre-permission explanation without truncation.
- [x] Preserve the camera pre-permission explanation and bullets at Accessibility Large.
- [x] Refine the root Settings colored-tile rows and normalize their accessories.
- [x] Replace the Home metric card grid with active-only disclosure rows.
- [x] Update focused source-contract coverage and mobile documentation.

## Verification
- [x] Focused Settings, notification, and Home source-contract tests
- [x] All 49 native iOS source-contract files
- [x] App Review demo, submission-copy, support, deletion, public-content, and contrast contracts
- [x] Dark-mode and maximum-Dynamic-Type simulator interaction smoke
- [x] Public support, privacy, and about URL status checks
- [x] `npm run build:app`
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] Wisconsin simulator build
- [x] Wisconsin generic-device build
- [x] Authenticated simulator screenshots, or an explicit runtime blocker
- [x] `git diff --check`

## Review
- Shipped: Compact colored root Settings rows, native green notification switches with single-line labels, and active-only Home metric disclosure rows.
- Verified: 49 native source-contract files, 27 rejection-focused App Review contracts, project drift, native drift, 51/51 iOS audit coverage, public URL status, production web build, XcodeBuildMCP interaction smoke, and repository simulator plus generic-device builds.
- Deferred: Physical-device Dynamic Type and VoiceOver acceptance remains part of final release QA.
- Blocked: None.
- Proof artifacts: Authenticated iPhone 16 simulator screenshots captured for Home, dark-mode Settings and Notifications, the corrected push pre-permission sheet, and the camera prompt at Accessibility Large; both permission prompts were also exercised at maximum Dynamic Type.
- Next slice or stop: Stop this bounded polish slice. Final candidate upload and physical-device acceptance remain owned by the release-candidate plan.
