# Hook Dependency Escape Hatch Cleanup

Date: 2026-06-22
Backlog item: DESLOPPIFY M4

## Scope

Trim small React hook dependency suppressions where a primitive dependency key can replace unstable arrays, and add a source-contract guardrail so remaining `react-hooks/exhaustive-deps` suppressions carry rationale comments.

## Checklist

- [x] Inspect M4 backlog evidence and target files.
- [x] Remove safe dependency suppressions in cache update callbacks and URL/keyed effects.
- [x] Add rationale coverage for remaining derived-key suppressions.
- [x] Add focused source-contract coverage.
- [x] Sync `DESLOPPIFY.md`, `tasks/todo.md`, and generated codemaps if needed.
- [x] Run focused tests and closeout gates.

## Verification

- Passed: `npx vitest run tests/hook-escape-hatches-source.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `npm run codemap`
- Passed: `npm run verify:docs`
- Passed: `npm run db:migrate:check`
- Passed: `git diff --check`
- Passed: `npm run build:app`
