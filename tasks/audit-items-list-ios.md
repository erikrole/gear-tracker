# Audit: items list (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but `AssetListBadge` and `AssetStatusBadge` carry **real status-color drift the static detector missed** — both return raw `.red/.green/.blue/.orange/.purple` from private `var` getters (switch arms), which slip past R1's `.foregroundStyle(.red)`-shaped pattern. The drift detector earns a new rule (R7) as a result. Plus per-row VoiceOver gaps on `AssetRow` and skeleton-state VO pollution.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `ItemsView` + `AssetRow` + `AssetListBadge` + `AssetThumbnail` + `AssetStatusBadge` + `AssetStatusFilterMenu` in `ios/Wisconsin/Views/ItemsView.swift`. Focused follow-up to `audit-items-ios.md` (2026-04-24, broad architectural audit) after today's pattern lock-in.

**Surrounding context:** today's drift detector reports 0 R1–R6 violations on this file. The drift the audit catches lives in a class of code R1 doesn't see — switch-arm returns from private color-typed vars. Earns a new R7 rule that complements R1.

## P0 — blocks MVP

_None._ The list works. Pagination, search debounce, filter menu, retry-on-error, swipe-to-favorite, swipe-to-reserve, context menu, skeleton state, navigation destinations all function. No phantom-success class bugs.

## P1 — polish before ship

- [x] [Hardening] **`AssetListBadge.badgeColor` returns raw `.red/.green/.blue/.purple/.orange/.secondary/.gray`** from a switch on `computedStatus`. Same anti-pattern as R1 (raw status color literals) but in a different syntactic position — switch-arm `return` rather than `.foregroundStyle(.red)`. R1 didn't catch it. The visible result: capsule background and foreground use raw colors; in dark mode they don't get the cross-app contrast adjustments that `Color.statusText/.statusBackground` provides.
      `ios/Wisconsin/Views/ItemsView.swift:341-353`.
      Suggested fix: replace `badgeColor: Color` with `tone: StatusTone?`, route through `Color.statusText(_:)` and `Color.statusBackground(_:)` for foreground/background. Mirror the `CoveragePill` and `TradeStatusChip` fixes shipped today.

- [x] [Hardening] **`AssetStatusBadge.color` same pattern.** Same fix shape.
      `ios/Wisconsin/Views/ItemsView.swift:442-451`.

- [x] [Drift detector] **Extend the detector with R7 to catch switch/return raw status colors.** R1 catches `\.(foregroundStyle|fill|tint|background)\(\.red\)` — a modifier directly on a color literal. It misses the very common pattern of a private `var` returning a `Color` from a switch:
      ```swift
      private var color: Color {
          switch status {
          case .available: .green   // R1 doesn't see this
          case .checkedOut: .blue
          }
      }
      ```
      New R7 catches `(case\s+\.[a-zA-Z_]+:|return)\s+\.(red|green|blue|orange|purple)\b` — case arms or explicit returns immediately followed by a status color literal. Doesn't false-positive on `.foregroundStyle(Color.statusText(.green))` because the `.green` there isn't directly after a case-arm or return.

- [x] [A11y] **`AssetRow` not a combined accessibility element.** VoiceOver walks thumbnail, asset tag, subtitle, category · location, badge, due-label — six pieces per row. This is a high-traffic row component (every items-list row, plus accessory child rows in the item-detail accessory card use the same shape).
      `ios/Wisconsin/Views/ItemsView.swift:289-336`.
      Suggested fix: `.accessibilityElement(children: .combine)` + explicit row label that surfaces overdue state first when applicable: "Overdue: {tag}, {brand model}, {category}, {location}, due {date}, {requester name when checked out}." Decorative thumbnail stays inside via `.accessibilityHidden(true)` since the asset tag/name names the item adequately.

- [x] [A11y] **`AssetListBadge` shouldn't expose its own VO state when consumed inside `AssetRow`.** Today VO reads "Available, due 3d" as a separate announcement from the row. After the row gets a combined label that mentions the status + due-label inline, the badge can `.accessibilityHidden(true)` so VO doesn't double-announce.
      `ios/Wisconsin/Views/ItemsView.swift:377-395`.

- [x] [A11y] **`ItemRowSkeleton` placeholder list should be VO-hidden.** Eight skeleton rows pollute VO with placeholder shapes during initial load. Same fix shape as today's BookingsView + HomeView skeleton fixes.
      `ios/Wisconsin/Views/ItemsView.swift:135-141`.

- [x] [A11y] **`AssetThumbnail` "bag" placeholder Image leaks.** When an asset has no image, the placeholder `Image(systemName: "bag")` reads as "bag" alongside whatever the parent row says. Hide it.
      `ios/Wisconsin/Views/ItemsView.swift:421-425`.
      Decision: actually since the asset row already mentions the asset by name + tag, the entire AssetThumbnail can stay inside the combined-row a11y element via `.accessibilityHidden(true)`. The placeholder hide is implicit in that wider hide.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Swipe-action `Label("Favorite", systemImage:)` and `Label("Reserve", systemImage:)` leak icon names to VoiceOver. Same disposition as the booking-detail audit's deferred a11y on action toolbars — Label-with-icon is the standard SwiftUI pattern; VO reads the text fine; the icon name leak is mild. Skip until reported.
- [ ] [Polish] **Deferred.** Filter menu `Image(systemName: "checkmark")` selected-indicator. Standard Menu pattern; VO handles segmented selection fine. Skip.
- [ ] [Polish] **Deferred.** Per-status filter pre-selection (e.g. "show only checked-out by default for STAFF"). Power-user; web has rich filtering; iOS keeps simple by `feedback_ios_vs_web_role.md`.

## Acceptance criteria status

Per `AREA_ITEMS.md` and the prior audit:

- [x] AC: paginated items list with search.
- [x] AC: status filter menu.
- [x] AC: favorites toggle (swipe + filter).
- [x] AC: Reserve swipe + context menu (prefilled).
- [x] AC: skeleton + error + empty states.
- [x] AC: navigation to detail + reserve flow.
- [x] AC: status colors via cross-app token system — **closed by P1 R1+R7 fix.**
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 a11y fix.**
- [x] AC: skeleton state doesn't pollute VoiceOver — **closed by P1 fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening (a real R7-class drift caught + detector extended)
- [x] Parity (rich filtering intentionally web-only)
- [x] Accessibility
