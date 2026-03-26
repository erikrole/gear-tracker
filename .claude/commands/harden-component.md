# Harden Component

Five-pass audit and hardening pipeline for a reusable component.
Each pass adopts a different expert lens. Run sequentially — each builds on the last.
Commit after every pass. Push after all five.

**Target:** $ARGUMENTS

---

## Pass 0 of 5: Component Purpose & Scope Audit

You are a design systems architect.

### GOAL
Before hardening anything, evaluate whether this component is the right unit of work.
Determine if it should remain standalone, be merged with a sibling, be split into
subcomponents, or be restructured. Wasted effort polishing a component that needs a
different shape is the most expensive kind of rework.

### PREPARATION (do this before touching any code)
1. Read the target component file completely — understand its props, variants, state, and rendering logic
2. Grep the entire `src/` directory for all imports of this component — build a complete usage map
3. Read sibling components in the same directory — understand composition patterns
4. Glob `src/components/ui/*.tsx` — check if this wraps a shadcn primitive or if a shadcn equivalent exists
5. Read `components.json` for the shadcn style config
6. Read the relevant `docs/AREA_*.md` files for areas that consume this component
7. If this is a page-level composed component (e.g., `ShiftDetailPanel`), read the page that mounts it

### AUDIT QUESTIONS (answer each explicitly before proceeding)

| Question | What to evaluate |
|---|---|
| **Does this component have a clear, singular purpose?** | Can you describe what it does in one sentence? If not, it may be doing too much. |
| **Is the line count appropriate?** | Components over 300 lines usually need extraction. Over 500 is a red flag. |
| **Is the prop interface clean?** | Are there unused props? Props with confusing names? Props that should be derived internally? |
| **Is it a primitive or composite?** | Primitives (Button, Badge) have different hardening needs than composites (ShiftDetailPanel, BookingCard). |
| **How many consumers exist?** | A component used by 1 page has different constraints than one used by 15. |
| **Are consumers working around its limitations?** | Wrapping in extra divs, overriding styles, passing className hacks = API gaps. |
| **Does it compose well with sibling components?** | Does it accept children? Can it be placed inside Cards, Sheets, Popovers without breaking? |

### DECISION GATE
- **If the component should be restructured** (split, merged, re-scoped): STOP. Write the proposal to `tasks/todo.md` and ask the user before proceeding. Do not harden a component that should not exist in its current form.
- **If the component needs extraction** (>400 lines with distinct sections): Note which subcomponents to extract in Pass 1, but proceed — extraction is part of hardening.
- **If the component is correctly scoped**: State the one-sentence purpose and proceed to Pass 1.

### RULES
- This pass produces zero code changes
- Bias toward keeping existing structure unless there is clear evidence of scope creep
- Consider all three roles (ADMIN, STAFF, STUDENT) — does the component render differently per role?
- Consider mobile — is this component usable at 375px? Does it need to be?

### OUTPUT
- If proceeding: No commit. Move to Pass 1.
- If restructuring needed: Write proposal to `tasks/todo.md`, stop, and ask user.

---

## Pass 1 of 5: API & Design System Alignment

You are a frontend engineer and design systems expert.

### GOAL
Ensure this component's API is clean, typed, and fully aligned with shadcn/ui patterns.
If the component is too large (>300 lines), extract subcomponents first.

### PREPARATION
1. Read the component file completely
2. List every prop with its type and whether it's actually used by consumers
3. Grep `globals.css` for any custom CSS classes used by this component
4. Read the shadcn components this wraps or composes (Avatar, Badge, Card, Sheet, etc.)

### TASKS

#### Extraction (if needed)
- Components over 300 lines: identify distinct visual/logical sections and extract as named subcomponents in the same directory or file
- Target: parent component < 200 lines orchestrating subcomponents
- Each subcomponent gets its own typed props interface
- Subcomponents should be independently testable mental units

#### Prop Cleanup
- Remove unused props (grep all consumers to confirm)
- Add proper TypeScript types — no `any`, no `Record<string, unknown>` for structured data
- Add JSDoc comments on non-obvious props
- Default values should be sensible — not require every consumer to specify them

#### shadcn Alignment
- Replace custom CSS class components with shadcn equivalents
- Use `cva` for variants if the component has 3+ visual modes
- Use `cn()` for className merging
- Replace inline `style={{}}` with Tailwind classes
- Replace custom color values with design token CSS variables or Tailwind utilities

#### Cleanup
- Delete dead CSS classes (grep before removing)
- Remove dead imports
- Remove dead code (commented-out blocks, unused functions, unreachable branches)

### RULES
- Do not change observable behavior — same inputs → same outputs
- Preserve all click handlers, hover states, and interactive behavior
- Run `npm run build` and confirm zero errors before committing

### OUTPUT
Commit: `fix: clean [component] API — [brief list: extract N subcomponents, remove dead CSS, type props]`

---

## Pass 2 of 5: Logic & Data Flow

You are a senior full-stack engineer.

### GOAL
Audit and fix every logic path, state transition, and data flow in this component.

### PREPARATION
1. Read every hook this component uses — trace state from initialization through every mutation
2. Read the API routes this component fetches from — understand response shapes and error codes
3. Map every `fetch()` call and its error handling

### AUDIT

#### State & Dependencies
- [ ] **`useCallback`/`useMemo` dependency arrays**: Are any deps potentially unstable (toast, router, functions recreated each render)? Unstable deps + `useEffect` = infinite loop.
- [ ] **Stale closures**: Do event handlers close over state that could be outdated?
- [ ] **State transitions**: Map every `setState` call. Can any combination produce an impossible state?

#### Fetch & Mutations
- [ ] **Race conditions**: If the same fetch fires twice, can stale data overwrite fresh? Fix: AbortController.
- [ ] **Unmount cleanup**: Does the component abort in-flight fetches on unmount?
- [ ] **Every `fetch()` has `.catch()`**: Unhandled rejection = silent failure.
- [ ] **401 handling on every mutation**: Session can expire between mount and user action.
- [ ] **Refresh vs replace**: Background refreshes should preserve visible data, not flash loading state.

#### Interaction
- [ ] **Double-click prevention**: Can destructive actions fire twice? Add `disabled` guard.
- [ ] **Concurrent mutation guard**: If multiple independent actions exist, can they conflict? (e.g., assigning a shift while deleting another)
- [ ] **Optimistic UI rollback**: If optimistic updates exist, do they rollback correctly on error?

### RULES
- Fix bugs. Don't refactor working code.
- Don't add error handling for scenarios that can't happen given the API contract.
- Run `npm run build` before committing.

### OUTPUT
Commit: `fix: harden [component] data flow — [brief list of fixes]`

---

## Pass 3 of 5: Resilience & UX Polish

You are a reliability + UX engineer (combined pass for components).

### GOAL
Break this component, then make it unbreakable. Then make it feel great.

### RESILIENCE SCENARIOS
Test each applicable scenario mentally or by tracing code paths:

| Scenario | What to check |
|---|---|
| **Slow network** | Loading indicator visible? Can user interact with stale data while loading? |
| **API returns 500** | Error state clear and recoverable (retry button)? Differentiated from network error? |
| **API returns 401** | Redirects to login? On both initial fetch AND every mutation? |
| **Spam-click interactive elements** | Duplicate requests? Toast storms? Inconsistent state? |
| **Null/undefined data** | Does `.map()` crash on missing arrays? Does optional chaining cover all paths? |
| **Empty state** | Is there a meaningful empty state? Not just a blank area. |
| **Component unmounts during fetch** | State update after unmount? (React warning, potential memory leak) |

### UX POLISH
- **Loading states**: Skeleton or spinner that matches actual content shape
- **Error differentiation**: Network ("Check your connection") vs server ("Something went wrong") vs auth (redirect)
- **Button feedback**: Every action button shows working state (spinner, "Saving...", disabled)
- **Optimistic UI**: Can any mutation update UI instantly with rollback on failure?
- **Confirmation on destructive actions**: Named target, not generic "Are you sure?"
- **Toast feedback**: Every completed action gets a success toast
- **Mobile**: Ensure touch targets ≥ 44px, no horizontal overflow, readable text at 375px

### RULES
- Prioritize preventing silent failures over adding features
- A visible error is better than wrong data
- Match existing UX patterns in the codebase (toast style, error copy, confirmation dialogs)
- Run `npm run build` before committing

### OUTPUT
Commit: `fix: harden [component] resilience + polish — [brief description]`

---

## Pass 4 of 5: Doc Sync & Verification

You are the project's documentation steward.

### GOAL
Ensure all documentation reflects the hardening work. Verify the component builds and functions correctly.

### VERIFICATION
1. Run `npm run build` — must pass with zero errors and zero warnings related to this component
2. Grep for any remaining inline `style={{}}` in the component — should be zero (all Tailwind)
3. Grep for any remaining `console.log` or `console.error` — remove debug logging
4. Verify the component is imported correctly by all consumers (no broken imports from extraction)

### DOC UPDATES
1. **`docs/AREA_[relevant].md`** — Add changelog entry summarizing the hardening passes
2. **`tasks/lessons.md`** — Add patterns learned (anti-pattern → correct pattern)
3. **`docs/GAPS_AND_RISKS.md`** — Close any gaps resolved, add any new risks discovered

### RULES
- Every behavior change must be reflected in area docs
- Lessons must include both the anti-pattern and the fix
- Don't create new doc files — update existing ones

### OUTPUT
Commit: `chore: sync docs with [component] hardening`

Then push all commits.
