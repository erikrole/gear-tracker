# Audit: SwiftUI Performance Across Wisconsin iOS

**Date:** 2026-07-23  
**Status:** SOURCE REMEDIATION COMPLETE; INSTRUMENTS BASELINE PENDING  
**Verdict:** SOURCE READY; physical-device performance metrics required before closing  
**Scope:** Main Wisconsin app, shared native components, profile onboarding, and WisconsinKiosk SwiftUI surfaces  
**Audit type:** Code-first performance review. Findings are source-backed unless explicitly marked trace-backed.

## Goal

Keep the highest-frequency native workflows responsive under realistic production data and image loads:

1. Home action queue
2. Items and user-directory scrolling
3. Reservation equipment selection
4. Schedule list and calendar
5. Trade Board
6. Kiosk roster, checkout, pickup, and return
7. Profile photo selection and crop

This audit does not change product behavior, custody boundaries, API contracts, or visual design.

## Launch Warning Follow-Up

### PERF-IOS-07: Initial foreground refresh supersedes session validation

**Severity:** P1
**Confidence:** High for request ownership and observation invalidation; rendering-warning causality requires the post-fix device trace
**Category:** Broad observation invalidation, duplicate launch work, unstable framework render timing

The optimistic launch path started `/me` in `SessionStore`, rendered `AppTabView`, then started a second `/me` when the initial scene became active. The second request invalidated the first request token, producing `launch.session.optimistic result=unknown`. Both successful paths republished `CurrentUser` even when its value was unchanged, invalidating the capability-driven native tab hierarchy while iOS 26 rendered its glass tab bar.

The supplied device log also contained one `glassEffect() tried to update multiple times per frame` warning and five full-device-width `1206x0 image slot` failures. Those warnings are correlated with the launch invalidation window but are not attributed to a specific SwiftUI view without Instruments evidence. PointerUI's repeated `cannot add handler to 0 from 0` messages remain framework noise unless a trace connects them to visible Wisconsin behavior.

Remediation:

1. Track initial session validation independently from the optimistic routing hint.
2. Let `SessionStore` reject foreground refresh while initial validation is in flight.
3. Publish a decoded `CurrentUser` only when its `Equatable` value changed.
4. Own foreground lifecycle work at `WisconsinApp`, not inside the tab shell.
5. Start badge and Live Activity refreshes after Home publishes its dashboard payload.
6. Preserve the native tab structure and Liquid Glass controls until trace evidence identifies a control-level problem.

Source validation:

- `SessionStore` now logs `authenticated`, `unauthorized`, `offline`, `offline-optimistic`, or `superseded`; it cannot log `unknown`.
- `AppTabView` no longer observes scene phase or starts session refreshes.
- `WisconsinApp` skips noncritical initial foreground work while validation is active.
- Home starts badge and Live Activity refreshes from an unstructured task after dashboard success.
- Native tab values, capability gates, pinned Search placement, and safe-area inset behavior are unchanged.

Runtime validation still required:

- Five Release cold launches and five foreground cycles on Erik's iPhone.
- SwiftUI Instruments plus Time Profiler capture under the same network conditions.
- Confirm one `/me`, zero glass update warnings, zero zero-height image-slot failures, and no tab/navigation regression.

## Inventory

- 114 Swift source files under `ios/Wisconsin`
- 312 SwiftUI `View` structs
- 22 Observation or `ObservableObject` declarations
- 153 `ForEach` call sites
- 8 `GeometryReader` call sites
- 37 explicit `.animation` call sites
- 5 ImageIO or `UIGraphicsImageRenderer` transformation sites

Commands:

```sh
rg --files ios/Wisconsin | rg '\.swift$'
rg -n '^((private|fileprivate|internal|public) )?struct .*: View' ios/Wisconsin --glob '*.swift'
rg -n '@Observable|ObservableObject|ForEach\(|GeometryReader|\.animation\(' ios/Wisconsin --glob '*.swift'
rg -n 'CGImageSourceCreateThumbnailAtIndex|UIGraphicsImageRenderer' ios/Wisconsin --glob '*.swift'
```

## Marked Findings

### PERF-IOS-01: Image transformation can inherit the main actor

**Severity:** P1  
**Confidence:** High for actor placement; runtime impact not yet measured  
**Category:** Main-thread work, image pressure, scrolling hitches

`CachedThumbnail` starts its load from a SwiftUI view task and performs synchronous ImageIO downsampling after the network await. The unstructured task inherits the surrounding actor context, so cache misses can decode thumbnails on the main actor. The shared component feeds both item thumbnails and user avatars, making the cost repeat across list scrolling.

The same pattern exists in profile onboarding: selected photo data is synchronously downsampled after `PhotosPickerItem.loadTransferable`. Profile crop also normalizes, crops, renders a 1024-point image, and JPEG-encodes it synchronously before starting the upload task.

Evidence:

- `ios/Wisconsin/Core/ThumbnailLoader.swift:84-109`
- `ios/Wisconsin/Views/ItemsView.swift:800-819`
- `ios/Wisconsin/Views/Components/UserAvatarView.swift:13-28`
- `ios/Wisconsin/Views/Welcome/ProfileCompletionWelcomeView.swift:347-374`
- `ios/Wisconsin/Views/Welcome/ProfilePhotoCropView.swift:204-249`

Remediation:

1. Move download-adjacent ImageIO decode/downsample work into a non-main-actor image worker.
2. Keep UI state publication on `MainActor`.
3. Move profile normalization, crop rendering, and JPEG encoding out of the synchronous button action.
4. Preserve the existing URL cache, decoded-image cost limit, downsampling size, cancellation, and image-quality contracts.

Validation:

- Release build on a physical device.
- Cold-cache Items scroll and Users scroll in the SwiftUI Instruments template.
- Profile-photo selection and Save capture in Time Profiler and Hangs.
- Record Long View Body Updates, Hitches, main-thread samples, and memory peak.

Estimated effort: small to medium.

### PERF-IOS-02: Schedule rebuilds the same derived event graph during view updates

**Severity:** P2  
**Confidence:** High for repeated work; runtime impact depends on production event volume  
**Category:** Derived work in render paths

Schedule expands multi-day events, groups them by day, sorts every group, then filters those groups for shift, venue, and sport state. List mode reads `displayedGroups` for both the empty-state decision and list construction. Calendar mode separately reconstructs `eventsByDay`, then filters each visible day and derives dot information during grid construction.

Evidence:

- `ios/Wisconsin/Views/ScheduleView.swift:54-83`
- `ios/Wisconsin/Views/ScheduleView.swift:857-872`
- `ios/Wisconsin/Views/ScheduleView.swift:892-894`
- `ios/Wisconsin/Views/ScheduleView.swift:1206-1223`
- `ios/Wisconsin/Views/ScheduleView.swift:1737-1773`
- `ios/Wisconsin/Views/ScheduleView.swift:1900-1914`

Remediation:

1. Derive one schedule snapshot when events, `includePast`, or active filters change.
2. Reuse that snapshot for empty state, counts, list sections, calendar buckets, and selected-day rows.
3. Retain domain IDs and current chronological ordering.
4. Avoid adding `@State` as an ad hoc cache; make update ownership explicit in the model or a value-semantic derivation helper.

Validation:

- Profile list scrolling, filter changes, list/calendar switching, and month changes with production-scale event data.
- Compare `ScheduleView`, `ScheduleCalendarView`, and `EventRow` update counts before and after.

Estimated effort: medium.

### PERF-IOS-03: Bookings and event detail repeat smaller sort/group derivations

**Severity:** P2  
**Confidence:** High for repeated work; likely low impact at current page sizes  
**Category:** Derived work in render paths

Bookings sorts the same collection for section count and row iteration. Event detail rebuilds and sorts shift groups whenever `shiftsByArea` is read. These are smaller than Schedule and reservation creation, but they are straightforward cleanup once the shared derived-state pattern is established.

Evidence:

- `ios/Wisconsin/Views/BookingsView.swift:48-52`
- `ios/Wisconsin/Views/BookingsView.swift:307-310`
- `ios/Wisconsin/Views/EventDetailSheet.swift:36-51`

Remediation:

1. Compute a single sorted booking value for each render or update it when the page changes.
2. Derive event shift sections once when `shiftGroup` changes.
3. Preserve stable booking, event, and shift IDs.

Validation:

- Confirm row order and pagination behavior with source-contract tests.
- Inspect SwiftUI update duration on Bookings and Event Detail.

Estimated effort: small.

### PERF-IOS-04: Reservation creation repeatedly traverses up to 300 equipment rows

**Severity:** P1  
**Confidence:** High for repeated work; runtime severity needs a trace  
**Category:** Observation fan-out, filtering, grouping, sorting

`CreateBookingViewModel` exposes many computed collections derived from the same observable equipment inputs. `selectedEvents` is read repeatedly, while equipment rendering independently reads `displayedAssetGroups`, `displayedBulkSkus`, `displayedCategoryResults`, `selectedAssets`, `selectedBulkSkus`, location-mismatch counts, and battery recommendations. The picker accepts up to 300 serialized assets, so a search keystroke, selection, quantity change, conflict result, or recommendation acknowledgement can trigger several full traversals and sorts.

The view also evaluates the same computed collections in visibility checks and again in `ForEach`.

Evidence:

- `ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift:50-92`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift:118-183`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift:219-343`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift:23-35`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift:37-108`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift:128-158`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift:682-695`

Remediation:

1. Introduce a value-semantic equipment-picker snapshot derived from the exact inputs that affect browsing.
2. Recompute search/category results only when assets, item families, search text, category, location, or popularity order changes.
3. Derive selected equipment and power recommendations when selection inputs change.
4. Pass narrow row inputs so unrelated form mutations do not invalidate the entire equipment result graph.
5. Keep the 300-item contract, server ordering, category behavior, conflict checks, and custody rules unchanged.

Validation:

- Release-device trace while opening Equipment, typing a search, switching categories, adding/removing serialized gear, and changing battery quantities.
- Record long body updates for `CreateBookingEquipmentPicker`, update causes, input latency, and frame hitches.

Estimated effort: medium.

### PERF-IOS-05: Trade Board repeatedly classifies the same page and uses nested membership scans

**Severity:** P2  
**Confidence:** High  
**Category:** Repeated filtering, avoidable quadratic work

Trade Board exposes six computed subsets. `postedTrades` filters the full trade page and searches three other computed arrays for each row. `visibleCount`, `actionableCount`, empty-state checks, headers, and each `ForEach` evaluate those subsets again. The current API page is capped at 30, so this is bounded today, but the classification work is unnecessarily repeated and becomes more costly if pagination grows.

Evidence:

- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:13-36`
- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:100-122`
- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:216-234`
- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:250-342`

Remediation:

1. Classify trades into one snapshot in a single pass.
2. Use ID sets if exclusion remains necessary.
3. Reuse the snapshot for counts, empty state, and sections.

Validation:

- Unit-test classification parity for student and staff roles.
- Profile sheet presentation and section expansion with a full 30-row page.

Estimated effort: small.

### PERF-IOS-06: Home action queue recomputes overlapping subsets during row construction

**Severity:** P2  
**Confidence:** High for repeated work; low expected impact because displayed sections are capped  
**Category:** Repeated filtering and sorting

Home derives overlapping booking subsets, event-linked ID sets, shift matches, chronological entries, and final displayed entries. During row construction, `displayedEntries.last` reevaluates the complete derived collection for every row. Prefix limits keep this bounded, so this is not a release blocker, but Home is the first useful screen and should avoid unnecessary launch/render work.

Evidence:

- `ios/Wisconsin/Views/HomeView.swift:529-581`
- `ios/Wisconsin/Views/HomeView.swift:603-635`
- `ios/Wisconsin/Views/HomeView.swift:704-735`

Remediation:

1. Build one value-semantic action-queue snapshot from `DashboardData` and current user ID.
2. Iterate an enumerated stable snapshot or render dividers without rereading the entire collection.
3. Preserve current urgency ordering and queue caps.

Validation:

- Compare first useful Home render timing and `HomeActionQueue` body duration.
- Confirm ordering with existing dashboard source-contract tests.

Estimated effort: small.

## Reviewed Patterns Not Marked As Findings

- List identities generally use domain IDs. Remaining `id: \.self` and index identities are concentrated in fixed enums, static placeholders, keypad layouts, and stable local collections.
- Item and avatar images already use ImageIO downsampling, a bounded URL cache, and a decoded `NSCache`; the marked problem is execution context, not the overall cache design.
- Large scrolling result sets generally use `List` or `LazyVStack`. Plain `VStack` inside `ScrollView` is mostly used for bounded detail forms, onboarding, and dashboard cards.
- Explicit animations are generally scoped by value and frequently respect Reduce Motion. Runtime animation cost still belongs in the trace baseline.
- Kiosk cart and active-item grouping is linear and current collections are operationally bounded. Preserve as a watch item rather than refactoring without trace evidence.
- Formatter construction is present in API and low-frequency helper paths, but the audit did not find a high-volume formatter instantiated directly inside a list row body.

## Remediation Order

1. **Slice A: Off-main image pipeline**
   - Close PERF-IOS-01.
   - Add focused actor/cancellation tests where practical.
   - Verify main app and kiosk target compilation because the thumbnail component is shared.

2. **Slice B: Reservation equipment snapshot**
   - Close PERF-IOS-04.
   - Add pure derivation tests before view wiring.
   - Preserve existing source-contract tests and reservation semantics.

3. **Slice C: Schedule derivation snapshot**
   - Close PERF-IOS-02 and PERF-IOS-03.
   - Keep list and calendar output parity testable through value helpers.

4. **Slice D: Small repeated-classification cleanup**
   - Close PERF-IOS-05 and PERF-IOS-06.
   - Keep this separate from visual redesign.

5. **Slice E: Runtime baseline and regression budget**
   - Capture before/after traces for each high-frequency workflow.
   - Record device, OS, Release configuration, dataset size, CPU, hitch count, long update count, and memory peak.

## Runtime Metrics

No performance trace was provided or captured during this source audit.

| Workflow | Device / build | CPU | Hitches | Long view updates | Memory peak |
| --- | --- | --- | --- | --- | --- |
| Items cold-cache scroll | Pending | Pending | Pending | Pending | Pending |
| Users cold-cache scroll | Pending | Pending | Pending | Pending | Pending |
| Reservation equipment search/select | Pending | Pending | Pending | Pending | Pending |
| Schedule filters and calendar | Pending | Pending | Pending | Pending | Pending |
| Trade Board full page | Pending | Pending | Pending | Pending | Pending |
| Home first useful render | Pending | Pending | Pending | Pending | Pending |
| Profile photo select/crop/save | Pending | Pending | Pending | Pending | Pending |

Launch baseline from the supplied Debug device log:

| Metric | Before | After source fix | Acceptance |
| --- | ---: | ---: | --- |
| Cold first useful Home | 3,879 ms, one observed run | Pending Release-device capture | Lower five-run median under matched conditions |
| Session validation owners | 2 source-triggered `/me` requests | 1 by source contract | Exactly one |
| Session result | `unknown` | Cannot emit `unknown` | Explicit terminal result |
| Liquid Glass warnings | 1 | Pending device capture | 0 |
| Full-width zero-height image slots | 5 | Pending device capture | 0 |
| Warm dashboard refresh | 259 ms, one observed run | Pending device capture | No material regression |

## Instruments Capture Contract

Use a Release build on a physical device where possible. Record one interaction per capture using the SwiftUI Instruments template with Time Profiler and Hangs/Hitches:

1. Start from a stable idle state.
2. Record only the named interaction.
3. Stop immediately after the interaction settles.
4. Save the trace with device, OS, build configuration, dataset size, and reproduction note.
5. Repeat the identical interaction after each remediation slice.

Apple references:

- [Understanding and improving SwiftUI performance](https://developer.apple.com/documentation/Xcode/understanding-and-improving-swiftui-performance)
- [Optimize SwiftUI performance with Instruments](https://developer.apple.com/videos/play/wwdc2025/306/)
- [Profile, fix, and verify: Improve app responsiveness with Instruments](https://developer.apple.com/videos/play/wwdc2026/268/)

## Acceptance Status

- [x] Existing thumbnail, Schedule, Bookings, and Event Detail findings have durable IDs.
- [x] Main app, shared components, onboarding image work, and kiosk surfaces received a static smell sweep.
- [x] Findings distinguish source evidence from missing runtime severity.
- [x] Remediation is split into independently verifiable slices.
- [x] PERF-IOS-01 source remediation complete.
- [x] PERF-IOS-02 source remediation complete.
- [x] PERF-IOS-03 source remediation complete.
- [x] PERF-IOS-04 source remediation complete.
- [x] PERF-IOS-05 source remediation complete.
- [x] PERF-IOS-06 source remediation complete.
- [ ] PERF-IOS-01, PERF-IOS-02, and PERF-IOS-04 physically profiled.
- [ ] Before/after metrics recorded.
- [x] Main Wisconsin and WisconsinKiosk targets compile after implementation.
- [x] Relevant Swift source-contract tests pass after implementation.

## Verification For This Audit Record

Required:

```sh
git diff --check
rg -n 'PERF-IOS-0[1-6]' tasks/audit-swiftui-performance-ios.md
npm run verify:docs
```

Implementation slices additionally require the native iOS verification matrix from `AGENTS.md`.

## Files Read

- `AGENTS.md`
- `docs/NORTH_STAR.md`
- `docs/AREA_MOBILE.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `tasks/audit-all-pages-ios.md`
- `tasks/audit-ios-apple-design-full.md`
- `ios/Wisconsin/Core/ThumbnailLoader.swift`
- `ios/Wisconsin/Views/Components/UserAvatarView.swift`
- `ios/Wisconsin/Views/ItemsView.swift`
- `ios/Wisconsin/Views/HomeView.swift`
- `ios/Wisconsin/Views/BookingsView.swift`
- `ios/Wisconsin/Views/ScheduleView.swift`
- `ios/Wisconsin/Views/EventDetailSheet.swift`
- `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingViewModel.swift`
- `ios/Wisconsin/Views/CreateBooking/CreateBookingEquipmentPicker.swift`
- `ios/Wisconsin/Views/Welcome/ProfileCompletionWelcomeView.swift`
- `ios/Wisconsin/Views/Welcome/ProfilePhotoCropView.swift`
- `ios/Wisconsin/Kiosk/KioskIdleView.swift`
- `ios/Wisconsin/Kiosk/KioskCheckoutView.swift`
- SwiftUI performance audit skill references for code smells, profiling intake, and report structure

## Known Limits

- No Instruments trace, XCTest performance baseline, Organizer hitch report, or MetricKit payload was available.
- Runtime severity remains a hypothesis until captured on a physical device with representative data.
- This pass did not mutate user data, exercise kiosk custody, or perform reservation/schedule mutations.
- Existing unrelated Schedule web work and generated codemap changes were preserved.

## Review

### Shipped

- Shared image decode/downsample and profile crop encoding leave the main actor through `@concurrent` processing.
- Schedule and Event Detail rebuild stored date/shift indexes only when source inputs change.
- Bookings keeps its sorted page synchronized when rows change.
- Reservation equipment results and cart selections are evaluated once per render pass.
- Trade Board classifies each loaded page in one pass.
- Home constructs one action-queue collection for row and divider rendering.
- Initial session validation has one request owner and unchanged user values do not invalidate the tab shell.
- Home defers badge and Live Activity refreshes until after dashboard success.

### Verified

- `npx vitest run tests/ios-swiftui-performance.test.ts tests/ios-runtime-warning-cleanup.test.ts tests/ios-create-booking-picker-parity.test.ts tests/ios-home-afm-header-source.test.ts` passed: 37 tests.
- Launch lifecycle, session ownership, tab stability, Home, collaborator access, and Live Activity source contracts passed: 49 tests across 9 files.
- `IOS_SKIP_TESTS=1 npm run ios:xcode:verify` passed simulator and generic-device builds for Wisconsin.
- `npm run ios:xcode:verify:kiosk` passed static gates, simulator build, kiosk XCTest, and generic-device build.
- `npm run ios:project:check`, `npm run drift:ios`, and `npm run audit:ios:gaps` passed. The gap audit still reports the unrelated unregistered `ProfileNextUp.swift`.

### Deferred

- Release-build physical-device Instruments captures and before/after metrics.
- Post-fix confirmation for the Liquid Glass and zero-height image-slot warnings on Erik's iPhone.

### Blocked

- The full Wisconsin XCTest suite reaches a pre-existing failure in `ProfileCompletionModelsTests.testRoleAwareVisibleSteps`: current source returns collaborator `[.phones, .photo]` and student `[.phones, .wiscard, .student, .apparel, .photo]`, while the test still expects the older sequences. The performance slice does not touch those source or test files.

### Next slice or stop

- Stop source changes. Capture the listed physical-device workflows with the SwiftUI Instruments template before claiming measured performance gains.
