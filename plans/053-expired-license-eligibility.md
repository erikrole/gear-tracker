# Plan 053: Prevent expired license codes from appearing or acting claimable

> **Executor instructions**: Follow this plan step by step, run every verification gate, and update the row in `plans/README.md`. Stop instead of inventing expiration semantics.
>
> **Drift check (run first)**: `git diff --stat 9e92580f..HEAD -- src/lib/services/licenses.ts src/app/\(app\)/licenses/LicenseTable.tsx src/app/\(app\)/licenses/types.ts tests/licenses-service.test.ts`

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `9e92580f`, 2026-07-09
- **Execution**: BLOCKED 2026-07-10. `docs/AREA_LICENSES.md` defines expiry as informational and does not establish whether expired codes block new claims. Date-only inputs currently serialize to UTC midnight, but no end-of-day or institutional-timezone cutoff is documented. No source files changed.

## Why this matters

An expired Photo Mechanic code can remain `AVAILABLE` or `PARTIAL`, render with claimable color and interaction, and pass the transactional claim service. The expiry badge does not protect the mutation. Launch behavior must never let a user claim a code that the same row labels Expired.

## Current state

- `src/lib/services/licenses.ts:listCodes()` excludes RETIRED only.
- `claimCode()` rejects RETIRED and full codes but never evaluates `expiresAt`.
- `src/app/(app)/licenses/LicenseTable.tsx` defines claimability only from `AVAILABLE | PARTIAL`.
- The service already uses SERIALIZABLE isolation and one retry; preserve both.
- Expiration display uses the browser's current instant. The product needs one explicit server-owned rule for whether a date expires at its instant or at the end of an institutional day.

## Scope

**In scope**:
- `src/lib/services/licenses.ts`
- `src/app/(app)/licenses/LicenseTable.tsx`
- `src/app/(app)/licenses/types.ts` if the payload needs an additive eligibility field
- Focused license service/route/UI tests
- `docs/AREA_LICENSES.md`, `docs/GAPS_AND_RISKS.md`, and closeout ledger

**Out of scope**:
- License slot-count redesign
- Automatic retirement or deletion of expired codes
- Notification cadence changes
- Native UI changes unless an API payload contract used by iOS changes

## Steps

1. Confirm the intended expiry boundary with existing schema/input semantics. Prefer one shared pure helper such as `isLicenseExpired(expiresAt, now)` used by reads and mutations.
   - **Verify**: tests cover null, past, exact boundary, future, and the accepted timezone/day rule.
2. Enforce expiry inside `claimCode()` after the code is loaded within the existing SERIALIZABLE transaction. Return a specific 409 message.
   - **Verify**: an expired AVAILABLE and expired PARTIAL code both reject without creating a claim or updating status.
3. Make list/UI claimability consume server-owned eligibility, or apply the exact shared rule without duplicating semantics. Expired rows must not use green/blue claim affordances or keyboard click handlers.
   - **Verify**: UI/source tests cover expired AVAILABLE, expired PARTIAL, future AVAILABLE, claimed, and retired rows.
4. Verify admin inspection still works for expired codes, while student claim does not.
5. Sync docs and run focused browser proof for student and admin views.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Tests | `npx vitest run tests/licenses-service.test.ts tests/licenses-routes.test.ts tests/licenses-page-source.test.ts` | all pass; adjust exact existing filenames after inventory |
| Typecheck | `npx tsc --noEmit --pretty false` | exit 0 |
| Lint | `npx eslint src/lib/services/licenses.ts 'src/app/(app)/licenses/LicenseTable.tsx' --max-warnings=0` | exit 0 |
| Build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | exit 0 |

## Done criteria

- [ ] Expired codes cannot be claimed at the service boundary.
- [ ] Expired codes do not render as claimable for students.
- [ ] Admin inspection remains available.
- [ ] Expiration boundary tests pin the accepted semantics.
- [ ] Focused tests, TypeScript, lint, build, docs, and browser proof pass.

## STOP conditions

- Existing data stores date-only expiry values without a documented timezone interpretation.
- The change requires a schema migration instead of an additive/read-time rule.
- iOS decodes a changed required field and cannot tolerate the rollout order.
