# Repo Map System Plan

Date: 2026-06-12

## Goal

Make the repository easier to navigate by generating current codemaps from source instead of letting architecture docs drift.

## Scope

- Generate route, schema, area ownership, frontend, backend, dependency, and architecture maps into `docs/CODEMAPS/`.
- Add npm scripts for regeneration and check mode.
- Document the map workflow in `README.md`.
- Keep the slice tooling/docs-only. Do not change product runtime behavior.

## Checklist

- [x] Add deterministic codemap generator.
- [x] Add `npm run codemap`, `npm run codemap:check`, and `npm run verify:docs`.
- [x] Regenerate `docs/CODEMAPS/` from current source.
- [x] Document the repo map workflow in `README.md`.
- [x] Verify generator syntax, check mode, and whitespace.

## Review

- 2026-06-12: Added `scripts/generate-codemaps.mjs` and generated source-backed maps for architecture, backend, frontend, data, dependencies, routes, schema, and area ownership.
- 2026-06-12: Added `codemap`, `codemap:check`, and `verify:docs` npm scripts plus README guidance for using the maps.
- 2026-06-12: Verification passed: `node --check scripts/generate-codemaps.mjs`, `npm run codemap:check`, and `git diff --check`.
