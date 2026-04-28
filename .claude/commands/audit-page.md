---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/audit-page.md
observe: echo "[audit-page] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Audit Page

Improvement-opportunity audit for a single page. Reads everything, then answers four questions:
what's smart, what doesn't make sense, what can be simplified, what can be rethought.
This is analysis only — no code changes.

**Target:** $ARGUMENTS
*(Provide the route path or page file, e.g. `items/[id]`, `schedule`, `src/app/(app)/checkouts/page.tsx`)*

---

## Role

You are a senior engineer doing a candid peer review. You're not checking for bugs or ship-readiness —
you're looking for improvement opportunities. Be honest. Be specific. Cite file and line numbers.
Your goal is a tight list of actionable insights, not a comprehensive audit report.

---

## PHASE 1: Investigation

Read everything relevant before forming any opinions.

### Required Reads

1. **Locate the page file** — glob `src/app/(app)/[target]/**/*.tsx` or navigate the route tree
2. **Read the page file completely** — understand what it renders, what it fetches, what state it manages
3. **Read every component the page imports** — skip shadcn primitives, focus on domain components
4. **Read every API route the page calls** — look at the full handler, not just the signature
5. **Read every custom hook the page uses** — understand state shape and side effects
6. **Read `docs/AREA_*.md` for this page's domain** — understand intended behavior
7. **Read `prisma/schema.prisma` models this page touches** — what data is available vs what's surfaced?

### Things to Note While Reading

- How many API calls does the page make? Are they sequential or parallel?
- How many `useState` hooks? Are all of them necessary?
- How many components does the page render directly? Could any be composed differently?
- What data is in the schema but not shown on the page?
- What UX patterns does the page use? Are they consistent with sibling pages?
- Are there patterns here that don't appear elsewhere, or patterns elsewhere that are missing here?

---

## PHASE 2: Four-Lens Analysis

Answer each question with specific, file-cited examples. Skip sections where nothing applies —
don't pad the report.

### Lens 1: What's Smart?

Identify patterns worth keeping and replicating elsewhere:

- **Data fetching**: Is there an elegant loading/error/refresh pattern that other pages should adopt?
- **State management**: Is there a clean, minimal state shape? Are derived values computed correctly?
- **Composition**: Is the component tree well-organized? Are concerns cleanly separated?
- **Resilience**: Are there good abort controller patterns, null-safe guards, or optimistic updates?
- **Consistency**: Does this page do something particularly well that other pages get wrong?

For each: cite the pattern, explain what makes it smart, note if it should be replicated.

### Lens 2: What Doesn't Make Sense?

Identify things that are confusing, inconsistent, or misaligned with the product's needs:

- **Wrong abstraction**: A component doing two unrelated things. A hook that owns state it shouldn't.
- **Inconsistent patterns**: Fetching data differently from sibling pages for no reason.
- **Over-engineered paths**: Error handling for errors that can't happen. Validation at the wrong layer.
- **Confusing props or state names**: State called `data` that actually holds a list of users.
- **Misaligned UX**: Feature designed around an edge case while the common case is awkward.
- **Dead code with no purpose**: Feature flags, branches, or state that serve no current use.

For each: describe what doesn't make sense and why. Don't fix — just name it clearly.

### Lens 3: What Can Be Simplified?

Identify complexity that can be reduced without losing value:

- **Excess state**: `useState` calls that could be derived, eliminated, or merged.
- **Redundant fetches**: Multiple API calls that could be consolidated or cached.
- **Unnecessary abstraction**: A hook or component that wraps a single thing with no added value.
- **Verbose logic**: A `useEffect` with 15 dependencies that's trying to do too much.
- **Over-specified types**: A type with 20 fields when the component uses 3.
- **Duplicate logic**: Two components doing the same thing in slightly different ways.

For each: describe the current complexity and the simpler alternative. Be concrete.

### Lens 4: What Can Be Rethought?

Identify bigger opportunities — architectural changes, different mental models, workflow redesigns:

- **Schema opportunity**: Is there data in `prisma/schema.prisma` that would make this page significantly
  better if surfaced? (new fields, relationships, computed values)
- **API redesign**: Would a different API shape (consolidated endpoint, different query structure)
  make the page simpler or faster?
- **Component rethinking**: Should this be a sheet instead of a page? A tab instead of a route?
  Should two pages be merged?
- **Role differentiation**: Does ADMIN see the same page as STUDENT when they shouldn't?
- **Mobile rethink**: Does the page assume desktop interaction in ways that hurt mobile users?
- **Workflow rethink**: Is the user doing extra steps that the system could automate or skip?

For each: describe the current model, the alternative, and the tradeoff. These are proposals, not decisions.

---

## PHASE 3: Improvement Report

Write the findings to `tasks/[page-name]-audit.md`:

```markdown
# [Page Name] Improvement Audit
**Date**: YYYY-MM-DD
**Target**: [file path]
**Domain**: [area name]

## What's Smart
[Patterns worth keeping or replicating. Each item cites file:line.]

## What Doesn't Make Sense
[Confusing or inconsistent patterns. Each item cites file:line.]

## What Can Be Simplified
[Specific complexity reductions. Each item states: current approach → simpler alternative.]

## What Can Be Rethought
[Bigger opportunities. Each item states: current model, proposed alternative, key tradeoff.]

## Quick Wins
[Top 3 improvements that can be done in < 30 minutes each.]

## Bigger Bets
[Top 2 improvements that would require meaningful design or schema work.]
```

---

## RULES

- Read-only. Zero code changes.
- Every claim must cite a file and line number.
- "Smart" isn't flattery — only call out patterns that are genuinely worth replicating.
- "Doesn't make sense" isn't nitpicking — only flag things that create real confusion or bugs.
- Don't repeat findings across lenses. Each insight belongs in exactly one lens.
- Quick Wins must be achievable without schema changes or API redesigns.
- Bigger Bets must be worth the effort — don't propose rewrites for their own sake.
- If a lens yields no findings, omit that section rather than padding it.
