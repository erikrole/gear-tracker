# Profile Completion API Hardening - 2026-07-15

## Scope
- Route: `GET/PATCH /api/me/profile-completion`
- Area: Users
- Goal: Close deployment risks without changing the accepted desktop wizard or profile-completion fields.

## Findings and Resolution
- [x] Authentication and object scope: `withAuth` supplies the only target user id; callers cannot select another user.
- [x] Permission: `PATCH` enforces explicit `user.edit_self` access for Admin, Staff, and Student roles.
- [x] CSRF and caching: the shared authenticated wrapper enforces same-origin mutations and `ok()` returns `private, no-store`.
- [x] Validation: discriminated step payloads remain bounded; phone values now require at least seven digits.
- [x] Uniqueness: Athletics email and both Wiscard uniqueness constraints rely on database writes with friendly `P2002` conflicts.
- [x] Atomicity: the profile update and audit entry run in one Serializable transaction.
- [x] Audit privacy: audit snapshots contain field names and completion-state booleans, not raw contact, apparel, or Wiscard values.
- [x] Response privacy: the self-only response retains fields required to resume the wizard but omits the redundant combined Wiscard lookup token.
- [x] Client storage: the profile-completion query is not in the persisted React Query allowlist.

## Verification
- [x] Focused profile-completion, API-wrapper, route-wrapper, and PII-scope tests: 42 passed.
- [x] TypeScript and focused ESLint.
- [x] Prisma validation and migration-prefix check: 94 migrations with no collisions or malformed folders.
- [x] Documentation/codemap checks and `git diff --check`.
- [x] Clean production Next build with lint verified independently: compiled, type-checked, and generated 198 static pages.
- [ ] Authenticated desktop runtime smoke after migration 0092 is applied.
