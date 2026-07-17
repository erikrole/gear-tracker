# Xcode 26.6 Recommended Settings Follow-up - 2026-07-17

## Goal
- Encode Xcode's selected recommended settings in `ios/project.yml` so the generated project remains reproducible and the upgrade warning clears.

## Route
- Owner area: Mobile Operations build configuration
- Ledger: this bounded follow-up
- Prior work: `tasks/archive/completed-2026-07/ios-swift-6-xcode-26-6-fixes-plan.md`

## Source Checks
- Xcode 26.6 selects user-script sandboxing, project-level development-team inheritance, and String Catalog symbol generation.
- Xcode leaves generated Asset Catalog framework extensions unselected; its tool specification defaults that setting to `NO`.
- The project has no shell-script build phases, so enabling user-script sandboxing does not require declaring script inputs or outputs.

## Stop Conditions
- Stop if project regeneration removes unrelated active iOS work.
- Stop if a selected recommendation breaks either generated-project drift or an affected target build.

## Slices
- [x] Add the three selected recommendations to shared project settings.
- [x] Remove duplicate target-level development-team settings so targets inherit the project value.
- [x] Regenerate and verify the Wisconsin project.

## Verification
- [x] `npm run ios:project:check`
- [x] `npm run ios:xcode:verify`
- [x] `git diff --check`

## Review
- Shipped: User-script sandboxing, project-level development-team inheritance, and String Catalog symbol generation in the XcodeGen source. Asset Catalog framework extensions remain disabled as Xcode's default selection requested.
- Verified: Generated-project drift, static iOS gates, Wisconsin simulator build, Wisconsin generic-device build, and diff whitespace.
- Deferred: None.
- Blocked: None.
- Next slice or stop: Stop. Cancel the stale Xcode upgrade sheet and let Xcode reload the regenerated project.
