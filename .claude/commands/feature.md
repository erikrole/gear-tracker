# Feature

Two-phase feature command: discover the highest-impact opportunity, then implement
it safely. Each phase has a decision gate — no code changes without confirmation.

**Input:** $ARGUMENTS
*(If blank: discover the highest-impact unbuilt feature. If provided: evaluate and implement the specified feature idea.)*

---

## Phase A: Discovery & Evaluation (read-only — no code changes)

You are a product engineer who deeply understands this codebase and its users.

### GOAL
Understand the current state of the target area, identify the highest-impact feature
or improvement, and produce a concrete proposal before writing any code.

### PREPARATION (do this before proposing anything)
1. Read `docs/NORTH_STAR.md` — what is this product trying to be? What is it NOT?
2. Read the relevant `docs/AREA_*.md` for the target area — current state, acceptance
   criteria, changelog, information architecture
3. Read the relevant `docs/BRIEF_*.md` if one exists — are there unimplemented requirements?
4. Read `docs/GAPS_AND_RISKS.md` — are there open gaps or Phase B/C features in this area?
5. Read `docs/DECISIONS.md` — architectural constraints that affect what's possible
6. Read `prisma/schema.prisma` — understand the data model (what exists, what's unused,
   what relationships are defined)
7. Read `tasks/todo.md` — is there already planned work for this area?
8. Read `tasks/lessons.md` — patterns that inform what to build (recurring pain points,
   prior session discoveries)
9. Read the existing page(s) and API route(s) for the target area
10. Glob `src/components/ui/*.tsx` — know what shadcn components are available

### DISCOVERY QUESTIONS (answer each before proposing)

1. **User pain**: What is the most painful workflow in this area today? Where do users
   waste time, make mistakes, or lose trust?
2. **Gap analysis**: What does the AREA doc say should exist but doesn't yet? What's
   in Phase B/C deferred features that's now achievable?
3. **Quick wins**: What improvements require <50 lines of code but meaningfully improve
   the experience? (Better defaults, smarter sorting, inline editing, keyboard shortcuts)
4. **Integration opportunities**: Can this area benefit from connecting to another area
   that's already built? (e.g., linking events to bookings, showing shift context in
   checkout flow)
5. **Unused data**: Is there data in the schema that's collected but never surfaced in
   the UI? (Audit logs, timestamps, computed fields, relationship counts)

### CANDIDATE EVALUATION

For each candidate feature, score:

| Criterion | Weight | Score (1-5) |
|---|---|---|
| User impact (daily workflow improvement) | 3x | |
| Implementation effort (lower = better) | 2x | |
| Integration safety (risk of breaking existing) | 3x | |
| Schema readiness (model exists vs needs migration) | 2x | |

### OUTPUT OF PHASE A

Present the top 3 candidates ranked by weighted score:

```
### Candidate 1: [Name]
- **What**: One-sentence description
- **Why**: User pain it addresses
- **How**: Key implementation steps (3-5 bullets)
- **Risk**: What could go wrong
- **Effort**: S / M / L
- **Score**: [weighted total]
```

### DECISION GATE
Ask the user which candidate to implement. If the input was a specific feature request
(not an area exploration), proceed with that feature directly after validation.

---

## Phase B: Implementation

You are a senior full-stack engineer following the Thin Slice Protocol.

### GOAL
Implement the selected feature in the smallest shippable slice. Leave the codebase
cleaner than you found it.

### PRE-IMPLEMENTATION CHECKLIST (NON-NEGOTIABLE)
- [ ] Re-read `prisma/schema.prisma` — confirm no migration is needed, or plan the
      migration as a separate first step
- [ ] Confirm no naming conflicts with existing API routes, components, or utilities
- [ ] Identify every file that will be modified — list them explicitly
- [ ] Check that needed shadcn components are installed; if not, `npx shadcn@latest add <component>`
- [ ] Check `docs/DECISIONS.md` for constraints on this feature area (especially D-001,
      D-006, D-007, D-012 if touching bookings/allocations)

### IMPLEMENTATION ORDER (follow strictly)

1. **Schema** (if needed): Migration file, regenerate client, verify build
2. **API/Service**: New or modified routes with auth guards, input validation, audit logging
3. **UI wiring**: Page or component changes using shadcn components exclusively
4. **Error handling**: Every new fetch has loading, error, and empty states
5. **Build verification**: `npm run build` must pass with zero errors

### INTEGRATION SAFETY RULES
- [ ] No existing API contract changes (response shape, status codes) without checking all callers
- [ ] No Prisma model renames or field removals without grep for all usages
- [ ] No new dependencies without justification — prefer what's already in package.json
- [ ] Test the feature in context: does the page still load correctly with existing data?
- [ ] RBAC: every new API route must check session and role. Every new UI action must
      respect role visibility.
- [ ] Audit logging: every new mutation must emit audit records (D-007)

### FEATURE QUALITY BAR
- [ ] Works on mobile viewport (375px width)
- [ ] Loading state uses shadcn Skeleton matching actual content layout
- [ ] Empty state is helpful, not just "No data"
- [ ] Error state offers recovery (retry button or actionable message)
- [ ] Keyboard accessible (Tab order, Enter to submit, Escape to close)

### RULES
- One feature per command invocation. Do not scope-creep.
- If the feature is larger than a single session, implement only the first thin slice
  and write remaining slices to `tasks/[feature]-plan.md`.
- Do not refactor unrelated code — stay focused on the feature.
- Follow existing patterns: find a similar page in the codebase and match its structure.
- Run `npm run build` before committing.

### OUTPUT

```
Commit: `feat: [feature description] — [area affected]`
```

### DOC SYNC (NON-NEGOTIABLE)
- Update `docs/AREA_*.md` — add changelog entry, update acceptance criteria if new
  behaviors were added, verify IA section still matches
- Update `docs/GAPS_AND_RISKS.md` — close any gaps this feature resolves
- Update `tasks/todo.md` — check off if planned work, add to Recently Shipped
- Update `tasks/lessons.md` if implementation revealed patterns worth capturing
- If a `tasks/[feature]-plan.md` was created, track remaining slices there

```
Commit: `chore: sync docs with [feature] ship`
```
