# Audit: notifications sheet (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but several notification types (damage / lost / low-stock) tap into a silent dead-end ("mark-read only, no navigation target yet"), pagination uses an explicit "Load More" button instead of infinite scroll, and `loadMore` swallows errors with `try?`.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `NotificationsSheet` + `NotificationsViewModel` + `NotificationRow` in `ios/Wisconsin/Views/NotificationsSheet.swift`. Universal touchpoint — every user touches this when the bell badge appears on `HomeView`.

**Surrounding context:** today's profile pass made push channels and quiet-hours manageable from inside the app. The notifications sheet is the inbox side of that loop. Slice 13 (2026-05-07) shipped type-tinted icons matching web's `notifIconBg`. The grouping (Today / Yesterday / This Week / Older), the unread-dot indicator, pull-to-refresh, mark-all-read, and per-row swipe-to-mark-read all already ship.

## P0 — blocks MVP

_None._ Loads correctly; auth failures route via the global 401 broadcaster (`APIClient`); pull-to-refresh works; the bell badge in `HomeView` reflects `appState.unreadNotifCount`; "Mark All Read" toolbar action fires; tap-to-navigate works for bookings + trades.

## P1 — polish before ship

- [x] [Gaps] **Asset-related notifications dead-end on tap.** `checkin_item_damaged`, `checkin_item_lost`, and `low_stock` all carry `assetId` in their payload but the row's `handleTap` only navigates if `effectiveBookingId` exists or the type starts with `trade_`. A staffer tapping a "Camera A reported damaged" notification gets nothing — the row marks read and stays put. The natural target (the asset detail) is one tap away if we plumb it.
      `ios/Wisconsin/Views/NotificationsSheet.swift:162-172` (`handleTap` falls through silently for these types) and `Models/NotificationModels.swift:19` (`assetId` is decoded but never read).
      Why it matters: the floor's primary "what should I do about this?" path. A damage notification IS a call to action — fix the gear, file a report, follow up. Routing to the asset detail puts the staffer one step closer to that action.
      Suggested fix: extend `NotificationsSheet` with an optional `onSelectAsset: ((String) -> Void)?` callback (parity with the existing `onSelectBooking` / `onSelectTrades`); branch `handleTap` to fire it when the notification type is asset-related (`checkin_item_damaged`, `checkin_item_lost`, `low_stock`, `reservation_pickup_ready` when no bookingId) AND `payload.assetId` is non-nil. Wire `HomeView` with a `pendingAssetId: String?` + `AssetRouteId` (mirroring the existing `BookingRouteId` pattern) so the sheet's onDismiss appends the navigation cleanly.

- [x] [UI polish] **Pagination uses an explicit "Load More" button instead of infinite scroll.** Floor users expect "scroll down → more loads" on iOS; an explicit button forces a tap they don't expect.
      `ios/Wisconsin/Views/NotificationsSheet.swift:148-156`.
      Suggested fix: replace the `Load More` `Section` with a `task(id:)` modifier on a sentinel row at the end of the list that fires `loadMore` when it appears. Keep a small `ProgressView` in that slot while loading. Falls back to retry on error (see hardening fix below).

- [x] [Hardening] **`loadMore` swallows errors with `try?`.** Server failure on page 2+ leaves the user staring at an unchanging list with no signal. The first-page error gets a `ContentUnavailableView` retry; subsequent pages get nothing.
      `ios/Wisconsin/Views/NotificationsSheet.swift:28-36`.
      Suggested fix: capture a `pageError: String?` on `NotificationsViewModel`; surface it in the sentinel row alongside a Retry button on failure. Same pattern shipped on items + bookings list pagination.

- [x] [Flows] **Swipe-mark-read fires no haptic.** Mark-all-read uses `.sensoryFeedback(.success, trigger:)` ✓ but per-row swipe-mark-read is silent. Floor users marking through a stack of notifications get tactile confirmation on the bulk action and silence on individual ones.
      `ios/Wisconsin/Views/NotificationsSheet.swift:125-144`.
      Suggested fix: add `.sensoryFeedback(.selection, trigger:)` keyed on a tickable state, or call `Haptics.tap()` inside the swipe action's closure.

- [x] [A11y] **Swipe-action `Label("Mark Read", systemImage: "checkmark")` exposes the icon name.** SwiftUI Labels in swipe actions read both pieces; VoiceOver hears "checkmark, Mark Read." Same family of fix as the booking detail pass.
      `ios/Wisconsin/Views/NotificationsSheet.swift:128-131, 138-141`.
      Suggested fix: explicit `.accessibilityLabel("Mark as read")` on the swipe button.

- [x] [UI polish] **The non-navigating notification types (`shift_gear_up`, `low_stock`, others) silently mark-read on tap with no visual feedback.** A user tapping such a row sees the unread dot disappear but no other affordance — the row stays in place. Combined with the asset-navigation fix above, `low_stock` now navigates; `shift_gear_up` is the only remaining no-target type. A subtle hint (e.g., the row briefly highlights to confirm the read action) closes the loop.
      `ios/Wisconsin/Views/NotificationsSheet.swift:171-172`.
      Decision: **Skip.** The unread-dot disappearance IS the visual feedback. Adding a flash on tap would compete with the natural scroll/dismiss intent. Leave the silent mark-read for these types.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** `shift_gear_up` navigation target — no iOS shift detail exists yet; routing to ScheduleView in general would leave the user hunting. Defer until a per-shift detail surface lands.
- [ ] [Polish] **Deferred.** Unread-only filter / segmented control. Web doesn't have it either; the visual distinction (semibold + dot) covers the scanning need.
- [ ] [Polish] **Deferred.** Mark-as-unread inverse swipe. Rarely needed.
- [x] [Hardening] **Notification read actions now recover honestly.** `markRead` / `markAllRead` no longer swallow API failures. The iOS API client routes both PATCH actions through the shared response handler, and the sheet restores optimistic unread state plus shows a recoverable Refresh banner with error haptic when a read mutation fails.
      `ios/Wisconsin/Core/APIClient.swift`; `ios/Wisconsin/Views/NotificationsSheet.swift`
- [ ] [Polish] **Deferred.** Pull-to-refresh after `markAllRead` to catch unloaded unread notifications past page 1. Today they're marked read server-side but not in the local list; the next manual refresh corrects it.

## Acceptance criteria status

There is no `AREA_NOTIFICATIONS_SHEET` doc; AC inferred from `AREA_NOTIFICATIONS.md`:

- [x] AC: bell badge → sheet → list of recent notifications.
- [x] AC: grouped by Today / Yesterday / This Week / Older.
- [x] AC: unread state visible (semibold title + accent dot).
- [x] AC: per-row tap marks read.
- [x] AC: per-row swipe-to-mark-read.
- [x] AC: bulk Mark All Read.
- [x] AC: type-tinted icons (slice 13 / 2026-05-07).
- [x] AC: pull-to-refresh.
- [x] AC: damage / lost / low-stock notifications navigate to asset detail — **closed by P1 navigation fix.**
- [x] AC: pagination feels native (infinite scroll, not a button) — **closed by P1 fix.**
- [x] AC: loadMore failures are recoverable — **closed by P1 hardening fix.**
- [x] AC: swipe-mark-read feels tactile — **closed by P1 haptic fix.**
- [x] AC: VoiceOver users hear "Mark as read" without icon noise — **closed by P1 a11y fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web grouping + tinting matches per slice 13)
- [x] Accessibility
