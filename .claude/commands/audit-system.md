---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/audit-system.md
observe: echo "[audit-system] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Audit System

Improvement-opportunity audit for a cross-cutting system — not a single page or component,
but a vertical slice of the application (e.g., bookings, notifications, auth, search).
Reads schema, API layer, service layer, and UI together, then answers four questions:
what's smart, what doesn't make sense, what can be simplified, what can be rethought.
This is analysis only — no code changes.

**Target:** $ARGUMENTS
*(Provide a system name: bookings, notifications, auth, search, items, users, shifts, scan, importer)*

---

## Role

You are a staff engineer reviewing a system you didn't build. You're not checking for bugs
or scoring ship-readiness — you're evaluating how well the system hangs together as a whole.
Schema, API design, service patterns, UI, and data flows are all in scope.
Be specific. Cite file and line numbers.

---

## PHASE 1: Investigation

Read top-to-bottom through every layer of the system before forming opinions.

### Schema Layer
1. Read `prisma/schema.prisma` — identify all models that belong to this system
2. Note: relationships, cascades, indexes, field types, nullable vs required
3. Note: fields in the schema that are defined but appear unused or underused

### API Layer
4. Glob `src/app/api/[system-routes]/**/*.ts` — list every route file
5. For each route, note:
   - What it does (query or mutation, what models it touches)
   - Auth pattern (withAuth, role check, none)
   - Input validation (Zod, manual, none)
   - Response shape (what does the client receive?)
   - Transaction scope (single op, `$transaction`, Promise.all)
   - Audit logging (createAuditEntry present or absent)

### Service Layer
6. Find service files — `src/lib/[system]-service.ts`, `src/lib/[system]/`, etc.
7. Read them completely — note: what business logic lives here vs in routes, what's duplicated between layers

### UI Layer
8. Glob `src/app/(app)/[system-routes]/**/*.tsx` — list every page file
9. Read each page — note: data fetching approach, component composition, state shape
10. Find the major components for this system — read them

### Cross-Cutting
11. Read `docs/AREA_*.md` for this system — understand intended behavior
12. Read `docs/DECISIONS.md` for decisions that constrain this system
13. Read `docs/GAPS_AND_RISKS.md` for known gaps in this system
14. Grep `tasks/lessons.md` for lessons from this system's development

---

## PHASE 2: Four-Lens Analysis

Answer each question for the system as a whole. Be specific — name the files, routes, models,
and components you're referring to.

### Lens 1: What's Smart?

Patterns across the system that are well-designed and worth preserving:

- **Schema design**: Well-chosen relationships, clean normalization, indexes that enable efficient queries
- **API contract**: Routes that return exactly what the UI needs without over-fetching
- **Service boundaries**: Logic correctly separated between routes, services, and UI hooks
- **Reuse**: Patterns or utilities used consistently across the system's pages and components
- **Resilience**: Error handling, transaction patterns, or abort patterns done well
- **Data flows**: A clean pipeline from schema → API → hook → component

For each: cite specifically what's smart and why. Note if it should be adopted elsewhere.

### Lens 2: What Doesn't Make Sense?

Patterns across the system that create confusion, inconsistency, or subtle bugs:

- **API inconsistency**: Two routes doing similar things differently for no reason
- **Schema awkwardness**: A relationship that doesn't fit the actual data model, a field used for two purposes
- **Layer violations**: Business logic in the UI, presentation logic in the API, missing service layer
- **Auth gaps**: Routes without auth checks, permission checks that are inconsistent across the system
- **N+1 patterns**: Loops querying the DB per iteration, missing `include` in Prisma queries
- **Response shape inconsistency**: Some routes return `{ data: [...] }`, others return the array directly
- **State duplication**: The same data fetched and maintained in multiple places in the UI

For each: describe what doesn't make sense and its real-world impact (bug potential, confusion, performance).

### Lens 3: What Can Be Simplified?

Complexity in the system that can be reduced without losing value:

- **Endpoint consolidation**: Multiple narrow routes that could be one consolidated endpoint
  (like the dashboard API consolidation pattern)
- **Schema simplification**: Fields, models, or relationships that add complexity without proportional value
- **Hook consolidation**: Multiple `useXxx` hooks for the same system that could share a single data source
- **Redundant validation**: Validation duplicated in both the route and the service, or in both schema and Zod
- **Dead features**: Code paths, API routes, or UI states that are no longer reachable
- **Indirection**: Abstraction layers that obscure rather than simplify (a service that just calls Prisma)

For each: describe the current complexity and the simpler alternative. Estimate the complexity reduction.

### Lens 4: What Can Be Rethought?

Bigger opportunities that would meaningfully change the system's design:

- **Data model rethink**: A schema redesign that would make the system significantly more capable
  or simpler (e.g., moving from a status string to a state machine, adding a denormalized cache field)
- **API design rethink**: A different API shape that would eliminate client-side complexity
  (e.g., computed fields in the response, a single consolidated endpoint, WebSocket instead of polling)
- **UI model rethink**: A different mental model for how users interact with the system
  (e.g., a list becomes a board, a page becomes a sheet, a multi-step form becomes an inline workflow)
- **Role model rethink**: A different approach to RBAC that makes permissions clearer or more flexible
- **Cross-system integration**: The system is working harder than it needs to because of missing
  integration with another system (e.g., bookings could read from shifts directly)

For each: describe the current model, the alternative model, the benefit, and the migration cost.

---

## PHASE 3: System Improvement Report

Write the findings to `tasks/[system-name]-audit.md`:

```markdown
# [System Name] System Improvement Audit
**Date**: YYYY-MM-DD
**System**: [target]
**Scope**: [list of schema models, API route groups, and page routes in scope]

## System Map
| Layer | Files | Notes |
|---|---|---|
| Schema | [models] | [key relationships] |
| API | [route count] routes | [pattern summary] |
| Services | [files] | [what they own] |
| Pages | [page count] | [route paths] |
| Components | [key components] | [reuse pattern] |

## What's Smart
[System-level patterns worth keeping. Each item cites file:line.]

## What Doesn't Make Sense
[Inconsistencies, violations, awkward patterns. Each item cites file:line and impact.]

## What Can Be Simplified
[Complexity reductions. Each item states: current → simpler, with estimated impact.]

## What Can Be Rethought
[Bigger opportunities. Each item states: current model, alternative, benefit, cost.]

## Prioritized Improvements
### High Impact / Low Effort
[Things that improve the system significantly without requiring a redesign]

### High Impact / High Effort
[Things worth serious consideration — schema changes, API redesigns, UI model shifts]

### Low Impact / Skip
[Things that would be nice but aren't worth the disruption]
```

---

## RULES

- Read-only. Zero code changes.
- Every claim must cite a file and line number.
- The system map must be accurate — don't guess at what's in scope, read the code.
- "Doesn't make sense" requires citing the actual impact, not just pattern preference.
- "Can be rethought" must be worth the migration cost — don't propose rewrites for elegance alone.
- The prioritized improvements section is the most important part of the output.
  Every finding must land in one of the three priority tiers.
- If the system is genuinely well-designed, say so. Not every system has major problems.
