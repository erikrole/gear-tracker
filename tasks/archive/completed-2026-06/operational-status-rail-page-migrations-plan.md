# Operational Status Rail Page Migrations Plan - 2026-07-10

## Goal

- Replace remaining page-level action/status card strips with `OperationalStatusRail` while keeping analytical KPI grids, import summaries, entity detail stats, and navigation cards intact.

## Route

- Owner area: Shared web design language.
- Secondary areas: Dashboard, Items, Bulk Inventory, Notifications, Kits, Licenses, and Users/Onboarding.
- Ledger: This plan plus `tasks/todo.md`.
- Existing reference: `tasks/archive/operational-status-rail-plan.md` and `tasks/archive/completed-2026-06/items-status-rail-plan.md`.

## Source Checks

- `OperationalStatusRail` owns presentation only; route calculations, filtering, and navigation remain local.
- Existing shared cards remain the expanded Details primitive.
- Strong candidates: Dashboard, Inventory Hygiene, Battery Ops, Notifications, Kits, Licenses, Onboarding Status, and Allowed Emails.
- Deliberate exclusions: Reports, import preview/result steps, badge progress, Resources references, item insights, booking/item/event detail, and Schedule, which is already migrated.
- Users roster composition counts and User Availability tab signals remain deferred because they mix demographic/detail context with page-level status and need a separate interaction decision.

## Stop Conditions

- Stop on a route if its visible cards cannot map to one orientation signal plus prioritized exceptions without inventing a new API or navigation contract.
- Stop if replacing a card would hide a currently visible action, selected filter state, partial-data warning, or user-specific notice.
- Keep report/KPI cards visible when collapsing them would make analysis slower.

## Slices

- [x] Slice 1: Migrate Dashboard, Inventory Hygiene, Battery Ops, and Notifications.
- [x] Slice 2: Migrate Kits, Licenses, Onboarding Status, and Allowed Emails.
- [x] Slice 3: Add source/behavior contracts, synchronize docs and task ledgers, and archive this plan.

## Verification

- [x] Focused Vitest contracts for every migrated route.
- [x] Focused ESLint for touched source and tests.
- [x] `npx tsc --noEmit --pretty false`.
- [x] `npm run db:migrate:check`.
- [x] `npm run codemap` and `npm run verify:docs`.
- [x] `git diff --check`.
- [x] `npm run build:app`.
- [x] Authenticated browser smoke for touched routes, or record the session blocker.

## Review

- Shipped: Dashboard, Inventory Hygiene, Battery Ops, Notifications, Kits, Licenses, Onboarding Status, and Allowed Emails now use the shared action-first operational status rail. Expanded metric details, route-local filters, links, notices, partial-data feedback, and analytical exclusions remain intact. The retired Dashboard `StatCard` helper was removed.
- Verified: Seven focused test files passed with 21 tests, focused ESLint and TypeScript passed, all 93 migration prefixes passed, codemaps/docs and whitespace passed, and `npm run build:app` completed successfully.
- Deferred: Users roster composition and the User Availability tab remain card/detail surfaces pending a separate interaction decision. Reports, imports, badges, item insights, Resources references, and entity-detail summaries intentionally remain card-based.
- Blocked: Authenticated visual interaction proof could not start because the installed in-app Browser plugin package is missing its required `scripts/browser-client.mjs` runtime file. No alternate browser mechanism was substituted.
- Proof artifacts: `tests/operational-status-rail-source.test.ts` plus the existing route-focused battery, notification, kits, onboarding, allowed-email, and health-indicator contracts.
- Next slice or stop: Stop. The identified page-level operational candidates are migrated.
