# Plan 054: Make Items bootstrap failures visible and recoverable

> **Executor instructions**: Preserve fail-closed edit gating, run each verification gate, and update `plans/README.md` when complete.
>
> **Drift check (run first)**: `git diff --stat 9e92580f..HEAD -- src/app/\(app\)/items/hooks/use-filter-options.ts src/app/\(app\)/items/page.tsx src/app/api/items-page-init/route.ts tests/items-page-init*`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e92580f`, 2026-07-09
- **Execution**: IMPLEMENTED 2026-07-10. Automated regression, full test, lint, TypeScript, migration, docs, and app-build gates pass. The browser harness covers the degraded states through request interception, but an authenticated run remains blocked until dedicated isolated credentials are available.

## Why this matters

The Items list can load inventory while its reference-data bootstrap fails. Today the client silently converts that failure into empty filters and `canEdit=false`, so staff/admin users appear read-only and cannot tell an outage from a legitimately empty catalog. The API already reports named partial failures; the UI discards them.

## Current state

- `use-filter-options.ts` performs a one-shot raw fetch, ignores non-OK/malformed responses, and has an empty catch.
- `/api/items-page-init` returns user role, locations, departments, categories, brands, kits, and `partialFailures` from `Promise.allSettled`.
- `items/page.tsx` uses `options.canEdit` for New item and related staff actions.
- `OperationalPartialResultsAlert`, React Query, `handleAuthRedirect`, and `parseJsonSafely` are established repo patterns.

## Scope

**In scope**:
- `src/app/(app)/items/hooks/use-filter-options.ts`
- `src/app/(app)/items/page.tsx`
- `src/app/api/items-page-init/route.ts` only if response typing/shape needs an additive correction
- Focused Items bootstrap tests
- Items/design docs and closeout ledger

**Out of scope**:
- Changing inventory query behavior
- Changing item permissions
- Refactoring the entire Items page
- Treating missing reference data as permission to edit

## Steps

1. Replace the one-shot effect with a query-backed bootstrap hook that returns loading, initial error, refresh error, `partialFailures`, and `refetch`. Handle 401 through the shared auth helper.
   - **Verify**: unit/source tests distinguish success, non-OK, malformed JSON, network failure, and partial success.
2. Keep role gating fail-closed, but surface an explicit initial failure with Retry when role/reference data cannot be trusted.
   - **Verify**: staff controls do not appear until role is known; users are told why.
3. For partial success, keep inventory and healthy filters visible and render `OperationalPartialResultsAlert` naming the unavailable reference groups. Disable only controls that require a failed group.
   - **Verify**: category failure does not erase locations; kit failure does not mislabel the whole inventory as failed.
4. Preserve stale reference options during background refresh failure and show bounded recovery feedback.
5. Browser-smoke initial failure, partial failure, retry success, STUDENT, and STAFF/ADMIN states.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npx vitest run tests/items-page-init.test.ts tests/items-filter-options-source.test.ts` | all pass; create/adjust focused filenames as needed |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0 |
| Lint | `npx eslint 'src/app/(app)/items/hooks/use-filter-options.ts' 'src/app/(app)/items/page.tsx' --max-warnings=0` | exit 0 |
| Build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## Done criteria

- [x] Initial bootstrap failure is visible and retryable.
- [x] Named partial failures are visible without discarding healthy data.
- [x] Staff/admin actions remain fail-closed until role is known.
- [x] Background failure preserves stale reference options.
- [x] Focused tests, full tests, TypeScript, lint, build, docs, and whitespace gates pass.
- [ ] Authenticated browser states pass against an isolated target.

## STOP conditions

- The API response shape differs from the documented `data + partialFailures` envelope.
- A proposed fix enables edit actions before role truth is available.
- Recovery requires changing item authorization or inventory query contracts.
