# Audit: licenses (iOS) — 2026-04-24

**MVP verdict:** N/A — out of scope for iOS V1
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

## Scope check
No iOS license screen exists — `ios/Wisconsin/Views/` has no `LicensesView.swift` or equivalent. `docs/AREA_MOBILE.md:24-30` defines V1 primary destinations as Dashboard, Items, Reservations, Check-outs, Scan — licenses are intentionally absent. `docs/AREA_LICENSES.md` describes a web-only area.

This audit therefore has no source to evaluate. Web audit (`tasks/audit-licenses-web.md`) covers the licenses surface.

## P0 — blocks MVP
_None — feature is intentionally web-only for V1._

## P1 — polish before ship
_None._

## P2 — post-MVP
- [ ] [Parity] Add a student-facing iOS view for "My license" so a student can see/copy their active code without opening the web app, and release it on the go. Would slot under a "More" tab or under Profile. Not blocking — students at MVP open the web app for license actions; the current 2-day rotation nag includes a push notification, so awareness is fine.

## Lenses checked
- [x] Gaps — feature explicitly out of iOS V1 scope
- [x] Flows — N/A (no screen)
- [x] UI polish — N/A
- [x] Hardening — N/A (backend already hardened per web audit)
- [x] Breaking — N/A
- [x] Parity (informational) — web-only is intentional per AREA_MOBILE V1

## Files read
- docs/AREA_MOBILE.md
- docs/AREA_LICENSES.md
- ios/Wisconsin/Views/ (directory listing)

## Notes
- iOS push for license expiry/nag *is* wired (see `licenses.ts` `processExpiryWarnings` and `processLicenseNags` calling `sendPushToUser`) — students get notified even without a license screen.
- When licenses lands on iOS, scope it as a single screen: list (read-only for students, full for staff), claim/release sheet mirroring web confirmations, and a "Your license" banner on the Profile or Home tab.
