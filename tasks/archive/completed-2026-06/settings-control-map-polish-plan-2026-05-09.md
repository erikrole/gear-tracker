# Settings Control Map Polish Plan - 2026-05-09

## Goal

Make `/settings` feel like a deliberate operator control map, not a passive index of links. Keep this slice focused on the hub and shared Settings navigation; do not change settings permissions, mutation behavior, or subpage forms.

## Peer patterns checked

- Reports: rounded tab shell with an obvious active section and quiet card rhythm.
- Inventory Hygiene: compact metrics, strong operational wording, and link rows with clear targets.
- Settings subpages: current role-aware section metadata and grouped IA already live in `SETTINGS_SECTIONS`.

## Plan

- [x] Structure: Add `/settings` as an active Overview entry in the Settings nav.
- [x] UX: Surface visible section counts, role context, and resume behavior more clearly.
- [x] UI: Tighten card headers, link rows, badges, focus states, and numeric rhythm.
- [x] Consistency: Keep using `SETTINGS_SECTIONS`, shadcn primitives, and existing group metadata.
- [x] Verification: Run TypeScript, migration-prefix, whitespace, build, and browser smoke.
- [x] Docs: Update Settings area doc and task queue.

## Propagation candidates

- [ ] Settings subpages: consider adopting the rounded nav shell if browser smoke confirms it reads better across dense admin pages.
- [ ] Other admin hubs: use visible-role/count summaries when a page is a map rather than a workflow.

## Review

- Shipped: Settings nav now includes an active Overview entry and uses the same rounded shell rhythm as Reports. The `/settings` control map now shows the current role, visible section/group counts, role badges per destination, tighter group cards, focus-visible row treatment, and tabular count badges.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. Authenticated Chrome DevTools smoke rendered `/settings` and `/settings/departments`; Overview and Departments active states were correct, console was clean, and replaced stale fetches completed with 200 responses.
- Deferred: Subpage form/table polish remains out of scope for this slice.
