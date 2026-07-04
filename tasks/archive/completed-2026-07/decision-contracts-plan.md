# Decision Contract Tests

Date: 2026-06-22

Backlog item: `DESLOPPIFY.md` N2

## Scope

Add a small source-contract test file for high-value documented decisions that recently drifted or were clarified by the desloppify cleanup.

## Target Decisions

- D-025: User-facing booking status labels are display-only.
- D-027: Venue mappings are admin-owned, regex-validated, and deterministic.
- D-040: App/web is reservation-first; checkout custody and reservation pickup/return remain kiosk-only.

## Plan

- [x] Inspect decision text, helper ownership, existing focused tests, and app/web route surfaces.
- [x] Add `tests/decision-contracts.test.ts` for the three target decisions.
- [x] Run focused Vitest and closeout gates.
- [x] Sync `DESLOPPIFY.md` and `tasks/todo.md`.

## Review

- 2026-06-22: Decision contract tests shipped locally. `tests/decision-contracts.test.ts` now pins D-025 booking status label/display behavior, D-027 venue mapping regex validation and admin-only deterministic matching, and D-040 app/web reservation-first custody boundaries. Verification passed with focused Vitest, TypeScript, docs/codemap check, migration prefix check, whitespace check, and `npm run build:app`.

## Guardrails

- Do not duplicate every route-level behavior test. These are contract sentinels, not exhaustive coverage.
- Prefer pure helper checks and narrow source checks over fragile snapshots.
- Keep N2 separate from broader M4 hook/type cleanup and N1 codemap watchlist work.
