# Audit: guides (iOS) - 2026-07-03

**MVP verdict:** READY - 0 P0, 0 P1 open
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** source audit plus simulator screenshots

## P0 - blocks MVP

_None._

## P1 - polish before ship

- [x] [UI polish] The guide reader presented the title and article inside web-like chrome instead of using native reading hierarchy.
      `ios/Wisconsin/Views/GuidesView.swift`
      Why it mattered: the generic navigation title, small tag pills, and one oversized article card made operational guides feel embedded rather than at home on iOS.
      Fix: the reader now uses a compact semantic header, Dynamic Type system typography, a cardless article canvas, distinct numbered-step markers, and an accessible callout treatment while keeping the content read-only. It does not repeat the generated body excerpt above the article, and it suppresses a leading Markdown rule that would duplicate the header separator.

- [x] [Breaking] The July 5 Resources payload slimming removed full Markdown from `/api/resources`, but the native reader still opened from that compact list model.
      `ios/Wisconsin/Views/GuidesView.swift`, `ios/Wisconsin/Core/APIClient.swift`, `ios/Wisconsin/Models/Models.swift`
      Why it mattered: the guide directory loaded, but opening a guide rendered an empty article.
      Fix: list rows now decode the bounded `searchText`, local search uses it, and the reader fetches the full guide by slug with loading, retry, and pull-to-refresh states.

- [x] [Flows] Native Markdown numbered lists repeated `1.` for every ordered step.
      `ios/Wisconsin/Views/GuidesView.swift`
      Why it mattered: operational guides use numbered steps; repeating `1.` makes instructions harder to follow in the field.
      Fix: `MarkdownBlock.Kind.numbered` now carries the parsed number and renders that value.

- [x] [Accessibility] Guide list rows inherited the full Markdown-derived summary in their combined accessibility label.
      `ios/Wisconsin/Views/GuidesView.swift`
      Why it mattered: VoiceOver users heard a long body excerpt before the useful row metadata.
      Fix: `GuideRow` now exposes a compact label with title, guide type/category, and updated date.

- [x] [UI polish] The reader article could run under the pinned tab/search bar at the bottom of the screen.
      `ios/Wisconsin/Views/GuidesView.swift`
      Why it mattered: long instructions should remain readable without bottom chrome covering text.
      Fix: `GuideReaderView` hides the tab bar while the pushed article is open and keeps a bottom safe-area inset for article scrolling.

## P2 - post-MVP

- [ ] Full native guide authoring, verification, Contacts, and sport assignment reference tools remain web-owned by design.

## Acceptance criteria status

- [x] Native guide list loads from the existing Resources contract.
- [x] Search, focus filtering, sort, pull-to-refresh, loading, empty, and error states are present.
- [x] Guide reader renders Markdown article content in native SwiftUI.
- [x] Reader fetches full Markdown from the detail route after the compact list payload loads.
- [x] Reader hierarchy, metadata, steps, and callouts use native SwiftUI presentation and Dynamic Type.
- [x] Guide authoring and management remain web-owned.

## Runtime proof

- [x] Guides list screenshot before reader fix: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_205d7226-3cbb-4cab-8c6b-1cfb971cd593.jpg`
- [x] Guide reader numbered-list screenshot before bottom inset: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_4ce9d1d6-4299-4b78-8c74-93bacd63983f.jpg`
- [x] Final guide reader screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_637461c1-bdd6-42be-b625-bf7ba23d9139.jpg`

## Lenses checked

- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity
- [x] Accessibility

## Files read

- `docs/AREA_MOBILE.md`
- `docs/AREA_RESOURCES.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `ios/Wisconsin/Views/GuidesView.swift`
- `ios/Wisconsin/Core/APIClient.swift`
- `tasks/audit-all-pages-ios.md`
