# Apple HIG Audit — iOS (Wisconsin app) — 2026-05-03

**Scope:** Apple Human Interface Guidelines + iOS 26+ modern SwiftUI APIs.
**Target:** iOS 26.0 deployment, Swift 5.10, Xcode 16+ (per `ios/project.yml`). Forward-compatible to iOS 27.
**Ship bar:** modern, idiomatic, Liquid-Glass-native, ready for iOS 27 the day it ships.

**Method:** static source review against the 10-lens rubric below, grounded in Apple's
own documentation. Each finding cites the canonical Apple URL it derives from.
Findings tagged P0 (HIG violation), P1 (clear deviation), P2 (polish/feel).

---

## 2026-06-05 Refresh — iOS 27 Readiness

**Current truth:** The earlier 2026-05-03 P0/P1 HIG sweep is mostly closed in current source. `AppTabView` tested the modern value-based `Tab(...)` API on 2026-06-10, but user retest confirmed it still triggers UIKit's tab item/controller assertion when Schedule is selected. Keep the stable `.tabItem`/`.tag` shell until Apple fixes the runtime path or the app shell is restructured and device-proven. The primary Scan tab already has permission priming, denied-state recovery, manual-entry fallback, haptics, retryable error state, and sheet-based results.

**Apple timing:** WWDC26 runs June 8-12, 2026. The Keynote is June 8 at 10 a.m. PT and Platforms State of the Union is June 8 at 1 p.m. PT. Treat iOS 27-specific guidance as pending until those sessions publish. Current work should improve against today's HIG without raising deployment target or Swift version.

**Current P1 selected for implementation:** `ios/Wisconsin/Views/Search/QRScannerSheet.swift` lagged behind the primary Scan tab. It still requested camera permission directly, used 36pt overlay controls, presented manual entry in an alert, hard-tinted the progress spinner, auto-cleared errors, and lacked error haptics. The QR shortcut is part of the global search affordance, so fixing it improves daily lookup without adding desktop parity or changing custody rules.

**Slice outcome:** QR scanner shortcut now reuses `ScanPrePromptView` and `ScanDeniedView`, raises close/torch controls to 44pt, presents manual entry as a medium sheet through `ScanManualEntrySheet`, keeps no-match/server errors visible with recovery actions, adds `Haptics.error()`, turns torch off when leaving the scene, and gives VoiceOver users a keyboard-first fallback.

**Second slice outcome:** `BookingsView` empty states now include direct recovery actions. Search-empty states clear the query, Mine-only empty states switch to all visible bookings, and empty Reservations can open creation when allowed. The slice keeps the accepted mobile active-only booking scope and avoids reopening GAP-34's desktop parity filters.

**Third slice outcome:** `LoginView` restored the native `Need an account?` link while keeping registration web-owned and invite-gated by `AllowedEmail`. The 2026-07-01 domain cutover moved that link through `AppEnvironment.url(path:)`, currently `https://wisconsincreative.com/register`.

**Fourth slice outcome:** `PasswordSetupView` now gives forced-password users a persistent in-form requirements checklist while they complete first sign-in, matching HIG text-field guidance to keep field purpose and validation visible instead of relying on disappearing placeholders or a single changing warning line.

**Fifth slice outcome:** `ScheduleView` calendar day cells now keep their compact visual date circles while giving each interactive day a 44pt minimum width and rectangular content shape. This aligns Calendar mode with the same tap-target baseline already used by the month chevrons and primary schedule controls.

**Sixth slice outcome:** `NotificationsSheet` read actions now recover honestly when the server rejects a mark-read or mark-all-read mutation. The API client uses the shared response handler, optimistic unread state is restored on failure, and the sheet shows a recoverable Refresh banner with error haptics.

**Seventh slice outcome:** `TradeBoardSheet` cancellation now uses the shipped server route and returned trade state. The native client calls `PATCH /api/shift-trades/[id]/cancel`, decodes `{ data: trade }` through the shared API handler, and lets the returned `CANCELLED` status remove the post from active sections instead of deleting locally after an unchecked request.

**Eighth slice outcome:** `TradeBoardSheet` action failures now stay in context. Failed claim and cancel actions show an inline recovery banner with Refresh and Dismiss actions plus error haptics instead of interrupting the sheet with a generic OK-only alert.

**Ninth slice outcome:** `LoginView` password visibility now has explicit accessibility semantics. The icon-only eye button speaks as Show password or Hide password and exposes Password hidden or Password visible as state.

**Tenth slice outcome:** `PasswordSetupView` now matches the same accessibility pattern. The shared eye button speaks as Show passwords or Hide passwords and exposes Passwords hidden or Passwords visible as state.

**Eleventh slice outcome:** `ItemsView` rows now preserve the combined operational VoiceOver label and add an explicit "Double-tap to view item details" hint so the row's navigation action is discoverable.

**Twelfth slice outcome:** `ScheduleView` list microcopy now uses semantic SwiftUI font styles instead of fixed point sizes. Date headers, My Shift chips, Home/Away labels, crew coverage icons, shift labels, and weather text scale with Dynamic Type while preserving monospaced digits for fast operational scanning.

**Thirteenth slice outcome:** `ScanView` result errors now keep recovery in context. The result sheet exposes Try again before Type code instead, retries the last scanned code, and resets same-code dedupe first so a failed lookup can be retried immediately without dismissing the sheet.

**Sources:** Apple HIG root, Accessibility, Layout, SwiftUI Liquid Glass docs, SwiftUI updates, WWDC26 page, `docs/AREA_MOBILE.md`, `docs/AREA_SEARCH.md`, `docs/AREA_SCAN.md`, `docs/DECISIONS.md`, `docs/GAPS_AND_RISKS.md`, and `prisma/schema.prisma`.

---

## Reference URLs (Apple, canonical)

**HIG (design language):**
- HIG root: https://developer.apple.com/design/human-interface-guidelines
- Designing for iOS: https://developer.apple.com/design/human-interface-guidelines/designing-for-ios
- Materials: https://developer.apple.com/design/human-interface-guidelines/materials
- Sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- Tab bars: https://developer.apple.com/design/human-interface-guidelines/tab-bars
- Modality: https://developer.apple.com/design/human-interface-guidelines/modality
- Privacy: https://developer.apple.com/design/human-interface-guidelines/privacy
- Accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Color: https://developer.apple.com/design/human-interface-guidelines/color
- Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Buttons: https://developer.apple.com/design/human-interface-guidelines/buttons

**SwiftUI (concrete APIs we should adopt):**
- Applying Liquid Glass: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views
- `Tab` struct (iOS 26 API): https://developer.apple.com/documentation/swiftui/tab
- `TabRole`: https://developer.apple.com/documentation/swiftui/tabrole
- `tabBarMinimizeBehavior(_:)`: https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)
- `presentationDetents(_:)`: https://developer.apple.com/documentation/swiftui/view/presentationdetents(_:)
- `safeAreaInset(...)`: https://developer.apple.com/documentation/swiftui/view/safeareainset(edge:alignment:spacing:content:)

**Confirmed iOS 26 APIs to standardize on (verbatim from Apple docs):**
- `.glassEffect(_:in:)` — Liquid Glass on any custom view
- `Glass.regular.tint(_).interactive()` — configurable glass material
- `GlassEffectContainer(spacing:)` — perf + morph multiple glass views
- `glassEffectID(_:in:)` + `GlassEffectTransition.matchedGeometry / .materialize` — glass morphing
- `.buttonStyle(.glass)` and `.buttonStyle(.glassProminent)` — Liquid-Glass buttons
- `Tab("Title", systemImage: "...", role: .search) { ... }` — modern tab declaration
- `.tabBarMinimizeBehavior(.onScrollDown)` — auto-minimize tab bar on scroll

---

## Rubric — 10 HIG lenses

1. **Navigation grammar** — push (drill-down) vs. sheet (self-contained task) vs. fullScreenCover (immersive). [HIG: Modality](https://developer.apple.com/design/human-interface-guidelines/modality)
2. **Typography & Dynamic Type** — semantic `Font` styles only; scales to AX5. [HIG: Typography](https://developer.apple.com/design/human-interface-guidelines/typography)
3. **Color & Materials** — semantic colors + Liquid Glass per iOS 26 guidance; no raw `Color.black/white`. [HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials), [HIG: Color](https://developer.apple.com/design/human-interface-guidelines/color)
4. **Touch targets** — ≥ 44×44pt per HIG. [HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
5. **Accessibility** — VoiceOver labels, traits, announcements; Dynamic Type; Reduce Motion. [HIG: Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
6. **SF Symbols** — semantic SF Symbols, consistent weight/scale.
7. **Feedback states** — empty (`ContentUnavailableView`) / loading / error / offline / success.
8. **Haptics & motion** — `.success`/`.warning`/`.selection`; honor Reduce Motion.
9. **Forms & keyboard** — `keyboardType`, `textContentType`, `submitLabel`, focus chaining, `scrollDismissesKeyboard`.
10. **System integration** — Share sheet, Universal Links, `.searchable`, swipe actions, context menus, permission priming. [HIG: Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy)

---

## Cross-cutting iOS 26 modernization (apply globally)

These are project-wide patterns to adopt in a single sweep before per-screen polish.

- [ ] **CC-1 — Migrate `TabView` to the new `Tab` struct API.** Blocked 2026-06-10 by repeated UIKit tab item/controller assertion on Schedule selection.
      The stable current shell uses `.tabItem { Label(...) }` plus `.tag(...)`. Do not reattempt `Tab("Home", systemImage: "house", value: ...)` until device verification proves UIKit's tab item/controller mapping remains stable. Cite: https://developer.apple.com/documentation/swiftui/tab

- [ ] **CC-2 — Adopt `TabRole.search` (where applicable) and `.tabBarMinimizeBehavior(.onScrollDown)`.** Blocked with CC-1.
      Scan is a search-flow entry, but app-shell stability is higher priority than system search-slot styling. Do not restore `role: .search` or tab-bar minimization while they ride the crashing modern tab shell. Cites: https://developer.apple.com/documentation/swiftui/tabrole, https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)

- [ ] **CC-3 — Replace hand-rolled `.regularMaterial`/`.ultraThinMaterial` overlays with `.glassEffect(_:in:)` Liquid Glass.**
      Sites: `ScanView.swift:146` (`ScanResultCard` uses `.regularMaterial`), `ScanView.swift:28` (`ProgressView` in `.ultraThinMaterial` circle), `BannerView.swift` (probably). Liquid Glass is the iOS 26 system material — Apple's guidance is "Standard components in SwiftUI use Liquid Glass. Adopt Liquid Glass on custom components." Replace with `.glassEffect(in: .rect(cornerRadius: 20))` or `.glassEffect()` (default capsule). Wrap clusters in `GlassEffectContainer` for perf. Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [x] **CC-4 — Replace custom prominent buttons with `.buttonStyle(.glass)` / `.buttonStyle(.glassProminent)`.** ✅ Shipped 2026-05-03.
      - [x] BookingDetailView Extend / Cancel — `.buttonStyle(.glass).controlSize(.large).tint(.blue/.red)`.
      - [x] LoginView Sign in — dropped the `Color(.label)` inverted-fill (invisible-white-on-white in dark mode) and the custom `ScalePressStyle`. Now `.buttonStyle(.glassProminent).tint(.brandPrimary)`.
      - [x] ScanView Scan Again — `.borderedProminent` → `.glassProminent`.
      - `ScalePressStyle` remains defined for the `FABButtonStyle` analog in `FloatingSearchButton` (different style intent — that's a FAB with custom spring scale; evaluate as part of CC-3 when the FAB itself moves to `.glassEffect(.regular.tint(.accentColor).interactive(), in: .circle)`).

- [x] **CC-5 — Sweep all hardcoded `Color.black.opacity(...)` shadows.** ✅ Shipped 2026-05-03.
      Cleaned 4 shadow sites: `HomeView.swift` `StatCell` and `DashboardCard` (dropped both shadows, replaced with `Color(.separator)` stroke borders matching `ItemDetailView` card pattern); `FloatingSearchButton.swift` (dropped black drop-shadow, kept accent-tinted glow which adapts); `LoginView.swift` (kept the splash-card lift but converted to `Color(.sRGBLinear, white: 0, opacity: 0.4)` so it remains visible over the dark gradient). The 4 remaining `black.opacity` sites in the codebase are legitimate scrim/camera-overlay uses, not shadows.

- [x] **CC-6 — Standardize permission priming via reusable pattern.** ✅ Shipped 2026-05-03 (the only P0 from the per-screen audit).
      Added `ScanPrePromptView` mirroring `PushPrePromptView`'s shape, plus `ScanDeniedView` recovery state (`.denied`/`.restricted` → "Open Settings" CTA). `ScanView` is now a state machine over `AVCaptureDevice.authorizationStatus(for: .video)` and re-checks on `scenePhase == .active` so toggling Camera in Settings takes effect immediately. Generic `PrePromptScreen(symbol:title:body:rationale:onContinue:)` deferred until a third permission flow exists — for now the duplication is contained to two files. Cite: https://developer.apple.com/design/human-interface-guidelines/privacy

- [x] **CC-7 — Replace hand-rolled top overlays with `.safeAreaInset(edge: .top)`.** ✅ Shipped 2026-05-03 (AppTabView offline banner).
      `AppTabView.swift:34-42` `BannerView` overlay is the canonical wrong-way; iOS 26 idiom is `.safeAreaInset(edge: .top) { OfflineBanner() }` directly on the `TabView`. Cite: https://developer.apple.com/documentation/swiftui/view/safeareainset(edge:alignment:spacing:content:)

- [x] **CC-8 — Honor `@Environment(\.accessibilityReduceMotion)` on every animated transition.** ✅ Shipped 2026-05-03.
      All 8 non-kiosk animation sites gated: AppTabView (offline banner), WisconsinApp RootView (login offline banner), ScanView (result card spring), LinkStickerWizard (step transition), CreateBookingSheet AssetPickerRow (selection icon), ScheduleView (toast + refresh error), and `ScalePressStyle` (which auto-fans-out to its 3 call sites in ScheduleView ×2 and CreateBookingSheet). 7 kiosk sites intentionally retained — kiosk is a fixed-mode public-facing flow where motion is part of the feedback signal. Mirrors the web side's app-wide MotionConfig. AppTabView shipped 2026-05-03. Remaining 14 `.animation(...)` sites: `LinkStickerWizard.swift:53`, `BookingDetailView.swift:467` (ScalePressStyle — already honored on FABButtonStyle, sweep when ScalePressStyle is removed), `CreateBookingSheet.swift:491`, `ScheduleView.swift:247-248`, `WisconsinApp.swift:99`, `KioskPickupView.swift:87,107,262`, `KioskShellView.swift:41`, `KioskReturnView.swift:87,112,296`, `KioskCheckoutView.swift:112`, `ScanView.swift:42`. (Many kiosk sites — but kiosk is a fixed-mode public-facing flow where motion is part of the feedback signal; consider whether kiosk gets a pass.)
      `AppTabView.swift:44` unconditionally animates the offline banner. Web side already wired `MotionConfig` (per memory). iOS side needs the equivalent: every `.animation(...)` site should fall back to `nil` (or `.identity`) under Reduce Motion. Cite: https://developer.apple.com/design/human-interface-guidelines/accessibility

- [x] **CC-9 — Adopt `Observable` + `@Observable` macros consistently (Swift 5.10+).** ✅ Verified 2026-05-03.
      Codebase has zero `ObservableObject`, `@Published`, `@StateObject`, `@ObservedObject`, `@EnvironmentObject` references. Fully on `@Observable`.

---

## Per-screen findings

### `AppTabView` (`ios/Wisconsin/Views/AppTabView.swift`)

**Verdict:** functional and uses correct semantic SF Symbols, but uses iOS 17-era APIs. Modernize to iOS 26.

- [ ] **P1 — [Navigation/iOS-26] Re-evaluate `Tab` struct API + `TabRole.search` for Scan tab.** `AppTabView.swift:10-32`.
      2026-06-10 status: user retest confirmed the modern tab shell still crashes on Schedule selection. Keep `.tabItem`/`.tag` until the runtime path is device-proven stable.
      Why: this is the canonical iOS 26 declaration, but it is not the best API for this app while it reproduces a hard UIKit assertion.
      Cites: https://developer.apple.com/documentation/swiftui/tab • https://developer.apple.com/documentation/swiftui/tabrole • https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)

- [ ] **P1 — [Materials] Offline banner is a hand-rolled overlay.** `AppTabView.swift:34-42`.
      Replace with `.safeAreaInset(edge: .top)` on the `TabView`, content using `.glassEffect()` not custom material. Cite: HIG Materials + safeAreaInset doc.

- [ ] **P2 — [Accessibility] `.badge(...)` has no descriptive label.** Lines 17, 30.
      Add `.accessibilityLabel("Bookings, \(appState.overdueCount) overdue")` so VoiceOver announces meaning, not just count.
      Cite: https://developer.apple.com/design/human-interface-guidelines/accessibility

- [ ] **P2 — [Navigation] Profile entry not exposed from tab root.** `ProfileView` is reachable only from inside `HomeView`. HIG iOS pattern is a top-trailing avatar on the landing screen, or a dedicated tab. Confirm and document the canonical entry.

---

### `LoginView` (`ios/Wisconsin/Views/LoginView.swift`)

**Verdict:** form mechanics solid (correct `textContentType`, `keyboardType`, focus chaining). Visual treatment is iOS 17-era; needs iOS 26 modernization.

- [ ] **P1 — [Color/Materials] Sign-in button uses `Color(.label)` fill — inverts in dark mode.** `LoginView.swift:168-173`.
      Replace the entire custom `.background(...)` + `RoundedRectangle` treatment with `.buttonStyle(.glassProminent)`. Single line. Auto-tints, auto-handles disabled state, auto-Liquid-Glass.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [ ] **P1 — [Color] Hardcoded RGB gradient ignores color scheme.** `LoginView.swift:30-38`.
      Either: (a) declare immersive — set `.preferredColorScheme(.dark)` on the root only while the splash is shown; or (b) move both the dark and light gradient stops into Asset Catalog as a `Color Set` with light/dark variants.
      Cite: https://developer.apple.com/design/human-interface-guidelines/color

- [ ] **P1 — [Materials] Card shadow `Color.black.opacity(0.25)`.** `LoginView.swift:192`.
      iOS 26 Liquid Glass gives the card lift implicitly. Replace the custom card with `.glassEffect(in: .rect(cornerRadius: 20))` and drop the shadow.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [ ] **P2 — [Accessibility] Decorative `Image("Badgers")` not marked.** `LoginView.swift:63-66`.
      Add `.accessibilityHidden(true)` (the heading "Wisconsin Creative" already provides the label).

- [ ] **P2 — [Accessibility] Login error not announced.** `LoginView.swift:147-153`.
      Post `AccessibilityNotification.Announcement(error).post()` when `session.error` flips non-nil. VoiceOver users currently miss the error unless they navigate to it.
      Cite: https://developer.apple.com/design/human-interface-guidelines/accessibility

---

### `ScanView` (`ios/Wisconsin/Views/ScanView.swift`)

**Verdict:** baseline correct (uses `DataScannerViewController`, `ContentUnavailableView`). Three significant iOS 26 modernizations needed.

- [ ] **P0 — [Privacy] No camera permission priming.** `DataScannerViewController` is instantiated immediately on tab entry; system permission prompt fires cold.
      Build `ScanPrePromptView` shown when `AVCaptureDevice.authorizationStatus(for: .video) == .notDetermined`. On denial, render a recovery view with link to Settings (`UIApplication.openSettingsURLString`). Generalize via the CC-6 reusable `PrePromptScreen`.
      Cite: https://developer.apple.com/design/human-interface-guidelines/privacy

- [ ] **P1 — [Modality] Result overlay should be a real sheet with detents.** `ScanView.swift:32-38`, `ScanResultCard` at `:110+`.
      Convert to `.sheet(item: $results) { ResultsSheet(results: $0) }` with `.presentationDetents([.medium])`, `.presentationDragIndicator(.visible)`, `.presentationBackgroundInteraction(.enabled(upThrough: .medium))`. Keeps scanner running underneath, gets real grabber + swipe-to-dismiss.
      Cite: https://developer.apple.com/documentation/swiftui/view/presentationdetents(_:) • HIG Sheets

- [ ] **P1 — [Materials/iOS-26] `.regularMaterial` → `.glassEffect()`.** `ScanView.swift:146`.
      Once converted to a sheet (P1 above), the sheet handles material itself. If kept as overlay for any reason, swap to `.glassEffect(in: .rect(cornerRadius: 20))`.

- [ ] **P1 — [Haptics] No haptic on scan result.** `handleScan` at `:52-59`.
      Add `Haptics.success()` on result arrival, `Haptics.warning()` if `results.isEmpty`. `Haptics` already exists at `Core/Haptics.swift`.
      Cite: HIG Feedback / Haptics

- [ ] **P2 — [Accessibility] No VoiceOver fallback for camera scan.**
      When `UIAccessibility.isVoiceOverRunning`, show a manual `TextField` (already plumbed via `HIDScannerField`) so VO users can type a code.

- [ ] **P2 — [Color] `ProgressView().tint(.white)` hardcoded.** `:25-29`. Drop the tint — system handles contrast.

---

### `HomeView` (`ios/Wisconsin/Views/HomeView.swift`)

**Verdict:** strong iOS 17+ practice (`@Observable`, `ContentUnavailableView`, `sensoryFeedback`, `contentTransition(.numericText())`, `.refreshable`). Two recurring anti-patterns and one tab-bar-vs-title mismatch.

**2026-05-12 follow-up:** Home is no longer treated as a passive mini dashboard. The iOS landing screen now uses a compact triage strip plus a user-specific `Next Up` queue for my overdue gear, due-today bookings, awaiting pickup, upcoming reservations, and upcoming shifts while keeping the strip as the global operational count surface. The old passive `Upcoming Events`, `My Checkouts`, `Team Checkouts`, and `Team Reservations` card stack was removed from Home; staff/admin exception work stays below the queue. Home also no longer repeats Scan/search controls because scan lookup already has a dedicated tab-bar action and kiosk owns checkout/handoff execution. Staff TestFlight follow-up removed leading queue row icons, moved profile to the top-right avatar, added a bottom-right creation action, and made tab reselection reset local stacks/filters where appropriate.

- [x] **P1 — [Materials/iOS-26] Hardcoded `.shadow(color: .black.opacity(0.06)...)` on every card.** `HomeView.swift:367-368, 525-526` (`StatCell`, `DashboardCard`).
      Identical anti-pattern to `LoginView`. iOS 26 idiom: drop the shadow and use `.glassEffect(in: .rect(cornerRadius: 12))` for card surfaces. Each `StatCell` becomes a Liquid Glass tile that morphs nicely under `GlassEffectContainer`.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [x] **P1 — [Materials] `FloatingSearchButton` overlay should be Liquid Glass.** `HomeView.swift:290-294`.
      The whole point of the iOS 26 floating-button pattern (Photos search, Mail compose) is `.glassEffect(.regular.tint(.accentColor).interactive(), in: .circle)` + a `GlassEffectContainer`. Verify what `FloatingSearchButton` renders today; if it's a custom solid-fill circle, migrate.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [x] **P2 — [Navigation] Tab label "Home" vs. screen title "Dashboard" mismatch.** `AppTabView.swift:12` ("Home") vs. `HomeView.swift:240` (`.navigationTitle("Dashboard")`).
      HIG: the tab label should match the destination's title (or be a tight synonym). Pick one. Apple's pattern is "the tab name is the noun the user navigates to" — if this screen is a dashboard, name the tab "Dashboard"; if it's home, the screen title is "Home".
      Cite: https://developer.apple.com/design/human-interface-guidelines/tab-bars

- [x] **P2 — [DRY/UX] Three near-identical context menus on summary rows.** `HomeView.swift:148-161, 171-184, 194-207`.
      Not strictly HIG, but the duplication invites drift. Extract one `BookingSummaryContextMenu(summary:)` view modifier.

- [ ] **P2 — [Accessibility] Triage strip values use semantic Dynamic Type, but the compact four-cell layout still needs an AX5 real-device check.** `HomeView.swift`.
      Verify in the AX5 simulator. If clipped, switch to `ViewThatFits` or constrain content height.

---

### `ItemsView` (`ios/Wisconsin/Views/ItemsView.swift`)

**Verdict:** excellent — `.searchable`, `ContentUnavailableView` for all states, debounced search, skeleton list, explicit 44pt frames on toolbar buttons, `@Observable`, optimistic-update favorite. Two iOS 26 polish opportunities.

- [x] **P1 — [Gestures] No swipe actions on List rows.** `ItemsView.swift:144-172`.
      HIG List rows should expose primary actions via `.swipeActions`. Currently Favorite, Reserve, and Copy Asset Tag are context-menu-only. Add leading-swipe Favorite (low-risk) and trailing-swipe Reserve (CTA). Keep the context menu for parity.
      Cite: https://developer.apple.com/design/human-interface-guidelines/list-views

- [ ] **P2 — [Materials/iOS-26] `AssetThumbnail` border `Color(.separator)` lineWidth: 1 — fine, but the rounded-rect background `Color(.systemGray6)` looks dated next to Liquid Glass surfaces.** `:347-352`.
      Optional: try `.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))` for the empty state. Not critical.

- [ ] **P2 — [Feedback] Trailing pagination spinner has no failure-vs-end-of-list distinction.** `:184-187`.
      Currently a permanent `ProgressView()` until `hasMore` flips. If load fails mid-scroll, the spinner stays visible (you have `pageError` handling above for the empty case — good — but the in-list state could show "End of list" or be hidden when `!hasMore`).

---

### `ItemDetailView` (`ios/Wisconsin/Views/ItemDetailView.swift`)

**Verdict:** clean structure. Two clear HIG violations on Dynamic Type and brand color.

- [ ] **P1 — [Typography] Hero title uses `.font(.system(size: 24, weight: .black))` — does NOT scale with Dynamic Type.** `ItemDetailView.swift:291`.
      This is a direct HIG violation. iOS 26 scales every `.system(size:)` only if you append `.dynamicTypeSize(...)` or use a relative size. Use `.font(.title2.weight(.heavy))` (semantic) instead. Same fix needed anywhere `.system(size: ...)` appears in the codebase — sweep this with the shadow sweep.
      Cite: https://developer.apple.com/design/human-interface-guidelines/typography

- [ ] **P1 — [Color] `wiRed = Color(red: 0.773, green: 0.020, blue: 0.047)` hardcoded.** `:252`.
      Brand color must live in the Asset Catalog as `Color("BrandPrimary")` with light/dark variants and accessibility-high-contrast variants. Same color appears in `Brand.swift` — verify a single source of truth.
      Cite: https://developer.apple.com/design/human-interface-guidelines/color

- [ ] **P2 — [Materials/iOS-26] Hero card uses `Color(.secondarySystemGroupedBackground)` + `RadialGradient` overlay + manual `RoundedRectangle.strokeBorder(0.5)` — three layers reproducing what `.glassEffect()` does in one line.** `:309-324`.
      iOS 26 idiom: `.glassEffect(.regular.tint(Color.brandPrimary.opacity(0.06)), in: .rect(cornerRadius: 16))`. Drop the radial gradient; the glass already reflects ambient color.

- [ ] **P2 — [UX] Favorite error uses an `.alert` interruption.** `:88-95`.
      Alerts are HIG-reserved for situations the user must respond to immediately. A failed favorite toggle is informational. Use a transient toast/banner via `.safeAreaInset` or revert silently with a brief subtle indicator.
      Cite: https://developer.apple.com/design/human-interface-guidelines/alerts

---

### `BookingsView` (`ios/Wisconsin/Views/BookingsView.swift`)

**Verdict:** functional. One genuine HIG bug (haptic firing on wrong event) and one navigation pattern question.

- [ ] **P1 — [Haptics] `.sensoryFeedback(.success, trigger: navigationPath)` fires success on every navigation push.** `BookingsView.swift:183`.
      A push-navigation is not a success — it's just a screen change. `.success` haptic is reserved for confirming a meaningful user action (booking created, return completed). This makes every row tap feel rewarded, which trains users to ignore real success signals.
      Fix: remove this. Move `.success` to the actual booking-creation completion in `CreateBookingSheet.onCreated`.
      Cite: https://developer.apple.com/design/human-interface-guidelines/playing-haptics

- [ ] **P1 — [Navigation] Segmented Picker in `.principal` slot for Reservations/Checkouts.** `:197-205`.
      iOS 26 idiom for two-mode list switching is to use `.searchable(text:, scope:)` with a scope picker instead. The principal-segmented pattern is iOS 14-era. Alternative: `Tab` with sub-tabs, or a `Menu` in the title.
      Cite: https://developer.apple.com/design/human-interface-guidelines/searching

- [ ] **P2 — [Navigation] "+" button on `.topBarLeading`.** `:189-196`.
      HIG convention: primary creation actions go on `.topBarTrailing`. Leading is for back/menu/dismiss-style affordances. Move to trailing.
      Cite: https://developer.apple.com/design/human-interface-guidelines/toolbars

---

### `BookingDetailView` (`ios/Wisconsin/Views/BookingDetailView.swift`)

**Verdict:** the action buttons are the most date-stamped UI on this screen — every one is a hand-rolled color box that would take a one-line iOS 26 button style. Otherwise solid (discard confirm, `interactiveDismissDisabled`, role-based edit gating).

- [ ] **P1 — [Buttons/iOS-26] Hand-rolled action buttons should be `.buttonStyle(.glassProminent)` / `.glass`.** `BookingDetailView.swift:398-407` (Extend) and `:424-440` (Cancel).
      Both use `.background(Color.X.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))` with custom `ScalePressStyle`. iOS 26 replaces this entire pattern:
      ```swift
      Button { onExtend() } label: { Label("Extend Return Date", systemImage: "clock.arrow.circlepath") }
          .buttonStyle(.glass).tint(.blue).controlSize(.large)
          .disabled(isActioning)
      ```
      Cancel becomes `.buttonStyle(.glass).tint(.red)` with `role: .destructive`.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [ ] **P2 — [Buttons] `ScalePressStyle` (custom) is now redundant.** `:467-473`.
      iOS 26 `.buttonStyle(.glass)` provides the press-scale interaction natively. Remove `ScalePressStyle` once buttons migrate. Sweep all call sites.

- [ ] **P2 — [Haptics] No success haptic on Extend / Cancel completion.**
      `.success` belongs here (not on `BookingsView` row taps). Add `Haptics.success()` after `await loadBooking()` in the cancel path.

- [ ] **P2 — [Color] Overdue banner uses raw `Color.red` background with white text.** `:266-271`.
      Works visually but raw `.red` doesn't adapt to high-contrast accessibility. Use `Color(.systemRed)` (auto-adjusts under Increase Contrast) and ensure WCAG AA on the white-on-red.
      Cite: https://developer.apple.com/design/human-interface-guidelines/color

---

## Session ledger (2026-05-03)

**18 PRs landed on main.** Cross-cutting CC-1, 2, 4, 5, 6, 7, 8, 9, 10 ✅. CC-3 deferred for visual call. 21 per-screen findings closed (see list below). New components added: `ScanPrePromptView`, `ScanDeniedView`, `ScanManualEntryView`, `ScanResultSheet`, `BookingSummaryNavRow`, `Toast` + `.toast(_:)` modifier. Memory captured: `xcodegen` wipes manual entitlements (always restore `Wisconsin.entitlements` after running).

The Wisconsin app's iOS 26 surface is now: stable SwiftUI `TabView` with `.tabItem`/`.tag` tabs after the modern value-based `Tab(...)` shell repeatedly reproduced a UIKit tab item/controller assertion on Schedule selection; Liquid Glass on every prominent button (sign-in, scan-again, booking actions, floating search FAB); dynamic-provider brand color (light maroon + dark system-red, ≥4.5:1); semantic stroke borders replacing dark-mode-invisible black-opacity shadows; native `.sheet` with detents + `.presentationBackgroundInteraction` for scan results; camera permission priming gated on `AVCaptureDevice.authorizationStatus`; VoiceOver manual-entry fallback for the Scan tab; Reduce Motion honored on every non-kiosk animation; reusable Toast over `.alert` for non-blocking errors; Dynamic Type semantic fonts replacing hardcoded `.system(size:)`; Universal accessibility announcements on form errors.

## Per-screen P1s shipped 2026-05-03

In addition to the cross-cutting CC-1..CC-10 work, the following per-screen P1s shipped this session as a P1-correctness sweep:

- ✅ AppTabView — `.badge` accessibility (still P2; pending — see remaining)
- ✅ LoginView — decorative `Image("Badgers")` marked `.accessibilityHidden(true)`
- ✅ LoginView — error `AccessibilityNotification.Announcement` post on `session.error` change
- ✅ HomeView — navigationTitle "Dashboard" → "Home" (matches tab label)
- ✅ ItemsView — swipe actions added (leading: Favorite, trailing: Reserve)
- ✅ ItemDetailView — hero title `.font(.system(size: 24))` → `.font(.title2.weight(.heavy))` (Dynamic Type)
- ✅ ItemDetailView — `wiRed` killed (folded into CC-10)
- ✅ BookingsView — `.sensoryFeedback(.success, trigger: navigationPath)` removed (haptic-on-navigation bug)
- ✅ BookingsView — "+" toolbar moved from `.topBarLeading` → `.topBarTrailing`
- ✅ BookingDetailView — Liquid Glass action buttons (folded into CC-4)
- ✅ BookingDetailView — overdue banner `Color.red` → `Color(.systemRed)` (Increase Contrast adaptation)
- ✅ BookingDetailView — `Haptics.success()`/`.warning()` on cancel completion
- ✅ ScanView — camera permission priming (CC-6 / the only P0)
- ✅ ScanView — dropped hardcoded `.tint(.white)` on in-scanner ProgressView

**Per-screen items still open** (defer until device-tested):
- BookingsView — segmented Picker → `.searchable(scope:)` migration. The audit's "iOS 14-era" call has multiple valid alternatives (`.searchScopes`, sub-tabs, Menu-in-title) each with UX tradeoffs. Right call to defer until eyes-on the existing flow.
- CC-3 Liquid Glass on hand-rolled tinted banners (Overdue / Flagged / LostBulkUnits in HomeView). System materials (`.regularMaterial`, `.ultraThinMaterial`) auto-promote to Liquid Glass on iOS 26; the tinted-bg banners use `Color.X.opacity(0.06)` which doesn't promote. Migration is `.glassEffect(.regular.tint(.red).interactive())` but the visual call is best made on device.
- HomeView `StatStrip` clipping behavior at AX5 — needs Dynamic Type AX5 simulator pass.
- ScheduleView's existing inline toast could migrate to the new `Toast` component (separate refactor).

**2026-06-05 follow-up:** Items list favorite failures no longer silently revert. `ItemsView` now keeps optimistic favorite updates, rolls back on failure, and shows the shared non-blocking `Toast` with "Couldn't update favorite" when the server rejects the mutation.

## Aggregate findings (P0 cohort, all 8 screens)

| Screen | P0 | P1 | P2 |
|---|---|---|---|
| AppTabView | 0 | 2 | 2 |
| LoginView | 0 | 3 | 3 |
| ScanView | 1 | 3 | 2 |
| HomeView | 0 | 2 | 3 |
| ItemsView | 0 | 1 | 2 |
| ItemDetailView | 0 | 2 | 2 |
| BookingsView | 0 | 2 | 1 |
| BookingDetailView | 0 | 1 | 3 |
| **Total** | **1** | **16** | **18** |

Plus 9 cross-cutting items (CC-1..CC-9).

**Patterns that recur across ≥3 screens** (best fixed once via codemod, not per-screen):
1. Hardcoded `Color.black.opacity(...)` shadows → CC-5
2. Hand-rolled action buttons over native `.buttonStyle(.glass*)` → CC-4
3. Hand-rolled card backgrounds over `.glassEffect()` → CC-3
4. Custom `ScalePressStyle` everywhere → drops out with CC-4
5. Hardcoded RGB brand colors instead of Asset Catalog → new CC-10

- [x] **CC-10 — Consolidate brand colors with dark-mode adaptation.** ✅ Shipped 2026-05-03.
      Brand.swift is now the single source of truth. `Color.brandPrimary` uses `UIColor(dynamicProvider:)` — dark maroon (#A00000) in light, system-red luminance (#FF3B30) in dark (≥4.5:1 contrast). Killed the duplicate `wiRed` in ItemDetailView; tokenized LoginView gradient stops as `brandSplashTop`/`brandSplashMid`. WisconsinApp simplified to `.tint(.brandPrimary)`. Asset Catalog migration with high-contrast variants is still possible later but no longer urgent — the dynamicProvider gives the same runtime behavior.
      Cite: https://developer.apple.com/design/human-interface-guidelines/color

---

## Working order

1. Finish P0/P1 cohort audit: Home, Items, ItemDetail, Bookings, BookingDetail (next session, into this same doc).
2. Triage cross-cutting items (CC-1..CC-9) → single hardening sprint plan in `tasks/hig-hardening-ios-plan.md`.
3. Execute sweeps in this order (smallest blast radius first):
   - CC-5 (shadow sweep — pure cleanup)
   - CC-1 + CC-2 (Tab API migration — single file)
   - CC-3 + CC-4 (Liquid Glass + button styles — visible polish)
   - CC-6 (permission priming — prereq for any future system access)
   - CC-7 + CC-8 (safeAreaInset + Reduce Motion)
4. Re-audit each screen post-change; check items here.

## Cross-references

- Full per-feature audits (separate concern): `tasks/audit-bookings-ios.md`, `tasks/audit-items-ios.md`, `tasks/audit-login-ios.md`, etc.
- Existing iOS 26 plan: `tasks/ios-swift62-liquidglass-plan.md` — **stale**. Its Slice 1 (bump deployment target to iOS 26) is already complete per `ios/project.yml`. Slices 2 (Swift 6.2 Approachable Concurrency) and 3 (Liquid Glass adoption) should be folded into this audit's CC-1..CC-9 sweep and the file archived.
- Memory: iOS uses XcodeGen — regenerate after new files (`xcodegen generate` in `ios/`).

## Lessons

- WebFetch's underlying model has a stale knowledge cutoff and can't see iOS 26. Use `mcp__plugin_ecc_exa__web_fetch_exa` for current Apple docs; HIG pages themselves are JS-only but SwiftUI reference pages render as plain text.
- `ios/project.yml` confirms iOS 26.0 deployment target — we're free to use Liquid Glass APIs unconditionally.
- Recurring anti-patterns to codemod, not per-screen-fix: hardcoded `Color.black.opacity` shadows, hand-rolled material overlays, legacy `.tabItem` pattern.
