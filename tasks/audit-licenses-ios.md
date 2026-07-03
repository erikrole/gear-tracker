# Audit: licenses (iOS) — 2026-06-30

**MVP verdict:** ships for native self-service
**Ship bar:** student-friendly, fully functional for core flows, zero hiccups in front of a class
**Audit type:** static source (no build/run/UI tests)

## Scope check
Native iOS now has `ios/Wisconsin/Views/LicensesView.swift`, reachable from compact Browse, compact Profile/Settings > Directory fallback, and the regular-width sidebar. The screen uses the existing web-backed license routes:

- `GET /api/licenses`
- `GET /api/licenses/my`
- `POST /api/licenses/[id]/claim`
- `POST /api/licenses/[id]/release`

The native scope is self-service only: view pool state, claim one slot, copy the active code, and return the signed-in user's own slot. Staff/admin management workflows remain on the web Licenses page.

## P0 — blocks MVP
_None._

## P1 — polish before ship
- [x] [Flows] **Release must not expose the admin "release all active claims" fallback.** The server permits staff/admin release without `claimId` to release all active claims on a code when the requester does not personally hold that code. Native iOS only calls `releaseLicense(id:)` from `releaseActiveClaim()`, guarded by `activeClaim.id`, and the pool rows do not expose arbitrary release buttons.

- [x] [Flows] **Claim and return need native confirmations.** `LicensesView.swift` uses separate `confirmationDialog` flows for claiming and returning so one tap on a row never mutates custody silently.

- [x] [Hardening] **License dates should not brick the screen on fractional ISO strings.** License model date fields decode as strings, and the view formats them through fractional and standard ISO parsers. One malformed optional date degrades to neutral copy instead of failing the entire response decode.

- [x] [Accessibility] **Embedded row actions must stay reachable.** Pool and active-license rows keep Claim, Copy Code, and Return License as real buttons instead of combining the whole row into one accessibility element.

## P2 — post-MVP
- [x] [Parity] Add a student-facing iOS view for "My license" so a student can see/copy their active code without opening the web app, and release it on the go. Closed by `LicensesView.swift`.
- [ ] [Parity] Full native admin management, including create, bulk create, renew, retire, export, unknown occupants, and full per-code history. Deferred to web control room.

## Lenses checked
- [x] Gaps
- [x] Flows
- [x] UI polish
- [x] Hardening
- [x] Breaking
- [x] Parity

## Files read
- docs/AREA_MOBILE.md
- docs/AREA_LICENSES.md
- docs/AREA_SETTINGS.md
- prisma/schema.prisma
- src/app/api/licenses/**
- src/lib/services/licenses.ts
- ios/Wisconsin/Views/LicensesView.swift
- ios/Wisconsin/Views/ProfileView.swift
- ios/Wisconsin/Views/AppTabView.swift
- ios/Wisconsin/Core/APIClient.swift
- ios/Wisconsin/Models/Models.swift

## Notes
- iOS push for license expiry/nag is wired through `licenses.ts` `processExpiryWarnings` and `processLicenseNags`.
- The native page intentionally keeps destructive or admin-heavy management on web.

## 2026-07-03 Runtime Recheck

- [x] Licenses list screenshot: `/var/folders/_x/t6hvydvd77167wrmgclk3nc1bq8t3g/T/screenshot_optimized_c342b030-681b-4dd5-8f55-1279740f7c21.jpg`
- [x] Runtime state: active claim appears under `My License`, pool rows render availability and slot counts, and staff/admin can see unclaimed codes as allowed by the native scope.
- [x] Return confirmation verified without confirming the mutation: destructive `Return License` action appears behind a `Return Photo Mechanic license?` confirmation with explanatory copy.
- [x] Claim confirmation was not exercised because this live user already holds a license; native UI correctly hides claim actions while an active claim exists.
