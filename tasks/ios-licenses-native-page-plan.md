# iOS Native Licenses Page Plan

Date: 2026-06-30

## Goal

Replace the native iOS Licenses web fallback with a first-class SwiftUI page for Photo Mechanic license self-service. The page should let every authenticated role view the pool, claim one available slot, copy their active code, and return their own slot. Staff/admin power tools stay on the web control-room page.

## Source Audit

- `docs/NORTH_STAR.md`: native iOS is a first-class product surface, while web remains the control room.
- `docs/AREA_LICENSES.md`: each code has two slots, one active claim per user, all roles can view/claim/release, and staff/admin manage create/edit/retire workflows.
- `docs/AREA_SETTINGS.md`: Settings/Profile should keep focused child pages and role-appropriate feedback loops.
- `docs/AREA_MOBILE.md`: compact iPhone reaches secondary areas through Profile/Settings > Directory, while regular-width iPad exposes sidebar-only destinations.
- `docs/DECISIONS.md`: mobile should prioritize fast operational work; admin-heavy destructive actions can stay on web.
- `docs/GAPS_AND_RISKS.md`: no open license-specific blocker for native self-service.
- `prisma/schema.prisma`: `LicenseCode`, `LicenseCodeClaim`, and `LicenseCodeStatus` confirm the two-slot code and active-claim model.
- `src/app/api/licenses/**`: existing routes provide list, current claim, claim, and release contracts for the native page.

## Scope

- Add tolerant iOS models for license codes, active claims, active occupants, and claim responses.
- Add `APIClient` methods for `GET /api/licenses`, `GET /api/licenses/my`, `POST /api/licenses/[id]/claim`, and `POST /api/licenses/[id]/release`.
- Add `LicensesView.swift` using native SwiftUI `List` sections, pull-to-refresh, system navigation, confirmation dialogs, and standard copy/share behavior.
- Wire compact iPhone Profile/Settings > Directory and regular-width sidebar Licenses to the native page.
- Add source-contract tests that pin the route paths, native wiring, claim/return confirmations, and safe release behavior.
- Sync docs and run the iOS verification gates.

## Out Of Scope

- Admin create, bulk create, edit, retire, delete, unknown occupant, CSV export, and full per-code history workflows. Those remain on the web Licenses page.
- Schema or API contract changes.
- Kiosk custody behavior.

## Checklist

- [x] Audit licenses, mobile/settings, decisions, gaps, Prisma schema, API routes, and current iOS navigation.
- [x] Add Swift models and `APIClient` methods for the existing license APIs.
- [x] Build native `LicensesView` with loading, error, empty, active-license, pool, claim, return, copy, and admin web-link states.
- [x] Replace iOS Licenses web fallbacks with the native page in Profile/Settings and regular-width sidebar navigation.
- [x] Add focused source-contract tests.
- [x] Sync `AREA_LICENSES`, `AREA_MOBILE`, `AREA_SETTINGS`, and task review notes.
- [x] Regenerate Xcode project and run verification gates.
- [x] Screenshot follow-up: remove contradictory pool-row copy, make Copy Code neutral, keep Return destructive, and reduce active-license action weight.
- [x] App Store-style follow-up: use native SwiftUI text-only capsule buttons for Claim, Copy Code, and Return License without custom badge/icon styling.
