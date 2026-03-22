# Harden Page

Run a 4-pass audit and hardening pipeline on a page component.
Each pass builds on the previous one — run them sequentially, committing after each.

**Target file:** $ARGUMENTS (e.g., `src/app/(app)/page.tsx`)

---

## Pass 1: Design System Alignment

You are a frontend engineer and design systems expert.

### GOAL
Ensure this page fully aligns with shadcn/ui and a consistent design system.

### PREPARATION
- Read ALL files in `src/components/ui/` to inventory available shadcn components and their variant APIs
- Read the target page file completely

### TASKS

#### Replace Immediately
- Non-standard components (custom CSS classes) that have shadcn equivalents
- Raw HTML elements (`<span className="badge-*">`) that should use Badge, Avatar, etc.
- Custom loading states that should use Skeleton or Progress

#### Inconsistencies
- Spacing, typography, layout that doesn't match the design system tokens
- Mixed patterns (some headers use CardHeader, others use raw divs)
- Inline Tailwind classes that duplicate existing CSS classes

#### Refactors
- Rewrite sub-components to compose shadcn primitives
- Remove dead CSS classes after migration

### RULES
- Do not replace UI without clear benefit
- Prioritize consistency over creativity
- Run `npm run build` before committing
- Remove dead CSS that was replaced

### OUTPUT
Commit with message: `fix: migrate [page] to shadcn/ui components`

---

## Pass 2: Logic, Reliability & Data Flow

You are a senior full-stack engineer and reliability engineer.

### GOAL
Harden this page's logic, data flow, and reliability. Break it, then fix it.

### PREPARATION
- Read the API route(s) this page calls — understand error shapes, status codes, partial failure behavior
- Read any hooks or utilities the page imports (useConfirm, useToast, format functions, fetch wrappers)
- Read the page component completely

### AUDIT CHECKLIST

#### Critical (fix immediately)
- [ ] **useCallback/useEffect dependency arrays**: Are there hook returns (toast, confirm) in deps that could be unstable? Use refs for function deps.
- [ ] **Fetch race conditions**: Can rapid calls (refresh, retry, sheet close) cause stale responses to overwrite fresh data? Add AbortController.
- [ ] **Fetch cancellation on unmount**: Does the component clean up in-flight requests?
- [ ] **Error handling on every mutation**: Does every `fetch()` call have a `.catch()`? Does every mutation handle 401 (session expired)?
- [ ] **Refresh vs initial load errors**: Does a background refresh failure wipe visible data?
- [ ] **Double-click on destructive actions**: Can the user spam-click delete/cancel buttons?

#### Improvements
- [ ] **Defensive data guards**: Can the API return null/undefined arrays that would crash `.map()`?
- [ ] **State consistency**: After mutations, does the UI reflect the change immediately or wait for a full reload?
- [ ] **Loading states**: Is it clear to the user that something is happening during async operations?

#### Edge Cases
- [ ] **Empty arrays vs null**: What renders when a section has 0 items vs missing data?
- [ ] **Format functions with bad input**: Do date formatters produce "NaN" or "Invalid Date" on null/undefined?
- [ ] **Mid-action navigation**: What happens if the user navigates away during a delete?

### FAILURE SCENARIOS TO SIMULATE
- Slow network (3s+ response)
- API returns 500
- API returns 401 mid-session
- Double-click on every button
- Browser refresh during async operation
- Partial/malformed API response

### RULES
- Think like a chaotic real user
- Prioritize preventing silent failures
- Don't over-validate at the frontend — trust internal APIs, validate at system boundaries
- Run `npm run build` before committing

### OUTPUT
Commit with message: `fix: harden [page] — [brief description of fixes]`

---

## Pass 3: UX Polish

You are a product-minded UX engineer.

### GOAL
Make this page feel complete, fast, and trustworthy.

### TASKS

#### Delight & Polish
- Microinteractions (optimistic updates, button loading states, transitions)
- Feedback improvements (toasts, inline status changes)
- Optimistic mutations with rollback on failure

#### Speed Perception
- Loading skeleton variation (different widths per row, staggered animation)
- Refresh indicators that don't replace content
- Manual refresh affordance with data freshness ("Updated 2m ago")

#### Trust Signals
- Confirmation clarity (destructive actions explain consequences)
- Error messaging (differentiate offline vs server error vs auth expired)
- System transparency (show when data was last refreshed)

### RULES
- Focus on feel, not structure
- Avoid overengineering — small copy changes and icon swaps count
- Every async action needs visible feedback
- Run `npm run build` before committing

### OUTPUT
Commit with message: `feat: polish [page] UX — [brief description]`

---

## Pass 4: Doc Sync

You are the project's documentation maintainer.

### GOAL
Update all project docs to reflect the changes made in passes 1-3.

### FILES TO UPDATE
1. **`docs/AREA_[relevant].md`** — Add changelog entries for each pass. Update acceptance criteria if new behaviors were added. Bump version/date.
2. **`tasks/todo.md`** — Add to "Recently Shipped" section with a summary.
3. **`tasks/lessons.md`** — Add new session section with patterns learned (reliability, UX, design system).
4. **`docs/GAPS_AND_RISKS.md`** — Close any gaps that were resolved. Note any new risks discovered.
5. **`tasks/[feature]-plan.md`** — Move to `tasks/archive/` if all slices are shipped.

### RULES
- Every shipped behavior must be reflected in the area doc's changelog
- Lessons should be specific enough to prevent the same mistake in the next session
- Don't create new doc files — update existing ones
- Run `npm run build` before committing (in case doc references affect imports)

### OUTPUT
Commit with message: `chore: sync docs with [page] hardening work`
