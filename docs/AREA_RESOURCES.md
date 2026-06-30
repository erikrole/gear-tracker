# AREA: Resources

> Renamed from "Guides" on 2026-05-19. URLs `/guides*` permanently redirect to `/resources*`. The Prisma model is now `Resource`; `@/lib/guides` keeps its service name as a compatibility wrapper around resource records.

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: Shipped
- Created: 2026-04-14
- Last Updated: 2026-06-30
- Brief: `tasks/guides-plan.md` (archived)

## Description
In-app Markdown Guide library for Wisconsin Athletics Creative operational reference: contact numbers, building numbers, Media Drive context, server paths, SOPs, how-to guides, account notes, troubleshooting steps, event operations, and general information. Staff break broad reference material into focused Guides in a Markdown WYSIWYG editor; students read published Guides in-app. The landing page is guide-first: search/filter toolbar, cards/list browsing, compact server-path copy utility, and supporting Contacts plus Sport assignments references stay below the Guide results instead of competing with them.

## Components
- `/resources` — first-class Guide library landing page with a top operational toolbar for search, guide focus, sort, and cards/list layout. It puts Guide results first, keeps a compact copyable Media Drive server path in the header, and shows Contacts plus Sport assignments as supporting references. URL-backed via `filter`, `category`, `q`, `sort`, and `layout` params while preserving legacy `view` and `area` compatibility.
- `/resources/[slug]` — Markdown reader with editorial document styling, polished image treatment, sticky desktop table of contents, quiet update metadata, and an allowed-editor Mark verified action
- `/resources/new` — create page (Staff/Admin only) with a typed Guide focus selector and starter templates for Contacts, Building Numbers, Media Drive, Server Paths, SOPs, and Troubleshooting
- `/resources/[slug]/edit` — edit page with typed Guide focus, publish toggle, unsaved-change guard, and admin delete
- Native iOS Guides - read-only SwiftUI list and reader backed by `/api/resources`, reachable from compact Browse and Settings > Directory on iPhone and as a sidebar-only Resources destination on regular-width iPad. Authoring, deletion, verification, Contacts, and sport-assignment reference tools remain web-owned.

## Data Model
`Resource` model in `prisma/schema.prisma`:
- `id`, `title`, `slug` (unique, auto-generated from title), `category` (freeform)
- `type` (`ResourceType` enum: Contacts, Building Numbers, Media Drive, Server Paths, SOP, How-to, Troubleshooting, Account Note, Event Ops, General)
- `markdown` (Text — Markdown source of truth)
- `targetRoles` (`Role[]` — empty means all roles)
- `targetAreas` (`ShiftArea[]` — empty means all areas)
- `featured`, `featuredRank` (admin-curated priority metadata retained for ranking/backwards compatibility, not shown as a visible pinned section in the cleaned landing UI)
- `lastVerifiedAt`, `lastVerifiedById` → `User` (nullable freshness signal for living knowledge-base entries)
- `content` (Json — legacy BlockNote `Block[]` array retained for backwards-compatible conversion)
- `published` (boolean, default false)
- `authorId` → `User` (Restrict on delete)

Migrations: `prisma/migrations/0032_add_guides/migration.sql`, `prisma/migrations/0045_drop_guide_order/migration.sql` (drops unused `order` column), `prisma/migrations/0057_add_guide_markdown/migration.sql`, `prisma/migrations/0058_guide_personalization/migration.sql`, `prisma/migrations/0061_add_guide_freshness/migration.sql`, `prisma/migrations/0068_rename_guides_to_resources/migration.sql`, `prisma/migrations/0087_resource_type/migration.sql`

## Auth Rules
| Action | Roles |
|--------|-------|
| Read published guides | All (STUDENT, STAFF, ADMIN) |
| Read draft guides | STAFF, ADMIN |
| Create | STAFF, ADMIN |
| Edit | STAFF (own only), ADMIN (any) |
| Delete | ADMIN only |

All mutations use `createAuditEntry` per D-007.

## Service
`src/lib/guides.ts`:
- `listGuides({ published?, category?, search?, audience? })` — returns list summaries extracted from Markdown, with legacy BlockNote fallback; when `audience` is present, featured guides and role/area matches are ranked first
- `getGuideAudience(userId, fallbackRole)` — loads role, primary area, and area assignments for guide ranking
- `getGuide(id)`, `getGuideBySlug(slug)`
- `createGuide(...)` — auto-slugifies title, handles collision with `-2`, `-3` suffix
- `updateGuide(id, patch, editorRole, editorId)` — STAFF restricted to own guides; regenerates slug only if title changed
- `deleteGuide(id)`

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/resources` | All | List resources; STUDENT sees published only |
| POST | `/api/resources` | STAFF/ADMIN | Create resource |
| GET | `/api/resources/[id]` | All | Single resource by ID or slug |
| PATCH | `/api/resources/[id]` | STAFF/ADMIN | Update resource |
| DELETE | `/api/resources/[id]` | ADMIN | Delete resource |
| POST | `/api/resources/upload-image` | STAFF/ADMIN | Upload image to Vercel Blob; returns `{ url }`. Max 10MB per image. Used by the Markdown editor image upload handler. |

## Acceptance Criteria Status

| ID | Criterion | Status |
|----|-----------|--------|
| AC-1 | Staff can create, edit, publish, and delete guides without leaving the app | ✅ Complete |
| AC-2 | Students can read published guides; drafts are invisible to them | ✅ Complete |
| AC-3 | Category filter chips reduce the list correctly | ✅ Complete |
| AC-4 | Markdown editor supports headings, lists, code blocks, tables, links, and images | ✅ Complete |
| AC-5 | Guide reader renders cleanly on mobile | ✅ Complete (max-w-5xl, responsive) |
| AC-6 | Every mutation is audit-logged | ✅ Complete |
| AC-7 | `npm run build` passes | ✅ Complete |
| AC-8 | Guides function as a focused library for contacts, building numbers, Media Drive, server paths, SOPs, how-to guides, troubleshooting, accounts, event ops, and reference notes | ✅ Complete |
| AC-9 | Guides landing page prioritizes guide discovery and role/area-relevant browsing without a pinned/featured block | ✅ Complete |
| AC-10 | Individual guides render as polished editorial knowledge-base articles with theme-aware styling, photos, and desktop TOC | ✅ Complete |
| AC-11 | Contacts reference view can surface current user profile contact fields without duplicating them in Markdown | ✅ Complete |
| AC-12 | Living guides store verification metadata and can be marked verified by allowed editors without showing freshness badges in the cleaned-up reader/list UI | ✅ Complete |
| AC-13 | Resources supports cards/list browsing, typed Guide focus filters, Creative-area Guide lanes, compact server-path copy, and supporting Contacts/Sport assignment references | ✅ Complete |

## Change Log
| Date | Change |
|------|--------|
| 2026-06-30 | Native iOS Browse now makes Guides a first-class compact tab destination through the system Browse menu. Settings > Directory remains a fallback path, and regular-width iPad still exposes Guides as a sidebar-only Resources destination. |
| 2026-06-30 | Native iOS Guides replaced the previous web fallback with a read-only SwiftUI page. The native page loads the existing Resources list contract, supports pull-to-refresh, native search, focus filtering, recommended/recent/title sorting, and a lightweight Markdown reader for published guides and staff/admin draft visibility. No edit, delete, mark-verified, Contacts, or sport-assignment tools moved to iOS. |
| 2026-06-29 | Resources landing cleanup made Guides the first default section, removed the Guide collection tile wall and Featured guides block, added a compact header copy control for `smb://ath01-nas.uwia.wisc.edu/users/`, demoted Contacts into a compact reference summary on the landing page, and added read-only Sport assignments through `filter=assignments` backed by `/api/users` sport assignment data. |
| 2026-06-29 | Resources cleanup removed visible Verified/Needs review freshness badges from landing guide cards, list rows, and reader headers while preserving stored verification metadata and the allowed-editor Mark verified action. |
| 2026-06-28 | Resources first-class Guide library pass: added `ResourceType` typed focus with migration/backfill, preserved legacy URL filter compatibility while adding `layout=cards/list`, rebuilt `/resources` around Guide collections, area guide lanes, cards/list results, and supporting Contacts, and updated create/edit/reader surfaces to expose typed Guide focus. Verified with focused Resources tests, Prisma format/generate, TypeScript, docs checks, whitespace check, and build-app. |
| 2026-06-03 | Fixed a search regression: the `/resources` landing search again matches full document body text, not just title/category/author/summary. The 2026-05-19 directory rebuild had dropped the body (Markdown) term from the client-side `guideSearchText`, silently regressing the body-text search shipped 2026-05-10/2026-05-09. The body is already in the list payload, so the fix is client-side and mirrors the server `listGuides` search. Verified with `npx tsc --noEmit` and `npx next build`. |
| 2026-05-25 | Web bug sweep Batch 26 hardened Resources URL parsing and sort control display. `/resources` now preserves compatibility with legacy guide links using `view=` and `area=`, invalid `sort=` params fall back to Personalized, and the closed sort trigger shows the selected label instead of an empty combobox. |
| 2026-05-24 | Web bug sweep Batch 9 hardened Resources create/edit/delete/image-upload/mark-verified actions with shared auth redirect handling, safe JSON parsing, clearer server-error toasts, incomplete-response guards, and ref-backed duplicate-action prevention. |
| 2026-05-21 | Design-language cleanup moved Resources active filter removals to shared `OperationalActiveFilterChips`, replaced the native sort select with shadcn `Select`, and raised search/filter/sort/contact controls to the 40px operational target baseline while preserving the Resources rail exception. |
| 2026-05-19 | Slice 2 closeout: Prisma model renamed from `Guide` to `Resource`, the database table was renamed from `guides` to `resources`, resource routes now use `resource` RBAC/audit identities, and Vercel Blob uploads now write under `resources/`. Migration `0068_rename_guides_to_resources` was applied to Neon and verified with `/resources` route smoke. |
| 2026-05-19 | Renamed Guides to Resources: routes moved to `/resources*` (old `/guides*` 301-redirect via `next.config.ts`), sidebar entry relabeled, and the landing page rebuilt as a directory with a sticky left filter rail, top search + sort toolbar, active-filter chips, and Featured badges. Removed the "Featured for you" strip and the three stacked quick-card grids; Contacts directory now shows only under the Contacts filter. |
| 2026-05-10 | Guides review fixes: landing search now matches full Markdown guide text beyond card summaries, reader heading IDs stay aligned with ToC IDs for rich headings, and partial featured-rank PATCHes preserve or clear rank from the final featured state. |
| 2026-05-10 | Guide freshness closeout: guides now store last verification metadata, show Verified/Needs review badges on landing cards and reader pages, and allowed editors can mark entries verified from the reader. |
| 2026-05-10 | URL-backed Guides navigation: `/guides` now preserves search, category, area, and reference filters in query params so links such as `/guides?view=contacts`, `/guides?view=media-drive`, and `/guides?area=video` are shareable and reload-safe. |
| 2026-05-10 | Contacts filter polish: the live Contacts directory now filters by role and Creative area, and staff/admin can isolate missing phone or missing Slack profile data for cleanup. |
| 2026-05-10 | Slack profile links: Guides Contacts now keeps `@handle` as display/search text and opens Slack only when the synced user profile has a real Slack profile URL saved. |
| 2026-05-10 | Live Contacts directory: the Contacts reference view now pulls active users from the Users API and shows current avatar, role, title/year, email, phone, Slack handle, area, location, and profile link. |
| 2026-05-10 | Guides reference navigation: `/guides` now separates Creative area browsing from reference browsing, with first-class Contacts, Building Numbers, Media Drive, and Server Paths cards plus starter templates for Building Numbers and Media Drive entries. |
| 2026-05-10 | Living knowledge-base authoring upgrade: new guide starter templates now seed reference tables, copyable snippets, quote notes, owner fields, and last-verified metadata for Contacts, Server Paths, SOPs, and Troubleshooting entries. |
| 2026-05-10 | Living knowledge-base reader upgrades: guide headings now expose copyable deep links, fenced code blocks and reference tables have copy actions, and code/quote styling is tuned for operational snippets. |
| 2026-05-10 | Guides code and quote polish: Markdown inline code, fenced code blocks, and restored BlockNote quote blocks now render with dedicated theme-aware reader styling. |
| 2026-05-10 | Guides table presentation polish: Markdown tables now render as compact, theme-aware reference tables with stronger grid lines, header weight, and horizontal overflow protection. |
| 2026-05-10 | Markdown conversion fidelity fix: legacy BlockNote quotes, dividers, tables, bold text, and inline code now survive conversion; the existing Photo Mechanic + Lightroom guide was regenerated so the Hotkeys table and formatting render in the Markdown reader. |
| 2026-05-10 | Guides reader editorial polish: individual guide pages now use a theme-aware article shell, Gotham-forward section rhythm, upgraded sticky desktop table of contents, and larger captioned Markdown image treatment. |
| 2026-05-10 | Guides landing page personalization: added admin-curated featured guide fields, role/area targeting, server-side audience ranking, top featured cards, quick filters for Contacts/Server Paths/Recently Updated/My Area, and create/edit controls for guide priority. |
| 2026-05-09 | Guides editor migrated from BlockNote JSON to Markdown via MDXEditor + React Markdown rendering. `Guide.markdown` is now the durable source of truth, existing BlockNote content has a conversion fallback, and the existing Photo Mechanic + Lightroom guide was converted in the configured database for visual review. |
| 2026-05-09 | Authoring speed pass: new guide creation now includes starter templates for Contacts, Server Paths, SOPs, and Troubleshooting so staff can seed common knowledge-base entries without starting from a blank editor canvas. |
| 2026-05-09 | Guides reframed as an all-purpose Creative knowledge base: list cards now show text previews, search includes title/category/author/extracted Markdown text, empty states and create/edit language cover contacts, server paths, SOPs, how-to notes, and general reference entries. |
| 2026-05-08 | API hardening Wave 7: guide create/update now sanitizes stored BlockNote JSON recursively, stripping scriptable strings and prototype-pollution keys before content reaches storage. |
| 2026-05-08 | API hardening Wave 13: guide image uploads sanitize the original filename to a safe leaf name before writing to Blob storage. |
| 2026-04-14 | Feature shipped: schema (Guide model + migration 0032), service, API routes, list page, reader, create/edit pages, sidebar nav entry. All ACs met. |
| 2026-04-15 | Image upload to Vercel Blob: added `/api/guides/upload-image` route; wired BlockNote `uploadFile` on create/edit pages. Prevents 413 errors from base64-inlined images. Editor canvas widened to `max-w-5xl` / `min-h-600px`; reader matched. |
| 2026-04-25 | MVP audit follow-up (`tasks/audit-guides-web.md`): (1) edit page Cancel + Back link now confirm before discarding unsaved changes; (2) reader's Edit button respects STAFF authorship — only ADMIN or the guide's own author sees it (server PATCH enforcement was already correct); (3) ToC keyed by BlockNote block id instead of heading text — duplicate heading labels no longer break scroll/active state; (4) `/api/guides/upload-image` now rate-limited to 30 uploads / 5 min per user. |
| 2026-04-25 | P2 audit cleanup: (1) dropped unused `order` column via migration 0045; list now sorts by `updatedAt` desc only. (2) PATCH `/api/guides/[id]` now supports optimistic concurrency via `expectedUpdatedAt`; returns 409 if guide changed since load. (3) Filtered empty state on `/guides` offers a Clear-filters action. (4) `/guides/new` and `/guides/[slug]/edit` are now server components that gate via `requireAuth` + role check, eliminating the editor-flash-then-redirect for STUDENT. (5) GET `/api/guides/[id]` detects cuid format and routes directly — single DB read for slug lookups. |
