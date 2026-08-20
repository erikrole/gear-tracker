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
- [x] [UI polish] **License capacity and active-use hierarchy should be readable before scanning every row.** The page now leads with open-slot capacity, elevates the holder's code into a distinct active-license card, labels pool rows by open capacity, and uses blue for partial/full operational use. Student occupancy remains anonymous and claim/return rules are unchanged.

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

## 2026-08-19 UI Pass — Redundancy and Retired Honesty

Fixture-harness capture (no session, no network) showed problems the 2026-06-30 static pass and the 2026-07-03 single-state runtime recheck both missed, because both looked at one data shape.

- [x] [UI polish] **The holder's license was rendered twice in full.** The My License card and the first pool row carried the same title, the same plaintext code, and the same expiry. The pool row now drops the code and expiry lines and keeps only what the card above cannot say: occupancy on that specific code.
- [x] [UI polish] **One row carried two verdicts.** A held row showed both its open-slot pill and a separate `Yours` pill. Now a single `Yours` pill, and the status glyph is `key.fill` rather than `person.badge.plus`, which read as an invitation to add someone.
- [x] [Hardening] **Retired codes advertised themselves as claimable.** They rendered "Code hidden until claimed" and "No one is using this code". Retired rows now collapse to one dimmed line stating the lapse date and that the code is no longer claimable, with no occupancy line and no claim affordance.
- [x] [Gaps] **The capacity summary and the row count disagreed for staff.** `/api/licenses` returns retired codes to STAFF/ADMIN (`listAllCodes`), while `LicensePoolOverview` counts only non-retired. The header read "across 2 codes" above three rows. A section footer now names the excluded retired count.
- [x] [UI polish] **Per-row expiry was three identical lines.** Codes share an annual expiry, so the date was chrome until it mattered. Pool rows now show it only within 30 days or once lapsed; the My License card is unconditional. Verified in the `resourcesLicensesOpen` fixture, where a 12-day code shows its orange warning and a 134-day code does not.
- [x] [UI polish] **The per-row status wash inverted the hierarchy.** Full-bleed green/blue row backgrounds were unique to this screen, and left the retired row (`cardSurface`, effectively white) the brightest row on a grouped background. Removed; the claimed card stays the only tinted block.
- [x] [Accessibility] **Transient notices were silent to VoiceOver and actions had no haptics.** `showNotice` posts an announcement; claim, return, and copy carry success/error haptics matching the rest of the app.

### Still open

- [ ] [Parity] Full native admin management (create, bulk create, renew, retire, export, unknown occupants, per-code history) remains deferred to the web control room. Unchanged by this pass.
- [ ] Authenticated runtime proof against a live pool. This pass was captured through the DEBUG fixture harness; no live license was claimed, returned, or mutated.
