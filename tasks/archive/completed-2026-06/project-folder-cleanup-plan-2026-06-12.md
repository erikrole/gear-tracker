# Project Folder Cleanup Plan

Date: 2026-06-12

## Goal

Organize project-tracking clutter without changing product code or hiding active implementation work.

## Scope

- Reconcile `tasks/todo.md` so fully completed slices are no longer labeled active.
- Archive completed plan files that already have review notes and verification recorded.
- Move task proof images out of the root `tasks/` folder into a named archive folder.
- Remove root-level duplicate audit files only when the same filename already exists in `tasks/archive/`.
- Move root import, report, prompt, and smoke-proof artifacts into stable archive locations.
- Preserve existing dirty product changes and active roadmap plan files.

## Checklist

- [x] Snapshot current repo status and identify pre-existing dirty files.
- [x] Archive completed plan files from the active todo queue.
- [x] Move proof PNGs to `tasks/archive/proofs/`.
- [x] Reconcile duplicate active/archive audit files.
- [x] Update `tasks/todo.md` with a cleanup review.
- [x] Verify status, archive locations, and whitespace.
- [x] Move root import, report, prompt, and smoke-proof artifacts into archive locations.
- [x] Update references and ignore rules for the new artifact locations.
- [x] Add generated codemaps and a check command so repo mapping stays current.

## Review

- 2026-06-12: Pre-existing dirty files were `ios/project.yml`, `tasks/todo.md`, and four untracked roadmap plans. The cleanup preserved those changes.
- 2026-06-12: Archived completed iOS plan files into `tasks/archive/completed-2026-06/` and moved root task PNG proof artifacts into `tasks/archive/proofs/`.
- 2026-06-12: Root/archive duplicate audit filenames were compared and left in place because their contents differ.
- 2026-06-12: Verification passed: no root `tasks/*.png` files remain, archived plan files are present, `tasks/todo.md` points at the archived plan paths, and `git diff --check` is clean.
- 2026-06-12: Second cleanup pass moved the Cheqroom import CSV to `docs/archive/imports/`, the old codemap diff report to `docs/archive/reports/`, archived prompt notes to `docs/archive/prompts/`, and `.tmp` browser-smoke images to `tasks/archive/proofs/browser-smoke/`.
- 2026-06-12: Repo map pass added `scripts/generate-codemaps.mjs`, `npm run codemap`, `npm run codemap:check`, `npm run verify:docs`, and refreshed `docs/CODEMAPS/` from current source.
