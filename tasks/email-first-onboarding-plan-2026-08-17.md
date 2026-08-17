# Email-First Onboarding Plan - 2026-08-17

## Goal

- Let an invited but unregistered person enter their email on the normal web or native app sign-in surface and be routed directly into password creation and the existing role-aware profile setup.
- Retire the normal linked `/register?email=...` handoff while keeping a compatibility redirect for old links.

## Route

- Owner area: Users / authentication, with web and native iOS surfaces.
- Ledger: this active plan; archive after all implementation, documentation, and verification gates are complete.
- Existing references: `docs/BRIEF_ONBOARDING_V1.md`, D-029, D-037, `src/app/api/auth/register/route.ts`, `src/app/(app)/welcome/page.tsx`, and the existing iOS login/Welcome flow.

## Source Checks

- `AllowedEmail` remains the invitation authority. It is unique by normalized email, and unclaimed rows are consumed atomically by registration.
- Public registration currently accepts name, email, and password, derives role/profile seed data from `AllowedEmail`, creates the session, and routes both web and iOS users into the existing profile-completion flow.
- Web login currently submits email and password together. Native iOS already stages email before password but does not make a server discovery request.
- Existing docs intentionally retire temporary-password onboarding and require public auth responses to avoid broad membership enumeration.
- This slice changes only the UX hint needed for the requested email-first flow: an unclaimed allowed email returns a minimal `onboarding` mode; missing, claimed, inactive, and already-registered addresses return the normal `password` mode. No role, name, or profile data is returned, and the registration allowlist check remains authoritative.
- No schema or migration is needed.

## Stop Conditions

- Stop if the discovery response begins returning role, name, profile, or other private roster data.
- Stop if registration can be bypassed, claimed twice, or completed for an address that is not currently allowed.
- Stop if the web or native clients interpret a discovery error as successful onboarding.
- Stop if iOS Codable decoding or the Wisconsin target cannot tolerate the new response during rollout.
- Stop before production deployment or email-delivery changes; this slice is source, build, and local/runtime verification only.

## Slices

- [x] Slice 1: Add the rate-limited public email-discovery API contract and focused route tests.
- [x] Slice 2: Make web login email-first, render password creation for recognized pending invites, and redirect legacy registration links to login.
- [x] Slice 3: Make native iOS call discovery from its identity step, open the existing native registration form with the recognized email, and remove the manual registration link.
- [x] Slice 4: Update onboarding/status copy, decision/area docs, source-contract tests, and verification notes.

## Verification

- [x] Focused auth/discovery, registration, onboarding, and iOS source-contract tests. The focused email-first/API set passed 36/36; the native-focused set passed 66/66. The full suite passed 3,228 tests and had one unrelated environment failure in `tests/bootstrap-empty-database.test.ts` because `DIRECT_URL` is not configured.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint` (exit 0; one pre-existing unused-variable warning remains in `scripts/backfill-signature-artifacts.ts:511`).
- [x] `npm run codemap` and `npm run verify:docs` (codemaps current, including the new auth route and tests).
- [x] `npm run db:migrate:check` (120 migrations, no prefix collisions or malformed folders; no migration introduced).
- [x] `git diff --check`
- [x] `npm run build:app` (Next production build passed and included `/api/auth/discover`, `/login`, `/register`, and `/welcome`).
- [ ] Authenticated browser smoke for `/login`, email-first onboarding, `/welcome`, and legacy `/register` redirect. No authenticated local runtime or browser credentials were available in this turn.
- [x] `npm run drift:ios` (85 Swift files, no anti-patterns), `npm run audit:ios:gaps` (54/54 covered), `npm run ios:project:check`, and focused native source tests (66/66).
- [ ] Wisconsin generic iOS Simulator/device build. The Xcode build is blocked by the existing `WisconsinLiveActivities` `#Preview` macro/plugin failure and unavailable CoreSimulator service/runtime; no onboarding source error was observed.
- [ ] Record physical-device and authenticated native runtime proof separately if unavailable.

## Review

- Shipped: Local web/API/native source implementation, compatibility redirect, operator-link copy, tests, and docs. No schema, migration, temporary-password path, email service, deployment, or commit was added.
- Verified: Discovery returns only `onboarding` or `password`; registration remains the final allowlist-backed authority. TypeScript, lint, focused tests, build, docs, migration, codemap, and diff checks passed as recorded above.
- Deferred: Authenticated web smoke, native simulator/device UI acceptance, physical iOS acceptance, production deployment, and email-blast delivery proof.
- Blocked: One full-suite bootstrap test needs `DIRECT_URL`; Xcode runtime/build proof needs a working CoreSimulator/Xcode macro environment; authenticated browser/native proof needs credentials and a running environment.
- Proof artifacts: `docs/BRIEF_ONBOARDING_V1.md`, `docs/DECISIONS.md` D-051, `docs/GAPS_AND_RISKS.md` GAP-66, and the source/API tests named in the verification section.
- Next slice or stop: Stop at the local implementation boundary until authenticated runtime and iOS environment gates are available; then run GAP-66 rollout smoke before any production claim.
