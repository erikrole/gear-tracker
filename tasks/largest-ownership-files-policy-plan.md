# Largest Ownership Files Policy Closeout

Date: 2026-06-22
Backlog item: DESLOPPIFY M1

## Scope

Close the largest-file cleanup item without doing a blind standalone split. Treat this as a maintenance policy backed by the generated oversized-source watchlist and the render-only `EquipmentPicker` extraction completed while that hotspot was touched.

## Checklist

- [x] Re-check current largest-file evidence in `docs/CODEMAPS/architecture.md`.
- [x] Confirm `EquipmentPicker.tsx` was the touched hotspot and received one render-only extraction.
- [x] Leave untouched ownership hotspots for future related work instead of splitting them speculatively.
- [x] Record M1 closeout in `DESLOPPIFY.md` and `tasks/todo.md`.
- [x] Run documentation verification gates.

## Verification

- Passed: `npm run verify:docs`
- Passed: `npm run db:migrate:check`
- Passed: `git diff --check`
