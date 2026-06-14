# iOS UI Redesign — Native Liquid Glass Pass

**Branch:** `claude/ios-ui-redesign-kroihc`
**Direction (user-chosen):** Native Liquid Glass — lean into iOS 26 system materials/depth, Wisconsin red as a disciplined accent.
**Scope (user-chosen):** Full sweep — foundation + all major screens.

## Constraints / risks
- **No Xcode/Swift toolchain in this container** — cannot compile or screenshot. Verify by careful Swift correctness + tight, consistent diffs. Needs a compile + simulator pass on the user's machine before merge.
- **Proven Liquid Glass API surface only** (already compiles in this repo): `.buttonStyle(.glass)`, `.buttonStyle(.glassProminent)`, `.background(.regularMaterial/.ultraThinMaterial, in:)`, `.symbolEffect`, `.presentationDetents`. Avoid unproven `glassEffect()`/`GlassEffectContainer` to keep the build safe.
- **Do NOT switch `AppTabView` to value-based `Tab(...)`** — reproduced UIKit crash (lessons.md "UI Reliability"). Keep `TabView` + `.tabItem`/`.tag`.
- **No new files** — adding to `project.pbxproj` (objectVersion 77, explicit refs) is unverifiable risk. Put the foundation in the already-referenced `Brand.swift`.
- **UI-only** — do not touch Codable models / API request bodies (lessons: decode drift).

## Design system foundation (Brand.swift)
- `Brand.Space` spacing scale, `Brand.Radius` radius scale.
- Card surface colors (`.cardSurface`, `.cardSurfaceRaised`, `.hairline`).
- `.brandCard()` view modifier — one consistent card (continuous radius, hairline, soft shadow).
- `SectionHeader` — consistent section titles across screens.
- `FilterChip` — unify the repeated `.regularMaterial` capsule chips.
- `StatTile` — unify Home/Settings stat cards.

## Slices (each commit independently sensible)
1. Foundation in Brand.swift.
2. HomeView — flagship redesign (stat tiles, action queue cards, glass FAB).
3. ItemsView + ItemDetailView.
4. BookingsView + BookingDetailView.
5. ScheduleView.
6. ProfileView/Settings + LoginView polish.
7. Docs + lessons sync.

## Review (2026-06-14)

**Shipped:**
- Foundation in `Brand.swift`: `Brand.Space`/`Brand.Radius`, `.brandCard()`, `cardSurface`/`cardSurfaceRaised`/`hairline`, `SectionHeader`, `FilterChip`.
- HomeView: full redesign on the card system (grouped bg, elevated cards, section headers, glass FAB, continuous corners).
- ItemDetailView: cards → `brandCard()` / continuous corners + spacing scale.
- Shared `FormCard` routed through `brandCard()` → propagates to BookingDetailView, EditAssetSheet, CreateBookingSheet.
- ScheduleView: scope chips → shared `FilterChip`.
- LoginView: continuous squircle corners on fields + card.
- CreateBookingSheet review cards: continuous corners + tokens.
- Docs: `IOS_PATTERNS.md` "Layout & cards" section; `AREA_MOBILE.md` change log; `lessons.md`.

**Decisions:**
- Dropped speculative `StatTile` (no non-regressing adoption site).
- Left BookingsView / ItemsView lists largely as-is — already clean native plain lists; the design-system wins there are the shared row/card primitives they already use.
- AppTabView Settings already used continuous corners — no change needed.

**Not done / deferred (needs the user's Xcode pass first):**
- Compile + simulator verification (no Swift toolchain in the web container).
- UsersView/UserDetailView and the smaller sheets (EventDetailSheet, ExtendBookingSheet, NotificationsSheet) — mostly Form/List or already use the now-modernized `FormCard`; revisit after a visual pass on device.

**CI note:** the `validate` check fails on `prisma generate` (`Missing DIRECT_URL`) for every PR — pre-existing infra, unrelated to this iOS-only diff.
