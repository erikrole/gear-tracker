# Audit: kiosk success (iOS) — 2026-05-08

**MVP verdict (pre-fix):** ships, but it's the smallest kiosk surface and the easiest place to add tactile/audible/visual celebration without effort. No P0; everything is P1 polish.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class.
**Audit type:** static source (no build/run/UI tests).

Scope: `KioskSuccessView` in `ios/Wisconsin/Kiosk/KioskSuccessView.swift` — the final screen after checkout / pickup / return completes; auto-routes to `.idle` after 5 seconds. Seventh and final kiosk-surface pass after activation, idle, student-hub, checkout, pickup, and return.

**Surrounding context:** the success screen IS the moment of celebration — a student walks away thinking "that worked" or "what just happened?" depending entirely on this 5-second window. The current implementation is functional but flat: no haptic, no symbol animation, no early-dismiss, no VO announcement.

## P0 — blocks MVP

_None._ The screen displays the message, the countdown works, the auto-route to `.idle` fires reliably, the inactivity timer resets on transition.

## P1 — polish before ship

- [x] [Gaps] **No "Done" button — students who want to leave fast have to wait the full 5 s.** A teammate is calling, the student already understands "checkout complete" — they should be able to tap and go. Today the screen is purely passive.
      `ios/Wisconsin/Kiosk/KioskSuccessView.swift:8-37`.
      Suggested fix: prominent capsule "Done" button that routes to `.idle` immediately. Keep the auto-timer as the fallback so a student who walks away without tapping still resets the kiosk.

- [x] [Gaps] **No success haptic on appear.** Every other kiosk action shipped today fires `Haptics.success()` — checkout complete, pickup confirmed, return processed. The success SCREEN is the literal celebration moment and gets no haptic.
      `ios/Wisconsin/Kiosk/KioskSuccessView.swift:29-36`.
      Why it matters: tactile confirmation against the iPad mount tells the staffer (eyes elsewhere) that the kiosk worked. Cheap floor-relevant win.
      Suggested fix: `Haptics.success()` inside the `.task` modifier on appear.

- [x] [UI polish] **Raw `.green` instead of `Color.statusText(.green)`.** Drifts from the `StatusTone` token system. Same family of fix shipped on every other kiosk surface today.
      `ios/Wisconsin/Kiosk/KioskSuccessView.swift:14`.

- [x] [UI polish] **No symbol animation.** A bouncing checkmark on appear takes the screen from "static text" to "celebration" with one modifier. Symbol effects are exactly what the iOS 17+ `symbolEffect` API is for.
      `ios/Wisconsin/Kiosk/KioskSuccessView.swift:12-14`.
      Suggested fix: `.symbolEffect(.bounce, options: .nonRepeating)` on the `Image`. Skip when reduce-motion is on.

- [x] [UI polish] **Countdown digit jitters because `Text("\(countdown)s")` isn't monospacedDigit.** Hopping from "5s..." to "4s..." may shift width depending on the system font's tabular numbering.
      `ios/Wisconsin/Kiosk/KioskSuccessView.swift:22-24`.
      Suggested fix: `.monospacedDigit()`. Trivial.

- [x] [Flows] **No tap-anywhere-to-dismiss.** Even with a Done button, a tap on the screen background should route to idle — the kiosk is dark, the screen is a single message, the gesture feels natural.
      Suggested fix: `.contentShape(Rectangle())` + `.onTapGesture { skip() }` on the outer VStack. Pairs with the Done button — both lead to the same `skip()` helper.

- [x] [A11y] **VoiceOver users don't hear the success on appear.** The view title, message, and countdown are visible but VO doesn't announce them as a unit. The first focused element is whatever lands after the screen transition — could be the countdown ("Returning to home in 5 s") which lands as the headline, not the success message.
      Suggested fix: post `UIAccessibility.post(.announcement, ...)` carrying the success message on appear. Also combine the visual elements into a single accessibility element so manual nav reads "Success: \(message)" rather than three separate texts.

- [x] [A11y] **Countdown text changes every second and may re-read in VoiceOver, causing announcement spam.** A blind user hears "Returning to home in 5 seconds, returning to home in 4 seconds, returning to home in 3 seconds…"
      Suggested fix: hide the countdown text from accessibility entirely (`.accessibilityHidden(true)`); pair with the new Done button which gives VO users an explicit dismiss path so they don't need to wait for or hear the countdown.

- [x] [UI polish] **Empty space below the countdown is wasted.** With both a success message and a countdown, there's a Spacer below — but no visual closure. Minor, but a Done button placed in that empty space gives the screen a clear shape.
      Implicitly addressed by the Done-button fix above.

## P2 — post-MVP

- [ ] [Polish] **Deferred.** Per-action celebration variants (confetti for first-checkout, animation flair for "all returned on time"). Cute, but not floor-relevant. Keep success uniform.
- [ ] [Polish] **Deferred.** Audio chime on success. Same disposition as the other kiosk surfaces — speakers commonly muted; haptics covers the role.
- [ ] [Polish] **Deferred.** Per-action icons (checkout / pickup / return distinct symbols). Universal `checkmark.circle.fill` reads as "done" for all three; icon variation would mostly add ambiguity.

## Acceptance criteria status

There is no `AREA_KIOSK_SUCCESS` doc; AC inferred from `AREA_KIOSK.md`:

- [x] AC: success message visible after every completed kiosk action.
- [x] AC: auto-routes to `.idle` (5 s).
- [x] AC: inactivity timer resets on transition.
- [x] AC: students who want to leave faster have a Done button — **closed by P1 fix.**
- [x] AC: tactile confirmation fires on success — **closed by P1 haptic fix.**
- [x] AC: VoiceOver users hear the success message — **closed by P1 announce fix.**

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Parity (web kiosk dead)
- [x] Accessibility
