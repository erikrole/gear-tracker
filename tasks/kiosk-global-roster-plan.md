# Kiosk Global Roster Plan - 2026-08-03

## Goal

- Show every active, visible user in every kiosk's identity roster, regardless of the user's saved location.
- Keep physical gear, reservation pickup, and custody operations authoritative to the kiosk location.

## Route

- Owner area: `AREA_KIOSK`
- Secondary area: `AREA_USERS`
- Ledger: this plan
- Existing contract: D-032 currently scopes person reads to `kiosk.locationId` and must be reconciled with the current product direction.

## Source Checks

- `src/app/api/kiosk/users/route.ts` filters the manual roster to the kiosk location, no location, and policy-granted collaborators.
- `src/app/api/kiosk/identify/route.ts` and `src/app/api/kiosk/resolve-scan/route.ts` apply the same person-location filter to Wiscard identity.
- `src/app/api/kiosk/student/[userId]/route.ts` rejects a visible active user whose saved location differs from the kiosk before returning the student hub context.
- The same student context route already keeps pending pickups and reservations scoped to the kiosk location, while active checkouts remain globally readable for the identified requester.
- `hiddenFromRoster: false` remains the visibility boundary. This change does not expose hidden smoke users, inactive users, or private profile fields.
- `docs/DECISIONS.md` D-032 and `docs/AREA_KIOSK.md` describe the old location-scoped person model and need a dated correction.

## Stop Conditions

- Stop if removing person-location scope would expose hidden, inactive, or private user data.
- Stop if a custody or reservation route relies on the user-location check for physical location enforcement rather than using the booking, asset, allocation, or kiosk location checks already present.
- Stop if current response shapes differ from the native `KioskUser` and student-context models.

## Slices

- [x] Slice 1: Reconcile D-032 and kiosk area documentation to separate global person discovery from location-scoped operational work.
- [x] Slice 2: Remove user-location predicates from roster, Wiscard identity, scan identity, and student-context eligibility while preserving `hiddenFromRoster` and `active` filters.
- [x] Slice 3: Add route regression coverage for users assigned to another location and retain wrong-location reservation pickup coverage.
- [x] Slice 4: Run focused tests and repository gates, then record browser/device proof boundaries.

## Verification

- [x] `npx vitest run tests/users-hidden-visibility.test.ts tests/kiosk-resolve-scan-route.test.ts tests/kiosk-student-bulk-summary.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed TypeScript files
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [ ] Authenticated kiosk runtime proof, or record why it is unavailable
- [ ] Managed M2 iPad Air proof remains a separate hardware gate

## Review

- Implemented: Kiosk person discovery is global for active, visible internal users across the manual roster, Wiscard identity, scan identity, and student context. Explicitly eligible external collaborators remain global. Gear, reservation pickup, booking, allocation, and custody operations retain kiosk-location boundaries.
- Verified: Focused Vitest coverage passed 25 tests; TypeScript, focused ESLint, `npm run build:app`, codemap verification, and `git diff --check` passed.
- Deferred: Authenticated Kohl Center runtime walkthrough and managed iPad hardware proof. Production deployment is authorized; the release result will be reported in the handoff.
- Blocked: None for the code and documentation slice.
- Proof artifacts: `tests/users-hidden-visibility.test.ts`, `tests/kiosk-resolve-scan-route.test.ts`, `tests/kiosk-student-bulk-summary.test.ts`, and the implementation references in D-032.
- Next slice or stop: Stop here until the change is deployed, then verify the Kohl Center kiosk with an active visible user whose saved location differs from the kiosk and one physical pickup-location negative case.
