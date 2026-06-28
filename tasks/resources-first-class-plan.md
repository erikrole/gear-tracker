# Resources First-Class Guide Library Plan

Last updated: 2026-06-28

## Goal

Rebuild Resources as a first-class Guide library across the landing page, reader, create flow, and edit flow. The product job is to break the current one-master-Google-Doc mental model into focused, area-aware Guides while moving from freeform category-only records toward typed guide focus areas for Contacts, Building Numbers, Media Drive, Server Paths, SOPs, How-to, Troubleshooting, Accounts, Event Ops, and General references.

## Product Direction

- Scope is all Resources surfaces: `/resources`, `/resources/[slug]`, `/resources/new`, and `/resources/[slug]/edit`.
- Primary experience should read as a curated Guide library with cards, tiles, and list browsing, not an operational dashboard and not a generic document dump.
- User correction on 2026-06-28: keep visible cards/tiles/list of Guides. The design should help split a master Google Doc into smaller focused Guides by area and workflow.
- Contacts remain first-class inside Resources, with live profile-backed contacts continuing to sit alongside authored reference entries.
- Schema and API changes are allowed, but should be the smallest migration that preserves current data and route compatibility.

## Sources Read

- `AGENTS.md`
- `.agents/skills/gt-page/SKILL.md`
- `.agents/skills/shadcn/SKILL.md`
- `.agents/skills/make-interfaces-feel-better/SKILL.md`
- `docs/AREA_RESOURCES.md`
- `docs/DESIGN_LANGUAGE.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/app/(app)/resources/page.tsx`
- `src/app/(app)/resources/[slug]/page.tsx`
- `src/app/(app)/resources/[slug]/_components/GuideReader.tsx`
- `src/app/api/resources/route.ts`
- `src/app/api/resources/[id]/route.ts`
- `src/lib/guides.ts`
- `tests/resources-filters.test.ts`

## Current Findings

- `/resources` is still one large client page with a documented left-rail exception. That rail was useful for the rename MVP, but it makes the page feel like a filter demo rather than a focused Guide library.
- The data model has only freeform `category`, targeting arrays, featured rank, publish state, and verification metadata. Typed resource category/module fields are missing.
- Live Contacts are already first-class enough to keep, but they should support the Guide library instead of replacing it.
- Reader/editor language already uses "Guide" in component names and one visible back link. That is directionally correct; visible copy should consistently call authored records Guides while the nav/route remains Resources.
- Existing URL compatibility matters: current `filter`, `category`, `q`, `sort` params plus legacy `view` and `area` redirects should keep working.

## Slice Plan

### Slice 1: Typed Resource Contract

- Add a typed resource kind/module field to `Resource`, with a migration that backfills from existing `category` values.
- Keep `category` for backward-compatible display/search while making the typed field the UI navigation source.
- Update validation, service list/create/update paths, and audit snapshots to preserve the typed field.
- Add source-contract tests for legacy category backfill assumptions, URL filter compatibility, and list payload shape.

### Slice 2: Focused Guide Library Landing

- Replace the left rail/card grid with a Guide-library home that supports cards and list browsing.
- Use a compact top command surface for search, guide focus, sort, layout, and clear actions.
- Add first-class sections for Featured Guides, Guide collections, area guide lanes, Recently updated, and Contacts without making Contacts the primary product metaphor.
- Preserve shareable filters and active filter chips.
- Keep guide cards/list rows dense, stable, and shadcn-backed with focus type, freshness, audience, author, and updated metadata.

### Slice 3: Guide Reader Refresh

- Rebuild the reader shell around focused Guide article conventions.
- Keep Markdown rendering, heading anchors, copyable snippets/tables, verification metadata, edit permissions, and sticky ToC.
- Keep authored record language as Guide while Resources remains the route/nav area.
- Keep Mark verified stable-label pending behavior and consequence-aware error copy.

### Slice 4: Guide Breakout Authoring Refresh

- Rework create/edit around guide focus first, then title, area/role audience, publish state, featured state, and Markdown content.
- Keep starter templates, but route them through typed guide focus areas so staff can break the master doc into smaller focused Guides.
- Preserve optimistic concurrency and unsaved-change confirmations.
- Keep STAFF owner-only edit and ADMIN delete behavior.

### Slice 5: Docs And Verification

- Update `docs/AREA_RESOURCES.md`, `docs/DESIGN_LANGUAGE.md`, codemaps if needed, and this plan.
- Run focused Resources tests, validation/schema checks, TypeScript, docs verification, diff whitespace, build, and visible route smoke.

## Verification Checklist

- [x] Focused Resources tests: `npx vitest run tests/resources-filters.test.ts` plus new/updated resource contract tests.
- [x] Prisma: `npx prisma format`, `npx prisma generate`, and `npm run db:migrate:check` if a migration is added.
- [x] TypeScript: `npx tsc --noEmit`.
- [x] Docs: `npm run codemap` if codemap-owned files changed, then `npm run verify:docs`.
- [x] Whitespace: `git diff --check`.
- [x] Build: `npm run build:app`.
- [ ] Browser smoke for `/resources`, `/resources?filter=contacts`, `/resources/new`, `/resources/[slug]`, and `/resources/[slug]/edit` when an authenticated session is available. Authenticated `/resources` shell rendered, but `/api/resources` is blocked until `0087_resource_type` is applied to the current Neon database.

## Open Plan Checkpoint

- [x] User approved this plan before implementation.
- [x] Slice 1 shipped.
- [x] Slice 2 shipped.
- [x] Slice 3 shipped.
- [x] Slice 4 shipped.
- [ ] Slice 5 closeout completed.

## Review

- 2026-06-28: Resources now has a typed `ResourceType` contract, migration `0087_resource_type`, API/service validation for typed Guide focus, legacy category/type inference, and source tests for typed focus plus URL filter/layout compatibility.
- 2026-06-28: `/resources` was rebuilt as a first-class Guide library with guide collection tiles, cards/list layout, Creative-area guide lanes, active filter chips, and supporting live Contacts. `/resources/new`, `/resources/[slug]/edit`, and `/resources/[slug]` now expose Guide focus and use Guide-language copy.
- 2026-06-28: Verification passed: `npx vitest run tests/resource-types.test.ts tests/resources-filters.test.ts`, `npx prisma format`, `npx prisma generate`, `npm run db:migrate:check`, `npx tsc --noEmit`, `npm run codemap`, `npm run verify:docs`, `git diff --check`, and `npm run build:app`.
- 2026-06-28: Authenticated browser smoke logged in as the seeded admin and confirmed `/resources` renders the new Guide library shell, collection tiles, layout control, Contacts section, and empty All Guides state. Full runtime smoke is blocked until the current Neon database has `0087_resource_type` applied; `/api/resources` returns Prisma P2022 because `resources.type` is not present yet. Attempting to inspect/apply remote migration status was rejected by the environment usage limit.
