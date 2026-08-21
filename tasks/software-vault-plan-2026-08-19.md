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

- The initial production slice allowed ADMIN, STAFF, and STUDENT users to discover active software records; this audience-gated follow-up adds explicit collaborator access without weakening the default-deny policy.
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
- [x] Slice 4: Run focused tests, TypeScript, lint/build, migration/docs checks, and authenticated browser smoke if an approved local session is available.

## Verification

- [x] Focused vault crypto, service, route, and UI privacy tests
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint for changed TypeScript/TSX files
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs` when shared route/schema/docs maps change
- [x] `git diff --check`
- [ ] Authenticated browser smoke passed at desktop and narrow width for navigation, empty-state/list redaction, responsive layout, and a clean console. The live credential is now masked with its audience label; reveal/copy/archive/restore remains pending and must not expose the secret during evidence capture.
- [x] Migration/deploy approval was granted; the guarded production migration and deploy-shaped Vercel build passed.

## Review

- Shipped: Production Software Vault UI, encrypted schema/service/API boundary, dedicated permissions, sidebar/search copy, production-only Sensitive key, migration `0125_software_credentials`, regression tests, and area/decision/gap documentation. The existing Photo Mechanic pool remains below the vault at `/licenses`.
- Verified: all 3,383 tests, `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit --pretty false`, lint, `npm run build:app`, deploy-shaped Vercel build, `npm run codemap`, `npm run verify:docs`, `git diff --check`, production migration readback, and authenticated desktop/narrow browser proof with a clean console.
- Deferred: First real-credential create/reveal/copy/archive/restore acceptance and the coordinated key-rotation procedure remain operational follow-up. Per-record entitlements, sharing, and password history are out of scope for this shipped slice.
- Blocked: None for current production availability. Secret lifecycle acceptance waits for an administrator to enter an actual department credential; no credential was invented or seeded.
- Proof artifacts: commit `2548f4ce`, production deployment `dpl_BuEMXuk96yzqyjj9sPTTAPEAQ2tS`, migration checksum `b8debcbf66333da3b82f1eebac391c53b64df1d18e34a95f515864621d112f82`, `tests/software-vault.test.ts`, `docs/AREA_SOFTWARE.md`, `docs/DECISIONS.md` D-052, and GAP-69.
- Next slice or stop: Stop this production slice. Execute the audience-gated next slice only with explicit new approval, and use the first real administrator-entered credential for secret lifecycle acceptance.

## Next Slice — Audience-Gated Software Logins (2026-08-19)

### Goal

- Let admins and staff add/edit shared software logins with a site link, account email, and password that stays hidden until explicitly revealed.
- Let an authorized user copy a hidden password directly to the clipboard without changing the reveal state, with a brief visible copied confirmation.
- Let the login owner choose whether each record is shared with staff, students, and/or collaborators.

### Source Checks

- The existing `/licenses` Software Vault already owns the card, dialog, reveal, copy, archive, and restore flow.
- `Role` includes `ADMIN`, `STAFF`, `STUDENT`, and `COLLABORATOR`; collaborator access is capability-based and default-deny.
- Existing targeted-resource controls use shadcn `Checkbox` rows and are the interaction pattern for audience selection.
- The existing `SOFTWARE_VAULT_KEY`, audit boundary, and separate secret endpoint remain unchanged.

### Security Contract

- New records default to Staff + Students; Staff includes administrators for management and is not a separate ADMIN checkbox.
- ADMIN and STAFF can manage and see all records, including records shared only with students or collaborators.
- STUDENT sees only records shared with Students.
- COLLABORATOR must have the `SOFTWARE_VAULT_VIEW` capability and sees only records shared with Collaborators; without the capability the sidebar and API remain unavailable.
- Unauthorized records are filtered server-side and secret requests return a not-found response without decrypting or returning the password.
- Hidden copy requests the secret only for the clipboard write and never adds the password to the reveal state.

### Slices

- [x] Slice 1: Add the audience enum/array migration, validation, summary metadata, and pure access policy.
- [x] Slice 2: Enforce audience filtering on list/secret APIs and add the collaborator capability/nav gate with audit-safe updates.
- [x] Slice 3: Add checkbox-based audience controls and copied-state animation to the add/edit and card UI.
- [x] Slice 4: Run focused tests, TypeScript, lint/build, migration/docs checks, and record authenticated browser availability.

### Verification

- [x] Audience policy, API boundary, schema, and UI source-contract tests.
- [x] `npx prisma validate`, `npm run db:migrate:check`, `npx tsc --noEmit --pretty false`, focused ESLint, and `npm run build:app`.
- [x] `npm run codemap`, `npm run verify:docs`, and `git diff --check` when shared maps/docs change.
- [ ] Authenticated admin browser smoke passed on production at desktop and 390×844 with the real credential masked, the Staff + Students audience label present, and no horizontal overflow. Student and collaborator audience states remain pending because matching authenticated sessions were unavailable.
- [x] Do not apply the migration, seed real credentials, or make production changes without explicit approval.

### Review

- Shipped: per-login Staff/Student/Collaborator audience controls, server-side filtering before email decryption, the default-deny collaborator capability/nav/API gate, hidden-copy confirmation, collaborator-safe suppression of the Photo Mechanic pool, and migration `0126_software_credential_visibility`.
- Verified: 3,385 tests, Prisma validate/format, migration-prefix check, TypeScript, lint, `npm run build:app`, codemap/docs verification, `git diff --check`, isolated-branch rehearsal, guarded production migration/readback, production deployment, public smoke, and authenticated admin desktop/narrow masking and audience-label proof.
- Deferred: Student/collaborator authenticated audience proof, first real-credential reveal/copy/archive/restore acceptance, and coordinated key rotation.
- Blocked: Matching student and capability-enabled collaborator sessions were unavailable. The release did not read, copy, archive, or otherwise expose the real credential secret.
- Proof artifacts: commit `0b6c7931`, deployment `dpl_C76nqguhMWnUAq8hRSPW2Kudj3Wh`, and migration checksum `9a53d2962330acade5d053f7942ca9da49a71337dfd620a616d67e1792862a0d`.

## First-Class Software Separation and Hardening — 2026-08-20

### Goal

- Make Software a first-class destination with two explicit workflows: ordinary shared department logins and Photo Mechanic activation licenses.
- Keep shared-login secrets, permissions, and lifecycle independent from Photo Mechanic's two-slot claim/custody model while preserving `/licenses` compatibility.
- Harden the shared-login management path against duplicate actions, partial mutation/audit failures, naming conflicts, and stale in-memory secrets.

### Source Checks

- `src/app/(app)/licenses/page.tsx` now owns URL-backed Shared logins / Photo Mechanic licenses tabs, contextual Photo Mechanic actions, collaborator suppression, and retryable role loading.
- `src/app/(app)/licenses/SoftwareVault.tsx` owns shared-login list, reveal/copy, add/edit, archive, and restore behavior; shared-login copy no longer suggests Photo Mechanic.
- `SoftwareCredential` and `LicenseCode` are already separate Prisma models and API families. This slice must not merge them or change Photo Mechanic claim/expiry semantics.
- The pre-hardening shared software mutations wrote the credential before the audit row, so an audit failure could leave a committed change behind; this slice moves those writes into serializable transactions and maps unique-name conflicts to a friendly 409.
- Existing route tabs use the installed shadcn `Tabs` primitive and `useUrlState` for durable, linkable selection.

### Stop Conditions

- Stop if current permissions, API response shapes, production migration state, or D-052 contradict keeping the two workflows separate on the existing route.
- Stop if hardening would require exposing account emails or passwords in audit snapshots, list payloads, source fixtures, or error messages.
- Stop runtime claims if an authenticated session or configured development vault key is unavailable; source/build proof does not substitute for the signed-in route.
- Preserve the unrelated active iOS and documentation changes already present in the worktree.

### Slices

- [x] Slice 1: Add a URL-addressable Shared logins / Photo Mechanic tab boundary, contextual actions, role-aware visibility, and explicit section copy.
- [x] Slice 2: Polish shared-login refresh, archived-state, pending-action, secret-memory, empty, and recovery behavior.
- [x] Slice 3: Move shared-login create/update/archive audit writes into serializable transactions and return a friendly unique-name conflict.
- [x] Slice 4: Add focused regressions and run source, build, documentation, and authenticated-browser availability gates.

### Verification

- [x] Focused Software vault service, route, UI, and privacy tests (35 tests).
- [x] `npx tsc --noEmit --pretty false`.
- [x] Focused ESLint for changed TypeScript and TSX files.
- [x] `npm run build:app` after confirming no Next development server occupies the configured port.
- [x] `npm run codemap` followed by `npm run verify:docs` after route/service codemap drift.
- [x] `git diff --check` and a final in-scope diff review.
- [ ] `gt-ui-review` matched before/after review page using the same role, data, viewport, and scroll position (blocked: no approved isolated authenticated fixture/session is available in this run).
- [ ] Authenticated desktop and narrow browser proof for both tabs, contextual controls, masked secrets, clean console, and clean network behavior (blocked: no approved isolated authenticated fixture/session; no production or real secret was used).

### Review

- Shipped: URL-backed Shared logins and Photo Mechanic licenses tabs on `/licenses`, contextual PM actions, collaborator-safe role loading/retry, mobile PM cards, shared-login pending/recovery polish, POST reveal, transactional software audits/conflict mapping, explicit student license DTOs, serializable PM release retry, and private/audited CSV export.
- Verified: 35 focused tests across software/privacy/export/release contracts, TypeScript, scoped ESLint, Prisma validation, migration-prefix check, deploy-shaped `npm run build:app`, and `git diff --check`.
- Deferred: Authenticated student/collaborator role proof, first real-credential reveal/copy/archive/restore acceptance, coordinated key rotation, and matched before/after `gt-ui-review` captures.
- Blocked: Browser and visual-review gates require an approved isolated authenticated fixture/session. Repository testing configuration exposes no `PLAYWRIGHT_BASE_URL`, dedicated credentials, or `PLAYWRIGHT_TARGET_ISOLATED=1`; no production or real secret was touched.
- Proof artifacts: `tests/software-page-first-class.test.ts`, `tests/software-api-hardening.test.ts`, `tests/licenses-ui-privacy-contract.test.ts`, `tests/licenses-export-route.test.ts`, `tests/licenses-release-concurrency.test.ts`, `src/app/(app)/licenses/page.tsx`, `src/app/(app)/licenses/SoftwareVault.tsx`, `src/app/(app)/licenses/LicenseTable.tsx`, `src/lib/services/software.ts`, and the reconciled area/decision/gap docs.
- Next slice or stop: Stop at the local hardening boundary until an approved isolated authenticated browser session/fixture is available; then prove both tabs at desktop and 390×844, student/collaborator filtering, secret pending/recovery, and the visual review before any rollout claim.
