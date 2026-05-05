---
name: area-doc-sync
description: Enforce AGENTS.md rule #12 (Doc Sync on Ship). Given a feature name or recent diff, locate the matching `docs/AREA_*.md` and `docs/BRIEF_*.md`, update change logs, mark acceptance criteria, and reconcile `docs/GAPS_AND_RISKS.md` before commit.
disable-model-invocation: true
---

# Area Doc Sync

User-only skill. Run before committing any feature change. No commit ships without the AREA doc reflecting reality.

## When to invoke
The user runs `/area-doc-sync <feature-or-area>` (or just `/area-doc-sync` to infer from `git diff --staged`).

## Steps

1. **Identify the affected area(s)**
   - If an argument is given, match it against `docs/AREA_*.md` and `docs/BRIEF_*.md` filenames.
   - Otherwise: run `git diff --name-only HEAD` and map touched paths to AREAs (e.g. `src/app/(app)/items/*` → `AREA_ITEMS.md`).

2. **Update the AREA change log**
   - Open the matched `docs/AREA_*.md`.
   - Append one line to its change log: date + one-sentence user-facing outcome (per rule #9 — describe outcome, not code).
   - Mark any acceptance-criteria checkboxes that are now satisfied.

3. **Reconcile gaps & decisions**
   - Search `docs/GAPS_AND_RISKS.md` for entries closed by this change. Mark resolved with a date.
   - If the change introduced a new architectural choice, append it to `docs/DECISIONS.md` (one bullet, link to commit).

4. **Plan file lifecycle** (rule #14)
   - If `tasks/<feature>-plan.md` exists and all slices are checked off, move it to `tasks/archive/` (`git mv`).
   - Otherwise check off the slice that just shipped.

5. **Lessons capture** (rule #6)
   - If the user corrected you during this work, append a one-line rule to `tasks/lessons.md`.

6. **Verify and commit**
   - Run `npm run build` (rule #8 — never push a broken build).
   - Stage docs + code together; create one conventional-commit message bundling them (rule #12: same commit).
   - Push current branch.

## Output
Return a one-paragraph summary: which AREA was updated, which gaps closed, which plan archived.
