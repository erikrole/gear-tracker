---
name: page-ownership-pass
description: End-to-end execution pass for a gear-tracker web page or page slice. Use when the user asks to take a page end to end, touch every surface, run a UX focused pass, UI focused pass, consistency pass, hardening pass, full page pass, page ownership pass, or improve a page like Users by comparing peer pages and then implementing the selected changes. Covers planning, implementation, verification, docs sync, and cross-page propagation notes.
---

# page-ownership-pass

Own a single web page or a tightly scoped page slice through implementation. This is for execution, not read-only diagnosis.

Use `audit-page-web` instead when the user asks only whether a page is ready, asks for an MVP audit, or wants findings before code changes.

## Invocation

Examples:

- `Take Users end to end`
- `Run a full page pass on /users`
- `UX focused pass on Items`
- `UI focused pass on the Users filters and menus`
- `Make Users consistent with the better list pages`
- `Touch every surface on Users`
- `Page slice: tighten bookings row actions`

Normalize route names to `src/app/(app)/<page>/`. If the user names a component or slice, map it to the owning page before editing.

## Operating modes

### Full page mode

Use when the user wants the whole route improved. Own:

- Route structure and sibling components
- Header, command bar, filters, tabs, menus, tables, cards, sheets, dialogs, toasts, empty states, error states, and desktop/tablet web layout
- Referenced API routes, services, schemas, tests, docs, and task files
- Cross-page consistency and follow-up propagation

### Page slice mode

Use when the user points at one surface, such as filters, row actions, menus, detail sheets, empty states, or responsive behavior.

Keep the implementation narrow, but still compare peer pages and verify that the slice does not create a one-off pattern.

## Mandatory orientation

Before implementation, read enough current repo truth to avoid stale-plan work:

1. `docs/AREA_<PAGE>.md`
2. Matching `docs/BRIEF_*` files, including archived briefs when the area doc references them
3. `docs/DECISIONS.md`
4. `docs/GAPS_AND_RISKS.md`
5. `prisma/schema.prisma` for models, field names, indexes, and cascade rules touched by the page
6. `src/app/(app)/<page>/page.tsx` and every sibling component fully before editing
7. API routes, services, hooks, tests, and shared components referenced by the target surface
8. Relevant `tasks/<page>-*.md`, `tasks/*<page>*audit*.md`, and archived plans
9. At least two comparable shipped pages unless the page has no real peers

Use `rg --files` and `rg` first. If a cited doc is missing, note that and continue from current code.

## Peer comparison

Pick peer pages by workflow shape, not just route name:

- List and filter pages: compare `items`, `kits`, `users`, `guides`, `checkouts`, `reservations`
- Scheduling surfaces: compare `schedule`, `events`, dashboard event widgets
- Admin/settings surfaces: compare `settings`, `reports`, `bulk-inventory`, `users`
- Detail-heavy surfaces: compare item detail, booking detail, user detail, kit detail

Extract the best existing local pattern for:

- Page header hierarchy and primary action placement
- Search, filter, saved view, and clear/reset behavior
- Table row or card structure
- Inline actions versus row navigation
- Menu grouping and destructive action confirmation
- Loading, empty, filtered-empty, error, and success feedback
- Desktop/tablet layout and overflow behavior
- Form, sheet, dialog, and toast language

If the target page should intentionally differ, write down why before editing.

## Lenses

Apply these in order.

### 1. Structure

- Is the page organized around the user's real workflow?
- Is there one obvious primary action?
- Are secondary actions grouped where users expect them?
- Are tabs, filters, and menus doing distinct jobs?
- Can the page be scanned in under five seconds?

### 2. UX

- Golden paths for each role: admin, staff, student, requester, read-only where applicable
- State matrix: loading, empty, filtered empty, error, success, slow network, expired session
- URL behavior: query params, back button, deep links, selected row persistence, pagination
- Action feedback: disabled state, optimistic update, toast, row refresh, focus return
- Misclick risk: destructive actions, bulk actions, nested interactive controls

### 3. UI

Use `make-interfaces-feel-better` when visual detail work is material.

- Density and rhythm match the best comparable page
- shadcn/ui components are used for primitives
- Buttons use icons for recognizable actions when available
- Hit areas are at least 40px
- Text wraps cleanly on narrow and wide layouts
- Dynamic numbers use tabular numerals where layout shift matters
- Transitions specify exact properties

### 4. Consistency

- Match existing naming, route, service, query, and mutation patterns
- Avoid new one-off components unless they remove real duplication
- Reuse shared filters, list rows, sheets, dialogs, badges, empty states, and form controls where they already fit
- If the target page produces a better pattern, list other pages that should adopt it

### 5. Hardening

- Server-side auth and role checks match the UI
- Mutations use POST, PATCH, or DELETE with validation
- Zod covers body, query, and route params where applicable
- No N+1 query path on common list/detail loads
- Double-submit and rapid-click paths are guarded
- Concurrent edits and stale data fail clearly
- Errors do not leak internals
- Export and bulk operations are bounded

### 6. Verification

- Run focused type/test/build checks appropriate to the touched files
- Prefer safe app-only verification in this repo: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`
- Do not use `npm run build` as the only gate when the change does not need remote Neon migration deploy
- Use browser verification for visible page work when practical
- Check console, network, desktop/tablet width, and the changed interaction path
- Treat phone-width web checks as smoke tests only. The web app does not need phone-first polish because phone workflows belong in the iOS app.

## Plan and implementation

For non-trivial work:

1. Add or update a plan in `tasks/<page>-ownership-pass.md` or the existing active page plan.
2. Keep slices independently testable:
   - Structure and shared component extraction
   - UX flow cleanup
   - UI polish
   - Hardening and API/service fixes
   - Tests and docs
3. Implement the smallest coherent slice that improves the page without leaving a broken midpoint.
4. After each slice, verify and update the plan.
5. If a better page pattern emerges, add a propagation section:
   - Adopt now
   - Defer with reason
   - Do not adopt because the workflow differs

When the user says `all`, `go`, `yes`, `keep rolling`, or `next`, continue through the obvious approved P0/P1/consistency work without asking for each small step.

## Output record

For substantial passes, write or update a task file with:

```markdown
# <Page> Ownership Pass - <YYYY-MM-DD>

## Goal
- <what the page or slice should feel/do like when done>

## Peer patterns checked
- <page>: <pattern learned>

## Plan
- [ ] Structure
- [ ] UX
- [ ] UI
- [ ] Consistency
- [ ] Hardening
- [ ] Verification
- [ ] Docs

## Propagation candidates
- [ ] <other page>: <pattern to consider>

## Review
- Shipped:
- Verified:
- Deferred:
```

Keep the record practical. Do not create a design essay unless the user asks for one.

## Docs and task sync

When functionality ships:

- Update the relevant `docs/AREA_<PAGE>.md` change log and acceptance criteria
- Update `docs/GAPS_AND_RISKS.md` when a gap closes or a new deferred risk is identified
- Update `tasks/lessons.md` only for correction-worthy patterns or durable rules
- Archive completed plan files when all slices are shipped

## Stop conditions

Stop and re-plan if:

- Current code contradicts the plan
- Two consecutive verification or approach attempts fail
- A change would require schema or permission behavior outside the approved slice
- Peer pages disagree and the product direction is ambiguous

In those cases, summarize the conflict with file evidence and propose the next smallest safe move.
