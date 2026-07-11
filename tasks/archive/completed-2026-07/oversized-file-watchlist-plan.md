# Oversized File Watchlist Cleanup

Date: 2026-06-22
Backlog item: DESLOPPIFY N1

## Scope

Add an informational generated watchlist for the largest TypeScript and TSX source files so future cleanup can see size drift during normal codemap checks.

## Checklist

- [x] Inspect `DESLOPPIFY.md`, `scripts/generate-codemaps.mjs`, `docs/CODEMAPS/`, and `tasks/todo.md`.
- [x] Add a generated largest-source-files section without introducing a hard line-count threshold.
- [x] Regenerate codemaps.
- [x] Sync `DESLOPPIFY.md` and `tasks/todo.md`.
- [x] Run verification gates.

## Verification

- Passed: `npm run codemap`
- Passed: `npm run verify:docs`
- Passed: `npm run db:migrate:check`
- Passed: `git diff --check`
