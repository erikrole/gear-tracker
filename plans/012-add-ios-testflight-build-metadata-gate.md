# Plan 012: Add an iOS TestFlight build metadata gate

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- ios/project.yml ios/README.md docs/IOS_DEVICE_WALKTHROUGH.md package.json scripts docs/AREA_MOBILE.md`
> If any in-scope file changed since this plan was written, compare the "Current State" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The manual walkthrough says a TestFlight candidate must confirm the build number was bumped, but the generated iOS project still hardcodes `MARKETING_VERSION: "1.0"` and `CURRENT_PROJECT_VERSION: "1"`. That is easy to forget during a release push. A small preflight gate can catch stale metadata before archive/upload time.

## Current State

- `ios/project.yml:48-49` hardcodes `MARKETING_VERSION: "1.0"` and `CURRENT_PROJECT_VERSION: "1"`.
- `ios/README.md:32-37` documents the TestFlight archive/upload flow.
- `docs/IOS_DEVICE_WALKTHROUGH.md:21-29` lists build/install preflight steps but does not run a metadata script.
- `docs/IOS_DEVICE_WALKTHROUGH.md:457` says to confirm the build number was bumped before TestFlight.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Metadata check | new script, for example `npm run ios:release-check` | exits non-zero on stale build metadata |
| iOS drift check | `npm run drift:ios` | exit 0 if Swift untouched |
| Audit inventory | `npm run audit:ios:gaps` | no gaps |
| Typecheck | `npx tsc --noEmit` | exit 0 if package scripts or JS/TS helpers changed |

## Scope

**In scope**:
- `ios/project.yml`
- `ios/README.md`
- `docs/IOS_DEVICE_WALKTHROUGH.md`
- `package.json`
- A small script under `scripts/` if needed
- `docs/AREA_MOBILE.md`

**Out of scope**:
- Do not upload to TestFlight.
- Do not change signing, entitlements, bundle identifier, or deployment target.
- Do not automate App Store Connect metadata.
- Do not change app version numbers unless the maintainer explicitly asks to prepare a release candidate in this same branch.

## Git Workflow

- Branch: `codex/012-ios-testflight-build-metadata-gate`
- Commit message: `chore: add iOS TestFlight metadata preflight`

## Steps

### Step 1: Add a lightweight metadata checker

Add a script that reads `ios/project.yml` and verifies:

- `MARKETING_VERSION` is present.
- `CURRENT_PROJECT_VERSION` is present.
- For release/TestFlight mode, `CURRENT_PROJECT_VERSION` is not still the known baseline build number unless explicitly allowed.

Keep the script deterministic and local. A small Node script is fine because the repo already uses npm scripts for iOS checks.

Suggested command name:

```json
"ios:release-check": "node scripts/check-ios-release-metadata.mjs"
```

**Verify**: run the script against the current baseline and confirm whether it fails or prints the exact required action. If current `1` should be allowed during non-release development, add a flag such as `--testflight` for strict mode.

### Step 2: Wire the check into release docs

Update:

- `ios/README.md`: add the release-check command before Archive.
- `docs/IOS_DEVICE_WALKTHROUGH.md`: add the command to Build + install and Sign-off.

Do not add this to general CI unless the script has a non-release mode that will not block normal development.

**Verify**: `rg -n "ios:release-check|CURRENT_PROJECT_VERSION|TestFlight|build number" ios/README.md docs/IOS_DEVICE_WALKTHROUGH.md package.json scripts` -> the release path is documented.

### Step 3: Record the mobile process cleanup

Update `docs/AREA_MOBILE.md` with a small changelog note if this ships.

**Verify**: `rg -n "release-check|TestFlight|build number" docs/AREA_MOBILE.md docs/IOS_DEVICE_WALKTHROUGH.md ios/README.md package.json scripts` -> no stale manual-only instruction remains.

## Test Plan

- Run the new metadata checker in normal and strict/TestFlight mode, if both exist.
- Run `npx tsc --noEmit` if any TypeScript files changed.
- Run `npm run drift:ios` and `npm run audit:ios:gaps` if the branch touches iOS docs as part of release gating.

## Done Criteria

- [ ] There is a local command that checks iOS release metadata before TestFlight.
- [ ] TestFlight docs call the command before Archive.
- [ ] The command fails with actionable output when build metadata is stale in strict mode.
- [ ] Normal development checks are not blocked by release-only requirements.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

- The maintainer wants build numbers managed exclusively by Xcode or App Store Connect.
- The repo has an uncommitted release candidate where bumping `CURRENT_PROJECT_VERSION` is already in progress.
- The checker requires network access.

## Maintenance Notes

This is a process guard, not a release. Keep it boring and local.

