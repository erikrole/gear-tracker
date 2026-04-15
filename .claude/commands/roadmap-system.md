---
version: 1.0.0
rollback: git checkout HEAD -- .claude/commands/roadmap-system.md
observe: echo "[roadmap-system] run at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> ~/.claude/logs/skill-runs.log
feedback: cat ~/.claude/logs/skill-feedback.log
---

# Roadmap System

Design a cohesive, forward-looking roadmap for the entire system — not individual
pages or components. Think in systems, not surfaces. This is analysis only — no code changes.

No target argument needed. This command always evaluates the full system.

---

## Role

You are a senior product architect and systems thinker.
You see how every page, component, and flow connects. You design for consistency,
scalability, and progressive enhancement across the entire product.

## GOAL

Evaluate the current system architecture, identify gaps and inconsistencies across
domains, and design a three-version roadmap that evolves the product as a cohesive whole.

## PREPARATION (comprehensive — read everything)

1. Read `docs/NORTH_STAR.md` — product identity, principles, decision filters, phase roadmap
2. Read every `docs/AREA_*.md` file — understand each domain's current state, gaps, and aspirations
3. Read `docs/GAPS_AND_RISKS.md` — open gaps, pending decisions, risk registry
4. Read `docs/DECISIONS.md` — all architectural decisions and their acceptance criteria
5. Read `prisma/schema.prisma` — complete data model, relationships, constraints
6. Read `tasks/todo.md` — active work, recently shipped, priority queue
7. Read `tasks/lessons.md` — recurring patterns, pain points, anti-patterns discovered
8. Glob `src/app/(app)/*/page.tsx` — map the complete page tree
9. Glob `src/app/api/**/route.ts` — map all API routes
10. Glob `src/components/ui/*.tsx` — inventory of installed shadcn components
11. Read `src/lib/*.ts` — understand shared utilities (auth, permissions, api client, audit)
12. Read `components.json` — shadcn configuration

---

## STEP 1: SYSTEM OVERVIEW

### Core System Purpose
- What is this product trying to do overall?
- Who are the primary users and what are their daily workflows?
- What is the product's competitive advantage? (Reference NORTH_STAR)

### Key Domains
Map the major functional areas:
- **Booking** (reservations, checkouts, allocations, scan sessions)
- **Inventory** (items, assets, bulk SKUs, kits)
- **Events** (calendar, ICS sync, sport/venue mapping)
- **Users** (roles, permissions, profiles, shifts)
- **Operations** (dashboard, notifications, reports, search)
- **Administration** (settings, import, labels)

For each domain: current maturity level (Scaffold / MVP / Solid / Polished).

---

## STEP 2: CURRENT ARCHITECTURE

### Pages & Flows
- List every page and the primary user flow it supports
- Map how users move between pages (navigation, links, redirects)
- Identify dead ends (pages with no outbound navigation)
- Identify orphan pages (pages with no inbound navigation)

### Shared Components & Patterns
- What components are reused across multiple pages?
- What patterns are consistent? (form handling, error display, loading states)
- What patterns are inconsistent? (different approaches to the same problem)

### Gaps & Inconsistencies
- Duplicate logic across pages (copy-pasted fetch patterns, repeated type definitions)
- Misaligned UX patterns (different error handling, different loading approaches)
- Fragmented flows (workflows that require too many page transitions)
- Schema surface area that has zero UI (models with no page)

---

## STEP 3: SYSTEM VERSION ROADMAP

### V1 — Cohesive Foundation
**Goal**: Consistency and reliability across the system. Every page feels like it
belongs to the same product.

- Standardize on shadcn/ui components system-wide (identify remaining custom components)
- Unify patterns for:
  - Form handling (validation, submission, error display)
  - State management (fetch-on-mount, loading/error states, refresh)
  - API calls (auth handling, error responses, retry logic)
  - Navigation (breadcrumbs, back links, cross-references)
- Eliminate duplicate logic (extract shared hooks, utilities, components)
- Ensure all flows feel connected (no dead ends, no orphan pages)
- Complete missing states: every page has loading, error, and empty states

### V2 — Connected Experience
**Goal**: Reduce friction between pages. The system remembers context and reduces
manual work.

- Cross-page state awareness (checkout page knows the current event, booking page
  shows related items' availability)
- Smarter defaults and persistence (remember last-used filters, auto-select current
  event, pre-fill from history)
- Reduced steps across flows (inline actions instead of navigate-to-page-and-back)
- Better transitions between pages (preserve scroll position, transition animations,
  breadcrumb context)
- Unified search that connects all domains
- Notification system that surfaces actionable items across pages

### V3 — Intelligent System
**Goal**: The system anticipates needs, automates repetitive tasks, and provides
operational intelligence.

- Predictive behavior (suggest gear based on event type, predict availability conflicts)
- Context-aware UI (dashboard adapts to current event, role-specific layouts, time-of-day
  workflows like "game day mode")
- Automation of repetitive actions (auto-generate bookings from recurring events,
  bulk check-in by scan session, scheduled notifications)
- Deeper integrations between domains (shift assignments auto-populate checkout
  permissions, event changes cascade to bookings)
- Operational intelligence (trends, usage analytics, equipment health scoring,
  peak usage prediction)

---

## STEP 4: CROSS-CUTTING FEATURES

Identify features that should be consistent system-wide. For each, assess current
state and target state:

| Feature | Current State | V1 Target | V2 Target |
|---|---|---|---|
| Error handling | | | |
| Loading states | | | |
| Empty states | | | |
| Toast notifications | | | |
| Confirmation dialogs | | | |
| Form validation | | | |
| RBAC enforcement | | | |
| Audit logging | | | |
| Mobile responsiveness | | | |
| Keyboard accessibility | | | |

---

## STEP 5: DATA & STATE STRATEGY

- Where is state managed today? (Server state via fetch, React state, URL params)
- How does data flow across pages? (Re-fetch on mount, shared context, URL params)
- Where is data duplicated or inconsistent?
- Risks:
  - Stale data across tabs or after background periods
  - Race conditions on concurrent mutations
  - N+1 queries or unbounded result sets
- Recommendations for V2/V3 (React Query / SWR, optimistic updates, real-time sync)

---

## STEP 6: DEPENDENCIES & ORDER

- What must be unified first? (Shared patterns before features that depend on them)
- What blocks other improvements? (Schema changes, utility extraction, component standardization)
- Dependency graph: which V1 items enable which V2 items?
- Quick wins: V1 items that can ship independently with immediate impact

---

## STEP 7: RISKS & COMPLEXITY

- **Overengineering**: Which V3 ideas sound good but serve too few users?
- **Tight coupling**: Where are pages too dependent on each other's implementation details?
- **Migration burden**: How much existing code needs to change for V1 consistency?
- **Scaling**: Will current patterns hold at 2x users? 10x inventory items?
- **Scope creep**: Where is the boundary between V1 and V2 most likely to blur?

---

## STEP 8: IMPLEMENTATION STRATEGY

### Rollout Plan
- What can be done incrementally (one page at a time)?
- What requires coordinated changes across multiple pages?
- Recommended order of page-level work (highest impact → lowest)

### Resource Strategy
- Which items can run in parallel (independent pages, independent utilities)?
- Which items are sequential (shared utility before dependent pages)?
- Estimated effort per V1 item (S/M/L)

---

## RULES
- Think in systems, not pages. Every recommendation should consider its effect on the whole.
- Avoid duplicating logic — if two pages need the same thing, extract it.
- Consistency before complexity — V1 is about making everything work the same way.
- Every version should feel complete and usable — no "V1 is incomplete without V2."
- Be specific: name files, components, patterns, and routes.
- Reference existing decisions (D-001 through D-025+) when they constrain options.
- Ground everything in actual user workflows, not theoretical elegance.

## OUTPUT

Write the roadmap to `tasks/system-roadmap.md`. No code changes.

Update `docs/GAPS_AND_RISKS.md` with any newly identified systemic gaps.
