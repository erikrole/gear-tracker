# Plan Ledger Navigation Cleanup

Date: 2026-06-22
Backlog item: DESLOPPIFY N3

## Scope

Make it clear which planning surfaces are active today and which ones are historical reference only.

## Checklist

- [x] Confirm `plans/README.md` is historical despite opening with execution-queue language.
- [x] Confirm `tasks/README.md` and `tasks/INDEX.md` already define the root/archive task-folder contract.
- [x] Update `plans/README.md` so it points to current active ledgers before historical rows.
- [x] Update `tasks/INDEX.md` with an explicit start-here note for active backlog execution.
- [x] Record the cleanup in `tasks/todo.md` and `DESLOPPIFY.md`.
- [x] Run documentation verification gates.

## Verification

- Passed: `npm run verify:docs`
- Passed: `npm run db:migrate:check`
- Passed: `git diff --check`
