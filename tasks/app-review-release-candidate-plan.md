# App Review Environment And Release Candidate Plan - 2026-07-10

## Goal
- Give Apple a production-safe isolated review account and upload a signed Wisconsin candidate built from the exact source intended for review.

## Route
- Owner areas: Mobile, Notifications, deployment/platform integrity.
- Ledger: this plan plus the existing App Review and launch sections in `tasks/todo.md`.
- Existing references: `tasks/app-store-connect-submission-content.md`, `tasks/notifications-ios-delivery-fix-plan.md`, `tasks/ios-testflight-readiness-2026-05-11.md`, and `docs/RELEASE_VERIFICATION.md`.

## Source Checks
- Normal users remain on `wisconsincreative.com`; only the reviewer plus the exact Jordan Lee Staff and Alex Rivera Student test identities route to `review.wisconsincreative.com`.
- Production demo rows were removed. Review credentials must not be submitted until the review host uses an isolated Neon target.
- Build 21 is the processed App Store Connect baseline, but it predates the current Home, profile, booking, schedule, and launch-lifecycle work. Build 22 must move the app and Live Activities build metadata together and receive fresh candidate proof.
- Kiosk remains a separate target and is outside the App Store candidate.
- Apple Guideline 2.1 requires a complete, crash-tested build plus full reviewer access, live backend services, and any sample QR or other resources needed to exercise the app.
- Apple Guideline 2.3 requires screenshots, privacy disclosures, description, age rating, and other metadata to match the submitted build and use fictional account information.
- Apple Guideline 4.2 requires adequate native utility. Wisconsin satisfies this directionally through native reservations, schedule, search, scan, notifications, and Live Activities; Review notes and screenshots must demonstrate those flows rather than presenting the app as a web companion.
- Apple Guidelines 5.1.1(i) and 5.1.1(v) require an easily accessible in-app privacy-policy link and in-app account deletion when account creation is supported. The current native source includes both surfaces; signed-candidate interaction and isolated end-to-end deletion still require acceptance proof.
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
- [x] Slice 12: Replace Build 20 with Build 21 after the post-Build-20 native changes. Build 21 was uploaded and processed on 2026-07-20, then superseded by later native work.
- [ ] Slice 13: Freeze Build 22 after the active worktree settles, repeat hardware and Live Activities crash acceptance, recapture exact-binary screenshots, and upload only with explicit authorization. A local Build 22 archive and App Store export were produced with `asc` on 2026-07-23 as packaging proof, but the dirty source state is not the final frozen candidate.

## Launch Checklist
- [ ] 1. Freeze Build 22 as the App Review candidate. Build 21 remains the processed Connect baseline. The 2026-07-23 local packaging proof used HEAD `eedb6cdef309f5487083942d94e30c54e24148b9`, archive-time tracked diff SHA-256 `28afdae5e42c02c393174b15ef24c89d4ba7bcb0ac9435cb6e33c79e12f853b5`, and untracked launch-test SHA-256 `a6086e07e694c5703b0d8863158ce899b404d0da042b6a85640c4d3ea59a93ee`. The exported IPA SHA-256 is `b9dbf50a55f49ab14eb4824be42a624678fd852d18468ce03c96ade3e31e37da`. Rebuild after the worktree is reviewed or committed if any app source changes; do not upload until explicitly authorized.
- [ ] 2. Complete real-device acceptance on the oldest supported iPhone plus current hardware. On 2026-07-17, Erik's iPhone on iOS 27.0 connected successfully; the current signed Build 21 source installed over the existing app while preserving its authenticated session, launched, loaded live data, decoded `DEMO-CAM-001` through the camera, registered with APNs, received a self-scoped test push, and returned to Home when the payload intentionally contained no route. Current-hardware camera, APNs delivery, and install/upgrade acceptance are closed. Oldest-supported-device, routed production-payload, network-recovery, and accessibility acceptance remain open.
- [ ] 3. Verify privacy, support, and account deletion in the signed candidate. On 2026-07-17, the physical Build 21-source install opened the public Wisconsin Creative privacy policy, opened a correctly addressed support Mail draft, exposed Delete Account under Account & Security, explained retention and checked-out-gear constraints, required the current password, and kept the destructive action disabled without identity confirmation. Destructive completion remains intentionally untested on the real production account; isolated-review-account end-to-end deletion and retained-audit-state proof remain open.
- [x] 4. Provide an App Review-compliant Support URL with easy contact information. `/support` is implemented with a direct contact email, privacy link, and safe-support guidance; the public URL returned HTTP 200; and the saved App Store Connect Support URL now points to `https://wisconsincreative.com/support`.
- [x] 5. Correct the unlisted distribution workflow. Submit the new app as publicly available, state the unlisted intent in Review Notes, then send Apple's separate unlisted-distribution request after the version enters App Review. Apple changes the distribution method if approved. Live App Store Connect verification on 2026-07-13 confirms Public is selected and Private is not selected.
- [ ] 6. Produce and verify final iPhone and iPad App Store screenshots. On 2026-07-23, the isolated review database was brought to 103/103 migrations, its fictional dataset was refreshed, and the demo pickup desk was aligned with Build 22's primary-location picker. All fourteen local assets were then recaptured from the Build 22 Release simulator build and visually inspected: seven opaque iPhone JPEGs at `1320 x 2868` and seven opaque iPad JPEGs at `2064 x 2752`. Local `asc` validation passed the complete `APP_IPHONE_67` and `APP_IPAD_PRO_3GEN_129` sets with no issues. The sets are locally ready, but they remain gated on the final frozen archive and App Store Connect upload confirmation.
- [x] 7. Finalize reviewer notes, demo QR codes, and the optional walkthrough video. Notes include four exact fictional lookup codes and manual-entry instructions. QR attachments are generated from the seeded values. A video is intentionally omitted unless hardware acceptance exposes a review step that text and QR attachments do not explain.
- [ ] 8. Verify live App Store Connect privacy, age rating, copyright, and legal fields. Live verification in Zen on 2026-07-13 confirms: the published privacy label exactly matches the seven reconciled data types and purposes; privacy policy is correct; age rating is 4+ in 172 countries or regions with expected regional equivalents; Business/Productivity categories, no third-party content, standard EULA, Public distribution, Build 20, manual release, and encryption declaration are consistent. On 2026-07-17, the Support URL and Build 21 Review Notes were saved, untested Apple Silicon Mac and Apple Vision Pro availability were disabled, the Account Holder submitted the Digital Services Act trader-status self-assessment, and the copyright owner was confirmed as `Wisconsin Creative`. App Accessibility claims remain intentionally unset pending hardware proof.
- [ ] 9. Submit for review, then request unlisted distribution after approval. Submission remains gated on items 2, 3, 6, and 8, plus the Account Holder's final confirmation that both seven-image device sets are uploaded in the documented order. The final Submit for Review action requires the Account Holder's action-time confirmation; the unlisted request follows Apple's approval of the reviewed version.

Build 21 remains the processed baseline in App Store Connect, but it is no longer the intended submission candidate. Build 22 must be frozen, archived, exported, inspected, accepted on hardware, matched by screenshots and metadata, and selected in App Store Connect before submission.

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
- [x] Local Build 22 signed Release archive/export metadata inspection through `asc`; upload remains pending.
- [x] Real-device camera permission, QR decoding, APNs authorization/registration/delivery, and install-over-existing-app checks on current hardware.
- [ ] Real-device routed production-payload, network recovery, maximum accessibility text, and oldest-supported-device checks.
- [x] In-app privacy-policy and support links open successfully from a signed physical Build 21-source install.
- [x] In-app account deletion is discoverable, explains consequences and retention, requires password reauthentication, and presents a protected destructive action.
- [ ] Account deletion/request completes end to end on an isolated test account and leaves the documented audit/retention state.
- [x] App Store Connect privacy answers are checked against an enumerated data-flow and SDK inventory rather than inferred only from `PrivacyInfo.xcprivacy`.
- [ ] Final screenshot/metadata review uses only fictional identities and matches the exact submitted build.

## Review
- Shipped: Created the separate Neon project `gear-tracker-app-review` (`rough-truth-81998555`) with primary branch `main` (`br-broad-mouse-aid7tu0s`) and database `neondb`. Hardened the review seed so seeding requires an explicit 16+ character password and exact expected database host; removed password logging and the committed reviewer password from submission notes. On 2026-07-17, extended the future demo event to 30 days and the upcoming reservation to 21 days so App Review does not age out after a short queue delay.
- Verified: Focused seed/routing tests pass, the seed script parses, and a guarded seed attempt without a password refuses before connecting. On 2026-07-23, the isolated database reached 103/103 migration health, the guarded fictional seed completed, authenticated Build 22 iPhone and iPad Release simulator smoke showed current fictional checkout, reservation, user, item, search, schedule, and shift data, and all fourteen opaque screenshot assets passed visual, dimension, and local `asc` validation. The current Build 21 source also built, signed, installed, and launched on Erik's physical iPhone; preserved the existing authenticated session; loaded production data; decoded a camera-scanned QR value; registered for and received APNs; opened the privacy and support destinations; and exposed the protected in-app deletion flow without executing it. On 2026-07-12, Build 20 passed project drift, iOS drift, 49/49 audit coverage, 17 focused launch tests, simulator build, signed Release archive, App Store export, TypeScript, the complete `build:app` gate, codemap/docs, migration-prefix, and whitespace gates. Xcode uploaded the exact Build 20 archive successfully and App Store Connect accepted it for processing. The privacy slice has a source-grounded data/SDK inventory, a reconciled native manifest and App Store Connect table, an updated public policy, plist validation, and a regression contract for declared versus unsupported native data categories.
- Deferred: Final App Store metadata, screenshot ordering/upload confirmation, and hardware acceptance remain separate launch slices.
- Blocked: Oldest-supported-device, routed production-payload, unstable-network, maximum accessibility text, isolated end-to-end deletion, and final frozen-binary screenshot confirmation remain open. Current-hardware APNs delivery, camera/scanner, install/upgrade, privacy/support, protected deletion UI, DSA declaration, copyright owner, review deployment/data isolation, reviewer metadata, local screenshot generation, and untested Mac/Vision availability are closed.
- Proof artifacts: `/private/tmp/Wisconsin-20.xcarchive`; `/private/tmp/Wisconsin-20-export/Wisconsin Creative.ipa`; SHA-256 `c8ab32f8b593812b7f9dece98ce46502ea158ed37d494b7092411141655a29f1`; Xcode upload completed successfully at 2026-07-12 07:33 America/Chicago and Apple reported the package is processing.
- Next slice or stop: complete the remaining real-device recovery and Live Activities crash checks, freeze Build 22 from a reviewed source state, and recapture screenshots from that exact archive. Do not upload Build 22 or submit for review without explicit authorization.
