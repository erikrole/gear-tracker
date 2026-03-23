# Roadmap Component

Create a versioned roadmap (V1 → V2 → V3) for a reusable component. Focus on API
design, composition patterns, and rollout strategy. This is analysis only — no code changes.

**Target:** $ARGUMENTS

---

## Role

You are a design systems architect who builds components that last.
You know that the best component API is the one nobody has to look up.

## GOAL

Evaluate the current state of this component, understand how it's used across the
codebase, and design three versions that progressively enhance it while maintaining
backward compatibility.

## PREPARATION (do this before designing anything)

1. Read the target component file completely — understand its props, variants, and rendering logic
2. Grep the entire `src/` directory for all imports/usages of this component — build a
   complete usage map (which pages, how they use it, which props they pass)
3. Read `components.json` — understand the shadcn style config (base color, radius, CSS variables)
4. Glob `src/components/ui/*.tsx` — check if a shadcn equivalent exists or if this wraps one
5. Read sibling components in the same directory — understand composition patterns
6. Read the relevant `docs/AREA_*.md` files for areas that use this component
7. If this is a shadcn component, read its variant definitions and understand the full API

---

## ANALYSIS

### Current State
- What does this component do?
- What props does it accept? Are they well-typed?
- How many files import it? List them.
- Is it a primitive (Button, Badge) or a composite (BookingCard, UserAvatar)?
- Does it follow shadcn patterns (variants via cva, className merging via cn)?

### Usage Context
- Which pages consume this component?
- What variants or configurations do they use?
- Are there inconsistent usage patterns across consumers? (e.g., some pass children,
  others pass a `label` prop for the same visual result)
- Are any consumers working around limitations? (wrapping it in extra divs, overriding
  styles, passing className hacks)

---

## VERSION ROADMAP

### V1 — Core (clean, typed, handles all current use cases)
**Principle**: Standardize what exists. Clean API, proper TypeScript, shadcn-aligned.

- Clean up the prop interface — remove unused props, type everything
- Align styling with shadcn patterns (cva for variants, cn for className merging)
- Ensure it handles all current usage patterns without workarounds
- Add proper display name and JSDoc for key props
- Define the canonical usage pattern (one right way to use it)

**API Design:**
```tsx
// Define the V1 prop interface explicitly
interface ComponentProps {
  // List every prop with type and purpose
}
```

### V2 — Enhanced (new variants, better composition, responsive)
**Principle**: Extend the API for new use cases without breaking existing consumers.

- New variants based on anticipated needs (check AREA docs for upcoming features)
- Composition patterns: compound component API for complex configurations
- Responsive behavior: different layouts at mobile vs desktop breakpoints
- Animation/transitions for state changes
- Accessibility improvements (aria labels, keyboard interaction, focus management)

**API Design:**
```tsx
// Show how V2 extends V1 without breaking changes
```

### V3 — Advanced (context-aware, compound, accessibility-complete)
**Principle**: The component adapts to its context and handles every edge case.

- Context-aware rendering (e.g., renders differently inside a Card vs standalone)
- Full compound component pattern (Component.Header, Component.Body, Component.Footer)
- Complete accessibility audit (screen reader, keyboard nav, high contrast)
- Slot pattern for maximum flexibility without prop explosion
- Performance optimization (memo boundaries, virtualization for lists)

**API Design:**
```tsx
// Show the V3 compound component API
```

---

## INTEGRATION PLAN

For each version:
- Which consumers need to update their usage?
- Can the migration be done incrementally (one page at a time)?
- Are there breaking changes? If so, what's the migration path?
- Rollout order: which pages to migrate first? (highest usage → lowest)

## RISKS

- **API churn**: Will V2 changes force V1 consumers to update? Minimize this.
- **Tight coupling**: Is this component too tied to specific page logic?
- **Overengineering**: Is V3 solving problems nobody has? Check actual usage patterns.
- **Prop explosion**: Does V2/V3 add too many props? Consider composition over configuration.

## ROLLOUT PLAN

1. Ship V1 as a non-breaking cleanup (existing consumers continue working)
2. Migrate consumers to V1 canonical patterns one page at a time
3. Ship V2 as additive changes (new variants, new sub-components)
4. V3 only when actual usage demands it — not speculatively

---

## RULES
- Keep the API simple. If a prop needs a paragraph to explain, the API is wrong.
- Avoid building for hypothetical consumers — design for actual usage patterns.
- shadcn-first: if a shadcn component does the job, wrap or extend it, don't rebuild.
- Every version must be backward-compatible with the previous version's API.
- No component is an island — consider how it composes with other components.

## OUTPUT

Write the roadmap to `tasks/[component-name]-roadmap.md`. No code changes.

Update relevant `docs/AREA_*.md` with a reference to the roadmap file.
