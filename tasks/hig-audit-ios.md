# Apple HIG Audit — iOS (Wisconsin app) — 2026-05-03

**Scope:** Apple Human Interface Guidelines + iOS 26+ modern SwiftUI APIs.
**Target:** iOS 26.0 deployment, Swift 5.10, Xcode 16+ (per `ios/project.yml`). Forward-compatible to iOS 27.
**Ship bar:** modern, idiomatic, Liquid-Glass-native, ready for iOS 27 the day it ships.

**Method:** static source review against the 10-lens rubric below, grounded in Apple's
own documentation. Each finding cites the canonical Apple URL it derives from.
Findings tagged P0 (HIG violation), P1 (clear deviation), P2 (polish/feel).

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

- [x] **CC-1 — Migrate `TabView` to the new `Tab` struct API.** ✅ Shipped 2026-05-03.
      The current `AppTabView.swift:10-32` uses the legacy `.tabItem { Label(...) }` pattern. iOS 26 introduces `Tab("Home", systemImage: "house") { HomeView() }` which is the canonical declaration. The old pattern still compiles but the new one is required to access `TabRole`, `tabPlacement`, and the floating-tab-bar adaptations on iPad/Mac. Cite: https://developer.apple.com/documentation/swiftui/tab

- [x] **CC-2 — Adopt `TabRole.search` (where applicable) and `.tabBarMinimizeBehavior(.onScrollDown)`.** ✅ Shipped 2026-05-03.
      The Scan tab is a search-flow entry; using `role: .search` puts it in the conventional search slot and unlocks system search styling. Adding `.tabBarMinimizeBehavior(.onScrollDown)` on the `TabView` gives the modern iOS 26 disappearing tab bar behavior on scroll. Cites: https://developer.apple.com/documentation/swiftui/tabrole, https://developer.apple.com/documentation/swiftui/view/tabbarminimizebehavior(_:)

- [ ] **CC-3 — Replace hand-rolled `.regularMaterial`/`.ultraThinMaterial` overlays with `.glassEffect(_:in:)` Liquid Glass.**
      Sites: `ScanView.swift:146` (`ScanResultCard` uses `.regularMaterial`), `ScanView.swift:28` (`ProgressView` in `.ultraThinMaterial` circle), `BannerView.swift` (probably). Liquid Glass is the iOS 26 system material — Apple's guidance is "Standard components in SwiftUI use Liquid Glass. Adopt Liquid Glass on custom components." Replace with `.glassEffect(in: .rect(cornerRadius: 20))` or `.glassEffect()` (default capsule). Wrap clusters in `GlassEffectContainer` for perf. Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [x] **CC-4 — Replace custom prominent buttons with `.buttonStyle(.glass)` / `.buttonStyle(.glassProminent)`.** ✅ Shipped 2026-05-03.
      - [x] BookingDetailView Extend / Cancel — `.buttonStyle(.glass).controlSize(.large).tint(.blue/.red)`.
      - [x] LoginView Sign in — dropped the `Color(.label)` inverted-fill (invisible-white-on-white in dark mode) and the custom `ScalePressStyle`. Now `.buttonStyle(.glassProminent).tint(.brandPrimary)`.
      - [x] ScanView Scan Again — `.borderedProminent` → `.glassProminent`.
      - `ScalePressStyle` remains defined for the `FABButtonStyle` analog in `FloatingSearchButton` (different style intent — that's a FAB with custom spring scale; evaluate as part of CC-3 when the FAB itself moves to `.glassEffect(.regular.tint(.accentColor).interactive(), in: .circle)`).

- [x] **CC-5 — Sweep all hardcoded `Color.black.opacity(...)` shadows.** ✅ Shipped 2026-05-03.
      Cleaned 4 shadow sites: `HomeView.swift` `StatCell` and `DashboardCard` (dropped both shadows, replaced with `Color(.separator)` stroke borders matching `ItemDetailView` card pattern); `FloatingSearchButton.swift` (dropped black drop-shadow, kept accent-tinted glow which adapts); `LoginView.swift` (kept the splash-card lift but converted to `Color(.sRGBLinear, white: 0, opacity: 0.4)` so it remains visible over the dark gradient). The 4 remaining `black.opacity` sites in the codebase are legitimate scrim/camera-overlay uses, not shadows.

- [ ] **CC-6 — Standardize permission priming via reusable pattern.**
      `PushPrePromptView.swift` exists for notifications. Need parity for camera (Scan) and any future use (mic, location, photos). Refactor into a generic `PrePromptScreen(symbol:title:body:rationale:onContinue:)` and create `ScanPrePromptView`. Cite: https://developer.apple.com/design/human-interface-guidelines/privacy

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

- [ ] **P1 — [Navigation/iOS-26] Migrate to `Tab` struct API + `TabRole.search` for Scan tab.** `AppTabView.swift:10-32`.
      Replace `.tabItem { Label("Home", systemImage: "house") }` with `Tab("Home", systemImage: "house", value: 0) { HomeView() }`. Set `Tab("Scan", systemImage: "barcode.viewfinder", value: 3, role: .search) { ScanView() }`. Add `.tabBarMinimizeBehavior(.onScrollDown)` on the `TabView`.
      Why: this is the canonical iOS 26 declaration; unlocks proper iPad sidebar adaptation and floating-tab-bar behavior on iOS 27 without code change.
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
      When `UIAccessibility.isVoiceOverRunning`, show a manual `TextField` (already plumbed via `KioskScannerField`) so VO users can type a code.

- [ ] **P2 — [Color] `ProgressView().tint(.white)` hardcoded.** `:25-29`. Drop the tint — system handles contrast.

---

### `HomeView` (`ios/Wisconsin/Views/HomeView.swift`)

**Verdict:** strong iOS 17+ practice (`@Observable`, `ContentUnavailableView`, `sensoryFeedback`, `contentTransition(.numericText())`, `.refreshable`). Two recurring anti-patterns and one tab-bar-vs-title mismatch.

- [ ] **P1 — [Materials/iOS-26] Hardcoded `.shadow(color: .black.opacity(0.06)...)` on every card.** `HomeView.swift:367-368, 525-526` (`StatCell`, `DashboardCard`).
      Identical anti-pattern to `LoginView`. iOS 26 idiom: drop the shadow and use `.glassEffect(in: .rect(cornerRadius: 12))` for card surfaces. Each `StatCell` becomes a Liquid Glass tile that morphs nicely under `GlassEffectContainer`.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [ ] **P1 — [Materials] `FloatingSearchButton` overlay should be Liquid Glass.** `HomeView.swift:290-294`.
      The whole point of the iOS 26 floating-button pattern (Photos search, Mail compose) is `.glassEffect(.regular.tint(.accentColor).interactive(), in: .circle)` + a `GlassEffectContainer`. Verify what `FloatingSearchButton` renders today; if it's a custom solid-fill circle, migrate.
      Cite: https://developer.apple.com/documentation/swiftui/applying-liquid-glass-to-custom-views

- [ ] **P2 — [Navigation] Tab label "Home" vs. screen title "Dashboard" mismatch.** `AppTabView.swift:12` ("Home") vs. `HomeView.swift:240` (`.navigationTitle("Dashboard")`).
      HIG: the tab label should match the destination's title (or be a tight synonym). Pick one. Apple's pattern is "the tab name is the noun the user navigates to" — if this screen is a dashboard, name the tab "Dashboard"; if it's home, the screen title is "Home".
      Cite: https://developer.apple.com/design/human-interface-guidelines/tab-bars

- [ ] **P2 — [DRY/UX] Three near-identical context menus on summary rows.** `HomeView.swift:148-161, 171-184, 194-207`.
      Not strictly HIG, but the duplication invites drift. Extract one `BookingSummaryContextMenu(summary:)` view modifier.

- [ ] **P2 — [Accessibility] Stat values use `.font(.title.weight(.bold))` — good for Dynamic Type — but the surrounding `.padding(12)` clips at AX5.** `:355-365`.
      Verify in the AX5 simulator. If clipped, switch to `ViewThatFits` or constrain content height.

---

### `ItemsView` (`ios/Wisconsin/Views/ItemsView.swift`)

**Verdict:** excellent — `.searchable`, `ContentUnavailableView` for all states, debounced search, skeleton list, explicit 44pt frames on toolbar buttons, `@Observable`, optimistic-update favorite. Two iOS 26 polish opportunities.

- [ ] **P1 — [Gestures] No swipe actions on List rows.** `ItemsView.swift:144-172`.
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
