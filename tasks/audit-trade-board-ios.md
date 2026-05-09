# Audit: trade board (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but `TradeStatusChip` uses raw `.green/.orange/.secondary/.gray` instead of the cross-app `StatusTone` system, the claim haptic bypasses the centralized `Haptics` enum, the action-error alert is OK-only with no Retry, and `TradeRow` isn't a combined VoiceOver element.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `TradeBoardSheet` + `TradeBoardViewModel` + `TradeRow` + `TradeStatusChip` in `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift`. Reachable from `HomeView` (notifications-tap → trades) and from `ScheduleView` toolbar.

**Surrounding context:** STUDENT shift-trading surface — students browse open trades posted by other students + claim them. Two sections: "Open Trades" (others' posts) and "My Active Posts" (own posts, swipe-to-cancel). STAFF trade-approve surfaces are different (live in `EventDetailSheet`'s assignment row mini-buttons, audited today).

## P0 — blocks MVP

_None._ Pull-to-refresh works. Auth handled. Claim + Cancel both have confirmation dialogs. Local list mutates correctly post-API-call. Error state has Retry on initial load failure. The trade post sheet is correctly presented and the `onTradePosted` / `onTradeClaimed` callbacks bubble through to the host (HomeView posts a toast).

## P1 — polish before ship

- [x] [Hardening] **Direct `UINotificationFeedbackGenerator()` call bypasses the centralized `Haptics` enum.** Same drift fixed on the link sticker wizard earlier today. The claim-success path fires a raw success haptic; cancel + post don't fire any.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:111`.
      Suggested fix: replace the raw `UINotificationFeedbackGenerator()` call with `Haptics.success()`. Also fire `Haptics.success()` on cancel-success and `Haptics.warning()` in the error catches so the trade-management flow has a complete haptic chain.

- [x] [UI polish] **`TradeStatusChip.statusColor` returns raw `.green/.orange/.secondary/.gray`.** Drifts from the `StatusTone` token system established across all kiosk + booking-detail surfaces today.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:283-291`.
      Suggested fix: route through `Color.statusText(_:)` and `Color.statusBackground(_:)` for the foreground + background pair. `.open` → `.green`, `.claimed` → `.orange`, `.completed` → `.gray`, `.cancelled / .expired / .unknown` → `.gray`. Mirror the kiosk + booking pass.

- [x] [Flows] **Action-error alert is OK-only.** Failed claim or cancel surfaces in an alert with just OK; user must dismiss + re-tap. Same shape of fix shipped on create-booking today.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:143-147`.
      Decision: **Skip with rationale.** Unlike create-booking which has a single submit retry path, trade board has two distinct mutating actions (claim + cancel) that share the alert state. A "Try again" button can't disambiguate which action to retry without holding extra state. The user's natural recovery path (tap the Claim button or swipe-cancel again) is one tap away in the list. Leaving as-is.

- [x] [A11y] **`TradeRow` not combined.** VoiceOver walks each piece (area, event summary, status pill, time row with clock icon, person row with person icon, notes, claim button) — seven announcements per row. Combined into a single "Trade: VIDEO at Football vs Western Illinois, Friday Sep 11, 9:00–13:00, posted by Erik Mason, status Open" announcement matches today's row patterns.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:205-269`.
      Suggested fix: `.accessibilityElement(children: .combine)` on the outer VStack + an explicit row label that surfaces the most important fact first; decorative `clock` and `person` icons get `.accessibilityHidden(true)`; the Claim button stays as a separate accessibility element so VO can act on it (`.accessibilityElement(children: .contain)` would consume the button — `.combine` keeps interactive children separately addressable).

- [x] [A11y] **Swipe-action `Label("Cancel Trade", systemImage: "xmark")` exposes the icon name** ("x mark, Cancel Trade"). Same family of fix shipped today.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:189-193`.
      Suggested fix: `.accessibilityLabel("Cancel trade")` on the swipe button.

- [x] [Flows] **No haptic on cancel-trade success.** Claim has one (post-fix); cancel doesn't.
      `ios/Wisconsin/Views/Schedule/TradeBoardSheet.swift:131-138`.
      Suggested fix: `Haptics.success()` after the cancel awaits — symmetrical with claim.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Pagination — today loads only the first 30 trades (`pageSize = 30`). Web has pagination; iOS doesn't currently surface it. For a small school with a handful of open trades at any time, 30 is plenty. Defer until needed.
- [ ] [Polish] **Deferred.** Filter by area (VIDEO / PHOTO / etc.). Web has it; iOS could add. Cross-tab consistency (BookingsView has filter UI) suggests this is worth doing once the trade board's traffic exceeds the 30-row cap.
- [ ] [Polish] **Deferred.** Time-to-claim countdown for expiring trades — web doesn't have it either. Not blocking ship.
- [ ] [Polish] **Deferred.** Per-trade share affordance (post to Slack / messages). Off-platform path; not a documented floor need.

## Acceptance criteria status

Per `AREA_SHIFTS.md`:

- [x] AC: students can browse open trades posted by others.
- [x] AC: students can claim a trade with confirmation.
- [x] AC: students can cancel their own posts via swipe.
- [x] AC: status chip distinguishes open / claimed / completed / cancelled / expired.
- [x] AC: pull-to-refresh.
- [x] AC: trade post sheet from `+` toolbar.
- [x] AC: status chip uses cross-app token discipline — **closed by P1 fix.**
- [x] AC: claim haptic via centralized `Haptics` enum — **closed by P1 fix.**
- [x] AC: VoiceOver users hear each row as a combined element — **closed by P1 a11y fixes.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web trade board exists; iOS aligned)
- [x] Accessibility
