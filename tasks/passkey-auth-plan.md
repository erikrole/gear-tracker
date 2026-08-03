# Passkey Authentication Plan - 2026-07-31

## Goal

- Let active, invite-granted Gear Tracker users enroll a passkey and use it for web or native iOS sign-in while preserving password recovery, the existing cookie-backed `Session` model, and kiosk device authentication.

## Route

- Owner area: Users / Settings / Authentication
- Ledger: this active plan; archive after verification and documentation closeout
- First slice: web enrollment, login, credential management, schema, tests, and docs
- Current slice: native iOS `AuthenticationServices` against the same server ceremony contract

## Source Checks

- `AllowedEmail.claimedAt` and an active `User` are the current invitation/access boundary; no additional identity-verification state is needed for passkey eligibility.
- Password login currently verifies `User.passwordHash` and calls `createSession`; `requireAuth` validates the shared session cookie and active account on every request.
- Settings Security already owns password changes and session revocation for every authenticated role.
- Kiosk auth is intentionally separate and remains activation-code/device-token based.
- Native iOS already centralizes authenticated API traffic in `APIClient`, session restoration in `SessionStore`, and personal security controls in `AccountSecuritySettingsView`; the passkey slice must extend those contracts rather than introduce a second auth store.

## Stop Conditions

- Stop if the WebAuthn library's installed API does not match the ceremony response used by the routes and browser client.
- Stop if a challenge can be reused, verified without its short-lived ceremony cookie, or consumed without a serialized one-time guard.
- Stop if passkey login creates a second session/auth authority instead of using `createSession`.
- Stop if the last recovery path can be removed while password recovery remains the only fallback.
- Stop before deployment if migration health, authenticated browser proof, or the production RP origin is not confirmed.

## Slices

- [x] Slice 1: Add passkey credential and one-time ceremony persistence.
- [x] Slice 2: Add WebAuthn registration, authentication, listing, and revocation routes with rate limits and audit entries.
- [x] Slice 3: Add web login and Settings Security enrollment/management UI.
- [x] Slice 4: Add focused API, service, source-contract, schema, and migration checks.
- [x] Slice 5: Update Users, Settings, decisions, gaps, and native follow-up documentation.
- [x] Slice 6: Add native iOS passkey login, enrollment, and credential management against the web API contract.
- [x] Slice 7: Harden explicit self-service authorization, duplicate conflicts, and native post-mutation recovery.

## Verification

- [x] Focused passkey and auth tests: 17 tests passed across 5 files.
- [x] `npx prisma validate` and `npx prisma generate`.
- [x] `npm run db:migrate:check`.
- [x] Restored exact production migration provenance for `0104_license_claim_history_integrity`, `0105_license_expiry_timestamp_parity`, and `0106_calendar_event_results` from repository history.
- [x] Applied `0106_passkey_auth` through the guarded Neon HTTP fallback; final health reports 111/111 local migrations applied with no pending, failed, or DB-only rows.
- [x] `npx tsc --noEmit --pretty false`.
- [x] Focused ESLint on changed TypeScript/TSX files.
- [x] `git diff --check`.
- [x] `npm run build:app`.
- [x] `npm run codemap` and `npm run verify:docs`.
- [ ] Authenticated browser smoke for login and Settings Security, unavailable in this turn without a usable invited test account/browser session.
- [x] Native iOS source-contract tests, XcodeGen project check, drift checks, and affected-target simulator build.
- [x] Native registration confirmation decodes the compact `201` response returned by the verifier instead of the fuller passkey-list model.
- [x] Native rollout-skew handling: production route 404 hides enrollment with a clear unavailable state and the optional passkey name opts out of contact autofill.
- [x] Hardening regressions: 23 focused tests across passkey server, native source contract, route wrapper, and collaborator permission policy files.
- [x] Current TypeScript, focused ESLint, migration-free `build:app`, iOS project/drift/gap checks, and Wisconsin simulator build.
- [ ] Current docs verification is blocked by parallel badge/sidebar codemap drift across four generated codemaps; do not regenerate until those owners finish.
- [ ] Authenticated browser smoke, device-side AASA refresh, and real-device passkey enrollment/sign-in.

## Review

- Shipped locally: web and native iOS passkey enrollment, discoverable login, credential listing/revocation, shared-session issuance, audit entries, schema/migration file, associated-domain/AASA support, rollout-skew handling, explicit self-service permission gates, actionable duplicate conflicts, truthful native refresh recovery, UI, tests, and documentation.
- Verified: focused tests, native source contracts, XcodeGen project membership, iOS drift checks, Wisconsin simulator build, Prisma validation/generation, migration prefix check, TypeScript, ESLint, diff check, codemap/docs verification, and `build:app`. The native registration confirmation now matches the verifier's compact `201` response. A 2026-07-31 production read confirmed AASA `200 application/json`, registration-options `405` for unauthenticated `GET`, and passkey listing `401` for unauthenticated `GET`; Apple’s AASA CDN returned the matching app ID.
- Deferred: authenticated browser smoke, device-side association refresh, and real-device passkey use.
- Migration: production `0106_passkey_auth` is applied. The exact previously DB-only migration files were restored from Git history, the existing calendar-result column was reconciled into Prisma, and final health matches all 111 local migrations.
- Proof artifacts: `src/lib/passkey.ts`, `prisma/migrations/0106_passkey_auth/migration.sql`, `ios/Wisconsin/Core/PasskeyService.swift`, `tests/passkey-auth.test.ts`, `tests/ios-passkey-source.test.ts`, `docs/DECISIONS.md` D-043, and `docs/GAPS_AND_RISKS.md` GAP-62.
- Next slice or stop: install the current build on a real iPhone, allow Apple’s association refresh, and run invited browser and device enrollment/sign-in proof before enabling enrollment for real users.
