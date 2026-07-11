# Equipment Picker Render Split

Date: 2026-06-22
Backlog item: DESLOPPIFY N4

## Scope

Extract one render-only `EquipmentPicker` piece while leaving data hooks, scan lookup, availability checks, and section grouping logic in place.

## Checklist

- [x] Inspect `EquipmentPicker.tsx`, existing `equipment-picker/` helpers, and N4 backlog guidance.
- [x] Extract the selected-items shelf into a presentational component.
- [x] Add source-contract coverage for the incremental split boundary.
- [x] Sync `DESLOPPIFY.md`, `tasks/todo.md`, and codemaps.
- [x] Run focused tests and closeout gates.

## Verification

- Passed: `npx vitest run tests/equipment-picker-render-split-source.test.ts`
- Passed: `npx tsc --noEmit --pretty false`
- Passed: `npm run codemap`
- Passed: `npm run verify:docs`
- Passed: `npm run db:migrate:check`
- Passed: `git diff --check`
- Passed: `npm run build:app`
