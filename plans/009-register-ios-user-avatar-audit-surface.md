# Plan 009: Register iOS UserAvatarView in the audit inventory

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- scripts/ios-audit-inventory.sh docs/IOS_PATTERNS.md docs/AREA_MOBILE.md ios/Wisconsin/Views/Components/UserAvatarView.swift`
> If any in-scope file changed since this plan was written, compare the "Current State" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

`npm run audit:ios:gaps` currently exits 0 but reports `Components/UserAvatarView.swift ? NEW add to registry in scripts/ios-audit-inventory.sh`. That means the iOS audit inventory is no longer a clean release signal. The component itself is valid shared UI, but the registry needs to know whether it is audit-worthy or intentionally exempt.

## Current State

- `ios/Wisconsin/Views/Components/UserAvatarView.swift:5` defines the shared avatar component.
- `ios/Wisconsin/Views/UsersView.swift:247` uses `UserAvatarView`.
- `ios/Wisconsin/Views/CreateBookingSheet.swift:497`, `:509`, and `:1298` use `UserAvatarView`.
- `scripts/ios-audit-inventory.sh:90-96` lists shared component exemptions but does not include `Components/UserAvatarView.swift`.
- `docs/IOS_PATTERNS.md:381-383` says new views/components must be dropped into the registry.
- Advisor verification: `npm run audit:ios:gaps` reported one unregistered surface for `Components/UserAvatarView.swift`.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Audit inventory | `npm run audit:ios:gaps` | no unregistered surfaces |
| iOS drift check | `npm run drift:ios` | exit 0 |
| Source check | `rg -n "UserAvatarView|Components/UserAvatarView" scripts/ios-audit-inventory.sh docs/IOS_PATTERNS.md docs/AREA_MOBILE.md ios/Wisconsin/Views` | registry and docs reflect the component |

## Scope

**In scope**:
- `scripts/ios-audit-inventory.sh`
- `docs/IOS_PATTERNS.md`, only if the baseline counts change
- `docs/AREA_MOBILE.md`, to record that the audit inventory is clean again

**Out of scope**:
- Do not redesign `UserAvatarView`.
- Do not consolidate other avatar implementations here. That is Plan 011.
- Do not change audit coverage semantics for real screens.

## Git Workflow

- Branch: `codex/009-register-ios-user-avatar-audit-surface`
- Commit message: `chore: restore iOS audit inventory coverage`

## Steps

### Step 1: Classify UserAvatarView in the registry

Add `Components/UserAvatarView.swift` to `scripts/ios-audit-inventory.sh`.

Preferred classification: `exempt-shared`, because the component is a shared primitive consumed by audited surfaces rather than a routeable screen or sheet.

**Verify**: `npm run audit:ios:gaps` -> no `NEW add to registry` row for `Components/UserAvatarView.swift`.

### Step 2: Refresh baseline documentation if counts changed

If the full audit output changes exempt or total counts, update `docs/IOS_PATTERNS.md` so its baseline line remains truthful.

Add a short `docs/AREA_MOBILE.md` changelog entry only if this is being committed as a shipped cleanup.

**Verify**: `rg -n "34 audit-worthy|35 audit-worthy|UserAvatarView|0 unregistered" docs/IOS_PATTERNS.md docs/AREA_MOBILE.md scripts/ios-audit-inventory.sh` -> no stale baseline remains.

## Test Plan

- Run `npm run audit:ios:gaps`.
- Run `npm run drift:ios`.
- No Swift build is required unless this plan unexpectedly edits Swift source.

## Done Criteria

- [x] `Components/UserAvatarView.swift` is in the audit registry.
- [x] `npm run audit:ios:gaps` reports no unregistered iOS surfaces.
- [x] `npm run drift:ios` exits 0.
- [x] Documentation baseline counts are either unchanged or updated.
- [x] `plans/README.md` status row updated.

## Review

- Completed 2026-06-11 on branch `codex/009-register-ios-user-avatar-audit-surface`.
- Registered `Components/UserAvatarView.swift` as `exempt-shared` because it is a shared primitive consumed by audited screens and sheets.
- Updated the current iOS audit and drift baselines in `docs/IOS_PATTERNS.md` and recorded the cleanup in `docs/AREA_MOBILE.md`.
- Verification: `npm run audit:ios:gaps` reports 39/39 audit-worthy surfaces covered, 12 exempt shared/infra/tiny surfaces, and `✓ no audit gaps`; `npm run drift:ios` reports 0 anti-patterns across 51 Swift files; `git diff --check` passed.

## STOP Conditions

- `UserAvatarView` has grown beyond a shared primitive and should receive a focused audit doc instead of an exemption.
- The audit inventory reports additional unregistered surfaces that are unrelated to this plan.

## Maintenance Notes

This plan restores the usefulness of `audit:ios:gaps` as a release gate. It should stay narrow and avoid UI behavior changes.
