# Audit: Wisconsin iOS App and Kiosk - Apple Design - 2026-07-10

**Audit verdict at discovery: NOT READY**  
**Remediation status: SOURCE FIXES COMPLETE; MANAGED-DEVICE SIGNOFF PENDING**

The main app is close and its native foundation is strong. The full product cannot receive an unqualified signoff because two kiosk custody paths can lose local scan state or misattribute audit actors, and several P1 accessibility, session-recovery, Dynamic Type, and failure-recovery defects remain.

The audit began as a read-only pass. The 2026-07-10 remediation wave subsequently fixed every source-level finding in the ordered roadmap. Current automated proof includes 170 iOS-focused tests, both simulator builds, iOS drift/audit/project checks, docs verification, and the app production build. Managed-device HID/camera, VoiceOver, and accessibility-size visual signoff remain external proof rather than open source defects.

## Scope and Method

- Main target: authentication, app shell, Home, Schedule, reservations, item discovery/detail, Guides, Licenses, Users, Search/Scan, notifications, profile/settings, availability, and staff sheets.
- Kiosk target: activation, idle, event/checkout details, student hub, direct checkout, pickup, return, success, sleep, HID scanner, camera, typed recovery, session handling, and inactivity behavior.
- Product contracts: `docs/NORTH_STAR.md`, `docs/AREA_MOBILE.md`, relevant `docs/AREA_*.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`, relevant `docs/BRIEF_*.md`, `docs/IOS_PATTERNS.md`, and `prisma/schema.prisma`.
- Design lens: `/Users/erole/.agents/skills/apple-design/SKILL.md`, with emphasis on agency, familiarity, flexibility, simplicity, craft, direct feedback, spatial consistency, interruptibility, reduced motion, and Dynamic Type.
- Audit contract: `.agents/skills/gt-audit-ios/SKILL.md` and prior `tasks/audit-*-ios.md` records.

## Executive Scorecard

| Area | Verdict | Reason |
| --- | --- | --- |
| Native architecture and wayfinding | Strong | System tabs, native navigation, role-adaptive labels, native sheets and controls are the norm. |
| Core main-app flows | Close | Reservations, items, Schedule, resources, and settings are present and recoverable, with one edit-loss defect. |
| Kiosk custody integrity | Blocked | Rapid scans can replace fresh cart state; idle edits use fabricated requester attribution. |
| Accessibility | Blocked | Some interactive children are collapsed into combined VoiceOver elements; a zoom action is tap-only; feedback is not always announced. |
| Dynamic Type | Blocked | Fixed custom Gotham helpers do not scale relative to text styles and are used across core identity/title surfaces. |
| Motion and feedback | Needs focused work | Haptics and press feedback are generally good; several shared animations ignore Reduce Motion. |
| Offline and session recovery | Needs focused work | Main offline status is clear; kiosk 401s can strand active flows until heartbeat recovery. |
| Build and source health | Green | Drift, audit inventory, project generation, and both simulator builds pass. |

## P0: Release Blockers

### P0-1. Rapid kiosk checkout scans can silently drop a valid cart item

`handleScan` snapshots `cart` before starting an unbounded task. Each response then constructs its replacement from that stale snapshot. Two fast HID or camera scans can both succeed at the server, but the later completion can overwrite the first response locally. Checkout completion sends only the remaining local cart.

- Evidence: `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:520-545`, completion payload at `:632-653`.
- Apple Design impact: response is not continuous or trustworthy; the interface can contradict the user’s physical scanning action.
- Required outcome: serialize intake or merge every response into fresh MainActor store state; deduplicate in-flight values; prove delayed, out-of-order responses and real scanner bursts.

### P0-2. Idle checkout edits lack operator identity and write misleading audit attribution

Any person at the idle kiosk can open an active checkout. The drawer enables editing for an open checkout and sends the checkout requester’s ID as `actorId`, even though that requester may not be the person making the change.

- Evidence: `ios/Wisconsin/Kiosk/KioskIdleView.swift:530-568`; `ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift:65-71,441-495`.
- Contract: staffed physical trust is documented in `docs/AREA_KIOSK.md:19-24`, but mutation audit truth is still required by the custody boundary in `docs/AREA_KIOSK.md:75-79` and D-007 in `docs/DECISIONS.md`.
- Required decision: either keep idle detail read-only and require an identified operator path, or define an explicit kiosk-device/system actor plus staff unlock policy. Do not patch the label while preserving false attribution.

## P1: Must Fix Before Full Signoff

### P1-1. Kiosk 401 responses strand active flows

The API normalizes 401 to `.unauthorized`, but scan, confirm, load, and detail mutation paths render ordinary errors and remain in the current flow. Only idle/student paths deactivate immediately; heartbeat recovery can take 60 seconds.

- Evidence: `ios/Wisconsin/Kiosk/KioskAPIClient.swift:333-345`; checkout `KioskCheckoutView.swift:528-560,645-663`; pickup `KioskPickupView.swift:250-330`; return `KioskReturnView.swift:249-323`; detail `KioskCheckoutDetailSheet.swift:427-497`; heartbeat `KioskStore.swift:332-347`.
- Required outcome: central 401 handling clears the kiosk session, returns to activation immediately, and announces why.

### P1-2. Availability preflight fails open in kiosk UI

A failed preflight clears results. Completion refreshes and checks only blocking results, so it can remain enabled when availability is unknown. The server remains authoritative, but the interface delays the failure until the final action.

- Evidence: `ios/Wisconsin/Kiosk/KioskCheckoutView.swift:632-700`.
- Required outcome: explicit checking, verified, and failed states; completion disabled for unknown/failed state; Retry; last verified result scoped to the current cart and due-time revision.

### P1-3. Interactive children are collapsed in accessibility containers

Several views apply `.accessibilityElement(children: .combine)` around actionable buttons. This can remove the child action as a separately reachable VoiceOver element.

- QR scan failure recovery: `ios/Wisconsin/Views/Search/QRScannerSheet.swift:213-240`.
- Paused notifications Resume: `ios/Wisconsin/Views/NotificationSettingsView.swift:265-290`.
- Kiosk Retry: `ios/Wisconsin/Kiosk/KioskComponents.swift:529-542`.
- Kiosk success Done: `ios/Wisconsin/Kiosk/KioskSuccessView.swift:50-78`.
- Contract: use containment for interactive children per `docs/IOS_PATTERNS.md:157-163`.

### P1-4. Scan-result image zoom is inaccessible outside direct touch

The image is accessibility-hidden but owns an `onTapGesture` that opens the full-screen viewer.

- Evidence: `ios/Wisconsin/Views/Search/ScanResultHeroCard.swift:259-273`.
- Required outcome: a real Button with a clear “View larger image” label; hide only decorative image content.

### P1-5. Custom Gotham type does not participate in Dynamic Type

The shared helpers use fixed `.custom(..., size:)` and fixed system fallbacks without `relativeTo` or UIFontMetrics. They feed core titles, item identity, booking identity, search results, Home, Guides, student identity, kiosk checklist rows, and sleep/idle surfaces.

- Root evidence: `ios/Wisconsin/Core/Brand.swift:34-49`; kiosk duplicate helpers in `ios/Wisconsin/KioskOnly/KioskOnlyApp.swift:123-134`.
- Representative consumers: `HomeView.swift:358-377,461-502`; `Search/SearchResultRow.swift:8-79`; `Search/ScanResultHeroCard.swift:20-36`; `KioskStudentHubView.swift:120-124`; `KioskComponents.swift:351-365`.
- Required outcome: semantic scalable font APIs and accessibility-size layout variants; identity/custody text must wrap rather than shrink or clip.

### P1-6. Failed shift-time saves dismiss and discard the edit

The save callback returns no success signal and the sheet always dismisses after awaiting it.

- Evidence: `ios/Wisconsin/Views/EventDetailSheet.swift:1270-1283,1347-1353`.
- Required outcome: throwing or Boolean result; inline error; preserve entered values; dismiss only after confirmed save.

### P1-7. Edit Shift Times is fixed to a 320-point sheet

Two date pickers, toolbar, footer, and discard behavior are forced into one rigid detent.

- Evidence: `ios/Wisconsin/Views/EventDetailSheet.swift:1289-1344`.
- Required outcome: adaptive medium/large presentation verified at AX5 and landscape.

### P1-8. Important dynamic feedback is not announced

Password change success/error and notification action/pagination errors rely on inserted colored text and haptics without live VoiceOver announcements or focus management.

- Evidence: `ios/Wisconsin/Views/AccountSecuritySettingsView.swift:98-114,184-213`; `ios/Wisconsin/Views/NotificationsSheet.swift:27-45,130-165`.
- Reference implementation: `ios/Wisconsin/Views/LoginView.swift:59-63`; policy in `docs/IOS_PATTERNS.md:179`.

## P2: High-Value Polish and Resilience

1. Consequential controls miss the 44-point target: license claim/copy/return, event approve/decline/assign/claim, and the 32-point trade error dismiss. Sources: `LicensesView.swift:268-285,364-375`; `EventDetailSheet.swift:1181-1244`; `Schedule/TradeBoardSheet.swift:536-544`; requirement in `docs/AREA_MOBILE.md:20-27`.
2. Reduce Motion gaps remain in QR transitions, scan/push pre-prompts, create-booking cart feedback, shared kiosk checklist/progress, camera feedback, and kiosk keyboard hint. Sources: `QRScannerSheet.swift:107-115`; `ScanPrePromptView.swift:22-26`; `PushPrePromptView.swift:15-19`; `CreateBookingEquipmentPicker.swift:158-215`; `KioskComponents.swift:374-405,689-701`; `KioskBarcodeCameraView.swift:73-79`.
3. Global Search uses fixed 350 ms and 250 ms dispatch delays around dismissal/navigation and autofocus. Source: `Search/GlobalSearchSheet.swift:79-105`.
4. Login’s visual Email and Password labels are not programmatically attached to their fields. Source: `LoginView.swift:90-153`.
5. Compact Search rows lack one coherent accessibility label and hint. Source: `Search/SearchResultRow.swift:8-79,119-183`.
6. Permission screens are inconsistent: Push exposes decorative iconography and uses a fixed-height CTA; camera-denied kiosk recovery lacks an Open Settings action and unsupported copy ignores manual entry. Sources: `PushPrePromptView.swift:15-47,62-72`; `KioskBarcodeCameraView.swift:107-148`.
7. Assign Student hard-caps an unscoped local list at 200 and ignores its `sportCode`. Source: `Schedule/AssignStudentSheet.swift:4-25,96-112`.
8. Guides skeleton rows remain exposed to VoiceOver. Source: `GuidesView.swift:134-145,197-250`.
9. Kiosk inactivity preserves checkout cart items but not setup context or a visible resumable pickup/return state. Source: `KioskStore.swift:89-91,281-285` and flow-local state in checkout/pickup/return views.

## P3: Optional Cleanup

1. Bulk equipment at capacity remains an enabled dead tap with only warning haptic. Source: `CreateBookingEquipmentPicker.swift:230-311`.
2. Guide reader adds an unexplained 72-point blank inset while the tab bar is hidden. Source: `GuidesView.swift:253-295`.
3. Settings repeats the same Directory destinations exposed by More. This is a documented compact fallback, so change only after a deliberate IA decision. Sources: `ProfileView.swift:251-293`; `docs/AREA_SETTINGS.md:197`; `docs/IOS_PATTERNS.md:71`.

## What Is Already Strong

- System-owned five-tab shell, role-adaptive Gear label, pinned Search, and compact/regular destination handling: `AppTabView.swift:28-75,152-161`.
- Main offline banner honors Reduce Motion: `AppTabView.swift:99-110`.
- Scanner recovery includes manual entry, permission recovery, 44-point controls, torch labels, and VoiceOver fallback: `QRScannerSheet.swift:55-83,137-199,256-301`.
- Booking detail gates mutations by role, ownership, and lifecycle, with explicit load/error/retry and confirmations: `BookingDetailView.swift:18-152,973-1039`.
- Extend Booking preserves changes on failure and confirms discard: `ExtendBookingSheet.swift:73-159`.
- Items, Users, Guides, Licenses, and Availability have meaningful loading, empty, error, and recovery states; evidence is recorded in their current Swift views and screen audit files.
- Kiosk uses a native iPad target, adaptive chrome, immediate press feedback, restrained glass hierarchy, safe hidden-HID ownership, synchronized scan feedback, transient-offline session restoration, partial-data idle refresh, and server-authoritative return counts: `KioskChrome.swift:72-106`; `KioskComponents.swift:625-640`; `KioskShellView.swift:24-87`; `KioskCheckoutView.swift:88-103,585-598`; `KioskStore.swift:152-188`; `KioskIdleView.swift:598-650`; `KioskReturnView.swift:301-308`.

## Apple Design Opinion: What the App Should Feel Like

The target feeling should be **calm operational confidence**. A student should feel that the app already understands the next job. A counter operator should feel that every scan landed, every state is visible, and nothing can disappear between steps. Delight should come from speed, certainty, and physical responsiveness, not decorative motion or more visual layers.

### Overall design verdict

The app is structurally more native than most internal tools. It uses the system tab bar, navigation stacks, sheets, lists, searchable destinations, SF Symbols, semantic colors, and platform controls. That is the right foundation.

Its remaining design weakness is that it sometimes behaves like a polished database client rather than a field instrument. There are many competent cards, labels, chips, counters, and status treatments, but the strongest action can compete with supporting metadata. The next design phase should not add more chrome. It should create a stronger action hierarchy, make state changes feel physically trustworthy, and remove presentation that does not help someone complete the next job.

### 1. Home should be an action surface, not a dashboard

**Opinion:** Home is close, but it should be more decisive. The greeting and operational summaries establish context, yet large fixed brand type and stat presentation can make the page feel like an executive dashboard. For students, the first meaningful object should be the next shift, pickup, return, or overdue action. For staff, it should be the most urgent operational exception.

- Keep the greeting quiet and short. Gotham can remain as a small brand moment, but it should not dominate or resist Dynamic Type.
- Let the primary queue own visual weight. One clear action card is better than several equally styled summary cards.
- Counters should be secondary evidence, not destinations unless tapping them leads to a clear queue.
- Avoid adding more generated summary copy or motivational language. Current operational state is the useful content.
- Source surfaces: `ios/Wisconsin/Views/HomeView.swift`, `ios/Wisconsin/Core/Brand.swift`.

### 2. The tab architecture is right; do not redesign it

**Opinion:** The system-owned tab bar with a dedicated trailing Search tab is the strongest major design decision in the app. Keep it. Do not replace it with custom glass, a floating scan orb, or a hand-built bottom bar.

- `Home`, `Schedule`, `My Gear`/`Bookings`, `More`, and `Search` are predictable and role-aware.
- Search correctly owns scanning. A separate Scan tab would split one discovery model into two destinations.
- `More` is acceptable because its contents are literal directories. Avoid turning it into a mixed action menu.
- Settings repeating directory destinations is defensible as a fallback, but visually subordinate them so Settings still reads as account and preference management.
- Source surfaces: `ios/Wisconsin/Views/AppTabView.swift`, `BrowseView.swift`, `ProfileView.swift`.

### 3. Search and Scan should feel like one continuous physical interaction

**Opinion:** Search is functionally strong but the transition from scanner dismissal to result navigation is the least Apple-like seam in the main app. Fixed delays reveal implementation timing. The result should appear as the natural consequence of the scan, with no dead interval or presentation race.

- A successful scan should produce synchronized visual, haptic, and spoken confirmation on the causal frame.
- The scanned object should become the visual anchor of the result. Preserve spatial continuity where SwiftUI navigation allows it, rather than dismissing one world and later opening another.
- Use a critically damped transition for programmatic result presentation. Reserve bounce for a genuinely momentum-driven gesture, which scanning is not.
- Keep manual code entry prominent as an equal recovery input, not a shame-state fallback.
- The result hero is useful, but metadata should wrap and breathe instead of shrinking to preserve a designed height.
- Source surfaces: `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift`, `QRScannerSheet.swift`, `ScanResultHeroCard.swift`, `SearchResultRow.swift`.

### 4. Reservation creation should feel progressive, not wizard-heavy

**Opinion:** The create-reservation flow has the right steps and strong recovery behavior. Its risk is accumulating too many explanatory cards, picker rows, cart feedback elements, and confirmation treatments until the user feels they are completing a form rather than expressing a simple intent: when, why, and what gear.

- Keep the event as the natural starting anchor when one exists. Let it prefill time and context visibly, while preserving agency to edit.
- Equipment selection should respond immediately and continuously. The cart count, row state, haptic, and cart contents must change together.
- At-capacity rows should become calmly unavailable, not accept a tap and warn afterward.
- Use one stable cart surface. Avoid transient overlays that compete with the persistent cart bar.
- Confirmation should summarize exceptions and commitments, not repeat every field at equal weight.
- Source surfaces: `ios/Wisconsin/Views/CreateBookingSheet.swift` and `Views/CreateBooking/*`.

### 5. Booking and item detail should reduce card-on-card hierarchy

**Opinion:** These screens are capable and readable, but shared `brandCard` usage can create a web-dashboard rhythm when every section receives its own rounded container, stroke, and shadow. Native grouped content often needs less framing.

- Use cards for distinct objects or actions, not every information group.
- Prefer native section spacing, inset grouped lists, and quiet dividers for related metadata.
- Keep the title, current status, holder/booking context, and next allowed action above secondary history and attributes.
- Status rails and pills should clarify exceptions. Repeating the same status color in rail, pill, icon, and text becomes visual overstatement.
- Item imagery should remain tappable through a real accessible control; zoom is valuable for condition inspection.
- Source surfaces: `ios/Wisconsin/Views/BookingDetailView.swift`, `ItemDetailView.swift`, `ItemsView.swift`, `Core/Brand.swift`.

### 6. Schedule should emphasize time and commitment over administration

**Opinion:** Schedule is information-dense but generally well shaped. The design should continue separating the student’s commitment from staffing administration. Event time, call time, assignment, and required action should never look equivalent.

- For students, their assignment and call time should be the visual center.
- For staff, coverage and exceptions should lead; individual management controls can remain one level deeper.
- Small approval and assignment controls currently optimize density over confidence. Keep compact visual labels but expand the touch surfaces.
- The fixed-height shift editor is a clear spatial mistake. A task sheet should grow with its content and user text size.
- Save failures must remain in place. Dismissing a failed edit breaks spatial continuity and agency.
- Source surfaces: `ios/Wisconsin/Views/ScheduleView.swift`, `EventDetailSheet.swift`, `Views/Schedule/*`.

### 7. Settings is appropriately boring

**Opinion:** Settings should not become a showcase. The native List/Section structure is correct. Keep it literal, predictable, and low-motion.

- Account, notifications, appearance, tools, and sign-out are familiar groupings.
- Permission and registration state should remain two separate truths.
- Recovery actions should be full-width or clearly local to the failed state, especially under large text.
- Success and error changes need spoken feedback, but no celebratory animation.
- Source surfaces: `ios/Wisconsin/Views/ProfileView.swift`, `NotificationSettingsView.swift`, `AccountSecuritySettingsView.swift`.

### 8. The kiosk should feel like an appliance, not a large iOS app

**Opinion:** The kiosk has the clearest opportunity for a distinctive product character. Its dark operational surface, large targets, immediate press response, and scanner-first flows are directionally right. The bar is not visual novelty. The bar is appliance-level certainty.

- Every physical scan must create an immediate, durable visual change. The rapid-scan race is therefore both a custody bug and the most serious design failure.
- The active student, location, workflow phase, and cart/progress must remain spatially stable. Context should not disappear during scanning or inactivity.
- Avoid stacking translucent surfaces. On a dark kiosk, glass should identify floating controls or modal tasks, while core working surfaces remain solid and high contrast.
- Press feedback should be immediate and restrained. The existing 0.97 scale is appropriate for large tiles. Progress and checklist changes should use critically damped motion with no bounce unless a user gesture carried momentum.
- Success should be short, unambiguous, and interruptible. The operator must be able to leave immediately; reduced-motion users should get a static state change rather than staged entrances.
- Sleep mode is operationally justified, but slow looping movement can be vestibularly uncomfortable. Burn-in movement should remain extremely quiet and honor accessibility motion settings.
- Idle checkout detail should be read-only until operator identity is explicit. Visual edit affordance communicates authorization, so this cannot be solved only at the API layer.
- Source surfaces: `ios/Wisconsin/Kiosk/KioskShellView.swift`, `KioskIdleView.swift`, `KioskCheckoutView.swift`, `KioskPickupView.swift`, `KioskReturnView.swift`, `KioskSuccessView.swift`, `KioskSleepModeView.swift`, `KioskComponents.swift`.

### 9. Typography should use Gotham as punctuation, not prose

**Opinion:** Gotham gives the app a Wisconsin Athletics identity, but it is overextended into rows and operational identity text. System type is better for dense, changing, accessibility-sensitive information.

- Keep Gotham for a few hero or brand moments: Home greeting, scan result title, kiosk phase title, and success headline.
- Prefer San Francisco for item names, user names, tags, list rows, metadata, forms, and all long or frequently changing text.
- Make every custom font relative to a semantic text style.
- Never preserve brand typography by shrinking essential identity text with aggressive `minimumScaleFactor`.
- Root source: `ios/Wisconsin/Core/Brand.swift:34-49`; usages across Home, Search, Items, Booking Detail, Guides, Users, and Kiosk.

### 10. Motion needs a house rule

**Opinion:** The app has many individually reasonable animations but no single behavioral grammar. Apple-like motion comes from consistency and causality, not the number of springs.

Adopt this rule:

- Direct press: immediate opacity plus subtle scale, no delay.
- Programmatic insertion or state change: critically damped spring, roughly 0.3 to 0.4 response, no bounce.
- User-thrown or dragged object: velocity-aware spring with slight bounce only when momentum exists.
- Sheet presentation/dismissal: system behavior unless a custom interactive transition is essential.
- Success/error: state, color, haptic, and spoken feedback on the same causal frame.
- Reduce Motion: short opacity change or static replacement, never simply remove all feedback.

Current custom animations that ignore Reduce Motion should be fixed before adding any new motion language. Sources are listed in the P2 findings above.

### 11. Material should encode hierarchy, not branding

**Opinion:** Liquid Glass and material are working best on native toolbars, floating scanner controls, and primary kiosk actions. They become weaker when used as a general decoration or layered over other translucent surfaces.

- Let the system own navigation and sheet material.
- Use solid grouped surfaces for dense operational data.
- Use glass for floating controls that need separation from changing content.
- Do not put colored text directly on highly translucent foreground material when contrast varies.
- Prefer scroll-edge behavior over extra divider bars under floating chrome.

### 12. What not to build

- No custom tab bar.
- No standalone Scan tab.
- No decorative carousel on Home.
- No extra dashboard charts for students.
- No universal animated card transitions.
- No more status pills where plain text or one symbol communicates the same state.
- No kiosk editing affordance without a truthful actor model.
- No custom gesture system where native scrolling, sheets, swipe actions, or navigation already express the workflow.

## Opinionated Design Priorities

1. Make kiosk scans and actor identity unquestionably trustworthy.
2. Make the next action dominate Home, reservation, Schedule, and kiosk surfaces.
3. Replace fixed Gotham usage with a restrained, scalable typography system.
4. Establish one motion and feedback grammar across both targets.
5. Remove redundant cards, pills, shadows, and repeated status color after the functional blockers close.
6. Run a real-device, accessibility-size, VoiceOver, and scanner interaction review before adding new visual polish.

## Verification Evidence

- `npm run drift:ios`: passed, 71 Swift files, no configured anti-patterns.
- `npm run audit:ios:gaps`: passed, 47/47 audit-worthy surfaces covered.
- `npm run ios:project:check`: passed, XcodeGen output matches the checked-in project.
- `xcodebuild -project ios/Wisconsin.xcodeproj -scheme Wisconsin -destination 'generic/platform=iOS Simulator' -configuration Debug build`: **BUILD SUCCEEDED**.
- `xcodebuild -project ios/Wisconsin.xcodeproj -scheme WisconsinKiosk -destination 'generic/platform=iOS Simulator' -configuration Debug build`: **BUILD SUCCEEDED**.
- Build success proves compilation only. It does not close hardware-scanner ordering, VoiceOver reachability, Dynamic Type layout, or real-device gesture behavior.

## Recommendation

Do not start a broad visual redesign. Fix the custody and actor-truth blockers first, then establish shared accessibility/type/motion foundations before screen-local polish. The ordered execution route is in `tasks/ios-apple-design-remediation-slices.md`.

## Sources Used

- `/Users/erole/.agents/skills/apple-design/SKILL.md`
- `.agents/skills/gt-audit-ios/SKILL.md`
- `.agents/skills/gt-plan/SKILL.md`
- `AGENTS.md`
- `docs/NORTH_STAR.md`
- `docs/AREA_MOBILE.md` and relevant `docs/AREA_*.md` files for audited surfaces
- `docs/BRIEF_*.md` files relevant to onboarding, availability, scan telemetry, escalation, kits, and multi-event bookings
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `docs/IOS_PATTERNS.md`
- `prisma/schema.prisma`
- `ios/Wisconsin/App/WisconsinApp.swift`
- `ios/Wisconsin/App/AppDelegate.swift`
- Swift source files cited above and their dependent Core, Models, Kiosk, and Shared files
- `tasks/audit-all-pages-ios.md` and current screen-level `tasks/audit-*-ios.md` records
- `tasks/README.md`, `tasks/INDEX.md`, `tasks/todo.md`, and `tasks/lessons.md`
