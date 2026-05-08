# Audit: kiosk idle (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but the avatar grid and active-checkout strip ignore the avatar URLs they're already fetching, and the Deactivate kill-switch is one accidental tap away.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskIdleView` in `ios/Wisconsin/Kiosk/KioskIdleView.swift` (split-pane: left = stats + today's events + active checkouts; right = avatar grid for "Select your name"). Focused follow-up to `tasks/audit-kiosk-ios.md` (2026-04-24, broad kiosk scope) and the activation-screen pass shipped earlier today.

**Surrounding context:** the idle screen is what 100% of floor users see when they walk up. Average student spends <5 s on it before tapping their name. Polling is 30 s. Web has no parity here — kiosk on web is dead per the prior audit.

## P0 — blocks MVP

_None._ The flow is correct. The split-pane layout works on iPad landscape. Auth-failure → activation route ships per the prior audit. Inactivity timer + cart persistence ship per the prior audit. Disambiguated first-name-collision labels ship per the prior audit. Stats skeletons render while loading.

## P1 — polish before ship

- [x] [Gaps] **Avatar grid renders initials only — `KioskUser.avatarUrl` is fetched but unused.** The model already carries `avatarUrl: String?` (web's `/api/kiosk/users` returns it; the iOS Codable already decodes it). The avatar tile renders a `Circle().fill(...)` with two-letter initials and discards the URL. Floor users scan the grid for their *photo*, not their initials — every student named Alex sees three identical "AL" tiles.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:249-280` (`UserTile`).
      Why it matters: this is the single biggest "feels like a real product" win on the floor. Web user-detail pages already use AsyncImage avatars; web sidebar uses them. The kiosk — the highest-traffic surface — is the one place that doesn't. Identifying yourself by initials is hostile UX even at 20 students.
      Suggested fix: render `AsyncImage(url:)` when `avatarUrl != nil` with the existing initials circle as the placeholder/failure state. Match the `AccountAvatar` pattern in `AppTabView.swift` (success → `image.resizable().scaledToFill()`; default → initials circle). Keep the existing `Color.white.opacity(0.12)` placeholder fill so the tile shape doesn't pop in.

- [x] [Gaps] **Active checkout rows render initials only — `KioskActiveCheckout.requesterAvatarUrl` is fetched but unused.** Symmetric to the avatar-grid issue; the dashboard JSON already includes `requesterAvatarUrl`. Staff watching the active-checkouts strip identifies "who's overdue" faster by face than by initials.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:192-225` (`CheckoutRow`).
      Suggested fix: replace the bare `Circle().fill(...)` with the same AsyncImage-or-initials pattern; preserve the red-tinted overdue ring around the avatar so the visual signal survives.

- [x] [Hardening] **`Deactivate` is one accidental tap away.** A small `Button("Deactivate")` lives in the upper-right of the left panel with `.font(.caption)` styling and no confirmation. Anyone — a curious student, a misdirected tap during cleanup, the maintenance team — can brick the kiosk with one finger.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:50-53`.
      Why it matters: when this fires, every kiosk_session cookie is wiped, the iPad drops to the activation screen, and gear-room staff need a fresh 6-digit code from the web admin to bring it back. Mid-shift, that's 5–10 minutes of dead time at the counter.
      Suggested fix: wrap the action in a `confirmationDialog("Deactivate this kiosk?", ...)` with a destructive Confirm + Cancel. Keep the tiny visual footprint.

- [x] [Hardening] **`exclamationmark.triangle.fill` uses raw `.red`.** Drifts from the `StatusTone` token system; `.red` resolves slightly differently than `Color.statusText(.red)` in dark contexts.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:217`.
      Suggested fix: switch to `Color.statusText(.red)`. Same physical color in this dark-locked surface, but consistent with the rest of the app's token discipline.

- [x] [UI polish] **Truncated checkout items show "A, B" with no "+N more" cue.** A checkout with 5 items renders as "Camera A, Tripod" — the staffer doesn't know it has 3 more items behind the truncation. Web shows the count badge.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:209-212`.
      Suggested fix: when `checkout.itemCount > 2`, append " · +\(itemCount - 2) more" in `.foregroundStyle(.tertiary)`. Keep the existing line-limit so the row stays single-line.

- [x] [UI polish] **Stats values pop in without animation.** When a checkout completes elsewhere and the next 30 s poll lands, the count change is jarring. iOS 17+ has `contentTransition(.numericText())` for exactly this.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:153-159` (`StatTile`).
      Suggested fix: add `.contentTransition(.numericText())` and a value-keyed animation; respect reduce-motion.

- [x] [A11y] **`UserTile` accessibility label reads as initials.** VoiceOver users hear "EM" instead of "Erik Mason" — useless for picking a name. Tiles also aren't combined into a single button label.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:254-279`.
      Suggested fix: `.accessibilityElement(children: .combine)` on the button label, plus an explicit `.accessibilityLabel(displayName)` on the button (so the disambiguated "Erik R." reads, not "EM"). Add `.accessibilityHint("Tap to start checkout for \(displayName)")` so the action is clear.

- [x] [A11y] **`CheckoutRow` and `KioskEventRow` aren't combined elements.** VO walks each piece — initials circle, name, item names, time — and the overdue triangle is announced as "warning triangle" with no context.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:166-225`.
      Suggested fix: `.accessibilityElement(children: .combine)` on each row; for the overdue case, set the combined label to "Overdue: \(name), \(items)" so VO speaks the most important fact first.

- [x] [Hardening] **Stale-data invisibility.** When `loadAll()` hits a transient 5xx and silently keeps last-good values, the screen shows "fresh" stats forever. Staff diagnosing a kiosk that's lying about counts has no signal.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:126-141`.
      Suggested fix: track `lastLoadedAt: Date` and `loadFailedAt: Date?`; render a tiny "Updated Xm ago" caption under the kiosk name, switching to `Color.statusText(.orange)` when the last successful load is >5 min old. Doesn't shout — gives staff something to point at.

- [x] [UI polish] **Header omits the location name.** The kiosk *name* shows ("Front Counter") but not the *location* ("MERIT"). When a kiosk is moved between locations, staff diagnosing "wrong kiosk?" reports has no quick visual confirmation.
      `ios/Wisconsin/Kiosk/KioskIdleView.swift:42-48`.
      Suggested fix: add a small subhead under the kiosk name showing `store.info?.locationName` in `.foregroundStyle(.secondary)` `.font(.caption)`. Stays out of the way for everyone except a staffer specifically looking for it.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Roster search/filter for >50-student locations. Already flagged in the prior audit's P2 list; revisit when a location actually crosses that bar.
- [ ] [Polish] **Deferred.** Avatar grid keyboard navigation for hardware keyboards. Kiosk is touchscreen iPad; no keyboard expected.
- [ ] [Polish] **Deferred.** "Need help? Ask gear room staff." caption under the avatar grid for first-time students. Existing implicit affordance (counter is staffed) covers it.
- [ ] [Polish] **Deferred.** Off-line mode / cached snapshot of the dashboard. The kiosk is wired ethernet/locked Wi-Fi at the gear room; offline is rare. Keep last-good in memory; persisting is overkill.

## Acceptance criteria status

There is no `AREA_KIOSK_IDLE` doc; AC inferred from `AREA_KIOSK.md` (per the prior audit) and `project_scan_role.md`:

- [x] AC: idle screen shows live stats — `dashboard.stats` rendered, refreshed every 30 s.
- [x] AC: today's events visible — rendered when present.
- [x] AC: active checkouts visible — rendered when present.
- [x] AC: avatar grid for "Select your name" — rendered with disambiguated labels (prior audit).
- [x] AC: auth failure → activation — `loadAll` handles `APIError.unauthorized` (prior audit).
- [x] AC: avatar tiles use real photos — **closed by P1 avatar fix.**
- [x] AC: deactivate is not a one-tap accident — **closed by P1 confirm fix.**
- [x] AC: VoiceOver users can pick a name from the roster — **closed by P1 a11y fix.**
- [x] AC: staff can tell when data is stale — **closed by P1 stale-data fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead by prior decision; nothing to mirror)
- [x] Accessibility
