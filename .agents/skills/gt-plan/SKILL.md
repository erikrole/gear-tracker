---
name: gt-plan
description: Gear Tracker planning workflow. Use when the user runs /gt-plan, asks to plan a feature or slice, or starts any non-trivial Gear Tracker task that needs docs, schema, gaps, decisions, and verification sequencing before implementation.
---

# /gt-plan

Use this before non-trivial Gear Tracker work. The output is a practical plan file, not a strategy essay.

## Inputs

- Feature, route, area, bug, or slice name.
- If no name is supplied, infer from the user's request and current diff.

## Required Reads

1. `AGENTS.md`
2. Relevant `docs/AREA_*.md`
3. Relevant `docs/BRIEF_*.md`
4. `docs/DECISIONS.md`
5. `docs/GAPS_AND_RISKS.md`
6. `prisma/schema.prisma` when data, permissions, or lifecycle behavior is touched
7. Related `tasks/*.md` and `tasks/archive/*.md`
8. Current source files for the target area

## Workflow

1. Map the request to one owner area and any secondary areas.
2. Write or update `tasks/<feature>-plan.md`.
3. Keep slices independently testable:
   - Schema or migration
   - API or service
   - UI or iOS wiring
   - Tests
   - Docs and hardening
4. Add a verification section with exact commands.
5. Add stop conditions where current source, docs, or database state may contradict the plan.

## Plan File Shape

```markdown
# <Feature> Plan - <YYYY-MM-DD>

## Goal
- <user-facing outcome>

## Source Checks
- <doc/source/schema facts with paths>

## Slices
- [ ] Slice 1: <independently testable unit>
- [ ] Slice 2: <independently testable unit>

## Verification
- [ ] <focused tests>
- [ ] `npx tsc --noEmit`
- [ ] `npm run db:migrate:check`
- [ ] `git diff --check`
- [ ] `npx next build` or `npm run build` when DB deploy behavior is in scope

## Review
- Shipped:
- Verified:
- Deferred:
```

## Rules

- Prefer `npx next build` for app-only checks.
- Use `npm run build` when schema or deploy behavior is in scope.
- Do not edit implementation files until the plan has a coherent first slice.
