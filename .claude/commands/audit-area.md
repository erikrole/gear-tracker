# Audit Area

Comprehensive ship-readiness audit for a product area. Reads every doc, inspects
every page and component, checks hardening status, verifies roadmap coverage, and
produces a structured verdict. This is analysis only — no code changes.

**Target:** $ARGUMENTS
*(Provide an area name: checkouts, items, dashboard, users, events, shifts, reservations, notifications, settings, scan, importer, mobile)*

---

## Role

You are a staff engineer conducting a pre-release area audit. You have authority
to assess quality but not to ship — your job is to give the team an honest,
structured assessment of where this area stands and what's blocking ship-readiness.

## GOAL

Produce a single, structured audit report that answers five questions:
1. **Scope**: Is the area's scope well-defined and documented?
2. **Hardening**: Has it been stress-tested and made resilient?
3. **Roadmap**: Is there a versioned evolution plan?
4. **Features**: Are planned features fleshed out with specs?
5. **Ship-readiness**: Can this go to real users today?

---

## PHASE 1: Document Audit (read everything first)

### Required Reading (do ALL of these — no exceptions)

#### Area Documentation
1. Read `docs/AREA_[target].md` completely — note:
   - Version number and last-updated date
   - Acceptance criteria: which are marked met vs unmet?
   - Information Architecture: does it describe every page/tab/panel?
   - Changelog: when was the last entry? Does it reflect recent commits?
   - Deferred items: what's explicitly punted to later phases?

2. Read every `docs/BRIEF_*.md` that references this area — note:
   - Are all acceptance criteria addressed in the area doc or code?
   - Are there orphaned briefs (written but never implemented)?

3. Read `docs/DECISIONS.md` — note decisions affecting this area:
   - Which decision IDs apply?
   - Are there constraints the code must follow?
   - Any pending decisions blocking features?

4. Read `docs/GAPS_AND_RISKS.md` — note:
   - Open gaps referencing this area
   - Active risks referencing this area
   - Pending decisions that block this area

5. Read `docs/NORTH_STAR.md` — note:
   - Which phase is this area in? (A/B/C)
   - Is the phase status accurate vs what's actually shipped?

#### Task & Planning Files
6. Read `tasks/todo.md` — note:
   - Active work items for this area
   - Recently shipped items for this area
   - Phase B/C remaining items

7. Check for `tasks/[area]-plan.md` or `tasks/[area]-roadmap.md` — note:
   - Does a plan exist? Is it current?
   - Are slices checked off accurately?
   - Should it be archived?

8. Read `tasks/lessons.md` — note:
   - Lessons learned from this area's implementation
   - Recurring patterns or pain points

---

## PHASE 2: Code Inspection (every page and component, one by one)

### Page Inventory
1. Glob `src/app/(app)/[area-routes]/**/*.tsx` — list every page file
2. For each page file, read it completely and note:
   - **Component count**: How many components does this page render?
   - **Data fetching**: What API routes does it call? How many fetch calls?
   - **State management**: How many `useState` / `useCallback` / `useEffect` hooks?
   - **Error handling**: Does every fetch have loading, error, and empty states?
   - **Loading states**: Are there skeletons? Do they match the actual layout?
   - **Auth guards**: Does it check role/permissions before rendering restricted UI?
   - **Mobile**: Is there responsive behavior? (Check for `md:`, `lg:`, `sm:` breakpoints)

### API Route Inventory
3. Glob `src/app/api/[area-routes]/**/*.ts` — list every API route
4. For each route, read it and note:
   - **Auth check**: Does it verify session and role?
   - **Input validation**: Is the request body validated (Zod, manual checks)?
   - **Audit logging**: Does every mutation call `createAuditEntry`?
   - **Error responses**: Does it return structured errors with appropriate HTTP status codes?
   - **Transaction safety**: Are multi-step mutations wrapped in `$transaction`?
   - **N+1 queries**: Are there loops that query the DB per iteration?

### Component Inventory
5. Identify shared components used by this area's pages
6. Check: Are they using shadcn/ui components or custom primitives?
7. Check: Are there dead imports, unused exports, or orphaned components?

---

## PHASE 3: Hardening Assessment

### Check git history for hardening work
1. Search git log for commits mentioning this area + "harden", "resilience", "stress", "break", "audit"
2. Check if `/harden-page` or `/break-this` has been run on each page in this area

### Hardening Checklist (per page)

| Check | What to verify |
|---|---|
| **Design system alignment** | All components are shadcn/ui. No custom CSS for things shadcn handles. No dead CSS classes. |
| **Data flow safety** | AbortController on fetches. Race condition prevention. 401 handling on every endpoint. Null-safe arrays. |
| **Resilience** | Spam-click guards on buttons. try/catch/finally on mutations. Refresh-preserves-data pattern. Network error differentiation. |
| **UX polish** | Optimistic mutations where appropriate. Skeleton loading. Toast feedback on actions. Error recovery (retry buttons). |
| **Accessibility** | aria-invalid on form errors. aria-describedby for help text. Keyboard navigable. Focus management. |

### Rate each page:
- **Hardened**: All 5 checks pass. Has been through `/harden-page` or equivalent.
- **Partially hardened**: 2-4 checks pass. Key gaps remain.
- **Not hardened**: 0-1 checks pass. Needs full `/harden-page` treatment.

---

## PHASE 4: Roadmap Assessment

### Check for roadmap artifacts
1. Does `tasks/[area]-roadmap.md` exist?
2. Does the AREA doc contain a "Roadmap" or "Future" or "Deferred" section?
3. Does NORTH_STAR.md reference Phase B/C work for this area?

### Roadmap Completeness

| Question | What to evaluate |
|---|---|
| **V1 defined?** | Is the current shipped version clearly defined as a coherent V1? |
| **V2 planned?** | Are the next improvements identified and prioritized? |
| **V3 envisioned?** | Is there a longer-term vision for this area's evolution? |
| **Dependencies mapped?** | Does the roadmap identify schema changes, API additions, and cross-area integrations needed? |
| **Effort sized?** | Are the roadmap items sized (S/M/L) so work can be planned? |

### Rate the roadmap:
- **Well-defined**: V1 shipped, V2 planned with specifics, V3 envisioned
- **Partially defined**: V1 shipped, some V2 ideas but vague
- **Undefined**: No roadmap artifact. Evolution is ad-hoc.

---

## PHASE 5: Feature Completeness Assessment

### Cross-reference all sources
1. List every feature mentioned in: AREA doc acceptance criteria, BRIEF docs, NORTH_STAR phases, GAPS_AND_RISKS, todo.md
2. For each feature, classify:

| Status | Definition |
|---|---|
| **Shipped** | Code exists, works, documented in AREA changelog |
| **Specced** | Brief or plan exists, not yet implemented |
| **Mentioned** | Referenced in a doc but no spec or plan |
| **Missing** | Should exist based on the product's identity (NORTH_STAR) but isn't mentioned anywhere |

### Feature Depth Check
For each shipped feature, assess:
- **Is it complete?** Does it handle all roles (ADMIN, STAFF, STUDENT)?
- **Is it documented?** Area doc reflects what shipped?
- **Is it tested?** Has it been through hardening?
- **Is it connected?** Does it link to related areas appropriately?

---

## PHASE 6: Ship-Readiness Verdict

### Scoring Matrix

Rate each dimension 1-5:

| Dimension | 1 (Red) | 3 (Yellow) | 5 (Green) |
|---|---|---|---|
| **Scope clarity** | No area doc, unclear boundaries | Area doc exists but outdated or incomplete | Area doc current, IA matches code, clear boundaries |
| **Hardening** | No pages hardened | Some pages hardened, key gaps | All pages hardened (5-pass or equivalent) |
| **Roadmap** | No plan, ad-hoc | Some ideas documented | V1-V2-V3 defined with sizing |
| **Feature completeness** | Core features missing | Core complete, gaps in edges | All planned features shipped and documented |
| **Doc sync** | Docs don't match code | Mostly match, some drift | Docs exactly reflect shipped reality |

### Overall Verdict

| Score Range | Verdict | Meaning |
|---|---|---|
| 21-25 | **Ship-ready** | This area can go to real users with confidence |
| 16-20 | **Nearly ready** | 1-2 targeted fixes/docs updates, then ship |
| 11-15 | **Needs work** | Specific gaps must close before shipping |
| 5-10 | **Not ready** | Major work required — hardening, features, or documentation |

---

## OUTPUT FORMAT

Write the audit report to `tasks/[area]-audit.md` with this structure:

```markdown
# [Area] Ship-Readiness Audit
**Date**: YYYY-MM-DD
**Auditor**: Claude (automated)
**Area**: [target]
**Overall Verdict**: [Ship-ready / Nearly ready / Needs work / Not ready] ([score]/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | X/5 | ... |
| Hardening | X/5 | ... |
| Roadmap | X/5 | ... |
| Feature completeness | X/5 | ... |
| Doc sync | X/5 | ... |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| [name] | /path | Hardened / Partial / Not | [key issues] |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| [name] | Shipped/Specced/Mentioned/Missing | [doc] | ... |

## Open Gaps & Blockers
[List from GAPS_AND_RISKS + anything discovered during audit]

## Recommended Actions (prioritized)
1. [Highest priority action]
2. ...

## Roadmap Status
[Current state of V1/V2/V3 planning]
```

---

## RULES

- This command produces ZERO code changes. It is read-only analysis.
- Be honest. A false "ship-ready" is worse than a real "needs work."
- Every claim must cite a specific file and line or doc section.
- Don't pad the score — if it's a 2, say it's a 2 and explain why.
- If a page hasn't been hardened, say so clearly — don't assume it's fine.
- Compare area doc claims against actual code behavior. Docs that claim shipped
  features that don't exist are a worse signal than missing docs.
- The audit report should be useful to someone who has never seen this codebase.
  Include enough context that the recommended actions are actionable.

## DOC SYNC

After writing the audit report:
- If the audit reveals stale claims in `docs/AREA_*.md`, note them in the report's
  "Doc sync" section — do not fix them (read-only command).
- If the audit reveals gaps not tracked in `docs/GAPS_AND_RISKS.md`, note them in
  the report's "Open Gaps & Blockers" section.
- No commits. The report itself is the output.
