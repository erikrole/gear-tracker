# Audit: kiosk student hub (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the right-half "Status" panel literally duplicates the left-half action buttons, the network-error state is a dead-end, and accent colors drift from the cross-app token system.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskStudentHubView` in `ios/Wisconsin/Kiosk/KioskStudentHubView.swift` (the per-user landing screen between idle → action). Focused follow-up to `tasks/audit-kiosk-ios.md` (2026-04-24 broad scope), `audit-kiosk-activation-ios.md`, and `audit-kiosk-idle-ios.md` (both 2026-05-08).

**Surrounding context:** the hub is a one-shot screen — every sub-flow (checkout / pickup / return) routes back to `.idle`, not `.studentHub` (verified across `KioskCheckoutView:41,63`, `KioskPickupView:53,219`, `KioskReturnView:53,245`). So a hub instance is created fresh each time, single-load, and only matters for the few seconds a student stares at "What do you need?" before tapping.

## P0 — blocks MVP

_None._ Auth/scoping is correct (server gates 404 by `kiosk.locationId`). Sub-flow buttons route to the right screens. Inactivity timer fires from the kiosk shell. Back button is non-destructive (no scanned items at this stage).

## P1 — polish before ship

- [x] [Gaps] **Top-bar avatar discards `KioskUser.avatarUrl`.** Same drift as the idle-screen tile shipped today: the model carries the URL, the iOS Codable decodes it, but the hub renders only initials in a `Color.white.opacity(0.12)` circle. The student literally just picked their tile (with photo, post-fix); landing on the hub and seeing initials reads as "this is a different page about me" rather than "same screen, more options."
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:24-41`.
      Suggested fix: same `AsyncImage(url:)` + initials-fallback pattern shipped on `UserTile`/`CheckoutRow` in the idle pass. Keep the 44pt size for the hub header.

- [x] [Gaps] **The right-half Status panel duplicates the left-half action buttons for active checkouts.** Every active checkout appears twice: once as a "Return: …" button in the action panel, once as a `StatusCard` in the status panel. Pending pickups appear only as buttons (status doesn't list them). Reservations appear only as `StatusCard`s. So the panel layout reads as "one column has action and status, the other column has only status — but the status column repeats half of the action column." Information hierarchy is muddled.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:104-115` and `:129-141`.
      Why it matters: the kiosk has 3-5 seconds of student attention. A duplicated row buys nothing and pushes "Upcoming Reservations" (the actually-novel info) below the fold.
      Suggested fix: Status panel keeps **only** "Upcoming Reservations" — the one piece of context that *isn't* an action button. Drop the redundant active-checkouts list. Action buttons keep all return paths. Add a friendly empty state ("Nothing reserved this week") so the right half doesn't go visually empty when the student has no reservations.

- [x] [Gaps] **Action buttons show item *count* but not item *names*.** Subtitle reads "3 items" — a student picking up two reservations can't tell them apart by their titles alone. The server already returns `serializedItems` and `bulkItems` per pickup, so the data is on hand.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:91-115`.
      Suggested fix: extend the subtitle to a 1-line item summary — first 1-2 item names + " · +N more" when truncated. Mirrors the active-checkouts "+N more" cue shipped on the idle screen today.

- [x] [Hardening] **Error state is a dead-end.** When `kioskStudentContext` fails, the view shows `Text("Could not load your information.")` centered in the void with no Retry button and no path forward. The student can hit Back, walk back through name selection, and try again — six taps when one would do.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:53-57, 169-178`.
      Suggested fix: replace bare error `Text` with a `ContentUnavailableView`-shaped state (icon + title + description + Retry button). Same pattern used elsewhere in the app for failed loads.

- [x] [Hardening] **Action button accents use raw `.green`, `.blue`, `.orange`.** Drifts from the `StatusTone` token system established in the consistency-pass slices. The kiosk is dark-locked, so the visual difference is small, but a single source of truth across the app is the goal.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:97, 110, 138, 235, 240`.
      Suggested fix: pickup → `Color.statusText(.green)`; return overdue → `Color.statusText(.orange)`; return normal → `Color.statusText(.blue)`; `StatusCard` alert tone → `Color.statusText(.orange)`. Checkout stays `Color.kioskRed` (brand-token, intentional).

- [x] [UI polish] **`isAlert` styling on `StatusCard` is split between the detail text color and the trailing icon.** The text turns orange but the warning triangle uses raw `.orange` and there's no unified "alert" treatment — the row reads as "two slightly orange things" instead of "this row is alarming."
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:221-247`.
      Suggested fix: when `isAlert`, also tint the leading edge of the row (a 3pt left-edge stroke or the background) so the alert state is glanceable. Or simpler: replace `isAlert: Bool` with `tone: StatusTone?` so the call sites can pass `.orange` for overdue, `.purple` for upcoming reservations, and the card renders consistent paired colors.

- [x] [A11y] **Action buttons aren't combined; decorative icons aren't hidden.** VoiceOver walks each piece — icon, title, subtitle, chevron — and announces "arrow up circle fill" for the icon, which is meaningless for a blind user.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:191-218`.
      Suggested fix: `.accessibilityElement(children: .combine)` on the button label; `.accessibilityHidden(true)` on the icon and trailing chevron; explicit `.accessibilityLabel("\(title), \(subtitle)")` so the spoken order matches the visual order.

- [x] [A11y] **`StatusCard` not combined; overdue triangle reads as "warning triangle".** Same family of issue.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:226-247`.
      Suggested fix: `.accessibilityElement(children: .combine)` and an explicit label that leads with the alert state when applicable ("Overdue: \(title), due \(detail)").

- [x] [UI polish] **Single-shot load means a student dawdling on the hub for >30 s sees stale state.** Rare in practice (the hub is a transit screen) but easy to add — the idle screen polls every 30 s; the hub doesn't poll at all.
      `ios/Wisconsin/Kiosk/KioskStudentHubView.swift:71`.
      Suggested fix: add a 30-s refresh `.task(id: "refresh")` mirroring the idle pattern. Cheap because the hub is short-lived; covers the corner case of "student picks name, then a teammate finishes a return on a sister kiosk during the wait."

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Pending-pickup ordering: server returns newest-first (`createdAt: "desc"`), but oldest-first (closest-to-expiry) might serve students better. No expiry exists yet (`tasks/archive/completed-2026-06/kiosk-gate-pending-pickup-plan-2026-05-10.md` flags cron auto-expiry as GAP-33), so this is moot until that lands.
- [ ] [Polish] **Deferred.** "What was I doing?" — when a student returns mid-checkout (cart persistence shipped per the prior audit), the hub doesn't surface "you have a cart in progress." Today's flow takes them to `.idle` first then they re-pick their name; the cart restores when they hit Checkout. Not broken, just non-obvious. Defer until observed.
- [ ] [Polish] **Deferred.** Inline reservation pickup confirmation — tap a reservation in the status panel to jump to its pickup flow. Today reservations are read-only; pickups appear separately as PENDING_PICKUP bookings in the action panel. The split is correct (BOOKED ≠ PENDING_PICKUP) but a future "Pickup" button on a hub-displayed reservation could compress the path.
- [ ] [Hardening] **Deferred.** Distinguish "transient network" from "user not at this kiosk" (server returns 404 with body for both). The student reaction is the same — hit Back — so the differentiation is staff-only. Skip.

## Acceptance criteria status

There is no `AREA_KIOSK_STUDENT_HUB` doc; AC inferred from `AREA_KIOSK.md` and the prior kiosk audit:

- [x] AC: student lands on a per-name screen after picking from the roster.
- [x] AC: primary action is checkout (always shown).
- [x] AC: pending pickups become tappable action buttons.
- [x] AC: active checkouts become tappable return buttons.
- [x] AC: upcoming reservations are visible.
- [x] AC: avatar matches the idle-screen tile (post-fix).
- [x] AC: hub doesn't repeat itself across panels (post-fix).
- [x] AC: failed load is recoverable in one tap (post-fix).
- [x] AC: VoiceOver users can pick the right action by hearing title+subtitle (post-fix).

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead; nothing to mirror)
- [x] Accessibility
