# Plan 062: Add a read-only Wisconsin Creative menu bar monitor

> **Executor instructions**: Keep custody and health semantics aligned with the existing web read models. Do not add mutations, copy credentials into source, deploy, or treat build success as authenticated runtime proof.
>
> **Drift check (run first)**: `git diff --stat 32134418..HEAD -- src/app/api/dashboard/stats/route.ts src/app/api/kiosk-devices/route.ts src/lib/services/dashboard-counts.ts src/app/\(app\)/settings/kiosk-devices/page.tsx ios/Wisconsin/Core/APIClient.swift ios/Wisconsin/Models/DashboardModels.swift`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: native macOS operations
- **Planned at**: commit `32134418`, 2026-08-08
- **Execution**: IMPLEMENTED LOCALLY; no-wake companion transport added, production deployment and APNs delivery proof pending

## Why this matters

Staff currently open the web control room to answer two frequent questions: how much gear is in physical custody, and whether the supporting kiosk fleet is healthy. A compact menu bar monitor can surface those answers without creating another mutation surface or weakening the kiosk-owned custody boundary.

## Product contract

- The menu bar count is `CHECKOUT + OPEN`: physical custody only.
- The popover leads with every `OPEN` checkout, conditionally adds a compact waiting-for-pickup lane when work exists, then shows system health. It does not summarize bookings into metric cards.
- Open checkout rows reuse the native iOS Bookings hierarchy and are ordered by due-back time.
- Booking and pickup rows show the requester's profile image when available, with initials retained during loading, on failure, or when no image is set.
- Waiting-for-pickup follows the existing operational rule: staged checkouts plus booked reservations whose start time has arrived. The lane stays hidden when empty.
- Overdue, due today, pending pickup, and booked reservations remain separate values.
- Companion refresh success proves the external projection responded. It does not prove Neon is awake or every subsystem is healthy.
- Projection failures must remain visible and must not overwrite the last trustworthy snapshot with fallback zeroes.
- Kiosk health matches the web contract: online within five minutes, stale within 24 hours, offline after 24 hours or before the first heartbeat.
- Companion data shows elapsed projection freshness without treating quiet time as a health failure. Healthy kiosk rows show location-scoped pending-pickup and open-checkout workload; unhealthy rows retain last-heartbeat diagnostics.
- A permission-denied kiosk read is `Restricted`, not a kiosk outage.
- The app is read-only. All detailed work deep-links to the existing web control room.
- The user-facing app name is Wisconsin Creative and its app identity reuses `ios/Wisconsin/AppIcons/AppIcon.icon`; GearOps remains the internal module, project, and bundle identifier.
- The menu bar uses a compact package SF Symbol; the repository app icon appears in the popover and system-owned app surfaces. The `Sim iPad` development record is excluded from macOS health counts, severity, and rows without changing the server record.
- Booking changes arrive through silent APNs invalidation and an Upstash-backed projection fetch. Local alerts are passive and silent, establish a no-alert baseline on enrollment, and deep-link to the affected booking.
- Automatic launch, restore, refresh, and push handling must never call a Neon-backed route. Explicit password enrollment may wake Neon because the user initiated it.

## Scope

**In scope**:

- A separate XcodeGen macOS project under `macos/`
- SwiftUI `MenuBarExtra` with window-style content and no Dock icon
- Native password enrollment that returns a revocable companion credential and initial projection
- Local-only restoration through Keychain and the last trusted cache
- External projection stats, kiosk fleet health, and freshness
- Every visible `OPEN` checkout in one bounded projection
- Manual Upstash-only refresh plus silent APNs invalidation, with no timer or polling loop
- Projection snapshot comparison plus native local alerts for reservation, pickup-ready, checkout, check-in, cancellation, extension, time, and generic booking updates
- Deep links to Dashboard, active Checkouts, and Kiosk Devices
- Unit tests for decoding, custody semantics, health thresholds, permission handling, and stale-data preservation
- Source-contract tests that pin the macOS target and route usage
- Dashboard area documentation and task/plan lifecycle updates

**Out of scope**:

- Checkout, reservation, kiosk, Schedule, database, or deployment mutations
- A database-backed companion read route
- Frequent database diagnostics polling
- Background agents, launch-at-login, or auto-update infrastructure
- Passkey runtime support until the macOS bundle identifier is added to the production webcredentials association and signed-device proof is available
- App distribution, notarization, production deployment, commit, or push

## Architecture

1. Explicit password enrollment authenticates against Neon once, builds the initial projection while compute is already awake, and returns a signed 90-day companion credential stored in Keychain.
2. Successful booking, custody, kiosk, and avatar mutations rebuild the bounded projection after commit, write it to Upstash, and send a silent APNs invalidation. A committed kiosk last-seen touch publishes in the same deferred chain.
3. Companion projection and device-registration routes authenticate from a signed credential plus an Upstash allowlist. They do not import the database or use the normal database-backed session middleware.
4. `GearOpsModel` restores only local cache and Keychain state. APNs and manual refresh fetch only the external projection, retain trusted data on failure, and never fall through to Neon-backed routes.
5. Pure health helpers classify kiosk heartbeat and aggregate menu bar severity so tests do not need SwiftUI or networking.
6. `BookingChangeDetector` maps projection snapshots to operational alert copy. `BookingNotificationCenter` schedules passive notifications with no sound and opens the affected booking when clicked.

## Steps

1. Scaffold the separate native macOS project and test target.
   - **Verify**: XcodeGen creates the project and the empty target builds without changing `ios/Wisconsin.xcodeproj`.
2. Implement response models, explicit enrollment, local-only session restoration, and external refresh state.
   - **Verify**: focused tests decode current server envelopes and prove a failed refresh cannot replace trusted counts.
3. Implement the menu bar label and window content.
   - **Verify**: signed-out, loading, healthy, partial, restricted, stale, and failed states compile and have accessibility labels.
4. Add exact kiosk health classification and web deep links.
   - **Verify**: tests pin five-minute and 24-hour boundaries and no mutation route appears in the macOS source.
5. Add silent APNs invalidation and projection-based booking notifications with a quiet baseline and no custody mutation surface.
   - **Verify**: tests prove the baseline emits nothing and later status or due-time changes produce the expected passive alert copy.
6. Run the focused tests, source contracts, macOS build, docs gate, and whitespace checks; update this plan with exact proof and remaining runtime gaps.

## Verification

| Purpose | Command | Expected on success |
|---|---|---|
| Generate project | `cd macos && xcodegen generate` | `GearOps.xcodeproj` generated |
| macOS tests | `xcodebuild -project macos/GearOps.xcodeproj -scheme GearOps -destination 'platform=macOS' test` | tests pass |
| macOS build | `xcodebuild -project macos/GearOps.xcodeproj -scheme GearOps -destination 'platform=macOS' build` | build succeeds |
| Source contracts | `npx vitest run tests/macos-gearops-source.test.ts` | focused contracts pass |
| Docs | `npm run verify:docs` | codemap check passes |
| Whitespace | `git diff --check` | exit 0 |

## Done criteria

- [x] Menu bar label shows the last trustworthy physical-custody checkout count.
- [x] Signed-out users can explicitly enroll the companion without storing a password.
- [x] Automatic launch, restore, APNs handling, and manual refresh use only external-cache routes.
- [x] Projection failures stay visible without zeroing trusted counts.
- [x] Permission-denied kiosk health is represented as restricted.
- [x] macOS unit tests, source contracts, build, docs, and whitespace gates pass.
- [x] Authenticated runtime proof is either completed against an isolated target or retained as an explicit gap.

## Execution result

- Added the independent `macos/GearOps.xcodeproj` XcodeGen project without changing the iOS project.
- Implemented a native window-style menu bar surface, explicit password enrollment, Keychain credential restoration, APNs-triggered Upstash refresh, cache-only startup, manual external refresh, and web deep links.
- Added pure heartbeat classification and a main-actor state model that preserves trusted counts across partial or failed refreshes.
- Added 20 Swift tests, thirteen repository source-contract tests, and three projection tests.
- Replaced the initial metric-card concept with a due-sorted, fully paginated list of `OPEN` checkout rows modeled on the native iOS Bookings tab, followed by one health section.
- Made the popover size to short content up to a 500-point scrolling cap, moved aggregate severity into System Health, added tested kiosk fleet counts and last-seen-first diagnostics, and used interactive Liquid Glass booking rows on macOS 26 with the prior custom-material fallback.
- Added passive, soundless native booking notifications backed by silent APNs invalidation and the external projection. The baseline is quiet; later reservations, pickup-ready changes, checkouts, check-ins, cancellations, extensions, time changes, and generic updates are classified from booking snapshots.
- Added a conditional waiting-for-pickup lane, compact projection freshness, and location-scoped workload counts on healthy kiosk rows.
- Added requester profile images to open-booking and waiting-pickup rows with a native asynchronous loader and initials fallback.
- Performance hardening downsamples profile photos off the main actor to their rendered pixel size, bounds decoded and URL caches, sorts pickup activity only when data changes, and persists each accepted projection once. The former 60-second database polling loop is removed.
- The signed Debug app launched as a background-only `LSUIElement` process and restored its authenticated session. Visual inspection confirmed two bookings first, System Health second, a neutral header, Critical health next to that section, `0 online · 2 stale · 1 offline`, last-seen-first kiosk rows, and no large footer dead zone.
- macOS granted GearOps alert authorization at runtime. No real booking was mutated to manufacture a delivery event, so actual Notification Center presentation remains event-dependent rather than visually forced.
- The no-wake slice passes the production-shaped Next.js build, 20 focused web contracts, all 20 macOS unit tests, generated codemap check, ESLint, and whitespace validation. The full repository suite passes 2,999 of 3,002 tests; three unrelated pre-existing assertions remain in App Store submission copy, the retired iOS forgot-password URL contract, and sport-config default count.
- Unsigned macOS compilation and tests pass. A push-capable signed build is blocked because this Mac has no Apple developer account configured and no `com.erikrole.GearOps` Mac App Development profile. Production deployment and real APNs invalidation delivery were not attempted.

## STOP conditions

- Existing routes cannot supply the data without weakening permissions.
- The app would need a production-only credential, copied session cookie, or committed secret.
- Correctness would require changing custody lifecycle or deriving checkout state independently on macOS.
- The macOS target would require modifying or regenerating the existing iOS project.
