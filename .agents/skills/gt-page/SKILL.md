---
name: gt-page
description: Gear Tracker web page execution workflow. Use when the user runs /gt-page, asks for a page ownership pass, UI or UX pass, hardening pass, consistency pass, or wants a route or page slice implemented end to end.
---

# /gt-page

Own one web route or one route slice through implementation, verification, and docs.

This is execution-oriented. Use `/gt-audit-web` when the user wants findings only.

## Inputs

- Route: `/items`, `/users`, `/settings/categories`, etc.
- Optional slice: filters, row actions, empty state, detail tabs, create flow, permissions, responsive pass.

## Required Reads

1. `AGENTS.md`
2. Matching `docs/AREA_*.md`
3. Relevant `docs/BRIEF_*.md`
4. `docs/DECISIONS.md`
5. `docs/GAPS_AND_RISKS.md`
6. `prisma/schema.prisma` for models touched by the route
7. Target `src/app/(app)/<route>/page.tsx` and siblings in full before editing
8. Referenced API routes, services, hooks, shared components, and tests
9. At least two peer pages with the same workflow shape

## Lenses

- Structure: primary action, command bar, tabs, route shape, page scanability.
- UX: loading, empty, filtered-empty, error, success, expired session, slow network.
- UI: shadcn primitives, hit areas, density, icon buttons, wrapping, tabular numbers.
- Consistency: reuse local patterns before creating abstractions.
- Hardening: auth, RBAC, Zod, transactions, N+1 risk, bulk/export bounds.
- Verification: focused tests, TypeScript, migration check, whitespace, build, browser smoke when visible UI changed.

## Workflow

1. Create or update `tasks/<route>-ownership-pass.md`.
2. Record peer patterns checked.
3. Implement the smallest coherent slice.
4. Update the task file as each checklist item completes.
5. Sync relevant area docs and gaps.
6. Run verification.

## Verification Defaults

- `npx tsc --noEmit`
- `npm run db:migrate:check`
- `git diff --check`
- `npx next build`
- Focused `npx vitest run ...` for touched service/API behavior
- Browser smoke for visible page changes, including console and the changed interaction path

## Stop Conditions

- Peer pages disagree and product direction is ambiguous.
- The route's API contract differs from the client assumption.
- Two verification or approach attempts fail.
- A schema or permission change is needed outside the selected slice.
