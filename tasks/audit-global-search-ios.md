# Audit: global search (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but a stale-write race silently swaps newer results for older ones on slow networks, three "View all" buttons render but do nothing, and `searchError` is set on server failure but never displayed.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `GlobalSearchSheet` + `FloatingSearchButton` in `ios/Wisconsin/Views/Search/`. Excludes `QRScannerSheet` (covered by the prior scan-pass cross-pollination — torch toggle, manual entry, dedupe pattern) and the per-row result views in `SearchResultRow.swift`.

**Surrounding context:** the floating search button on `HomeView` is the floor's universal "find anything" affordance — multi-type search across items / reservations / checkouts / people, plus a QR shortcut. Used by every role multiple times per session. Recent searches persist in `UserDefaults`.

## P0 — blocks MVP

_None._ The flow works for the happy path. Search is debounced (300 ms). Tapping a result navigates to the right detail view via `SearchDestination` enum. QR shortcut routes to asset detail correctly. Recents are persisted. The sheet auto-focuses the field on appear.

## P1 — polish before ship

- [x] [Hardening] **Stale-write race overwrites newer search results with older ones on slow networks.** `scheduleSearch` cancels the prior `debounceTask` and starts a new one, but the cancel only affects the 300 ms `Task.sleep` — once `performSearch` has started the API call, it'll write `results` regardless of whether a newer search is in flight. On a laggy connection: user types "ab" (search starts), types "abc" (debounce cancels but the "ab" API call is already in flight), then `performSearch("abc")` starts. Whichever request lands last writes `results` — and on slow networks the older "ab" response can win.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:269-302`.
      Why it matters: a user typing "MERIT" and getting "MERI" results is confusing in a way that's hard to debug — the screen reads as if the search broke.
      Suggested fix: track the `currentQuery` on the view; inside `performSearch`, after `await SearchService.shared.search(...)` returns, check `currentQuery == query` before writing. Late responses for stale queries get dropped.

- [x] [Hardening] **`searchError` is set on failure but never rendered.** `performSearch` writes the catch block's `error.localizedDescription` to `searchError`, but the `Group` switch in the body never references it. Server failure looks identical to "no matches" — the user sees "No results for 'X'" when the API actually 5xx'd.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:34-44, 292-302`.
      Suggested fix: add an `errorView` branch BEFORE the `noResultsView` check, gated on `searchError != nil && results.isEmpty && !isSearching`. Surface a `wifi.exclamationmark` + retry pattern matching the rest of the app.

- [x] [Gaps] **Three "View all" buttons render with empty closures.** When any category returns ≥10 results (the `SearchService` per-category limit), `viewAllButton(label:)` renders — but its action is `// dismiss and let caller handle deep link if needed` and does literally nothing. Floor user clicks "View all items" and watches the row light up and do nothing. Misleading worse than absent.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:195-197, 211-213, 227-229, 257-265`.
      Suggested fix: drop the buttons entirely until the deep-link routing is wired (P2). Keeping a count badge in the section header is a better hint that there's more than what's shown without promising a click target that doesn't exist.

- [x] [UI polish] **`sectionHeader(_:count:)` accepts a count parameter but ignores it.** The accompanying "View all" buttons partly served this purpose; once those are dropped, the section needs a way to communicate "showing 10 of N matches."
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:249-255`.
      Suggested fix: render the count in muted tertiary text on the right side of the section header. Mirrors the pattern shipped on the kiosk pickup ring and item detail Accessories card today.

- [x] [Flows] **Keyboard stays up while scrolling results.** With a long results list, the keyboard covers the bottom rows. On iOS, `.scrollDismissesKeyboard(.immediately)` (or `.interactively`) is the canonical fix.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:183-247`.
      Suggested fix: `.scrollDismissesKeyboard(.immediately)` on the `List`. Explicit field-blur on tap-row is automatic via `Button` consuming the gesture, but the scroll-to-dismiss is the floor-friendly behavior.

- [x] [A11y] **QR-scanner toolbar button has no accessibility label.** VoiceOver reads "qrcode.viewfinder, button" — meaningless to a blind user.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:107-114`.
      Suggested fix: `.accessibilityLabel("Scan QR code")`.

- [x] [A11y] **Clear-search (xmark) button has no accessibility label.** Same family of fix.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:97-105`.
      Suggested fix: `.accessibilityLabel("Clear search")`.

- [x] [A11y] **Recent-search rows expose the clock icon name.** `Label(term, systemImage: "clock")` in the recents section reads as "clock, term" via VoiceOver.
      `ios/Wisconsin/Views/Search/GlobalSearchSheet.swift:139-144`.
      Suggested fix: explicit `.accessibilityLabel("Recent search: \(term)")` so the icon stays decorative.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Wire the dead "View all" buttons to deep-link into the right tab with the search query prefilled (Items tab with `?search=...`, Bookings tab same, etc.). Requires NavigationStack coordination across tabs and a search-prefill API on the destination view-models. Worth doing once the search load has empirical data on whether users actually want category-level expansion.
- [ ] [Polish] **Deferred.** Auto-add tap-results to recents. Today only `commitSearch` (Return key) writes to recents; tap-to-navigate doesn't. Could pollute recents if every typed character writes; needs a thoughtful rule. Skip until requested.
- [ ] [Polish] **Deferred.** Multi-section result counts displayed as a compact pill. Today each section is its own `Section` header. With many categories, the visual surface gets long; a single-line "12 items, 3 reservations, 1 person" summary at the top could speed scanning.
- [ ] [Hardening] **Deferred.** Cancel API call (not just debounce) on new query. Today the `URLSession` task isn't cancelled when a new search starts; the response just gets dropped post-fix. A proper `cancel()` would save bandwidth on slow networks. Trade-off: extra plumbing for a bandwidth-only win on a request that's typically <200 ms. Skip.

## Acceptance criteria status

There is no `AREA_GLOBAL_SEARCH` doc; AC inferred from `AREA_MOBILE.md` ("scan + global search are the floor's universal find affordances"):

- [x] AC: floating button on Home opens the sheet with auto-focused field.
- [x] AC: multi-type search across items, bookings, people.
- [x] AC: results grouped by section with counts visible — **closed by P1 count fix.**
- [x] AC: QR shortcut routes to asset detail.
- [x] AC: recent searches persisted in `UserDefaults`.
- [x] AC: server failure is distinguishable from "no matches" — **closed by P1 surfacing fix.**
- [x] AC: stale-write races don't show older results — **closed by P1 race fix.**
- [x] AC: keyboard dismisses on scroll — **closed by P1 fix.**
- [x] AC: VoiceOver users hear actions, not icon names — **closed by P1 a11y fixes.**
- [x] AC: no dead UI — **closed by P1 view-all-removal fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has command palette / search; iOS is functionally aligned)
- [x] Accessibility
