# Resources Page — MVP Goal Plan

**Target:** Rename Guides → Resources. Cleaner directory listing, stronger layout, left filter rail.

## Phase 0 — Audit Notes
- Page lives at `src/app/(app)/guides/page.tsx` (~1070 lines) — three quick-card grids (Areas / Reference / Utility = 10 cards), a "Featured for you" strip, a category pill row, a live Contacts directory, and a results grid. Currently feels stacked and noisy.
- API: `src/app/api/guides/{route,[id],upload-image}/`. DB model `Guide` in `prisma/schema.prisma:1164`. Lib: `src/lib/guides.ts`, `src/lib/guide-ranking.ts`, `src/lib/guide-freshness.ts`.
- External /guides links: just `Sidebar.tsx:76`. External /api/guides callers: only files inside the guides feature itself.
- Primary user job: find the right operational reference (area guide, contact, server path, SOP) fast.
- Roles: all users. Authoring restricted to `STAFF`/`ADMIN`.
- What works today: ranking, freshness, contacts directory.
- What's prototype-level: three near-identical card grids, redundant Featured strip, category pill rail grows unbounded, no spatial hierarchy.

## MVP Bar

### Must Have
- New route `/resources` (+ children) with new layout.
- Sidebar label "Resources" linking to `/resources`.
- Single left filter rail (categories + areas + utility) replacing the three quick-card grids.
- Featured strip removed; featured guides surface via badge on cards in the main grid.
- Search + sort live above the result grid.
- Contacts directory only renders when "Contacts" filter is active (no more mingling).
- All internal `/guides/*` and `/api/guides/*` URLs migrated to `/resources/*` and `/api/resources/*`.
- Old `/guides*` paths redirect to `/resources*` (preserves bookmarks).
- Authoring permissions unchanged. Empty / loading / error states preserved.

### Must Not Include (V2)
- Prisma model rename `Guide` → `Resource` (slice 2 — migration with cascade rules).
- DB column / API payload key rename. Internal lib names stay `Guide`-prefixed.
- New filtering primitives (saved filters, multi-select).
- Bulk admin tools.

### Acceptance Criteria
- [ ] Sidebar shows "Resources" → `/resources`
- [ ] `/resources` renders with left rail + results grid
- [ ] Filter rail collapses former Area + Reference + Utility cards into one grouped vertical list with counts
- [ ] No "Featured for you" strip; featured cards carry a Featured badge
- [ ] Search input lives at the top of the results column
- [ ] Category pill row removed (categories live in the rail)
- [ ] `/resources/new`, `/resources/[slug]`, `/resources/[slug]/edit` all work
- [ ] `/api/resources` endpoints functional
- [ ] Visiting `/guides` redirects to `/resources` (and `/guides/[slug]` → `/resources/[slug]`)
- [ ] STAFF/ADMIN see "New Resource" CTA; STUDENT does not
- [ ] Contacts directory hidden unless rail filter = Contacts
- [ ] Mobile: rail collapses to a top filter sheet
- [ ] `npm run build` passes

### Verification Plan
- `npx tsc --noEmit`
- `npm run build`
- Manual smoke: `/resources`, switch filters, search, open a guide, edit (as staff), check `/guides` redirect.

## Slices
1. **Slice 1 (this PR)** — Route rename + UI rebuild + sidebar + redirects.
2. **Slice 2 (future)** — Prisma model `Guide` → `Resource` + migration + payload key rename.
