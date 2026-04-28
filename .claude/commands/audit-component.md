---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/audit-component.md
observe: echo "[audit-component] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Audit Component

Improvement-opportunity audit for a reusable component. Reads the component and all its
consumers, then answers four questions: what's smart, what doesn't make sense, what can
be simplified, what can be rethought. This is analysis only — no code changes.

**Target:** $ARGUMENTS
*(Provide the component name or file path, e.g. `UserAvatar`, `BookingCard`, `src/components/booking-card.tsx`)*

---

## Role

You are a design systems engineer doing a candid review. You're not checking for bugs —
you're evaluating the component's API design, composition quality, and fit within the
broader system. Be specific. Cite file and line numbers.

---

## PHASE 1: Investigation

### Required Reads

1. **Locate the component file** — search `src/components/`, `src/app/(app)/`, feature directories
2. **Read the component file completely** — understand its props, variants, state, and rendering logic
3. **Grep `src/` for all imports of this component** — build a complete consumer map
4. **Read 3-5 representative consumer files** — understand how it's actually used vs how it was designed
5. **Read sibling components in the same directory** — understand composition patterns
6. **Glob `src/components/ui/*.tsx`** — check if a shadcn equivalent exists for what this does
7. **If the component fetches data**, read the API route it calls

### Things to Note While Reading

- What's the line count? (>300 = probably doing too much)
- How many props does it accept? Are all of them used by consumers?
- How many `useState` hooks? Are any of them unnecessary?
- How do consumers actually use it — do they pass the same prop combination every time?
- Are consumers working around limitations (extra wrappers, className overrides, `!important`)?
- Is there a shadcn component that covers 80% of what this does?
- Does the component render differently per role (ADMIN/STAFF/STUDENT)?

---

## PHASE 2: Four-Lens Analysis

### Lens 1: What's Smart?

- **API design**: Props that are well-named, with sensible defaults, that consumers rarely override unnecessarily.
- **Composition**: Clean use of children, slots, or compound component patterns.
- **Resilience**: Null-safe guards, fallback states, graceful degradation.
- **Reuse**: The component saves consumers from repeating logic they'd otherwise duplicate.
- **Consistency**: Enforces patterns that would be inconsistent if implemented ad-hoc.

For each: cite the pattern, explain what makes it smart.

### Lens 2: What Doesn't Make Sense?

- **Prop confusion**: Props with misleading names, boolean props that should be enum variants,
  required props that are always passed the same value.
- **Wrong ownership**: State managed inside the component that should be lifted. Or state lifted
  to the parent that should live inside.
- **Inconsistent behavior**: The component does X in consumer A but behaves differently in consumer B
  for no obvious reason.
- **Leaky abstraction**: Consumers needing to know internals (class names, DOM structure) to use it correctly.
- **Mismatched scope**: The component is too specific (built for one page, pretending to be reusable)
  or too generic (covers every case, making each case harder to understand).

For each: describe what doesn't make sense and why.

### Lens 3: What Can Be Simplified?

- **Excess props**: Props that could be derived, eliminated, or merged.
- **Over-engineered variants**: More variants than any consumer uses, with unclear distinctions.
- **Internal complexity**: Logic that could be extracted, a `useEffect` that could be removed,
  a render branch that's never hit.
- **Unnecessary wrapping**: A component that just passes through to a shadcn primitive with minimal added value.
- **Dead code**: Unused exports, untriggered code paths, props no consumer passes.

For each: describe the current complexity and the simpler alternative.

### Lens 4: What Can Be Rethought?

- **API redesign**: Would a different props shape make consumers significantly simpler?
  (composition over configuration, render props, compound components)
- **Scope change**: Should this be split into two focused components? Or merged with a sibling?
- **Shadcn replacement**: Is there a shadcn component that should replace this wholesale?
- **Consumer benefit**: If you redesigned this from scratch knowing all its consumers, what would
  you build differently?
- **Role differentiation**: Should ADMIN and STUDENT variants be separate components rather than
  a single component with conditional rendering?

For each: describe the current model, the alternative, and the tradeoff.

---

## PHASE 3: Improvement Report

Write the findings to `tasks/[component-name]-audit.md`:

```markdown
# [Component Name] Improvement Audit
**Date**: YYYY-MM-DD
**Target**: [file path]
**Consumers**: [count] files

## Consumer Map
[List of files that import this component, grouped by area if helpful]

## What's Smart
[Patterns worth keeping. Each item cites file:line.]

## What Doesn't Make Sense
[API or behavior issues. Each item cites file:line.]

## What Can Be Simplified
[Specific reductions. Each item states: current → simpler.]

## What Can Be Rethought
[Bigger opportunities. Each item states: current model, alternative, tradeoff.]

## Quick Wins
[Top 3 improvements achievable without changing the component's external API.]

## Breaking Changes
[Any improvements that would require updating consumers — list the impact.]
```

---

## RULES

- Read-only. Zero code changes.
- Every claim must cite a file and line number.
- Consumer map must be complete — don't skip any consumer without noting why.
- "Breaking changes" section is mandatory if any improvements would change the public API.
- Don't flag something as "doesn't make sense" if it exists to serve a specific consumer need —
  check the consumers before concluding.
- If the component has fewer than 100 lines and is well-contained, say so. Not every component needs restructuring.
