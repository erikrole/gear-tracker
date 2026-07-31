# iOS System Hardening Audit - 2026-07-28

## Verdict

The native `Wisconsin` and `WisconsinKiosk` targets remain buildable, and the
repository inventory still accounts for every audit-worthy Swift surface.
This pass found and fixed several real cross-system defects in draft
persistence, request ownership, authentication lifecycle, local privacy, kiosk
credential handling, and accessibility. It did not produce physical-device or
production delivery proof.

## Scope

- All 82 Swift files inspected by `scripts/ios-drift-check.sh`
- All 52 audit-worthy surfaces registered by
  `scripts/ios-audit-inventory.sh`
- Main app and kiosk target membership, entitlements, privacy manifests, and
  simulator builds
- Authenticated session, APNs, Live Activity, SwiftData, UserDefaults,
  Keychain, clipboard, image-cache, URL-host, and app-snapshot boundaries
- Reservation composition, Schedule, Guides, global search, App Intents, and
  kiosk identity, student, scanner, sleep, and cold-launch flows
- Server device-token, Live Activity, and user-deactivation selectors
- Existing source-contract and native unit coverage

## Fixed Findings

| Severity | Finding | Resolution |
|---|---|---|
| P0 | A slow reservation-draft save baselined the live composer rather than the immutable payload sent to the server. Edits made during the request could be marked saved and lost after a task kill. | Draft saves capture an immutable snapshot, baseline only that snapshot, and retain later edits as unsaved. Concurrent saves join one request, and submit waits for an owned save before consuming `sourceDraftId`. Native tests exercise both races. |
| P0 | A lost reservation-create response could make a retry bind a changed composer payload to the original `sourceDraftId`. If the first request had committed, replay returned the original reservation and the client could clear newer work. | An indeterminate submission now owns one immutable payload and source draft ID across network, decoding, session-boundary, non-HTTP, and HTTP 5xx retries. HTTP 4xx failures are definite and permit a corrected payload. When replay confirms the original reservation after later edits, those edits are saved as a fresh draft and the composer stays open. |
| P1 | Schedule filter reloads, availability hints, kiosk context loads, and kiosk scans could publish stale responses after a newer request or navigation took ownership. | Added generation ownership, cancel-replace behavior, child-task cancellation, and post-await screen, scanner, session, and composer ownership checks. |
| P1 | An older account's successful response or 401 could publish into or sign out a replacement account. | Every authenticated request captures an `AuthSessionBoundary`; obsolete success and 401 responses are rejected, identity replacement advances the boundary, and account-scoped UI, routes, observers, caches, and refresh generations reset together. |
| P1 | Delayed APNs registration, permission, foreground-presentation, or tap callbacks could restore previous-user state after sign-out. | Registration and callback publication require the initiating authenticated identity and session boundary. Sign-out queues server revocation before cookie logout, unregisters APNs, and clears token, badge, delivered, pending, search, image-cache, and route state. |
| P1 | User deactivation and password reset left device or Live Activity start credentials usable, while several notification selectors could still include inactive users. | Serializable account cleanup now revokes device and start tokens, invalidates sessions and reset tokens, preserves active activity tokens as a durable end queue, and writes cleanup audit evidence atomically. Forgot/reset-password and schedule, email, blast, and notification selectors fail closed for inactive users. |
| P1 | A remote Live Activity start accepted by APNs could be persisted after its user, booking, or start token became ineligible. | A final serializable post-APNs eligibility read requires an active requester, an open booking with the same end time, and a still-owned unrevoked token before persistence. Retryable end delivery remains durable. |
| P1 | Kiosk requests could publish a successful response or obsolete 401 after activation or deactivation replaced the credential. | Kiosk requests capture a credential generation, recheck it after decoding, and ignore stale unauthorized responses. Activation and deactivation advance the generation, and `KioskStore` rechecks before state mutation. |
| P1 | Private App Intents could expose checkout, shift, or booking data without requiring local device authentication. | All three private intents now use `requiresLocalDeviceAuthentication`. |
| P1 | Shared kiosk UI referenced main-target-only `APIError` cases, breaking the standalone `WisconsinKiosk` target during the final build gate. | Shared error presentation now specializes only common cases and uses the target's own localized description for the remainder. Both target suites compile, test, and launch. |
| P1 | Kiosk credentials used a migratory Keychain class. | Kiosk tokens now use `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`; loading re-saves older credentials into the device-only class. D-039 is synchronized. |
| P1 | A corrupt persistent SwiftData cache could terminate the app at launch through `try!`. | Launch now records a fault and falls back to an in-memory cache for that process. |
| P1 | The kiosk target had no first-party privacy manifest, and the main manifest omitted native photo/video and user-content collection. | Both targets now package source-grounded manifests with required-reason UserDefaults declarations and linked app-functionality data categories. |
| P2 | Authenticated content could remain visible in app-switcher snapshots, and account-scoped data could survive locally after the user left the session. | A window-level privacy shield covers sheets and overlays. Sign-out and identity replacement clear local notification state, search recents, downsampled thumbnails, routes, badges, and app state. |
| P2 | A tampered persisted API host was trusted and force-unwrapped into the request base URL. | Stored hosts are validated against the canonical and App Review allowlist on every read and write, with canonical fallback. |
| P2 | Device and Live Activity registration accepted weakly validated, unbounded, or excessive APNs credentials. | Routes now require bounded even-length hexadecimal tokens, strict request bodies, actor rate limits, active-user rechecks, and per-user, per-device, and per-booking cardinality caps. Device revoke-all remains available only through an actually empty body. |
| P2 | APNs, Resend, cron, blast, and cleanup work could hold serverless functions too long or grow fan-out without a fixed bound. | APNs has a 7.5-second dispatch deadline, two-second stream deadlines, retry budget checks, 250-stream batches, and four-way concurrency. Email has a four-second abort. Cron starts, overdue work, end retries, blast recipients, target resolution, and hidden-user cleanup are bounded; changed database work is set-based where practical. |
| P2 | Claiming a license automatically copied its code indefinitely to the shared pasteboard. | Claim no longer copies. The explicit Copy Code action expires after two minutes. |
| P2 | Live Activity and “What’s Out” pagination included pending pickups before filtering for open custody. | Both callers now request `OPEN` checkouts at the API boundary so the bounded window cannot be crowded by non-custody rows. |
| P2 | Dense reservation and search rows decoded original images, while guide blocks rebuilt with unstable identities and repeated parsing. | The dense rows now use the shared downsampled thumbnail cache. Guide blocks have deterministic identity and one block parse. |
| P2 | Kiosk roster and sleep controls had incomplete recovery, scanner ownership, accessibility, Release-mode, and Reduce Motion behavior. | Kiosk roster states and request ownership are explicit, Release debug chrome is noninteractive, scanner input has one logical owner, and sleep mode has one accessible full-screen wake action with reduced motion respected. |
| P2 | Kiosk startup validated twice, device-model decoding used a deprecated initializer, and timer ticks wrote unchanged visible state. | `KioskShellView` owns resume, hardware decoding uses bounded UTF-8 bytes, and visible-state assignments are guarded. |

## Open Risks and External Proof

- `UIRequiresFullScreen` remains required by the current landscape-only,
  counter-mounted kiosk contract. Xcode 26 warns that Apple will ignore it in a
  future release. The migration is tracked in `docs/GAPS_AND_RISKS.md`.
- APNs receipt, Live Activity remote start/update/end, notification removal,
  Keychain reinstall retention, HID scanner behavior, camera fallback,
  Universal Clipboard expiry, background snapshot timing, VoiceOver, maximum
  Dynamic Type, and Reduce Motion need physical-device proof.
- Authenticated simulator walkthroughs for draft interruption, Schedule filter
  replacement, profile cache clearing, and kiosk identity routing were not run
  because no safe disposable signed-in session was available.
- Privacy manifests are source artifacts. App Store Connect privacy answers
  still require a deliberate metadata reconciliation before the next
  submission.
- The production dependency advisory lookup was not completed. The managed
  environment blocked `npm audit --omit=dev --audit-level=high` because it
  would send the project's dependency metadata to the public npm registry.
  Source, type, lint, test, and production-build gates do not replace a current
  advisory-database result.
- The Live Activity attributes schema still carries requester name, initials,
  and avatar URL for compatibility even though the current widget does not
  render them. Removing those fields requires a versioned compatibility plan
  for activities started by older app builds.
- A narrow APNs concurrency window remains: Apple may accept a remote-start
  push just before deactivation wins the final eligibility transaction. The
  transaction prevents database resurrection and known activity tokens remain
  durably endable. An activity whose token never registers with the server
  cannot be addressed remotely.
- Instruments, ETTrace, and memgraph were not run. The pass fixed evidenced
  source-level performance problems but does not claim runtime energy, frame,
  or allocation proof. Kiosk image paths outside the main thumbnail pipeline
  and synchronous guide attributed-string construction remain measurement
  candidates rather than confirmed defects.

## Verification Record

- Full Vitest suite: 436 files and 2,771 tests passed
- Native XCTest: `Wisconsin` 34 passed; `WisconsinKiosk` 6 passed; 0 failed
- Main `Wisconsin` simulator build and launch: passed, 0 warnings or errors
- `WisconsinKiosk` simulator build and launch: passed; only the tracked
  `UIRequiresFullScreen` deprecation warning remains
- `npm run ios:project:check`: passed
- `npm run drift:ios`: passed across 82 Swift files
- `npm run audit:ios:gaps`: 52 of 52 covered, 0 gaps
- `npx tsc --noEmit --pretty false`: passed
- `npm run lint`: passed
- `npm run build:app`: passed
- `npm run codemap` and `npm run verify:docs`: passed
- `git diff --check`: passed
- Privacy plist lint: passed for both targets
- Independent server-route performance review: 22 changed API and service
  files inspected, 0 remaining concrete Vercel or Neon findings
- `npm audit --omit=dev --audit-level=high`: blocked before registry access by
  the managed environment's external-metadata policy
- Authenticated browser and physical-device proof: not available in this pass
- Commit, push, deployment, upload, and App Store submission: not performed

### Native Proof Artifacts

- Main XCTest:
  `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/test_sim_2026-07-29T06-34-28-171Z_pid5872_415a897d.log`
- Main build and launch:
  `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/build_run_sim_2026-07-29T06-34-54-478Z_pid5872_4b8a2918.log`
- Kiosk XCTest:
  `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/test_sim_2026-07-29T06-35-45-551Z_pid5872_27a5971a.log`
- Kiosk build and launch:
  `/Users/erole/Library/Developer/XcodeBuildMCP/workspaces/gear-tracker-ff0dd6451482/logs/build_run_sim_2026-07-29T06-36-12-654Z_pid5872_a4201e68.log`

## Source Authority

- `AGENTS.md`
- `docs/NORTH_STAR.md`
- `docs/DECISIONS.md`
- `docs/AREA_MOBILE.md`
- `docs/AREA_KIOSK.md`
- `docs/AREA_NOTIFICATIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `docs/IOS_XCODE_WORKFLOW.md`
- `tasks/audit-ios-apple-design-full.md`
- `tasks/audit-all-pages-ios.md`
- `tasks/audit-swiftui-performance-ios.md`
- [Apple App Intent authentication
  policy](https://developer.apple.com/documentation/appintents/appintent/authenticationpolicy)
- [Apple remote-notification
  unregistration](https://developer.apple.com/documentation/uikit/uiapplication/unregisterforremotenotifications%28%29)
- [Apple privacy manifest
  files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files)
- [Apple device-only Keychain
  accessibility](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly)
- [Apple TN3192 on the deprecated full-screen
  requirement](https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key)
- Current Swift, TypeScript, Prisma, XcodeGen, test, and simulator build output
