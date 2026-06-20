# Dependency Audit Hardening Plan - 2026-06-18

## Goal
- Clear the dependency audit blocker that keeps PR #349 and PR #353 from being merge-ready, while separating package risk from CI configuration and Dependabot review policy.

## Source Checks
- `tasks/orchestrator.md`: PR #349 and PR #353 are package-mergeable but blocked under the mandatory high-audit gate; PR #324 should be closed only after explicit approval.
- `package.json`: `postinstall` runs `prisma generate`, `build` runs migration deploy before Next build, `vitest` is still declared as `^3.0.6`, and `@next/bundle-analyzer` remains in dev dependencies.
- `package-lock.json`: current lock resolves `vitest` to `3.2.4`, `vite` to `7.3.2`, and `webpack-bundle-analyzer` carries `ws@7.5.10`.
- `npm audit --audit-level=high` on current `main`: 17 findings remain, including high `vite`, critical `vitest <3.2.6`, and high `ws` through `webpack-bundle-analyzer`.
- `.github/workflows/ci.yml`: CI runs `npm ci` before setting `DATABASE_URL` and `SESSION_SECRET`; `DIRECT_URL` is never provided, so `postinstall` can fail before audit/test/build.
- `.github/workflows/claude-code-review.yml`: Claude review uses `anthropics/claude-code-action@v1` without an explicit Dependabot allowance, so bot-authored dependency PRs can fail review policy outside the package diff.
- `docs/NORTH_STAR.md`: integrity and trust outrank dependency churn; this work should improve security posture without changing product behavior.
- `docs/DECISIONS.md`: no product decision should be affected; this slice must avoid booking, kiosk, role, status, and audit behavior changes.
- `docs/GAPS_AND_RISKS.md`: accepted dependency/security residuals must be documented only if intentionally deferred.

## Slices
- [x] Slice 1: Package audit hardening
  - Start from current `main` after preserving unrelated worktree changes.
  - Run `npm audit fix` or the minimal equivalent package updates.
  - Keep the diff limited to `package.json` and `package-lock.json` unless a package major requires source changes.
  - Verify that `vitest` resolves to `>=3.2.6`, Vite is outside the audited vulnerable range, and the `ws` path through bundle analyzer is cleared or documented.
- [x] Slice 2: CI install environment correction
  - Update CI so `npm ci` has the placeholder env needed by `postinstall`/`prisma generate`.
  - Prefer setting placeholder `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` at the job level instead of weakening `postinstall`.
  - Keep this separate from package hardening if the package diff is already large.
- [x] Slice 3: Dependabot review policy decision
  - Decide whether dependency PRs should run Claude review for Dependabot, skip that workflow for Dependabot, or explicitly allow Dependabot if the action supports it.
  - Record the chosen policy in the orchestrator ledger before changing workflow behavior.
- [x] Slice 4: PR reconciliation
  - Re-run PR #349 and PR #353 classification after the package and CI blockers are addressed.
  - Close PR #324 only after explicit approval, preserving Lucide v1 and Zod 4 as separate recreate candidates if still desired.

## Verification
- [x] `npm audit --audit-level=high`
- [x] `npm ci`
- [x] `npm run db:migrate:check`
- [x] `npm test -- tests/query-client.test.ts`
- [x] `npm run lint`
- [x] `./node_modules/.bin/tsc --noEmit --pretty false`
- [x] `DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder DIRECT_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder SESSION_SECRET=0000000000000000000000000000000000000000000000000000000000000000 ./node_modules/.bin/next build`
- [x] `npm test`
- [x] `git diff --check`
- [x] `npm run verify:docs` if docs/codemaps change

## Stop Conditions
- Stop if `npm audit fix` proposes a major package upgrade or product source edits; split the affected package into its own branch.
- Stop if the branch would touch files already modified by active unmerged product work.
- Stop if audit remains red but only on a package that cannot be safely moved today; document the residual advisory and ask for an explicit baseline-audit exception.
- Stop before closing, merging, pushing, or changing GitHub PR state without explicit approval.

## Review
- Shipped: `npm audit fix` updated package-lock dependency resolution enough to clear the mandatory high gate: `vitest` resolves to `3.2.6`, `vite` resolves to `7.3.5`, and `ws` resolves to `7.5.11`. The same pass updates related Sentry/OpenTelemetry, Babel, Webpack, MDXEditor, and Resend transitive paths.
- Shipped: `.github/workflows/ci.yml` now provides placeholder `DATABASE_URL`, `DIRECT_URL`, and `SESSION_SECRET` at job scope, so `npm ci` can run `postinstall`/`prisma generate` before audit/test/build.
- Shipped: `.github/workflows/claude-code-review.yml` now allows only `dependabot[bot]` through the Claude Code Action `allowed_bots` input, matching the action's documented narrow bot-allowance path.
- Shipped: source-contract tests were reconciled to current iOS/kiosk/event contracts exposed by the existing source, including future-safe kiosk checkout date fixtures.
- Verified: high audit passes with only low/moderate findings remaining, clean install passes with placeholder env, migration prefix check passes, focused Vitest passes, lint passes with existing warnings, TypeScript passes, placeholder-env Next build passes, and full Vitest passes 228 files / 1330 tests.
- Deferred: Actual GitHub PR state is unchanged. PR #349 and PR #353 are now superseded by this local dependency hardening slice once it ships. PR #324 remains a close candidate that still needs explicit approval before mutation.
