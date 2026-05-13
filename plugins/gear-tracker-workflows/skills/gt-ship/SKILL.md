---
name: gt-ship
description: Gear Tracker ship workflow. Use when the user runs /gt-ship, asks to commit, push, close out, prepare a PR, or verify and ship a completed Gear Tracker slice.
---

# /gt-ship

Close out a slice without sweeping unrelated dirty work.

## Required Reads

1. `git status --short`
2. `git diff --name-only HEAD` for tracked-file detail after `git status --short`
3. Active task or plan file
4. Relevant `docs/AREA_*.md`
5. `docs/GAPS_AND_RISKS.md`
6. `tasks/lessons.md` only if the user corrected behavior or a durable rule was learned

## Workflow

1. Identify in-scope files from the user's request and active plan.
2. Use `git status --short` as the authoritative file inventory because `git diff --name-only HEAD` does not show untracked files.
3. Leave unrelated dirty files unstaged.
4. Ensure area docs and gaps reflect shipped reality.
5. Archive completed plan files only when all slices are shipped.
6. Run focused verification before staging.
7. Stage only in-scope files, including in-scope untracked files.
8. Commit with conventional commit format and a user-facing outcome.
9. Push only when requested or when the active workflow explicitly includes push.

## Verification Matrix

- App-only web/UI/API slice:
  - Focused tests
  - `npx tsc --noEmit`
  - `npm run db:migrate:check`
  - `git diff --check`
  - `npx next build`
- Schema/deploy slice:
  - `npx prisma validate`
  - `npm run db:migrate:health`
  - `npm run build`
- iOS slice:
  - `npx tsc --noEmit` when shared API models changed
  - `npm run drift:ios`
  - `npm run audit:ios:gaps`
  - targeted `xcodebuild` simulator build

## Commit Messages

- `feat: <user-facing outcome>`
- `fix: <root cause and user-facing outcome>`
- `chore: <tooling-only outcome>`

Never make a standalone tsbuildinfo commit.
