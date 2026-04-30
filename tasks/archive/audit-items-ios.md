# Audit: items (iOS) — 2026-04-24

**MVP verdict (post-fix, pre-Xcode-verify):** all P0 + P1 addressed; needs build verification.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

Scope: `ItemsView` list (search + status filter + favorites toggle + context menu) + `ItemDetailView` + `EditAssetSheet`.

## P0 — blocks MVP

- [x] [Flows] Status-filter / favorites-toggle change silently drops the new load when a previous load is still in flight — same `guard !isLoading` race as bookings P0.
      `ios/Wisconsin/Views/ItemsView.swift:19` (`guard !isLoading else { return }`); toolbar handlers at `:187-188` and `:195-197` both call `vm.load(reset: true)` immediately on toggle.
      Why it blocks ship: tap the filter, tap again before the first request completes — UI keeps showing pre-filter rows with no spinner. Wrong-data risk during a quick "show me checked-out items" lookup in front of a class.
      Suggested fix: mirror the `loadTask` cancellation pattern just shipped in `BookingsViewModel` — store the `Task<Void, Never>?`, cancel on reset, swallow `CancellationError`.

## P1 — polish before ship

- [x] [Flows] List context-menu "Reserve" opens `CreateBookingSheet` with no asset prefill — user has to re-find the gear they just long-pressed.
      `ios/Wisconsin/Views/ItemsView.swift:156-160` and `:206-208` (`CreateBookingSheet { _ in reserveAsset = nil }`).
      Why it matters: misleading affordance. The user expects "Reserve" on a row to start a reservation **for that asset**. The current sheet is generic, no preselected asset, no location prefill. Confusing in front of a class.
      Suggested fix: extend `CreateBookingViewModel` with an asset-prefill API (push the asset id into `selectedAssetIds` and the asset's `location.id` into `selectedLocationId`), and call it from the sheet's init when launched from the row context menu.

- [x] [Hardening] `ItemDetailView` favorite toggle swallows errors with `try?` and leaves UI in the optimistic state on failure.
      `ios/Wisconsin/Views/ItemDetailView.swift:51-56` — `isFavorited.toggle()` then `Task { isFavorited = (try? await APIClient.shared.toggleFavorite(...)) ?? isFavorited }`.
      Why it matters: if the request fails, the screen shows ⭐ but the server state is unchanged. User can't tell. Subsequent navigations will reveal the lie.
      Suggested fix: mirror the list VM pattern — `do/catch`, revert `isFavorited` on failure, surface a transient error.

- [x] [Hardening] No role gating on the edit pencil in `ItemDetailView`.
      `ios/Wisconsin/Views/ItemDetailView.swift:59-63`.
      Why it matters: AREA_ITEMS AC-7 requires "role-appropriate actions" on detail. STUDENTs see the pencil; tapping → server 403. AREA_MOBILE AC-5 demands UI-side hiding.
      Suggested fix: gate behind `session.currentUser?.role` ∈ {`STAFF`, `ADMIN`}. (Items are operationally an admin domain; no student-self-edit case applies.)

- [x] [Flows] `EditAssetSheet` Cancel has no "discard changes?" confirm and stays enabled while saving — accidental dismiss eats input; mid-save dismiss orphans the request.
      `ios/Wisconsin/Views/ItemDetailView.swift:170-178`.
      Suggested fix: same pattern just shipped on bookings — `confirmationDialog` when `hasChanges`, disable Cancel + `interactiveDismissDisabled` while `isSaving`.

- [x] [Breaking] Pagination errors swallowed — `vm.error` is set but only renders when the list is empty; trailing spinner spins forever on flaky network.
      `ios/Wisconsin/Views/ItemsView.swift:45-47` writes `error`; `:115` only shows it when `assets.isEmpty`; `:171-175` trailing spinner has no error fallback.
      Suggested fix: same `pageError` + inline Retry pattern just landed on `BookingsView`.

- [x] [UI polish] `AssetThumbnail` border uses hardcoded `Color.black.opacity(0.08)` — disappears in dark mode, every list row + the detail hero loses its subtle frame.
      `ios/Wisconsin/Views/ItemsView.swift:299`.
      Suggested fix: replace with `Color(.separator)`.

- [x] [UI polish] Toolbar trailing controls (favorites star + filter menu) are 4pt apart and use raw `Image(systemName:)` without `frame`/padding, putting tap targets under 44pt.
      `ios/Wisconsin/Views/ItemsView.swift:184-198`.
      Suggested fix: increase HStack spacing to ≥ 12; give each button `.frame(minWidth: 44, minHeight: 44)` or wrap as `.buttonStyle(.bordered)` for native sizing.

## P2 — post-MVP

- [ ] [Parity] **Deferred → GAP-36.** AREA_ITEMS AC-8 lists primary detail actions {Reserve, Duplicate, Retire, Delete, Needs Maintenance} — iOS detail exposes none of them. Feature add (needs API client methods + policy gating). Tracked.

- [x] [UI polish] Purchase price uses `Locale.current.currency?.identifier` with USD fallback instead of a hardcoded code.

- [x] [Flows] Reserve completion now navigates to the new booking via `BookingRouteId` push on `navigationPath`.

- [x] [Hardening] Decision: requester name stays visible to all roles. Small team, ownership visibility is the desired UX. No privacy gating applied.

## Acceptance criteria status

AREA_MOBILE.md:
- [x] AC-2 — list supports search + status filter + favorites scope + row-to-detail (`ItemsView.swift:181, 195, 187, 203-205`).
- [x] AC-3 — overdue red treatment on detail's active booking section (`ItemDetailView.swift:289-294`).
- [x] AC-5 — edit pencil hidden unless STAFF/ADMIN (`ItemDetailView.canEditAsset`); Reserve action remains available (students may reserve items for themselves) but server-side gating is authoritative.

AREA_ITEMS.md (iOS surface only):
- [x] AC-1 — list supports search, status filter (Available/Checked Out/Reserved/Maintenance), and favorites scope.
- [x] AC-2 — `tagName` (assetTag) is primary in list row title (`ItemsView.swift:222`).
- [x] AC-4 — status is derived (`AssetComputedStatus`), not freeform.
- [x] AC-7 — edit gating now present (STAFF/ADMIN only). Tabs remain a web-only construct; acceptable for V1 mobile.
- [ ] AC-8 — **missing on iOS**: Duplicate / Retire / Delete / Needs Maintenance not surfaced. P2 parity.
- [x] AC-11 — empty optional fields are simply omitted (`ItemDetailView.swift:236-249` only renders LabeledContent when value present).
- [x] AC-13 — Edit sheet does not touch `assetTag` (`ItemDetailView.swift:185-189`).

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational)

## Files read
- `docs/AREA_MOBILE.md`
- `docs/AREA_ITEMS.md` (acceptance + detail-surface sections)
- `docs/GAPS_AND_RISKS.md` (skim — no items-iOS-specific gap open)
- `ios/Wisconsin/Views/ItemsView.swift`
- `ios/Wisconsin/Views/ItemDetailView.swift`
- `ios/Wisconsin/Models/AssetModels.swift`
- `ios/Wisconsin/Core/APIClient.swift` (assets, asset, updateAsset, toggleFavorite)

## Notes
- Static audit only. User must verify in Xcode after fixes.
- The bookings audit just shipped a `loadTask` cancellation pattern + `pageError` retry row + `EditAssetSheet`-style discard confirm. The fixes here should be the same shape — quick to land.
- Privacy P2 (badge shows requester name) is worth a separate decision: keep it, anonymize for STUDENTs, or hide entirely on student mobile.
