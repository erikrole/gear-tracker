# Harden Page

Six-pass audit and hardening pipeline for a page component.
Each pass adopts a different expert lens. Run sequentially — each builds on the last.
Commit after every pass. Push after all six.

**Target:** $ARGUMENTS

---

## Pass 0 of 6: Page Purpose & Architecture Audit

You are a product architect and information architect.

### GOAL
Before hardening anything, evaluate whether this page is the right unit of work.
Determine if it should remain standalone, be merged into an adjacent page, be split,
or be restructured. Wasted effort polishing a page that needs a different shape is
the most expensive kind of rework.

### PREPARATION (do this before touching any code)
1. Read the target page file completely — understand what it renders and what data it fetches
2. Read `docs/NORTH_STAR.md` — understand the product's identity and what it is NOT trying to be
3. Read the relevant `docs/AREA_*.md` — understand the intended information architecture for this domain
4. Read the relevant `docs/BRIEF_*.md` if one exists — understand the original feature spec and acceptance criteria
5. List all pages under `src/app/(app)/` — map the full page tree
6. Read sibling pages in the same route segment (e.g., if target is `/items/[id]/page.tsx`, also read `/items/page.tsx`)
7. Read `docs/DECISIONS.md` for any decisions affecting this page's scope or lifecycle

### AUDIT QUESTIONS (answer each explicitly before proceeding)

| Question | What to evaluate |
|---|---|
| **Does this page have a clear, singular purpose?** | Can you describe what it does in one sentence? If not, it may be doing too much. |
| **Is this the right granularity?** | Should this be a tab within a parent page instead of a standalone route? Or should a tab be promoted to a full page? |
| **Are there sibling pages with overlapping content?** | Two pages showing the same entity from different angles (e.g., item detail + item history) may merge better as tabs or a sheet. |
| **Does the URL structure match the mental model?** | Would a staff coordinator find this page where they expect it? Does the breadcrumb path make sense? |
| **Is the page reachable?** | Are there navigation links, breadcrumbs, or search results pointing here? Orphan pages are invisible. |
| **Does the AREA doc's IA match what's built?** | If the area doc says "tabs: Info, History" but the page has 4 tabs, the doc or the page is wrong. |
| **Mobile viability** | Is this page usable on a phone in the field? Given the mobile-first principle from NORTH_STAR, should it be? |

### DECISION GATE
- **If the page should be restructured** (merged, split, re-routed): STOP. Write the restructuring proposal to `tasks/todo.md` and ask the user before proceeding. Do not harden a page that should not exist in its current form.
- **If the page is correctly scoped**: State the one-sentence purpose and proceed to Pass 1.

### RULES
- This pass produces zero code changes
- Bias toward keeping existing structure — only recommend restructuring when there is clear overlap, confusion, or violation of the AREA doc's IA
- Consider mobile: a page that makes sense on desktop might be unnecessary on mobile if the parent already shows the same data
- Consider roles: does the content density match the role's needs? (Students need speed; admins need depth)

### OUTPUT
- If proceeding: No commit. Move to Pass 1.
- If restructuring needed: Write proposal to `tasks/todo.md`, stop, and ask user.

---

## Pass 1 of 6: Design System Alignment

You are a frontend engineer and design systems expert.

### GOAL
Ensure this page fully aligns with shadcn/ui and a consistent design system.

### PREPARATION (do this before touching any code)
1. Glob `src/components/ui/*.tsx` — build a full inventory of every installed shadcn component
2. Read the variant APIs of components likely relevant to this page (Badge, Avatar, Card, Skeleton, Progress, Button, etc.)
3. Read `components.json` for the shadcn style config (base color, radius, CSS variable mode)
4. Read the target page file completely
5. Grep `globals.css` for every custom CSS class used by this page — understand what each one does

### TASKS

#### Red — Replace Immediately (shadcn-first, non-negotiable)
- Custom CSS class components that have direct shadcn equivalents (`.badge-green` -> `Badge variant="green"`, `.user-avatar` -> `Avatar` + `AvatarFallback`)
- Raw styled `<span>`, `<div>`, `<img>` elements doing the job of Badge, Avatar, AvatarGroup, Skeleton, Progress, Separator
- Custom loading skeletons or spinner components when shadcn `Skeleton` exists
- Inconsistent card headers — some using `CardHeader`/`CardTitle`, others using raw `<div>` + `<h2>`
- **Breadcrumbs**: Any custom `.breadcrumb` CSS or raw `<div>` breadcrumbs → shadcn `Breadcrumb` + `BreadcrumbList` + `BreadcrumbItem` + `BreadcrumbLink` + `BreadcrumbPage`
- **Error states**: Raw `<div>` error messages → shadcn `Alert` with `variant="destructive"` + `AlertTitle` + `AlertDescription`
- **Empty states**: Raw `<div>` "no data" messages → `EmptyState` component (wraps shadcn `Empty`)
- **Loading states**: `Spinner` or raw loaders → shadcn `Skeleton` layouts matching the actual page structure (vary widths per row)
- **Timeline/feed dots**: Custom CSS circles (`.history-dot`) → shadcn `Avatar` + `AvatarFallback`
- **Mobile cards**: Raw `<Link>` or `<div>` with `border` → shadcn `Card` + `CardContent`
- **Section dividers**: Raw `<hr>` or margin gaps between sections → shadcn `Separator`
- **Layout CSS classes**: Custom `.details-grid`, `.page-header`, `.header-actions` → Tailwind grid/flex utilities

#### Yellow — Inconsistencies
- Spacing values that don't match design system tokens (e.g., `padding: 10px 20px` in CSS vs `px-5 py-2.5` in Tailwind)
- Typography that bypasses the type scale (raw `font-size: 13px` vs `text-sm`)
- Mixed patterns: inline Tailwind classes duplicating what a CSS class already provides
- Color values hardcoded as hex instead of using CSS variables or variant props
- Custom `.muted` CSS class → `text-muted-foreground` Tailwind utility

#### Green — Enhancements
- Sub-components that could compose shadcn primitives more cleanly
- Opportunities to use `AvatarGroup` for stacked avatar patterns
- Badge `size="sm"` for tight inline labels (counts, tags, refs)

#### Cleanup (non-negotiable)
- After every component replacement, grep the CSS file for the now-dead class
- Grep the entire `src/` directory to confirm no other file uses it before removing
- Delete dead CSS. Do not leave commented-out rules.
- Check every modified file for dead imports (removed components, unused type imports)
- Verify no orphaned shadcn imports (e.g., importing `Spinner` after replacing with `Skeleton`)

### RULES
- Do not replace UI without clear benefit — if a custom component works and has no shadcn equivalent, leave it
- Prioritize consistency over creativity
- Preserve all existing interactive behavior (hover states, click handlers, links)
- Run `npm run build` and confirm zero errors before committing

### OUTPUT
Commit: `fix: migrate [page] to shadcn/ui components, remove N lines dead CSS`

---

## Pass 2 of 6: Logic & Data Flow (builds on Pass 0 findings)

You are a senior full-stack engineer.

### GOAL
Audit and fix every logic path, state transition, and data flow on this page.

### PREPARATION (do this before touching any code)
1. Read the API route(s) this page fetches — full file, not just the handler signature
   - What HTTP status codes can it return? (200, 401, 404, 409, 500?)
   - What does the response body look like on error? (`{ error: "..." }` vs empty)
   - Does it use `Promise.all`? What happens if one sub-query fails?
2. Read every hook and utility this page imports — useConfirm, useToast, format functions, fetch wrappers
   - What do the format functions return on null/undefined/invalid input?
   - Is `toast()` a stable reference or recreated each render?
3. Read the page component completely, tracing every state variable from initialization through every mutation

### AUDIT — Critical Issues

#### State & Dependencies
- [ ] **`useCallback` / `useMemo` dependency arrays**: List every dependency. Are any hook returns (toast, confirm, router) potentially unstable? Unstable deps in `useCallback` used by `useEffect` = infinite re-render loop. Fix with refs.
- [ ] **Stale closures**: Do event handlers close over state that could be outdated by the time they fire?
- [ ] **State transitions**: Map every `setState` call. Can any combination produce an impossible state? (e.g., `data !== null && fetchError !== false` simultaneously)

#### Fetch & Mutations
- [ ] **Race conditions**: If `loadData()` is called twice rapidly, can the first response arrive after the second and overwrite fresh data? Fix: AbortController.
- [ ] **Unmount cleanup**: Does the component abort in-flight fetches on unmount? (Check `useEffect` return function)
- [ ] **Every `fetch()` has a `.catch()`**: Trace every fetch call. An unhandled rejection = silent failure.
- [ ] **401 handling on every mutation**: Not just the main data load — also deletes, updates, and actions. Session can expire between page load and user action.
- [ ] **Refresh vs initial load error paths**: A refresh failure should toast, not replace visible data with an error screen.

#### Data Integrity
- [ ] **Null-safe array access**: Can the API return `null` or `undefined` for arrays the UI calls `.map()` on? Add `?? []` guards.
- [ ] **Count vs items mismatch**: Does the UI show a count badge (`total: 10`) but only render 5 items? Is there a "View all" link for the overflow?

### AUDIT — Improvements
- [ ] **Double-action prevention**: Can destructive buttons (delete, cancel) be clicked multiple times before the first resolves? Add `disabled` state or loading guard.
- [ ] **Loading feedback**: Is every async operation visible to the user? (spinner, disabled state, progress bar)

### RULES
- Fix bugs. Don't refactor working code that isn't broken.
- Don't over-validate — trust internal APIs, guard at system boundaries
- Keep changes minimal and targeted
- Run `npm run build` before committing

### OUTPUT
Commit: `fix: harden [page] data flow — [brief list of fixes]`

---

## Pass 3 of 6: Resilience & Failure Modes (builds on Pass 0 findings)

You are a reliability engineer.

### GOAL
Break this page. Then make it unbreakable.

### METHOD
For every user-facing flow on this page, simulate these failure scenarios and evaluate what the user sees:

### SCENARIO MATRIX

| Scenario | What to check |
|---|---|
| **Slow network (3G, 3s+ latency)** | Does the UI feel frozen? Is there a loading indicator? Can the user interact with stale data while loading? |
| **API returns 500** | Does the error screen explain what happened? Can the user recover (retry button)? Is the error type-specific (network vs server)? |
| **API returns 401 mid-session** | Does the page redirect to login? Or does it show a confusing "server error"? Check BOTH the main fetch AND every mutation endpoint. |
| **Spam-click every interactive element** | Click each button 5x rapidly. Do duplicate requests fire? Do toasts stack? Does the UI enter an inconsistent state? |
| **Browser refresh during async operation** | User hits F5 while a delete/save is in-flight. Does the operation complete? Is data lost? |
| **Partial/malformed API response** | What if one array is missing from the response? What if a date field is null? Does the page crash or degrade gracefully? |
| **Network drops after page load** | Page loaded fine, then WiFi dies. User clicks a button. What happens? |
| **Tab goes background for 30 minutes** | User returns — is data stale? Is there any indication? Can they refresh? |

### FOR EACH FAILURE FOUND
1. Describe the exact reproduction steps
2. Describe what the user sees (crash? blank screen? stale data? no feedback?)
3. Implement the fix
4. Verify the fix handles the scenario

### RULES
- Think like a chaotic real user, not a careful developer
- Prioritize preventing **silent** failures — a visible error is better than wrong data
- Don't add complexity for scenarios that can't actually happen given the API contract
- Run `npm run build` before committing

### OUTPUT
Commit: `fix: harden [page] resilience — [brief list of scenarios fixed]`

---

## Pass 4 of 6: UX Polish (builds on Pass 0 findings)

You are a product-minded UX engineer.

### GOAL
Make this page feel complete, fast, and trustworthy. Focus on feel, not structure.

### TASKS

#### Delight & Polish
- **Optimistic mutations**: Can any write operation update the UI instantly, then rollback on failure? (e.g., delete removes item from list immediately, restores on error)
- **Button feedback**: Does every action button show its working state? (loading spinner, "Deleting..." text, disabled during operation)
- **Microinteractions**: Subtle transitions on state changes — items entering/leaving lists, status changes, section expand/collapse

#### Speed Perception
- **Skeleton fidelity**: Do loading skeletons resemble the actual content layout? Vary widths per row — identical skeletons look like a test pattern, not real content loading.
- **Stagger timing**: Cards and rows should fade in with cascading delays (40-80ms apart), not all at once
- **Refresh without replacement**: Background data refreshes should show a subtle indicator (progress bar, spinning icon) — never replace visible content with skeletons
- **Data freshness**: Can the user see when data was last loaded? ("Updated 2m ago") Can they manually trigger a refresh?

#### Trust Signals
- **Error differentiation**: Offline errors, server errors, and auth errors should look and read differently. Use distinct icons and copy. ("You're offline" vs "Something went wrong — usually temporary")
- **Confirmation clarity**: Destructive actions should name what's being destroyed and state it's irreversible
- **System transparency**: After mutations, confirm what happened ("Draft deleted", "Checkout extended to Mar 25")

### ESCALATION RULE
Only ask the user if a decision would **change the page's information architecture, add/remove a feature, or alter a user workflow**. Copy, tone, component choices, error handling patterns, and engineering tradeoffs are yours to own — match existing patterns in the codebase.

### RULES
- Focus on feel, not structure
- Avoid overengineering — a copy change or icon swap can be higher impact than a new component
- Every async user action needs visible feedback — no silent operations
- Run `npm run build` before committing

### OUTPUT
Commit: `feat: polish [page] UX — [brief description of top changes]`

---

## Pass 5 of 6: Doc Sync

Update all project documentation to reflect the work done in passes 0-4.

### FILES TO CHECK AND UPDATE

1. **`docs/AREA_[relevant].md`**
   - Add a changelog entry for each pass (design system, logic, resilience, UX polish)
   - Update acceptance criteria if new behaviors were added (e.g., "refresh preserves data", "optimistic delete with rollback")
   - Bump the `Last Updated` date and `Version` if major changes were made
   - Verify the Information Architecture section still matches what shipped

2. **`tasks/todo.md`**
   - Add a single summary line to "Recently Shipped" covering all 4 implementation passes
   - If this work completes an item in "Active Work" or "Phase B Remaining", check it off

3. **`tasks/lessons.md`**
   - Add a new session section with patterns learned across all passes
   - Group by category: reliability patterns, UX patterns, design system patterns
   - Each lesson should be specific enough to prevent the same mistake next session
   - Include the anti-pattern (what was wrong) and the fix (what to do instead)

4. **`docs/GAPS_AND_RISKS.md`**
   - Close any gaps that were resolved by this work (strikethrough + "Closed" + date)
   - If new risks were discovered during the resilience pass, add them to Active Risks

5. **`tasks/[feature]-plan.md`**
   - If all slices of a related plan are now shipped, move the file to `tasks/archive/`

### RULES
- Every shipped behavior must be reflected in the area doc's changelog
- Lessons must include both the anti-pattern and the correct pattern
- Don't create new doc files — update existing ones
- Commit message must summarize what was updated

### OUTPUT
Commit: `chore: sync docs with [page] hardening passes`
