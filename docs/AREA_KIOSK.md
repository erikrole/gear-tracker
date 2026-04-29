# AREA: Kiosk Mode

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: Shipped — iOS canonical (web kiosk deprecated 2026-04-24)
- Created: 2026-04-07
- Last Updated: 2026-04-24
- Brief: `BRIEF_KIOSK.md`
- Decision Refs: D-030

## Description

Self-serve iPad kiosk for gear checkout / pickup / return at the equipment counter, plus on-the-floor kiosk activation by staff carrying an iPad. Implementation lives in the **native iOS app** (`ios/Wisconsin/Kiosk/`). The previously-shipped web kiosk surface (`src/app/(kiosk)/kiosk/`) was deleted on 2026-04-24 to remove the dual-implementation maintenance burden — iPads run the Wisconsin app directly and flip into kiosk mode via `KioskStore`.

## Trust Model

The kiosk is intentionally low-friction: no per-student password, no PIN, no biometric. The trust gates are layered:

1. **Physical trust.** The iPad is at the gear counter or carried by staff. Guided Access pins it to the Wisconsin app.
2. **Device authentication.** Each `KioskDevice` is created by an admin in Settings → Kiosk Devices. A 6-digit one-time activation code provisions a `kiosk_session` cookie tied to a specific `KioskDevice` row (with `locationId`, `active`, `lastSeenAt`).
3. **Server-side scope.** `withKiosk()` rejects all `/api/kiosk/*` calls without a valid kiosk-session cookie. Routes do not accept a regular user-session cookie. Bookings created through the kiosk are stamped with `source: "KIOSK"` for the audit trail.
4. **Identity = name picker.** A student taps their tile from the location-scoped roster. There is **no password / PIN / NFC** in V1. This is a deliberate trade-off: the counter is staffed during open hours, and physical+device gates carry the security weight. Misattribution risk (a student tapping the wrong tile or someone else's tile) is mitigated by the audit log and the social context of a staffed counter.

If at some point the kiosk needs to operate unattended or in a less-trusted physical context, a per-student PIN or NFC tap is the natural extension. Not in V1.

## Components

### iOS — Canonical Surface
Files under `ios/Wisconsin/Kiosk/`:

- **`KioskStore.swift`** — `@Observable` state machine. Owns `screen` (`activation | idle | studentHub | checkout | pickup | return | success`), `info` (KioskInfo from activation), inactivity timer, heartbeat task, persisted `kiosk_info_v1` in UserDefaults.
- **`KioskShellView.swift`** — switches between screens, applies dark color scheme, hides system overlays + status bar, captures every touch via `simultaneousGesture` to reset the inactivity timer.
- **`KioskActivationView.swift`** — 6-digit numpad, calls `/api/kiosk/activate`.
- **`KioskIdleView.swift`** — left panel: stats + today's events + active checkouts (polls `/api/kiosk/dashboard` every 30s). Right panel: location-scoped student roster grid (`/api/kiosk/users`).
- **`KioskStudentHubView.swift`** — entry point after a student taps their tile; lists their active checkouts/reservations and routes to checkout/pickup/return.
- **`KioskCheckoutView.swift`** — scan zone + scanned-items list + Complete button.
- **`KioskPickupView.swift`** — for `PENDING_PICKUP` bookings.
- **`KioskReturnView.swift`** — return flow.
- **`KioskSuccessView.swift`** — terminal screen with 5s auto-return to idle.
- **`KioskScannerField.swift`** — invisible UITextField that captures HID barcode-scanner keystrokes.
- **`KioskBarcodeCameraView.swift`** — DataScannerViewController-backed camera fallback for environments without a hand scanner.
- **`KioskAPIClient.swift`** — typed wrapper around `/api/kiosk/*` endpoints.
- **`KioskModels.swift`** — Codable types matching the kiosk API responses.

### Web — Backend + Admin (still used)

- **`src/app/(app)/settings/kiosk-devices/`** — admin CRUD page for `KioskDevice` rows (create, toggle active, delete, view activation code, last-seen timestamp).
- **`src/app/api/kiosk-devices/`** — REST CRUD for kiosk devices (admin/staff only, 401 redirect on mutations).
- **`src/app/api/kiosk/`** — kiosk-only API consumed by the iOS app:
  - `POST /activate` — validates 6-digit code, returns kiosk session
  - `GET /me` — returns kiosk identity
  - `POST /heartbeat` — updates `lastSeenAt`
  - `GET /dashboard` — live stats (active checkouts, today's events, team status)
  - `GET /users` — roster filtered by kiosk's `locationId`
  - `GET /student/[userId]` — a student's active checkouts and reservations
  - `POST /checkout/scan`, `POST /checkout/complete`, `GET /checkout/[id]`
  - `POST /checkin/[id]/scan`, `POST /checkin/[id]/complete`
  - `POST /pickup/[id]/scan`, `POST /pickup/[id]/confirm`
  - `POST /scan-lookup` — read-only item-by-tag lookup
- **Auth helpers:** `withKiosk()` (`src/lib/api.ts`) and `requireKiosk()` (`src/lib/auth.ts`) validate the kiosk-session cookie, refresh `lastSeenAt`, throw 401 if inactive/deactivated.

## Acceptance Criteria

| ID | Criterion | Status |
|----|-----------|--------|
| AC-1 | Admin CRUD for kiosk devices | ✅ Complete |
| AC-2 | iPad activation with 6-digit code | ✅ Complete |
| AC-3 | Idle screen with live stats | ✅ Complete |
| AC-4 | Checkout in ≤3 taps | ✅ Complete |
| AC-5 | Hand scanner input | ✅ Complete |
| AC-6 | Camera + manual fallbacks | ✅ Complete (camera added 2026-04-24, manual entry pending — see GAPS) |
| AC-7 | Return flow | ✅ Complete |
| AC-8 | Scan lookup | ✅ Complete |
| AC-9 | 5-min inactivity timeout (with mid-flow protection) | ✅ Complete |
| AC-10 | Audit trail with source=KIOSK | ✅ Complete |
| AC-11 | Kiosk API rejects non-kiosk requests | ✅ Complete |
| AC-12 | PENDING_PICKUP pickup flow | ✅ Complete |
| AC-13 | (Was: desktop scan routes gated 403) | ✅ N/A — web kiosk deleted; only `/api/kiosk/*` consumers are the iOS app |
| AC-14 | Mid-flow inactivity does not silently discard scan state | ✅ Complete (2026-04-24) |
| AC-15 | Heartbeat / dashboard 401 routes back to activation | ✅ Complete (2026-04-24) |

## Known Gaps

- Manual tag entry path (the third leg of AC-6) is not yet exposed in the iOS UI. Camera fallback covers most "scanner unavailable" cases. Track for a follow-up sprint.
- No search / first-letter filter on the avatar grid. Acceptable for ≤30-student locations; revisit on larger-roster rollouts.
- No "wrong person" undo path inside kiosk — admin must fix from web. Acceptable for V1.
- Activation code rotation lifecycle: once a device is activated and its cookie is intact, the original code is no longer needed; if cookie is wiped admin must regenerate from Settings → Kiosk Devices.

## Change Log
| Date | Change |
|------|--------|
| 2026-04-07 | Area doc created, all ACs pending |
| 2026-04-09 | AC-1 complete: Admin CRUD for kiosk devices shipped at `/settings/kiosk-devices`. |
| 2026-04-14 | AC-2–AC-13 complete: Full web kiosk flow shipped — activation, idle screen, avatar grid, student hub, checkout flow, return flow, scan lookup, inactivity timer, source=KIOSK audit trail, withKiosk auth on all routes. |
| 2026-04-24 | **iOS canonical, web kiosk deprecated.** Deleted `src/app/(kiosk)/kiosk/` (3,400 LOC) — all kiosk surfaces now run in the native iOS app. AREA doc rewritten with explicit Trust Model section. Added camera fallback (DataScannerViewController-backed) for AC-6. Added AC-14: scanned-cart preserved across inactivity reset (mid-flow scans no longer silently lost). Added AC-15: heartbeat and idle-dashboard 401s now route back to activation instead of silently failing. UI polish: shared `Color.kioskRed` extension, first-name+last-initial disambiguation on roster collisions, friendlier activation copy, back-button confirms when scanned items present. |
