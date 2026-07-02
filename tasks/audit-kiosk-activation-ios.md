# Audit: kiosk activation (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but every activation costs the gear-room staff six manual digit taps with no paste path and a few small footguns.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskActivationView` in `ios/Wisconsin/Kiosk/KioskActivationView.swift` + `KioskStore.activate(...)` + `KioskAPI.kioskActivate(...)`. Focused follow-up to `tasks/audit-kiosk-ios.md` (2026-04-24, broad kiosk scope), which left the activation surface untouched.

**Surrounding context:** activation only happens once per device (then the kiosk_session cookie persists). On the web, an admin generates the code at `/settings/kiosk-devices` and a `Copy` button puts it in the clipboard; the staff member then walks to the iPad and types it in. There is no admin-side UI on the iPad — this view is the entire activation surface.

## P0 — blocks MVP

_None._ Activation works, errors surface, retries are gated by server rate limiting, the cookie persists across launches, the heartbeat picks up admin-deactivation (per the prior audit's fix). The flow is correct, just rough around the edges.

## P1 — polish before ship

- [x] [Flows] **No paste affordance.** Web's `/settings/kiosk-devices` flow ends with a copy-to-clipboard dialog showing the freshly minted 6-digit code. Staff copies it on their phone or laptop, walks to the iPad, opens the kiosk… and has to retype six digits manually. Tap-tap-tap-tap-tap-tap, and a single fat-finger means the whole code clears (auto-submit on the 6th digit).
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:33-46` — there's no field to long-press, no PasteButton, no clipboard read.
      Why it matters: SwiftUI's `PasteButton` is a privacy-safe system control (no clipboard prompt) that auto-disables when the clipboard doesn't match the payload type. This is the canonical iOS pattern for accepting a one-time code from a sister device. Adopting it makes the round-trip "generate on web → paste on iPad" feel native.
      Suggested fix: add a `PasteButton(payloadType: String.self)` next to the digit display. On paste, extract the longest run of digits from the pasted string (handles "Code: 123456" pastes too), truncate to 6, and either fill or auto-submit. Falls back gracefully — the button is hidden by the system on devices/clipboards where it can't operate.

- [x] [UI polish] **The "✓" submit key is a silent no-op when fewer than 6 digits are entered.** The button still highlights and accepts taps; it just does nothing. Either visually disable it or remove it (auto-submit on the 6th digit covers the happy path).
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:107-138` — `handleKey("✓")` checks `code.count == 6` and returns silently otherwise.
      Why it matters: gear-room staff retains a "did I do something wrong?" doubt every time they tap the green button on a 5-digit input. Disabled-state is one second of clarity per activation.
      Suggested fix: bind `.disabled(code.count != 6)` to the `✓` key only and reduce its background opacity to ~0.35 when disabled. Keep auto-submit so the staffer doesn't *have* to tap ✓.

- [x] [UI polish] **Loading overlay floats with no backdrop.** During the network round-trip the spinner sits at center-screen with no scrim — it reads as "stuck rendering" against the dark kiosk background, especially when the numpad behind it is `.disabled`-grayed out.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:62-68`.
      Suggested fix: wrap the `ProgressView` in a `Color.black.opacity(0.4)` scrim that ignores safe area, with a centered card containing the spinner + "Activating…" copy. Match the inactivity warning overlay's pattern (already shipped at `KioskShellView.swift:46-80`).

- [x] [Hardening] **Error text uses raw `.red`.** Drifts from the app-wide `StatusTone` token system established in the consistency-pass slices.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:50` — `.foregroundStyle(.red)`.
      Suggested fix: switch to `Color.statusText(.red)`. Single token = single source of truth for dark-mode contrast (the kiosk is always dark, but the rest of the app uses the same token).

- [x] [A11y] **Numpad keys announce the symbol, not the action.** `⌫` reads as "delete left" (passable) and `✓` reads as "checkmark" (poor). VoiceOver users on a kiosk are rare but not zero — staff doing initial setup may have VoiceOver on from prior use of the iPad.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:107-126`.
      Suggested fix: add `.accessibilityLabel("Delete last digit")` to ⌫, `.accessibilityLabel("Submit code")` to ✓, and announce the result of each digit tap by exposing the entered count via the digit boxes' container label.

- [x] [A11y] **Error string is not announced when it appears.** When activation fails, the error text appears below the digits, but VoiceOver users won't hear it unless they manually navigate. SwiftUI has no `accessibilityLiveRegion` modifier on iOS; the canonical path is `UIAccessibility.post(.announcement, ...)`.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:48-52`.
      Implementation: extracted `surfaceError(_:)` that sets the error string, clears the code, fires `Haptics.error()`, and posts a `.announcement` accessibility notification carrying the same message — VO speaks the error immediately on every catch branch. The error `Text` also picks up `.accessibilityAddTraits(.updatesFrequently)` so VO recognizes it as dynamic content during manual navigation.

- [x] [UI polish] **Code-display boxes don't reset their stroke color smoothly.** When activation fails and `code = ""` clears, all six boxes flash from "filled stroke" (red) to "empty stroke" (white@0.2) with no animation. The reduce-motion env is also unobserved here, even though there's nothing to skip.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:33-46`.
      Suggested fix: wrap the `HStack(spacing: 12)` in `.animation(reduceMotion ? nil : .easeInOut(duration: 0.15), value: code)`. Tiny ease-in-out makes the clear feel intentional rather than a glitch.

- [x] [UI polish] **The "Settings → Kiosk Devices" hint doesn't say where.** Staff brand-new to the gear-room iPad reads "Settings → Kiosk Devices" and assumes that's an iOS Settings path. It is the web settings route, now under `wisconsincreative.com/settings/kiosk-devices`.
      `ios/Wisconsin/Kiosk/KioskActivationView.swift:26-29`.
      Suggested fix: rephrase to "Staff: enter the 6-digit code from wisconsincreative.com → Settings → Kiosk Devices." Same caption size, just unambiguous about the surface.

## P2 — post-MVP

- [ ] [Hardening] **Deferred.** No "Exit kiosk mode" affordance. By design — the activation screen is also the kiosk lockdown point. If staff accidentally enter via `wisconsin://kiosk` deeplink they have to either activate or kill the app. iOS Guided Access is the canonical answer for accidental-exit prevention; an in-app exit weakens kiosk lockdown. Skip until a real ask comes in.
- [ ] [Polish] **Deferred.** QR-code activation (admin web shows a QR encoding of the code; iPad scans). Promising but requires server + web changes; defer until activation friction is a documented complaint.
- [ ] [Polish] **Deferred.** Numeric hardware-keyboard support for the digit field. Kiosk is touchscreen iPad; staff doesn't bring a Bluetooth keyboard.
- [ ] [Hardening] **Deferred.** Client-side timeout / cancel button. Default `URLSession` 60 s is plenty; if the network is dead the rate-limit message will land before the user gives up.

## Acceptance criteria status

There is no `AREA_KIOSK_ACTIVATION` doc; AC inferred from `AREA_KIOSK.md` and the prior `audit-kiosk-ios.md`:

- [x] AC: 6-digit activation code → kiosk_session cookie → idle screen.
- [x] AC: Invalid code surfaces a server-readable error.
- [x] AC: Cookie persists across cold launch (`KioskStore.init` rehydrates `KioskInfo`).
- [x] AC: Heartbeat picks up admin deactivation (prior audit fix).
- [x] AC: Code paste-from-clipboard supported — **closed by P1 paste fix.**
- [x] AC: VoiceOver users can complete activation — **closed by P1 a11y fixes.**
- [x] AC: Loading and error states feel intentional — **closed by P1 polish fixes.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web has no parallel surface; admin code-gen flow informs paste UX)
- [x] Accessibility
