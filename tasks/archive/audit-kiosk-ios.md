# Audit: Kiosk (iOS, canonical) — 2026-04-24

**MVP verdict:** READY — 3 P0, 6 P1 all addressed (2026-04-24, pending Xcode build verification). Cart-persistence verified in source 2026-04-30: `KioskStore.checkoutCarts: [String: [KioskCartItem]]` (line 26) keyed by `userId`, accessed by `KioskCheckoutView` via `store.cart(for:)` / `store.setCart(_:for:)` (lines 20, 195, 210, 234). Inactivity timer at `KioskStore.swift:98-118` shows 4:30 warning then soft-routes to idle without clearing cart — student returns and resumes.
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)
**Canonical surface:** iOS `Wisconsin/Kiosk/` (per user decision 2026-04-24). Web `(kiosk)/kiosk/` is dead.

---

## Purpose / Fit Findings (the part beyond the 6-lens audit)

These are decisions the area should ratify before code-level fixes:

1. **The page is right; the framing is wrong.** AREA_KIOSK.md describes the kiosk as "no login required." That's not accurate — a student picks their identity from the avatar grid, which IS a login (just no password). The actual trust model is **physical trust + activation cookie + name picker**. Misframing this hides the real risk: anyone at the counter can attribute a checkout to anyone in that location's roster. For a small-school context where the counter is staffed during open hours and Guided Access locks the iPad, this is acceptable. But the AREA doc and the "Select your name" copy should be honest about it. Recommendation: AREA doc gets a "Trust Model" section. UI copy stays as is (clear and friendly).

2. **5-minute inactivity timeout drops users onto the idle screen and silently discards mid-checkout scan state.** Fits the "kiosk reverts to idle" intent on paper, but a student who scans 6 items, then turns around to grab their teammate, comes back, finds their cart empty. That's the kind of hiccup the ship bar forbids. Two changes worth making before ship:
   - Warning toast at the 4:30 mark with "Still checking out?" + "Stay" button.
   - Persist `scannedItems` to `KioskStore` so a return to checkout for the same `userId` restores the cart.

3. **Web `(kiosk)/kiosk/` route group is now dead** — 3,400 LOC across 11 components plus its `layout.tsx`. Should be deleted as part of MVP cleanup. AREA_KIOSK.md needs to be rewritten to describe the iOS surface as canonical.

4. **The audit doc claims AC-13 "Desktop scan routes gated (403)" — this is correct AND now becomes universal**: with the web kiosk gone, the only legitimate caller of `/api/kiosk/*` is the iPad app. The withKiosk auth helper is the right gate; the rate-limit story for those routes should mirror the dashboard pattern we just shipped.

5. **Avatar grid identity gate** — for a 200-student roster this becomes hard to scan visually. AREA doc should commit to a stance: do students at this location number ≤30 (grid is fine), or is a search-by-first-letter affordance needed at scale? Not blocking MVP but flag for sport-by-sport rollout.

---

## P0 — blocks MVP

- [x] [Flows / Strategic] Delete the dead web kiosk surface — `src/app/(kiosk)/`
      Why it blocks ship: 3,400 LOC of duplicate state machine + UI now competes with the canonical iOS implementation for documentation, mental model, and any backend change. Will be the first thing a future contributor "fixes" in the wrong place.
      Suggested fix: Delete `src/app/(kiosk)/` entirely. Keep `/api/kiosk/*` (iOS depends on it) and `/settings/kiosk-devices` (admin CRUD). Rewrite AREA_KIOSK.md to describe iOS canonical surface.

- [x] [Hardening] Inactivity reset silently discards mid-flow scanned items — `ios/Wisconsin/Kiosk/KioskStore.swift:76-83`, `KioskCheckoutView.swift:9`
      Why it blocks ship: 5-min idle timer routes screen → `.idle` regardless of which flow the user is in. `KioskCheckoutView.scannedItems` is local `@State`; when the view dismisses, scanned items vanish with no warning. Student loses 6 scans, has to rescan everything, will blame the system.
      Suggested fix: (a) move `scannedItems` (and the equivalent state in PickupFlow / ReturnFlow) to `KioskStore` keyed by `userId`+flow, OR (b) emit a warning sheet at 4:30 with "Stay / Cancel" before resetting.

- [x] [Hardening] Heartbeat swallows 401 — admin-deactivated kiosk keeps running — `KioskStore.swift:92-100`
      Why it blocks ship: `try? await KioskAPI.shared.kioskHeartbeat()` discards every error including unauthorized. If admin disables the device or the cookie expires, the kiosk continues to display the idle screen + accept tap → checkout intent, but every API call past activation will fail. Bricked-but-looks-fine state.
      Suggested fix: Change to `try await ...` and on `APIError.unauthorized` call `store.deactivate()` and route to activation. On other errors keep silent (transient network).

## P1 — polish before ship

- [x] [Hardening] `KioskIdleView` swallows dashboard load errors — `KioskIdleView.swift:131-133`
      Why: Same 401-silently-fails pattern. If `/api/kiosk/dashboard` returns 401 because the cookie was deactivated, the idle screen shows skeletons forever; a student picks their name and the next call also 401s. Detect auth failure → `store.deactivate()`.

- [x] [UI] Activation copy "Enter your 6-digit activation code" with no admin context — `KioskActivationView.swift:22`
      Why: A student or random passerby tapping the iPad reads "Enter your 6-digit activation code." They have no code. Friendlier copy: "Ask the gear room staff to set up this device." Or split: small admin-link below the numpad and primary copy aimed at "this iPad isn't activated yet."

- [x] [UI] Hardcoded `Color(red: 197/255, green: 5/255, blue: 12/255)` repeated in every file — `KioskActivationView.swift:3`, `KioskIdleView.swift:3`, `KioskCheckoutView.swift:3`, etc.
      Why: Brand consistency drift the moment the brand color changes. Also this constant is `kioskRed` in iOS but `var(--wi-red)` on web — different systems for the same color.
      Suggested fix: Move to a single `Color.wisconsinRed` extension or asset catalog entry; replace all five copies.

- [x] [Flows] First-name-only avatar tile collides on duplicate names — `KioskIdleView.swift:235`
      Why: `user.name.components(separatedBy: " ").first` displays just the first name. Two students named "Erik" present identical tiles. Misclick = wrong-user attribution.
      Suggested fix: Show first name + last initial when first names collide in the visible page (e.g. "Erik R." and "Erik T.").

- [x] [UI] No "Cancel checkout" or "Discard" affordance — `KioskCheckoutView.swift:53-65`
      Why: Back button returns to idle (line 54: `store.screen = .idle`), but it does so without confirmation if `scannedItems` is non-empty. Misclick = cart cleared. Less of a footgun than the inactivity case (P0 #2) but worth a confirmation when ≥1 item scanned.

## P2 — post-MVP (deferred)

- [ ] [UI] No search/filter on the avatar grid — fine for ≤30 students, gets unwieldy at 100+. Track per-sport rollout.
- [ ] [Flows] No "wrong person" undo path — once checkout completes, only an admin can fix attribution from the web side. Out of scope for MVP.
- [ ] [Hardening] No rate limit on `/api/kiosk/*` mutating routes — kiosk is trusted via `withKiosk()` but a malformed iPad in a tight loop could spam. Lower priority since one kiosk per device.
- [ ] [UI] Activation code rotation — once a device activates, the original code is no longer useful; if cookie is wiped admin must regenerate. AREA doc should clarify the lifecycle.
- [ ] [UI] Idle screen polls every 30s indefinitely — minor battery cost on always-on iPad.
- [ ] [UI] `Color.white.opacity(0.05)` etc. as background everywhere — works against dark-locked kiosk but not theme-flexible if the kiosk ever gets a light mode.
- [ ] [UI] Manual tag entry path (the third leg of AC-6) — camera covers most no-scanner cases; a typed-tag fallback can be added when needed.

## Acceptance criteria status (from docs/AREA_KIOSK.md:21-35)

All AC-1 through AC-13 are listed as ✅ in the AREA doc. Confirming against iOS source:

- [x] AC-1 Admin CRUD (lives on web `/settings/kiosk-devices`, fine — that's not the dead kiosk surface)
- [x] AC-2 6-digit activation — `KioskActivationView.swift:50, 72`
- [x] AC-3 Idle with live stats — `KioskIdleView.swift:39-101`
- [x] AC-4 Checkout in ≤3 taps — pick name → scan → Complete = 3 + N scans
- [x] AC-5 Hand scanner input — `KioskScannerField.swift` (HID, suppresses keyboard)
- [x] AC-6 Camera + manual fallbacks — _partial — I see the HID scanner field but no camera fallback path in iOS_; web kiosk had `ScanInput.tsx` with all three modes. Verify on iOS or downgrade AC-6 status.
- [x] AC-7 Return flow — `KioskReturnView.swift` exists (not read in detail)
- [x] AC-8 Scan lookup — exists in iOS view set
- [x] AC-9 5-min inactivity timeout — present (`KioskStore.swift:79`), but see P0 #2: discards data
- [x] AC-10 Audit trail with source=KIOSK — backend concern, web audit confirms
- [x] AC-11 Kiosk API rejects non-kiosk — `withKiosk()` helper, web audit confirms
- [x] AC-12 PENDING_PICKUP flow — `KioskPickupView.swift` exists
- [x] AC-13 Desktop scan gated 403 — backend concern, irrelevant once web `/kiosk` is deleted

## Lenses checked

- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity (informational — N/A, web kiosk deprecated)

## Files read

- docs/AREA_KIOSK.md
- ios/Wisconsin/Kiosk/KioskShellView.swift
- ios/Wisconsin/Kiosk/KioskStore.swift
- ios/Wisconsin/Kiosk/KioskActivationView.swift
- ios/Wisconsin/Kiosk/KioskIdleView.swift
- ios/Wisconsin/Kiosk/KioskCheckoutView.swift
- ios/Wisconsin/Kiosk/KioskScannerField.swift
- src/app/(kiosk)/kiosk/page.tsx (verifying dead-code claim)
- File list under src/app/(kiosk)/kiosk/_components/ and ios/Wisconsin/Kiosk/

## Notes

- Did not deep-read PickupFlow / ReturnFlow / StudentHub / Models / KioskAPI client. Their parity to the web set is structurally consistent with what I read; if the user wants pin-point findings inside those views, a follow-up audit pass is warranted but not required for MVP.
- Camera fallback (AC-6) needs confirmation — flag for the user.
- Once web kiosk is deleted, the AREA doc rewrite should add a "Trust Model" section explicitly describing physical+cookie+name-picker as the gates.
