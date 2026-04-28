---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/audit.md
observe: echo "[audit] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Audit

Improvement-opportunity audit for a page, component, or system. Answers four questions —
what's smart, what doesn't make sense, what can be simplified, what can be rethought —
then runs a polish checklist covering the most common accumulated rough edges.
Read-only analysis only. No code changes.

**Target:** $ARGUMENTS
*(A page route, component name, or system name. Examples: `items/[id]`, `BookingCard`, `notifications`, `search`)*

---

## Role

You are a senior engineer doing a candid walkthrough of code that's been in production for a while.
You're not grading it — you're looking for what can be improved, what was smart, and what got left
behind as the app evolved. Be specific. Cite file and line numbers for every finding.

---

## PHASE 1: Investigation

Identify the target type (page, component, or system), then read everything relevant.

### Locate and Read

**If the target is a page or route:**
1. Glob `src/app/(app)/[target]/**/*.tsx` to find the page file
2. Read the page file completely
3. Read every domain component the page imports (skip shadcn primitives)
4. Read every API route the page calls
5. Read every custom hook the page uses
6. Read the relevant `docs/AREA_*.md`

**If the target is a component:**
1. Find it in `src/components/`, `src/app/(app)/`, or feature directories
2. Read the component file completely
3. Grep `src/` for all consumers — read 3–5 representative ones
4. Read sibling components in the same directory
5. Check `src/components/ui/` for shadcn equivalents

**If the target is a system (cross-cutting):**
1. Read `prisma/schema.prisma` — identify models in scope
2. Glob `src/app/api/[system]/**/*.ts` — read every route
3. Find and read service files in `src/lib/`
4. Read all pages in `src/app/(app)/[system]/`
5. Read the relevant `docs/AREA_*.md` and `docs/DECISIONS.md`

### While Reading, Note

- How many API calls are made? Are they parallel or sequential?
- How many `useState` hooks? Are all of them load-bearing?
- What data is in the schema but not surfaced in the UI?
- What patterns does this use compared to sibling pages/components?
- Anything that looks like it was written early and never revisited?

---

## PHASE 2: Four-Lens Analysis

Answer each question with specific, file-cited findings. Omit a lens if it has nothing real to say.

### Lens 1 — What's Smart?

Patterns worth keeping and replicating:
- **Data fetching**: Elegant loading/error/refresh patterns, AbortController use, stale-while-revalidate
- **State shape**: Minimal, well-derived state. No redundant pieces.
- **Composition**: Clean component tree. Concerns separated at the right boundaries.
- **Resilience**: Good null-safe guards, optimistic updates, rollback patterns.
- **Consistency**: Something this does well that sibling pages/components get wrong.

For each: cite the pattern, explain why it's smart, note if it should be replicated elsewhere.

### Lens 2 — What Doesn't Make Sense?

Things that create confusion, inconsistency, or risk:
- **Wrong abstraction level**: A component doing two unrelated things. Logic in the wrong layer.
- **Inconsistent patterns**: Fetching data differently than sibling pages for no reason.
- **Over-specified error handling**: Handling errors that can't occur given the API contract.
- **Confusing names**: State or props named in ways that hide what they actually hold.
- **Misaligned UX**: Designed around edge cases while the common case is awkward.
- **Inconsistent auth**: Some routes checking permissions, sibling routes not.

For each: name it clearly and explain the real impact.

### Lens 3 — What Can Be Simplified?

Complexity that can be removed without losing value:
- **Excess state**: `useState` calls that can be derived, eliminated, or merged.
- **Redundant fetches**: Multiple API calls that could be one consolidated endpoint.
- **Unnecessary abstraction**: A hook or wrapper that adds no value over the underlying call.
- **Verbose logic**: A `useEffect` with 10 dependencies doing what could be done differently.
- **Duplicate code**: Two components doing the same thing with minor variations.
- **Dead code**: Unreachable branches, unused props, orphaned exports.

For each: current approach → simpler alternative. Be concrete.

### Lens 4 — What Can Be Rethought?

Bigger opportunities — different mental models, architectural shifts:
- **Schema opportunity**: Data in `prisma/schema.prisma` that would make the UI significantly
  better if surfaced (fields, relationships, computed values).
- **API redesign**: A different response shape that would simplify the client.
- **UI model**: Should this be a sheet instead of a page? A tab instead of a route?
  Should two pages merge? Should a list become a board?
- **Role differentiation**: ADMIN and STUDENT seeing the same UI when they have different needs.
- **Mobile rethink**: Desktop patterns that don't translate — forced horizontal layouts, tiny touch targets.
- **Workflow rethink**: User doing extra steps the system could skip or automate.

For each: current model → alternative → key tradeoff.

---

## PHASE 3: Consistency & Fit

This is the cross-app check — not "is this page good?" but "is this page a good citizen of the whole app?"
A pattern change that happened somewhere else may not have propagated here yet. Find those gaps.

### Data Fetching Pattern
- Grep for how sibling pages in the same area fetch data — `useFetch`, `useQuery`, raw `fetch`, React Query.
- Does this page use the same approach? If not, is there a reason, or is it just older code?
- Flag **pattern drift**: a page still using manual `useState + fetch` when the app has standardized on something else.

### Component Consistency
- Grep for how sibling pages render lists, cards, empty states, and loading skeletons.
- Does this page use the same primitives? If it has a local version of something that now exists as a
  shared component, that's drift.
- Check: does this page import components from shadcn that sibling pages wrap via a local abstraction?
  It should use the abstraction.

### Naming & Convention Alignment
- Variable names, function names, handler names (`handleDelete` vs `onDelete` vs `deleteItem`).
- Are they consistent with the naming style in sibling files?
- Flag anything that would confuse a developer jumping from another page in the same area.

### Dead Code
This is non-negotiable — dead code is technical debt that compounds. Check thoroughly:
- **Unused imports**: Lines at the top of the file importing things nothing in the file uses.
- **Unused state**: `useState` variables that are set but never read in JSX or logic.
- **Unreachable branches**: `if (condition)` paths where `condition` is always true or always false.
- **Unused props**: Props defined in the interface that no consumer passes and the component doesn't use.
- **Commented-out code**: Blocks left for "just in case" that should be deleted.
- **Orphaned event handlers**: Functions defined but never attached to anything.
- **Dead CSS classes**: Custom CSS classes in `globals.css` used only by this file — now replaceable by Tailwind or shadcn.

For each dead code finding: name the exact symbol and line.

### Ripple Awareness
Think about what would need to change elsewhere in the app if something changed here:
- **If this page's API response shape changed**: Which other pages or components consume the same endpoint?
  Grep the API route path across `src/` to find all consumers.
- **If a shared component used here changed its props**: Which other pages would be affected?
  Grep the component name across `src/`.
- **If this page's route changed**: Are there hardcoded links to this route elsewhere? Grep the route path.
- **Shared types**: Does this page define types locally that should be in a shared types file — or uses a
  shared type that has drifted from what it actually receives?

List each ripple risk as: *"If X changes, these files would need updating: [list]"*

### Navigation Integrity
- Are all links FROM this page (`href`, `router.push`, `redirect`) pointing to routes that actually exist?
- Are there any deep links or breadcrumbs that would be broken if this page moved?
- Does the page receive URL params or query strings from other pages — and does it handle missing/invalid values?

---

## PHASE 4: Polish & Niceties Checklist

These are the most common rough edges that accumulate as an app evolves. Check each one.

### Empty States
- Does every list/table have an empty state? Is it using `EmptyState` or `Empty` consistently?
- Is the empty state helpful (explains why it's empty, offers a next action) or just "No items found"?

### Loading Skeleton Fidelity
- Do loading skeletons match the actual content layout they replace?
- Are row widths varied (not identical rectangles)?
- Does a refresh show a spinner/indicator without replacing visible data with a skeleton?

### Silent Mutations (Toast Gaps)
- Check every async mutation (`fetch` with POST/PATCH/DELETE, form submit, button action).
- Does each one have a success toast AND an error toast?
- Are there any silent failures — operations that complete (or fail) with no user feedback?

### Confirmation Quality
- Are destructive actions (delete, cancel, remove) using `useConfirm()` with the item name?
- Is the confirm label specific (`"Delete checkout"`) rather than generic (`"Confirm"`)?

### Mobile Breakpoints
- Are there `sm:`, `md:`, or `lg:` classes present?
- Do forms stack vertically on mobile? Do tables have a mobile card alternative?
- Are touch targets ≥ 44px?

### Error Message Quality
- Are error messages user-facing (`"Couldn't save — check your connection"`) or dev-facing (`"PATCH failed: 500"`)?
- Are all error cases using `classifyError()` / `parseErrorMessage()` rather than hardcoded strings?
- Do error messages differentiate network errors from server errors from auth errors?

### Button Loading States
- Do buttons that trigger async operations get `disabled` and a loading indicator during the operation?
- Can any action button be clicked multiple times before the first resolves?

### Role Gating
- Does the page check roles before rendering ADMIN-only actions?
- Are there actions visible to STUDENT that shouldn't be?

---

## PHASE 5: Output

Write the report to `tasks/[target-name]-audit.md`:

```markdown
# [Target] Improvement Audit
**Date**: YYYY-MM-DD
**Target**: [file path or scope]
**Type**: Page / Component / System

## What's Smart
[Worth keeping or replicating. Each item cites file:line.]

## What Doesn't Make Sense
[Confusing or risky patterns. Each item cites file:line.]

## What Can Be Simplified
[Complexity reductions. Each item: current → simpler.]

## What Can Be Rethought
[Bigger opportunities. Each item: current model → alternative → tradeoff.]

## Consistency & Fit
### Pattern Drift
[Patterns this page uses that differ from the app's current standard. Each item: old pattern vs current standard, files affected.]

### Dead Code
[Every unused import, state variable, prop, branch, or handler. Each item: symbol name, file:line.]

### Ripple Map
[Changes here that would require updates elsewhere. Each item: "If X changes → these files need updating: [list]"]

### Navigation Integrity
[Any broken links, unhandled params, or route dependencies. ✅ if clean.]

## Polish Checklist
| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ / ⚠️ / ❌ | ... |
| Skeleton fidelity | ✅ / ⚠️ / ❌ | ... |
| Silent mutations | ✅ / ⚠️ / ❌ | [list any gaps with file:line] |
| Confirmation quality | ✅ / ⚠️ / ❌ | ... |
| Mobile breakpoints | ✅ / ⚠️ / ❌ | ... |
| Error message quality | ✅ / ⚠️ / ❌ | ... |
| Button loading states | ✅ / ⚠️ / ❌ | ... |
| Role gating | ✅ / ⚠️ / ❌ | ... |

## Quick Wins
[Top 3–5 improvements achievable in < 30 min each, no schema changes.
Format: **[file:line]** — what to do and why.]

## Bigger Bets
[1–2 improvements that require design or schema work but are worth it.
Format: what to change, why it matters, rough cost.]
```

---

## RULES

- Read-only. Zero code changes.
- Every claim must cite a file and line number — no vague assertions.
- Dead code findings must name the exact symbol, not just "there's some dead code."
- Ripple map must be based on actual grep results, not guesses.
- Polish checklist items that pass get ✅ only — don't explain what's good, move on.
- Quick Wins must be doable in < 30 minutes each, no schema changes required.
- Bigger Bets must be worth the disruption — don't propose rewrites for elegance alone.
- If a lens or section has nothing to report, omit it rather than padding.
- The goal is a page that's fast, consistent with its neighbors, and has zero dead weight.
  Every finding should serve that goal.
