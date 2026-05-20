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
- Prisma model rename `Guide` → `Resource` shipped in Slice 2 with migration `0068_rename_guides_to_resources`.
- DB table renamed from `guides` to `resources`; internal `@/lib/guides` service names remain compatibility wrappers.
- New filtering primitives (saved filters, multi-select).
- Bulk admin tools.

### Acceptance Criteria
- [x] Sidebar shows "Resources" → `/resources`
- [x] `/resources` renders with left rail + results grid
- [x] Filter rail collapses former Area + Reference + Utility cards into one grouped vertical list with counts
- [x] No "Featured for you" strip; featured cards carry a Featured badge
- [x] Search input lives at the top of the results column
- [x] Category pill row removed (categories live in the rail)
- [x] `/resources/new`, `/resources/[slug]`, `/resources/[slug]/edit` all work
- [x] `/api/resources` endpoints functional
- [x] Visiting `/guides` redirects to `/resources` (and `/guides/[slug]` → `/resources/[slug]`)
- [x] STAFF/ADMIN see "New Resource" CTA; STUDENT does not
- [x] Contacts directory hidden unless rail filter = Contacts
- [x] Mobile: rail collapses to a top filter sheet
- [x] `npm run build` passes

### Verification Plan
- `npx tsc --noEmit`
- `npm run build`
- Manual smoke: `/resources`, switch filters, search, open a guide, edit (as staff), check `/guides` redirect.

## Slices
1. **Slice 1** — Route rename + UI rebuild + sidebar + redirects.
2. **Slice 2** — Prisma model `Guide` → `Resource`, table rename to `resources`, route RBAC/audit identity rename, migration apply, and route smoke.

## Slice 2 Review

- Shipped migration `0068_rename_guides_to_resources`, preserving existing data while renaming the live Neon table from `guides` to `resources`.
- Prisma now exposes `Resource` / `db.resource`; the existing `@/lib/guides` service remains as the compatibility service for route/page code.
- `/api/resources` routes now require `resource.*` permissions and write `resource_*` audit actions with `entityType: "resource"`.
- Verified live Neon has `public.resources`, no `public.guides`, and the existing resource count survived the rename.
- Verified `/resources` compiles and redirects unauthenticated requests to `/login`, `/api/resources` returns the expected unauthenticated 401, and `/guides` redirects to `/resources`.
