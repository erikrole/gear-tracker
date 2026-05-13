---
name: gt-api-hardening
description: Gear Tracker API hardening workflow. Use when the user runs /gt-api-hardening, asks for route security, auth, RBAC, mutation, transaction, N+1, Vercel timeout, cron, kiosk, or public route hardening.
---

# /gt-api-hardening

Harden API routes from current source, not stale audit notes.

## Inputs

- Area, route family, finding, or broad hardening request.

## Required Reads

1. `AGENTS.md`
2. Relevant `docs/AREA_*.md`
3. `docs/DECISIONS.md`
4. `docs/GAPS_AND_RISKS.md`
5. `tasks/lessons.md`
6. Target `src/app/api/**/route.ts` files
7. Shared wrappers in `src/lib` used by those routes
8. Services and Prisma models touched by the route family
9. Existing tests for the route family

## Checks

- Every handler export is wrapped by `withAuth`, `withKiosk`, `withCron`, or `withHandler`.
- Mutations use server-side `requirePermission`, not just UI hiding.
- Route params, query, and body are validated.
- Mutations write audit entries where product state changes.
- Multi-write flows use transactions, with `Serializable` where races matter.
- Uniqueness relies on DB constraints and `P2002` handling.
- Public routes are disabled, rate-limited, or intentionally allowlisted.
- Cron routes use shared bearer validation.
- Kiosk routes stay under device-token auth.
- Read bundles use `Promise.allSettled` when partial data is acceptable.
- Export and bulk operations are bounded for Vercel function limits.

## Workflow

1. Inventory the route family and wrappers.
2. Write findings to `tasks/api-hardening-<area>.md` unless an active audit file exists.
3. Implement P0/P1 fixes in thin slices.
4. Add focused route/service tests.
5. Sync area docs and gaps.

## Verification

- Focused `npx vitest run ...`
- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
