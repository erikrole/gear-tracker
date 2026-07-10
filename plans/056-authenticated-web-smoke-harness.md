# Plan 056: Add a durable authenticated browser smoke gate for launch-critical web routes

> **Executor instructions**: Build an isolated, business-data-safe harness. Never run authenticated tests against production. Run all gates and update `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9e92580f..HEAD -- package.json package-lock.json tests/schedule-source-truth-smoke-contract.test.ts docs/RELEASE_VERIFICATION.md playwright.config.ts tests/e2e`

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/052-gate-settings-routes-by-role.md, plans/054-items-bootstrap-recovery.md, plans/055-dashboard-fast-count-truth.md
- **Category**: tests
- **Planned at**: commit `9e92580f`, 2026-07-09
- **Execution**: IMPLEMENTED, AUTHENTICATED PROOF BLOCKED 2026-07-10. Playwright discovers 27 launch-smoke tests across desktop and narrow-mobile projects. Local no-credential discovery remains available, while CI or release execution without complete credentials fails before test collection. Authenticated execution also requires `PLAYWRIGHT_TARGET_ISOLATED=1` and rejects known or configured production hosts. Full test, lint, TypeScript, migration, docs, and app-build gates pass. The remaining blocker is a dedicated non-production identity on an isolated target.

## Why this matters

The repo has extensive source-contract and service tests but intentionally asserts that no Playwright harness exists. Authenticated route proof is repeatedly blocked or performed ad hoc, so responsive layout, keyboard paths, role-adaptive controls, console errors, and recovery states can regress while the automated gate remains green.

## Current state

- `tests/schedule-source-truth-smoke-contract.test.ts` asserts there is no Playwright config, dependency, or script.
- `docs/NORTH_STAR.md`, `docs/DESIGN_LANGUAGE.md`, and `docs/RELEASE_VERIFICATION.md` all require or recommend authenticated browser proof.
- `scripts/deploy-smoke.mjs` supports HTTP/deploy checks and optional credentials, but it does not drive the rendered UI.
- Existing App Review/demo seeding can touch configured data. Do not reuse it against production for routine browser tests.

## Scope

**In scope**:
- `package.json` and lockfile
- `playwright.config.ts` (create)
- `tests/e2e/` business-data-safe launch smoke specs and auth fixture
- Reconcile `tests/schedule-source-truth-smoke-contract.test.ts`
- Release/testing/design docs and task ledger
- Initial routes: Dashboard, Bookings, Items, Search, Schedule, Settings overview, one personal Settings page, and one role-restricted Settings direct URL

**Out of scope**:
- Production mutations
- Full visual regression coverage for all 64 routes
- Kiosk/native iOS automation
- Replacing Vitest or deploy smoke
- Reservation-to-kiosk fulfillment automation in this first harness slice

## Steps

1. Add Playwright and a config that targets a supplied base URL, records traces/screenshots only on failure, and supports desktop plus narrow-mobile projects. Use accessibility-first locators.
   - **Verify**: `npx playwright test --list` exits 0 and lists both projects.
2. Add an auth setup fixture using dedicated environment variables. Save storage state under an ignored temporary/test-results path. Fail clearly when credentials are missing in release mode; allow an explicit local skip outside release mode.
   - **Verify**: no credential values or storage-state files are tracked by git.
3. Add read-only smoke cases for the scoped routes: document load, expected heading, no uncaught console/page errors, no horizontal overflow, keyboard-reachable primary action, and correct role visibility.
   - **Verify**: tests pass against an isolated local/review environment.
4. Add a direct-url Settings role test and recovery-state tests for Search, Items bootstrap, and Dashboard count truth after plans 052, 054, and 055 land. Use request interception for failure states, not database corruption.
5. Replace the old “Playwright must not exist” assertions with contracts for the new script/config/smoke route set.
6. Add `test:e2e:smoke` and document it as a release-candidate gate. Keep `npm test` fast and separate.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| List | `npx playwright test --list` | scoped smoke tests listed for desktop/mobile |
| E2E | `npm run test:e2e:smoke` | all pass against isolated target |
| Unit/source | `npx vitest run tests/schedule-source-truth-smoke-contract.test.ts` | pass with new contract |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0 |
| Lint | `npm run lint -- --max-warnings=0` | exit 0 |
| Build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## Done criteria

- [ ] Authenticated desktop and narrow-mobile smoke run repeatably against an isolated target.
- [x] No production data mutation is possible from the initial suite.
- [x] Scoped routes assert headings, console health, overflow, keyboard access, and role visibility.
- [x] Failure states are exercised through request interception.
- [x] Release docs name the exact command and credential contract.
- [x] Unit, type, lint, build, discovery, and safety-contract gates pass.
- [ ] Authenticated E2E execution passes against an isolated target.

## STOP conditions

- Only production credentials/data are available.
- Auth requires weakening normal security or adding a production bypass.
- The proposed fixture would commit cookies, passwords, tokens, or real student data.
- The isolated App Review/review target is not provisioned and no safe local test identity exists; report the blocker instead of using production.

## Maintenance notes

Keep the first suite small and high-signal. Prefer role/route/recovery assertions over brittle pixel baselines. Add screenshot baselines only after data and fonts are deterministic. The next dependent plan should automate reservation-to-kiosk fulfillment freshness once a safe test environment exists.
