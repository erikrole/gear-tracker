---
name: area-doc-sync
description: Gear Tracker doc-sync closeout helper. Use when a shipped or nearly shipped slice needs AREA docs, GAPS_AND_RISKS, DECISIONS, task ledgers, codemaps, and proof notes reconciled before gt-ship, commit, or handoff.
---

# Area Doc Sync

Use this before committing or handing off feature work. The job is to make docs and task ledgers match shipped reality, not to stage or commit.

For staging, conventional commit, push, and full closeout sequencing, prefer `gt-ship`.

## When to invoke
The user runs `/area-doc-sync <feature-or-area>` (or just `/area-doc-sync` to infer from `git diff --staged`).

## Steps

1. **Identify the affected area(s)**
   - Run `git status --short` first so untracked files are visible.
   - Read `tasks/INDEX.md`, `tasks/todo.md`, and the active plan or follow-up ledger for the slice.
   - If an argument is given, match it against `docs/AREA_*.md`, `docs/BRIEF_*.md`, and active task filenames.
   - Otherwise map touched paths to AREAs, for example `src/app/(app)/items/*` -> `AREA_ITEMS.md`.

2. **Update the AREA change log**
   - Open the matched `docs/AREA_*.md`.
   - Append one line to its change log: date + one-sentence user-facing outcome (per rule #9 — describe outcome, not code).
   - Mark any acceptance-criteria checkboxes that are now satisfied.

3. **Reconcile gaps & decisions**
   - Search `docs/GAPS_AND_RISKS.md` for entries closed by this change. Mark resolved with a date.
   - If the change introduced a new durable architectural choice, update `docs/DECISIONS.md`. Do not add a decision for routine implementation detail.

4. **Task ledger lifecycle**
   - Update the active plan or `tasks/todo.md` review with shipped, verified, deferred, blocked, proof artifact, and next-slice/stop notes.
   - If a plan is fully complete, move it to the current completed-plan archive bucket named in `tasks/INDEX.md`; keep references updated.
   - Do not move audit files while `tasks/INDEX.md` says audit skills still read root `tasks/audit-*` paths.

5. **Lessons capture** (rule #6)
   - If the user corrected you during this work, append a one-line rule to `tasks/lessons.md`.

6. **Verify readiness**
   - If shared source, route maps, schema, or docs/codemaps changed, run `npm run codemap` before `npm run verify:docs`.
   - For app-only changes, use focused tests, `npx tsc --noEmit --pretty false`, `npm run db:migrate:check`, `npm run verify:docs`, `git diff --check`, and `npm run build:app` as applicable.
   - For schema or deploy-path changes, include `npx prisma validate`, `npm run db:migrate:health`, and full `npm run build` only when migration deploy preflight is safe and approved. If full build cannot run, record the blocker and local compile proof.
   - For visible web changes, record authenticated browser smoke or the exact reason it was blocked.
   - Leave staging, commit, and push to `gt-ship` unless the user explicitly asked this skill to complete those steps.

## Output
Return a short summary: which AREA docs changed, which gaps or decisions changed, which ledger or plan was updated, what verification ran, and what remains deferred or blocked.
