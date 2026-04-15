---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/roadmap-page.md
observe: echo "[roadmap-page] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Roadmap Page

Create a versioned roadmap (V1 → V2 → V3) for a single page. Each version must feel
complete and independently shippable. This is analysis only — no code changes.

**Target:** $ARGUMENTS

---

## Role

You are a senior product strategist who thinks in progressive slices.
You understand that a page shipped at V1 is better than a page stuck at V3-planning.

## GOAL

Evaluate the current state of this page, then design three versions that progressively
enhance it. Each version is a complete, usable experience — not a half-finished step
toward the next.

## PREPARATION (do this before designing anything)

1. Read the target page file completely — understand what it renders, what data it fetches,
   what actions it supports
2. Read the relevant `docs/AREA_*.md` — understand intended IA, acceptance criteria,
   and what's been shipped vs what's deferred
3. Read the relevant `docs/BRIEF_*.md` if one exists — what was originally spec'd?
4. Read `docs/NORTH_STAR.md` — what is the product's identity? What principles should
   guide this page's evolution?
5. Read `docs/GAPS_AND_RISKS.md` — are there known gaps or deferred features for this area?
6. Read `docs/DECISIONS.md` — architectural constraints affecting this page
7. Read `prisma/schema.prisma` — what models does this page touch? What relationships
   and fields exist that the page doesn't yet surface?
8. Read sibling pages in the same route group — understand the broader context
9. Glob `src/components/ui/*.tsx` — know what shadcn components are available

---

## ANALYSIS

### Current State Assessment
- What does this page do today?
- What works well? (Keep these in all versions)
- What's missing or broken?
- What data is available in the schema but not surfaced?
- What role(s) use this page? Does the experience match their needs?
- Mobile viability: usable on a phone in the field?

---

## VERSION ROADMAP

### V1 — Core (minimum viable, feels complete)
**Principle**: Ship the simplest version that fully serves its primary user need.
Don't overpack. A polished V1 > a bloated V1.

For this version, specify:
- Features included (and explicitly: what's NOT included yet)
- shadcn components to use
- API routes needed (existing or new)
- RBAC: which roles see what
- Loading, error, and empty states
- Mobile behavior

### V2 — Enhanced (improved UX, reduced friction)
**Principle**: Now that V1 works, make it faster and smarter. Add convenience
features that reduce clicks, improve discoverability, and handle edge cases.

For this version, specify:
- New features (inline editing, bulk actions, filtering, sorting, keyboard shortcuts)
- Smarter defaults (remember last selection, auto-suggest based on context)
- Cross-page connections (link to related entities, show contextual data from other areas)
- Performance improvements (optimistic updates, background refresh, pagination)
- What V1 features get enhanced vs left alone

### V3 — Advanced (predictive, automated, intelligent)
**Principle**: The page anticipates user needs. It surfaces the right information
at the right time and automates repetitive workflows.

For this version, specify:
- Predictive features (suggest items based on event type, pre-fill from history)
- Automation (auto-assign, batch operations, scheduled actions)
- Advanced views (analytics, trends, comparisons)
- Real-time features (live updates, collaborative awareness)
- Integration with other system domains

---

## DEPENDENCIES

For each version:
- What schema changes are needed? (migrations, new models, new fields)
- What other pages or components must exist first?
- What shared components could be extracted for reuse?
- What API routes need to be built?

## RISKS

- Where could scope creep push V1 into V2 territory?
- What V2 features might be YAGNI (you aren't gonna need it)?
- What V3 ideas sound impressive but don't serve the actual user workflow?
- Are there tight coupling risks between versions?

## BUILD ORDER

Recommended implementation sequence within each version, following the Thin Slice Protocol:
1. Schema/migration (if needed)
2. API/service layer
3. UI wiring
4. Error handling and edge cases
5. Polish and testing

---

## RULES
- Do NOT overpack V1. It should be achievable in 1-2 sessions.
- Each version must feel complete — not "V1 is broken without V2."
- Reference existing patterns in the codebase — don't invent new paradigms.
- Be specific: name the shadcn components, API routes, and schema fields.
- Consider all three roles (ADMIN, STAFF, STUDENT) at every version.
- Consider mobile at every version.

## OUTPUT

Write the roadmap to `tasks/[page-name]-roadmap.md`. No code changes.

Update relevant `docs/AREA_*.md` with a reference to the roadmap file.
