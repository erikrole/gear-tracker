# Items Status Rail Plan

## Goal

Replace the page-local Items inventory summary grid with the shared `OperationalStatusRail` while preserving every status count, status-filter action, derived-status meaning, and recovery state.

## Audit

- [x] Read the Items route, query contract, Items area/brief/decisions/gaps, schema status models, and shared design language.
- [x] Compare the Schedule and Admin Fix Today rail adapters.
- [x] Confirm the existing shadcn primitives and shared operational metric cards cover the slice.

## Implementation

- [x] Keep active inventory as the rail orientation signal.
- [x] Surface nonzero checked-out, pending-pickup, reserved, and maintenance states as prioritized status-filter actions.
- [x] Keep Available and Retired counts, plus every operational count, in collapsed Details.
- [x] Preserve status filter toggling, selected-state feedback, and page reset behavior.

## Verification

- [x] Add a focused source contract for the Items adapter.
- [x] Run focused tests, ESLint, TypeScript, migration guard, docs/codemap checks, whitespace, and app build.
- [x] Record authenticated browser proof or the exact session blocker.
- [x] Sync Items, design-language, gaps, and task-ledger documentation; archive this plan when complete.

## Review

The Items list now uses the shared operational status rail instead of the always-open seven-tile summary. The adapter keeps active inventory as the orientation signal, exposes nonzero checked-out, awaiting-pickup, reserved, and maintenance states on the compact line, and keeps all six status counts as multi-select filters under Details. `OperationalMetricCard` now supports an optional pressed state so selected status facets remain visible and accessible.

Verification passed: focused Vitest (3 tests), focused ESLint, TypeScript, migration-prefix guard, codemap/docs checks, whitespace, and `npm run build:app`. Local browser smoke compiled `/items` and received the expected protected-route redirect to `/login`; authenticated visual and interaction proof remains blocked because the local browser has no signed-in session.
