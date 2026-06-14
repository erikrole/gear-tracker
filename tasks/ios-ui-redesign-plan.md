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

## Review
(filled in on completion)
