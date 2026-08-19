# Software Vault Plan - 2026-08-19

## Goal

- Rename the sidebar's Licenses entry to Software while preserving `/licenses` as the compatibility route.
- Add a clear shared-software vault for department accounts such as Photo Mechanic, Envato Elements, APM Music, and Motion Array.
- Keep Photo Mechanic's existing two-slot license pool available below the new vault.

## Route

- Owner area: Software / Photo Mechanic Licenses (`/licenses`)
- Secondary areas: Users permissions, audit logging, Prisma schema
- Ledger: this plan; reconcile `docs/AREA_LICENSES.md` or add a focused Software area note after verification
- Existing plan/archive references: `tasks/archive/completed-2026-08-18/license-expiry-date-only-plan.md`

## Source Checks

- `src/components/Sidebar.tsx` owns the current Licenses navigation item and keeps `/licenses` as its href.
- `src/app/(app)/licenses/page.tsx` owns the current client page and already fetches the authenticated user before rendering role-sensitive controls.
- `src/app/api/licenses/*` and `src/lib/services/licenses.ts` establish the existing permission, audit, rate-limit, and safe-error patterns.
- `LicenseCode` is specific to the two-slot Photo Mechanic model; shared credentials need a separate model and secret boundary.
- `src/lib/env.ts` has the central environment contract; the vault key must be explicit and fail closed rather than reuse a database or session value silently.
- Existing audit helpers support actor-scoped read/write records; secret values must never enter `beforeJson`, `afterJson`, responses, or exports.

## Product and Security Contract

- Internal ADMIN, STAFF, and STUDENT users may discover active software records; external COLLABORATOR users remain denied by the API and hidden from the sidebar.
- ADMIN and STAFF may create, edit, and archive records.
- List responses include non-secret metadata and the decrypted account email for the authorized internal viewer, but never include the password or encrypted ciphertext.
- Password reveal/copy is a separate authenticated, rate-limited request that returns `private, no-store` data and writes an audit event without the secret.
- Passwords and account emails are encrypted at rest with AES-256-GCM using a dedicated `SOFTWARE_VAULT_KEY` environment value. Missing or malformed key configuration fails closed for vault operations.
- No real credentials are seeded by this implementation; admins enter department credentials through the management dialog.

## Stop Conditions

- Stop schema/API work if the current Prisma migration prefix or live migration state contradicts the additive migration path.
- Stop and do not return secrets if the vault key is missing, malformed, or cannot authenticate ciphertext.
- Stop if the route shape requires exposing a password in the list payload, audit log, error message, export, or client source.
- Stop if existing dirty work in `docs/AREA_LICENSES.md`, `prisma/schema.prisma`, or shared shell files conflicts with the narrow edits; preserve the unrelated changes and report the conflict.
- Stop runtime claims if authenticated browser proof is unavailable; source/build proof does not substitute for the visible route gate.

## Slices

- [x] Slice 1: Add the encrypted `SoftwareCredential` schema/migration, dedicated permission entries, and server crypto/service/API boundaries.
- [x] Slice 2: Add the Software vault cards, safe reveal/copy behavior, and staff/admin management dialog above the existing Photo Mechanic license pool; relabel the sidebar.
- [x] Slice 3: Add focused privacy/security/source-contract coverage and durable area/decision documentation.
- [ ] Slice 4: Run focused tests, TypeScript, lint/build, migration/docs checks, and authenticated browser smoke if an approved local session is available.

## Verification

- [x] Focused vault crypto, service, route, and UI privacy tests
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed TypeScript/TSX files
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs` when shared route/schema/docs maps change
- [x] `git diff --check`
- [ ] Authenticated browser smoke of `/licenses` at desktop and narrow width, including password list redaction, reveal/copy request, and no console errors; record the blocker if unavailable
- [ ] Do not run full `npm run build` or apply migrations without explicit migration/deploy approval

## Review

- Shipped: Local Software Vault UI, encrypted schema/service/API boundary, dedicated permissions, sidebar/search copy, focused regression tests, and area/decision/gap documentation. The existing Photo Mechanic pool remains below the vault at `/licenses`.
- Verified: `npx prisma generate`, `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit --pretty false`, focused ESLint, `npm run build:app`, `npm run codemap`, `npm run verify:docs`, `git diff --check`, and the focused suite (24 tests across four files, including 7 vault tests).
- Deferred: Key rotation remains an operational re-encryption procedure; per-record entitlements, sharing, password history, and real credential seeding are out of scope.
- Blocked: Authenticated browser proof and production-shaped migration/key readback remain pending; do not use real department credentials until those gates pass.
- Proof artifacts: `tests/software-vault.test.ts`, `docs/AREA_SOFTWARE.md`, `docs/DECISIONS.md` D-052, and GAP-69.
- Next slice or stop: Run the broader focused suite, build, codemap/docs checks, and safe local browser smoke if an approved authenticated session and migrated local database are available.
