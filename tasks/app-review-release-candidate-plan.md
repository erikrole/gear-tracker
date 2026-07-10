# App Review Environment And Release Candidate Plan - 2026-07-10

## Goal
- Give Apple a production-safe isolated review account and upload a signed Wisconsin candidate built from the exact source intended for review.

## Route
- Owner areas: Mobile, Notifications, deployment/platform integrity.
- Ledger: this plan plus the existing App Review and launch sections in `tasks/todo.md`.
- Existing references: `tasks/app-store-connect-submission-content.md`, `tasks/notifications-ios-delivery-fix-plan.md`, `tasks/ios-testflight-readiness-2026-05-11.md`, and `docs/RELEASE_VERIFICATION.md`.

## Source Checks
- Normal users remain on `wisconsincreative.com`; only `appreview@wisconsincreative.com` routes to `review.wisconsincreative.com`.
- Production demo rows were removed. Review credentials must not be submitted until the review host uses an isolated Neon target.
- Build 18 predates the final release-hardening and APNs registration work. The next candidate must increment both the app and Live Activities build metadata.
- Kiosk remains a separate target and is outside the App Store candidate.

## Stop Conditions
- Stop if the production Neon project/branch or Vercel project cannot be identified unambiguously.
- Stop before seeding if the deployed review environment's `DATABASE_URL` and `DIRECT_URL` are not proven to point to the isolated branch.
- Stop if review deployment configuration would share production sessions, data, or secrets unintentionally.
- Stop before App Store upload if the worktree contains unreviewed iOS changes, build metadata is inconsistent, signing/archive fails, or the exact candidate has not passed the required gates.
- Record real-device APNs, camera, network, and accessibility checks as blocked rather than claiming them from simulator/source proof.

## Slices
- [x] Slice 1: Create a separate empty Neon review project and record its non-secret identifiers.
- [ ] Slice 2: Create or identify the separate Vercel review target, wire review-only environment variables, deploy, and bind `review.wisconsincreative.com`.
- [ ] Slice 3: Apply migration health/deploy checks to the isolated target, seed the fictional App Review dataset, and verify reviewer-scoped web/API behavior.
- [x] Slice 4: Remove the seed's fallback credential/logging path and finalize submission credentials without committing the secret.
- [x] Slice 5: Reconcile current iOS source, increment app and Live Activities build metadata, regenerate the project, and produce a signed archive.
- [ ] Slice 6: Run source, simulator, signed-archive, and real-device acceptance gates; upload only the exact verified candidate. Source, simulator, generic-device, archive, and export gates are complete; upload and hardware acceptance remain open.
- [ ] Slice 7: Update App Store Connect notes and close the existing launch ledgers with proof.

## Verification
- [ ] Focused App Review routing and seed tests.
- [ ] `npm run db:migrate:check`
- [ ] Read-only migration health against the isolated review database.
- [ ] Review-host login and broad-surface smoke proving only fictional records are visible.
- [ ] `npm run drift:ios`
- [ ] `npm run audit:ios:gaps`
- [ ] `npm run ios:project:check`
- [ ] `npm run ios:xcode:verify`
- [ ] `npm run verify:docs`
- [ ] `git diff --check`
- [ ] Signed Release archive/export metadata inspection.
- [ ] Real-device camera, APNs delivery/tap routing, network recovery, accessibility, and install/upgrade checks.

## Review
- Shipped: Created the separate empty Neon project `gear-tracker-app-review` (`long-art-11143851`) with primary branch `main` (`br-steep-pine-ajmzuvn5`) and database `neondb`. Hardened the review seed so seeding requires an explicit 16+ character password and exact expected database host; removed password logging and the committed reviewer password from submission notes.
- Verified: Neon table inventory returned empty for the new project. Focused seed/routing tests pass, the seed script parses, and a guarded seed attempt without a password refuses before connecting. Build 19 passes project drift, iOS drift, 47/47 audit coverage, focused source tests, simulator and generic-device builds, signed Release archive, App Store export, TypeScript, codemap/docs, migration-prefix, whitespace, and production app-build gates.
- Deferred:
- Blocked: The connected Vercel scope returns 403 for the repo's linked team/project. `review.wisconsincreative.com` has no DNS record. No review deployment, migrations, or demo seed can proceed until Vercel access is restored and the review environment is proven to use the isolated database. App Store Connect upload was rejected by the external-action approval gate pending explicit upload authorization. Real-device APNs, camera/scanner, unstable-network, and accessibility checks remain open.
- Proof artifacts: `/private/tmp/Wisconsin-19.xcarchive`; `/private/tmp/Wisconsin-19-export/Wisconsin Creative.ipa`; SHA-256 `8e504752c234903eeb016aadeaebf6819f8764cdbd6eb480175ce725e7907feb`.
- Next slice or stop: restore Vercel team access and explicitly authorize the build 19 App Store Connect upload; then wire review DNS/env, migrate, seed, smoke, and complete hardware acceptance.
