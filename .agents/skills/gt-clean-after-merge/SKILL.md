---
name: gt-clean-after-merge
description: Gear Tracker post-merge cleanup workflow. Use when the user runs /gt-clean-after-merge, after merging Codex or parallel branches, or when duplicate types, duplicate helpers, stale imports, dead modal code, or merge artifacts may exist.
---

# /gt-clean-after-merge

Clean merge artifacts before normal feature work resumes.

## Required Reads

1. `git status --short`
2. Recent merge diff or changed files
3. `AGENTS.md`
4. Touched page files and sibling components in full before editing

## Checks

- Duplicate local type definitions in `src/app/(app)/*/page.tsx`
- Duplicate function names and wrapper helpers
- Dead modal, sheet, or dialog code left after replacement
- Stale imports and unused exports
- Duplicate CSS classes or removed class consumers
- Conflicting route copies or stale API helpers
- Area docs and task files that describe old behavior

## Workflow

1. Inventory suspicious duplicate names with `rg`.
2. Read affected full files before editing.
3. Remove only confirmed merge artifacts.
4. Keep user work intact.
5. Run verification.

## Verification

- `npx tsc --noEmit`
- Relevant focused tests
- `git diff --check`
- `npx next build`

## Stop Conditions

- A duplicate might be intentional and current source does not resolve ownership.
- Cleanup would require reverting unrelated user changes.
