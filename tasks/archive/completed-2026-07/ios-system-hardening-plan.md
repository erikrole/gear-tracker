# iOS System Hardening Plan - 2026-07-28

## Goal

- Audit the full native Wisconsin and WisconsinKiosk system for evidenced
  correctness, security, privacy, accessibility, recovery, and maintainability
  defects.
- Fix the highest-confidence findings that can be isolated from the active
  reservation-drafts and blast-notifications work.
- Leave device-only, production-authenticated, and product-decision risks
  explicit instead of treating source gates as runtime proof.

## Route

- Owner area: Mobile (`docs/AREA_MOBILE.md`)
- Secondary areas: Reservations, Users, Schedule, Kiosk, Notifications, and
  Security
- Ledger: this plan plus the relevant existing `tasks/audit-*-ios.md` record
  when a finding changes an established audit verdict
- Existing references:
  - `tasks/audit-ios-apple-design-full.md`
  - `tasks/audit-all-pages-ios.md`
  - `tasks/audit-swiftui-performance-ios.md`
  - `docs/GAPS_AND_RISKS.md`

## Source Checks

- Current checkout is `feature/blast-notifications` with active user-owned
  reservation-draft, notification, API, test, and documentation changes.
- Baseline `ios:project:check`, `drift:ios`, and `audit:ios:gaps` pass.
- Native app traffic uses the shared canonical host and cookie-backed user
  sessions; kiosk traffic uses a separate device session mirrored into the
  Keychain.
- D-040 keeps normal custody mutations kiosk-only. D-041 requires collaborator
  access to fail closed. D-042 keeps current native Schedule reads on published
  relational data while GAP-60 tracks migration of staff writes to the working
  copy.

## Stop Conditions

- Stop a fix if it would overwrite or semantically rewrite the active
  reservation-drafts or blast-notifications work without a safe isolated edit.
- Stop if a proposed client fix weakens server authorization, kiosk-only
  custody, location scope, audit attribution, or rollout-tolerant decoding.
- Stop if a finding depends on a product decision rather than an established
  contract; record the decision need instead of choosing policy in code.
- Do not call hardware scanner, camera, APNs, VoiceOver, or performance behavior
  verified without matching runtime evidence.
- Do not run deploy-shaped builds, production mutations, uploads, commits, or
  pushes in this pass.

## Slices

- [x] Slice 1: Reconcile current inventory, prior audit findings, target
  membership, entitlements, privacy declarations, and baseline gates.
- [x] Slice 2: Audit auth, session and token storage, transport, URL handling,
  push exposure, logs, local persistence, kiosk identity, and server permission
  boundaries.
- [x] Slice 3: Audit Swift concurrency, request ownership, cancellation,
  duplicate mutations, stale state, Codable rollout skew, offline/session
  recovery, and interruption paths.
- [x] Slice 4: Audit SwiftUI accessibility, Dynamic Type, Reduce Motion,
  loading/empty/error states, view identity, and high-confidence performance
  or maintainability regressions.
- [x] Slice 5: Implement isolated P0/P1 fixes and bounded P2 fixes with focused
  regressions.
- [x] Slice 6: Sync affected audit/area/risk records and complete native,
  source-contract, docs, and whitespace verification.

## Verification

- [x] Focused Vitest source-contract suites for every changed native/API
  contract
- [x] Full Vitest suite: 436 files and 2,771 tests
- [x] Relevant native XCTest suites: 34 main and 6 kiosk tests
- [x] `npm run ios:project:check`
- [x] `npm run drift:ios`
- [x] `npm run audit:ios:gaps`
- [x] `npx tsc --noEmit --pretty false` when shared API or TypeScript contracts
  change
- [x] `npm run lint`
- [x] `npm run build:app` when shared API or TypeScript contracts change
- [x] XcodeBuildMCP main-target XCTest, simulator build, and launch
- [x] XcodeBuildMCP kiosk-target XCTest, simulator build, and launch
- [x] `npm run codemap` before docs verification when codemap-owned source moves
- [x] `npm run verify:docs` when docs or shared ownership records change
- [x] `git diff --check`
- [x] Final diff and dirty-worktree ownership review
- [x] Runtime proof for touched user-facing flows when a safe authenticated
  simulator session is available, or an exact blocker

## Review

- Shipped: Current worktree implementation only. No commit, push, deployment,
  upload, or App Store submission was performed.
- Verified: Full web and source-contract suite, TypeScript, lint, deploy-safe
  production build, XcodeGen parity, Swift drift and audit inventory, both
  privacy manifests, both XCTest suites, and build plus launch of both
  simulator targets.
- Deferred: Physical APNs and Live Activity delivery, HID scanner and camera,
  Keychain reinstall behavior, clipboard expiry across devices, snapshot
  timing, VoiceOver, maximum Dynamic Type, Reduce Motion, and Instruments,
  ETTrace, or memgraph measurement. A current production-dependency advisory
  lookup also remains because the managed environment blocked sending the
  dependency inventory to the public npm registry.
- Blocked: Authenticated simulator walkthroughs require a safe disposable
  signed-in account that was not available in this pass.
- Proof artifacts: `tasks/audit-ios-system-hardening.md` contains the findings,
  exact gates, native log paths, external-source authority, and residual risk.
- Next slice or stop: Stop source work. Run the documented physical-device and
  authenticated acceptance matrix before release.
