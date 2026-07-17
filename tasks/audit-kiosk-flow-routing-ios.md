# Audit: kiosk flow routing (iOS) - 2026-07-16

**MVP verdict:** NOT READY

**Audit type:** Static source audit informed by observed floor behavior. No code changes, build, simulator run, or physical-device walkthrough were performed.

**Scope:** Cross-flow entry behavior in the dedicated `WisconsinKiosk` target: idle, event detail, identity/student hub, direct checkout setup, reservation pickup, active checkout detail, and return.

## Executive finding

The individual checkout, pickup, and return flows are hardened once the user reaches the correct scan screen. The remaining weakness is routing intent into those flows.

The kiosk currently expects one prescribed sequence:

1. Identify a person.
2. Choose Checkout, Pickup, or Manage.
3. Supply required context.
4. Enter a dedicated scan screen.
5. Scan.

Real users begin with whichever object is already in front of them: a scanner, an event, their name, or an active checkout. The current state machine does not carry an unfinished intent across those entry points, so valid user behavior is ignored, rejected, or routed into a read-only surface.

The next hardening slice should introduce an intent-routing layer. It should preserve kiosk-only custody and identity verification while letting any meaningful entry point continue toward the same canonical checkout, pickup, or return flow.

## Observed intent matrix

| User starts with | Current behavior | Expected continuation | Verdict |
| --- | --- | --- | --- |
| Item scan on idle | Idle HID input is sent only to Wiscard identification, so an item barcode receives Wiscard-oriented failure copy | Resolve the scan, retain it, ask who is acting, then continue to checkout or return based on item custody | Broken |
| Event tap | Opens a read-only event sheet with only Done | Offer `Start Checkout for This Event`, retain the event, then ask who is acting | Broken |
| Name tap, then immediate item scan | Student hub has no HID scanner sink | Retain the identified person and begin or resume checkout with the scanned item staged | Broken |
| Checkout setup scan before `Start Scanning` | HID capture is not mounted until checkout context is ready and scanner capture is enabled | Stage the item immediately; require event/purpose and return time before final completion | Broken |
| Active checkout tap on idle | Opens read-only detail with no Return action | Offer Return, then verify the expected person before entering the existing return flow | Broken by design, but the handoff is missing |
| Active checkout tap after name selection | Opens editable detail with `Return Gear` in the header | Enter the existing return scan flow | Functional, but hidden behind `Manage` and an extra sheet |
| Reservation tap after name selection | Opens the canonical pickup flow | Enter pickup and require all scan evidence before confirmation | Functional |

## P0 findings

### P0-1: Scanner meaning changes by screen without a visible contract

Evidence:

- `KioskIdleView` mounts `HIDScannerField` only for `handleIdentityScan`, which calls `/api/kiosk/identify`.
- `KioskStudentHubView` mounts no HID scanner field.
- `KioskCheckoutView` mounts HID capture only after `scannerCaptureEnabled` becomes true; setup ends with a required `Start Scanning` button.
- Pickup and return correctly own their scanner once those dedicated screens are active.

Impact:

A floor user can perform the same physical action with the same scanner and receive four different outcomes: Wiscard lookup, silence, checkout item scan, or return/pickup scan. The UI does not expose this mode boundary strongly enough, and the dominant user expectation is that the kiosk understands a gear barcode anywhere.

Required hardening:

Add one kiosk-level scan router that classifies a scan before handing it to a flow. A server-backed resolver should distinguish at least:

- Wiscard identity
- Available serialized item or numbered unit
- Item currently held by an active checkout
- Item reserved for a pending pickup
- Unknown or malformed code

The router must never create custody directly. It should create or update a pending intent, then route through the existing authenticated checkout, pickup, or return APIs.

### P0-2: The state machine cannot retain intent across identity selection

Evidence:

`KioskScreen` carries only the final screen payloads: a user for checkout, booking/user IDs for pickup and return, and no event, staged scan, target checkout, or pending action for idle and student-hub transitions.

Impact:

An event-first, item-first, or active-checkout-first user must abandon that selection, identify themselves, and reconstruct the original intent manually. This is why individually correct screens still feel like dead ends.

Required hardening:

Give `KioskStore` a short-lived pending flow intent that can survive sheets and identity selection. It should be able to carry:

- desired action: checkout, pickup, return, or manage
- identified user, when known
- selected event, when known
- target booking, when known
- staged scan values or resolved items
- source entry point for diagnostics

Identity selection should fulfill the missing user field and resume the pending intent automatically. Inactivity reset and explicit cancel must clear it safely.

## P1 findings

### P1-1: Event detail advertises information but not the action users infer

`KioskEventDetailSheet` is read-only and exposes only Done. Add a prominent `Start Checkout for This Event` action. From idle, it should dismiss into identity selection while retaining the event. Once identity is known, it should open checkout with the event already selected and the return time prefilled from the event where valid.

Do not make worker avatar taps silently choose an actor. The user should still scan a Wiscard or deliberately select their name.

### P1-2: Name selection should arm checkout scanning immediately

The student hub currently presents a menu of actions and ignores HID input. Once a user deliberately selects their name, an available-item scan should be sufficient evidence of checkout intent.

Recommended behavior:

- Mount the shared scan router on the student hub.
- An available-item scan opens or resumes checkout and stages the item.
- A checked-out item belonging to one of that user's active checkouts offers or starts Return.
- A reservation item match can offer the relevant Pickup when unambiguous; otherwise show the user's pickup choices.
- Keep explicit Checkout, Pickup, Manage, and Return controls for touch-first users.

### P1-3: Checkout setup unnecessarily blocks scan-first users

`KioskCheckoutView` already persists the cart and its context draft separately. That makes scan-first setup feasible without weakening completion rules.

Allow item scans on the details screen and stage them in the existing cart. Keep event or custom purpose, valid return time, availability proof, and non-empty cart as completion requirements. The user can scan first and complete details second.

The `Start Scanning` CTA can become `Review and Scan` or disappear once the setup and scan state share one resilient flow. Avoid a hidden scanner mode switch.

### P1-4: Return is discoverable only after the exact identity-first path

The student hub labels active checkout actions as `Manage`, then places `Return Gear` inside the detail sheet. The idle checkout detail intentionally passes `allowsEditing: false` and no `onReturn`, following D-040's identified-student guardrail.

Preserve the guardrail while adding the missing handoff:

- On a selected student's hub, label the primary action `Return: <title>` or make Return the primary sheet action and Manage secondary.
- On idle checkout detail, show `Return This Checkout`. Tapping it should begin identity confirmation for the checkout requester, not open custody anonymously.
- After the matching Wiscard or deliberate name confirmation, route directly to the existing `KioskReturnView`.
- A wrong identity must fail clearly and return to identity selection without losing the target checkout.

### P1-5: Back navigation discards useful identity context

Pickup and return route Back directly to idle. After the user has identified themselves, Back should normally return to that user's hub. The current pickup/return screen payloads carry only `userId`, not a `KioskUser`, so the state machine cannot restore the hub without another lookup.

Carry enough identity context to return to the previous meaningful step. Reserve idle for explicit Done, cancel, timeout, or successful completion.

## P2 hardening

- Add lightweight flow telemetry: entry source, resolved intent, correction/backtrack, completion, cancellation, and failure code. Do not collect raw scan values.
- Add a visible pending-intent banner during identity selection, such as `Checking out for Volleyball vs. Purdue` or `Returning Alex's checkout`, so users know their first tap was retained.
- Add a clear ambiguity chooser when one scan could match multiple reservations or active checkouts. Never silently choose custody context.
- Make unknown scan recovery consistent across idle, hub, checkout setup, pickup, and return.
- Preserve camera and typed-code recovery through the same intent resolver and canonical custody APIs.

## Recommended implementation sequence

1. Add a pure `KioskFlowIntent` model and transition tests around the existing `KioskScreen` state machine.
2. Add a kiosk scan-intent resolver that classifies identity, item availability, active custody, and reservation context without mutating anything.
3. Route name-first and scan-first checkout into the same stored cart/context draft.
4. Add event-first checkout with pending identity.
5. Add active-checkout-first return with requester verification.
6. Normalize Back, Cancel, timeout, and success cleanup for the pending intent.
7. Run the physical iPad walkthrough below before visual polish.

## Physical 5.6 Sol walkthrough

Test every row with HID scanner, camera, and typed recovery where applicable. Use at least two users: one with a future reservation and active checkout, and one with neither.

### Checkout entry

- Scan an available item from idle, then identify a user.
- Tap a user, then immediately scan an available item without tapping Checkout.
- Tap Checkout, scan before choosing an event or purpose, then complete details.
- Tap an event, choose `Start Checkout for This Event`, identify a user, and verify the event remains selected.
- Start from each path, back out once, resume, and verify the cart and context remain correct.

### Pickup entry

- Tap a future reservation well before its start time and complete pickup.
- Scan a reserved item from idle and verify the kiosk resolves or asks for the correct reservation without guessing.
- Scan a wrong item, duplicate item, and unavailable numbered unit.

### Return entry

- Tap an active checkout on idle, choose Return, verify the requester, and complete return.
- Tap a user, tap the active checkout, and choose Return.
- Tap a user, then scan one of their checked-out items and verify Return is offered or started.
- Try the same item under the wrong user and verify the intent is retained while identity is corrected.
- Exercise partial return, duplicate scan, and completion after another kiosk changed the checkout.

### Recovery and state safety

- Let the inactivity warning appear with a staged item and pending event.
- Dismiss a sheet, background/foreground the app, disconnect/reconnect the HID scanner, and briefly drop network access.
- Double-scan rapidly and press completion while a scan request is in flight.
- Verify success, cancel, timeout, and kiosk deactivation clear pending intent and never leak one user's flow into the next user's session.

## Acceptance bar

- Every item scan produces a visible, relevant response on every interactive kiosk screen.
- Event-first, person-first, item-first, reservation-first, and active-checkout-first entry all converge on the same canonical custody APIs.
- Identity is required before any custody mutation, but it can occur before or after the initial intent.
- The kiosk retains event, booking, user, and staged item context across the identity handoff.
- No path creates or returns custody from a read-only lookup or event surface.
- Back and retry preserve safe work; cancel, timeout, success, and deactivation clear it.
- Physical HID, camera, and typed recovery pass on the managed iPad.

## Sources read

- `docs/AREA_MOBILE.md`
- `docs/AREA_KIOSK.md`
- `docs/DECISIONS.md` (D-040)
- `docs/GAPS_AND_RISKS.md`
- `ios/Wisconsin/App/WisconsinApp.swift`
- `ios/Wisconsin/App/AppDelegate.swift`
- `ios/Wisconsin/KioskOnly/KioskOnlyApp.swift`
- `ios/Wisconsin/Kiosk/KioskShellView.swift`
- `ios/Wisconsin/Kiosk/KioskStore.swift`
- `ios/Wisconsin/Kiosk/KioskModels.swift`
- `ios/Wisconsin/Kiosk/KioskAPIClient.swift`
- `ios/Wisconsin/Kiosk/KioskIdleView.swift`
- `ios/Wisconsin/Kiosk/KioskEventDetailSheet.swift`
- `ios/Wisconsin/Kiosk/KioskStudentHubView.swift`
- `ios/Wisconsin/Kiosk/KioskCheckoutView.swift`
- `ios/Wisconsin/Kiosk/KioskCheckoutDetailSheet.swift`
- `ios/Wisconsin/Kiosk/KioskPickupView.swift`
- `ios/Wisconsin/Kiosk/KioskReturnView.swift`
- `src/app/api/kiosk/identify/route.ts`
- `src/app/api/kiosk/scan-lookup/route.ts`
- Existing focused kiosk audit records in `tasks/audit-kiosk-*.md`

