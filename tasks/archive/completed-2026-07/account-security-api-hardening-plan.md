# Account Security API Hardening Plan - 2026-07-23

## Goal
- Make self-service password changes and session revocations atomic and fully auditable without weakening current-session safeguards or changing client response contracts.

## Route
- Owner area: Users.
- Ledger: `tasks/account-security-api-hardening-plan.md`.
- Existing references: `tasks/audit-trail-audit.md` findings 2 and 3, plus the completed backend-foundation session-revocation hardening slice.

## Source Checks
- `POST /api/me/change-password` verifies the current password, optionally re-identifies the current cookie-backed session, updates the password, and may revoke other sessions.
- The forced-password web flow still uses the legacy `/api/profile` password branch, which audits after its password/session transaction instead of atomically.
- `DELETE /api/me/sessions` and `DELETE /api/me/sessions/[id]` preserve the current session and scope deletion to the authenticated user.
- Current-session re-identification failures already return 401 before bulk revocation and must remain fail-closed.
- The three routes are authenticated, CSRF-protected, rate-limited, and have bounded response envelopes, but their security mutations do not write audit entries.
- The `/api/me` password route currently updates the user and revokes sessions as separate writes, while the legacy profile branch keeps its audit write outside the password/session transaction.
- D-007 requires mutation audit evidence. Audit records must never contain passwords, password hashes, or session token hashes.

## Stop Conditions
- Stop if current-session token rotation becomes required; that is a separate remembered-session contract with explicit prior deferral.
- Stop if audit history requires raw token, password, device fingerprint, or other secret material.
- Stop if the active schema tranche changes `User`, `Session`, or `AuditLog`.

## Slices
- [x] Slice 1: Make both password-change paths, their session effects, and secret-free audit evidence `SERIALIZABLE` and atomic.
- [x] Slice 2: Make all-other and single-session revocations atomic with useful audit evidence while preserving current-session and ownership denial behavior.
- [x] Slice 3: Add focused tests for transaction isolation, audit snapshots, fail-closed current-session verification, ownership, and response compatibility.
- [x] Slice 4: Sync Users documentation, the audit ledger, gaps, and this plan review.

## Verification
- [x] `npx vitest run tests/me-session-management.test.ts tests/auth-hardening.test.ts`
- [x] `npx eslint 'src/app/api/me/change-password/route.ts' 'src/app/api/me/sessions/route.ts' 'src/app/api/me/sessions/[id]/route.ts' src/app/api/profile/route.ts tests/me-session-management.test.ts tests/auth-hardening.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated security-settings smoke, or record why live session/password mutation was not performed.

## Review
- Shipped: Both self-service password-change paths and both session-revocation modes now commit their security mutation and secret-free audit evidence atomically at `SERIALIZABLE` isolation.
- Verified: 10 focused tests, focused ESLint, TypeScript, migration-chain check, codemap generation/check, diff check, and the production app build all pass.
- Deferred: Current-session token rotation remains outside this slice under the existing remembered-session contract.
- Blocked: None. Authenticated runtime smoke was intentionally not performed because changing a real password or revoking real sessions would mutate live account access; route-level failure and response behavior is covered by focused tests.
- Proof artifacts: `tests/me-session-management.test.ts`, `tests/auth-hardening.test.ts`, `docs/AREA_USERS.md`, `tasks/audit-trail-audit.md`, and `docs/GAPS_AND_RISKS.md`.
- Next slice or stop: Continue the audit ledger with schedule auto-assign, then calendar-sync and shift-generation system audit summaries. Treat audit-retention policy as a separate decision slice.
