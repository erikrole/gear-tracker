# Plan 010: Extend iOS API error guardrails into Core

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If any STOP condition occurs, stop and report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- scripts/ios-drift-check.sh docs/IOS_PATTERNS.md docs/AREA_MOBILE.md ios/Wisconsin/Core/APIClient.swift tests/ios-api-contract.test.ts tests/ios-notifications-token-honesty.test.ts`
> If any in-scope file changed since this plan was written, compare the "Current State" excerpts against live code before proceeding. On a mismatch, stop and report.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: correctness
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why This Matters

The iOS drift detector flags `try? await session.data(...)` because that pattern caused P0-class phantom-success bugs. The detector currently scans only `Views/` and `Kiosk/`, while `APIClient.swift` under `Core/` still contains the same raw pattern. Some Core calls are intentionally non-blocking hints, but that intent is not encoded in the guardrail. A future regression can pass `npm run drift:ios` while silently swallowing API failures in the shared client.

## Current State

- `scripts/ios-drift-check.sh:40-42` scans only `ios/Wisconsin/Views` and `ios/Wisconsin/Kiosk`.
- `scripts/ios-drift-check.sh:103-107` defines R3 for `try? await session.data`.
- `docs/IOS_PATTERNS.md:70-78` says API client methods should route through `perform` and calls out `_ = try? await session.data(for: req)` as an anti-pattern.
- `ios/Wisconsin/Core/APIClient.swift:83-86` has logout call `try? await session.data`.
- `ios/Wisconsin/Core/APIClient.swift:306-351` has `checkAvailability(...)` as a non-blocking hint with `try? await session.data`.
- `ios/Wisconsin/Core/APIClient.swift:353-369` has `shiftConflicts(...)` as a non-blocking hint with `try? await session.data`.
- `docs/AREA_MOBILE.md:170` records that `checkAvailability` was previously silently broken because `try?` swallowed the server 400.
- `tests/ios-api-contract.test.ts:69-80` pins the availability response envelope but not the Core error-handling guardrail.
- `tests/ios-notifications-token-honesty.test.ts:26-47` pins one recent move toward `perform` for token register/revoke.

## Commands You Will Need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused contract tests | `npx vitest run tests/ios-api-contract.test.ts tests/ios-notifications-token-honesty.test.ts` | exit 0 |
| iOS drift check | `npm run drift:ios` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0 if tests or scripts use TypeScript |
| iOS build | `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build` | BUILD SUCCEEDED |

## Scope

**In scope**:
- `scripts/ios-drift-check.sh`
- `docs/IOS_PATTERNS.md`
- `docs/AREA_MOBILE.md`
- `ios/Wisconsin/Core/APIClient.swift`, only if small allowlist-friendly wrappers are needed
- `tests/ios-api-contract.test.ts` or a new focused iOS source-contract test

**Out of scope**:
- Do not make advisory conflict hints block booking creation or assignment.
- Do not change API response shapes.
- Do not rewrite the whole API client.
- Do not remove local cookie clearing from logout.

## Git Workflow

- Branch: `codex/010-ios-core-api-error-guardrails`
- Commit message: `fix: guard iOS Core API error handling`

## Steps

### Step 1: Decide the guardrail shape

Extend R3 coverage so `Core/APIClient.swift` is checked too, but keep intentional advisory calls explicit.

Acceptable implementation shapes:

- Scan all Swift files under `Views`, `Kiosk`, and `Core`, then exclude a tiny allowlist of methods or files with comments explaining why.
- Add a source-contract test that fails on new `try? await session.data` occurrences in `APIClient.swift` unless the method is listed in an explicit advisory allowlist.

Prefer the source-contract test if shell allowlisting becomes brittle.

**Verify**: introduce a temporary extra `try? await session.data` in a scratch copy or by reasoning through the test pattern, then remove it before committing.

### Step 2: Make intentional advisory paths explicit

Document why `checkAvailability` and `shiftConflicts` may return empty maps on non-401 failure. If code changes are needed, keep behavior non-blocking but make the 401 broadcast and decode-failure behavior obvious.

Do not convert these hint calls into throwing APIs unless the booking and assign flows are also updated to display a non-blocking warning state.

**Verify**: `npx vitest run tests/ios-api-contract.test.ts` -> exit 0.

### Step 3: Update docs and changelog

Update `docs/IOS_PATTERNS.md` so the drift detector description no longer implies the R3 guarantee is limited to Views/Kiosk.

Update `docs/AREA_MOBILE.md` with a short note that Core API silent-swallow guardrails are now enforced.

**Verify**: `rg -n "try\\?|R3|Core|session.data|checkAvailability|shiftConflicts" scripts/ios-drift-check.sh docs/IOS_PATTERNS.md docs/AREA_MOBILE.md tests ios/Wisconsin/Core/APIClient.swift` -> intentional cases and guardrail docs are visible.

## Test Plan

- Existing contract tests for availability and token honesty.
- Add a static guardrail test if shell scanning cannot cleanly express the allowlist.
- Run `npm run drift:ios`.
- Run the iOS simulator build because this plan may touch Swift Core code.

## Done Criteria

- [ ] New unapproved `try? await session.data` in Core fails a cheap check.
- [ ] Advisory Core calls are explicitly allowlisted or documented.
- [ ] `checkAvailability` and `shiftConflicts` remain non-blocking hints.
- [ ] `npx vitest run tests/ios-api-contract.test.ts tests/ios-notifications-token-honesty.test.ts` exits 0.
- [ ] `npm run drift:ios` exits 0.
- [ ] iOS simulator build succeeds.
- [ ] `plans/README.md` status row updated.

## STOP Conditions

- Guarding Core through the shell script creates noisy false positives that cannot be expressed cleanly.
- A code change would make advisory conflict checks block primary booking or assignment workflows.
- The current branch already contains a broad APIClient refactor.

## Maintenance Notes

This plan is about making intent enforceable. The main risk is overcorrecting non-blocking hints into user-blocking errors.

