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
- Apple Guideline 2.1 requires a complete, crash-tested build plus full reviewer access, live backend services, and any sample QR or other resources needed to exercise the app.
- Apple Guideline 2.3 requires screenshots, privacy disclosures, description, age rating, and other metadata to match the submitted build and use fictional account information.
- Apple Guideline 4.2 requires adequate native utility. Wisconsin satisfies this directionally through native reservations, schedule, search, scan, notifications, and Live Activities; Review notes and screenshots must demonstrate those flows rather than presenting the app as a web companion.
- Apple Guidelines 5.1.1(i) and 5.1.1(v) require an easily accessible in-app privacy-policy link and in-app account deletion when account creation is supported. The current native source contains neither surface. Invitation-only web registration may make deletion applicability debatable, but launch should close the risk instead of depending on reviewer interpretation.
- Apple Guideline 5.1.1 requires accurate disclosure, consent, minimization, and revocation behavior. The checked-in privacy manifest is only one input; App Store Connect answers must be reconciled against actual server, SDK, diagnostics, notification, and operational-data behavior.

## Stop Conditions
- Stop if the production Neon project/branch or Vercel project cannot be identified unambiguously.
- Stop before seeding if the deployed review environment's `DATABASE_URL` and `DIRECT_URL` are not proven to point to the isolated branch.
- Stop if review deployment configuration would share production sessions, data, or secrets unintentionally.
- Stop before App Store upload if the worktree contains unreviewed iOS changes, build metadata is inconsistent, signing/archive fails, or the exact candidate has not passed the required gates.
- Record real-device APNs, camera, network, and accessibility checks as blocked rather than claiming them from simulator/source proof.

## Slices
- [x] Slice 1: Create a separate empty Neon review project and record its non-secret identifiers.
- [x] Slice 2: Create the separate Vercel review target, wire Review-only environment variables, deploy the private source with explicit approval, and bind `review.wisconsincreative.com` through a DNS-only Vercel CNAME.
- [x] Slice 3: Bootstrap and verify migration health on the isolated target, seed the fictional App Review dataset, and verify reviewer-scoped web/API behavior.
- [x] Slice 4: Remove the seed's fallback credential/logging path and finalize submission credentials without committing the secret.
- [x] Slice 5: Reconcile current iOS source, increment app and Live Activities build metadata to Build 20, regenerate the project, and produce a signed archive and App Store export.
- [ ] Slice 6: Run source, simulator, signed-archive, and real-device acceptance gates; upload only the exact verified candidate. Build 20 source, simulator, generic-device/archive, export, and App Store Connect upload gates are complete; Apple processing and hardware acceptance remain open.
- [ ] Slice 7: Update App Store Connect notes and close the existing launch ledgers with proof.
- [x] Slice 8: Add an easily accessible native Legal/Privacy surface that opens the canonical privacy policy and exposes a support/contact route.
- [x] Slice 9: Add a safe in-app account-deletion request or deletion flow, including reauthentication/confirmation, server-side lifecycle handling, and reviewer-facing explanation of invitation-only account creation.
- [x] Slice 10: Perform a data-flow inventory and reconcile the privacy manifest, App Store privacy nutrition label, privacy-policy retention/deletion language, permission timing, and third-party SDK behavior.
- [ ] Slice 11: Capture final screenshots from the exact candidate using fictional review data; verify every visible feature, role, device frame, age-rating answer, URL, copyright owner, and description claim against the submitted build.

## Verification
- [x] Focused App Review routing, bootstrap, and seed tests.
- [x] `npm run db:migrate:check`
- [x] Read-only migration health against the isolated review database.
- [x] Review-host login and broad-surface smoke proving only fictional records are visible.
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npm run ios:project:check`
- [x] `npm run ios:xcode:verify`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] Signed Release archive/export metadata inspection.
- [ ] Real-device camera, APNs delivery/tap routing, network recovery, accessibility, and install/upgrade checks.
- [ ] In-app privacy-policy and support links open successfully from a signed candidate.
- [ ] Account deletion/request completes end to end on an isolated test account and leaves the documented audit/retention state.
- [ ] App Store Connect privacy answers are checked against an enumerated data-flow and SDK inventory rather than inferred only from `PrivacyInfo.xcprivacy`.
- [ ] Final screenshot/metadata review uses only fictional identities and matches the exact submitted build.

## Review
- Shipped: Created the separate empty Neon project `gear-tracker-app-review` (`long-art-11143851`) with primary branch `main` (`br-steep-pine-ajmzuvn5`) and database `neondb`. Hardened the review seed so seeding requires an explicit 16+ character password and exact expected database host; removed password logging and the committed reviewer password from submission notes.
- Verified: Neon table inventory returned empty for the new project. Focused seed/routing tests pass, the seed script parses, and a guarded seed attempt without a password refuses before connecting. On 2026-07-12, Build 20 passed project drift, iOS drift, 49/49 audit coverage, 17 focused launch tests, simulator build, signed Release archive, App Store export, TypeScript, the complete `build:app` gate, codemap/docs, migration-prefix, and whitespace gates. Xcode uploaded the exact Build 20 archive successfully and App Store Connect accepted it for processing. The privacy slice has a source-grounded data/SDK inventory, a reconciled native manifest and App Store Connect table, an updated public policy, plist validation, and a regression contract for declared versus unsupported native data categories.
- Deferred: Final App Store metadata/screenshots and hardware acceptance remain separate launch slices.
- Blocked: Real-device APNs, camera/scanner, unstable-network, accessibility, live App Store Connect metadata/privacy entry, and final screenshot checks remain open. The Review deployment/data-isolation and App Store upload blockers are closed.
- Proof artifacts: `/private/tmp/Wisconsin-20.xcarchive`; `/private/tmp/Wisconsin-20-export/Wisconsin Creative.ipa`; SHA-256 `c8ab32f8b593812b7f9dece98ce46502ea158ed37d494b7092411141655a29f1`; Xcode upload completed successfully at 2026-07-12 07:33 America/Chicago and Apple reported the package is processing.
- Next slice or stop: finish App Store Connect metadata after Apple authentication, capture the final fictional screenshot set in Device Hub, and complete real-device acceptance against the live isolated Review environment. Do not submit for review until those gates are checked.
