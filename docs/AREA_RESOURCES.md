# AREA: Resources

> Renamed from "Guides" on 2026-05-19. URLs `/guides*` permanently redirect to `/resources*`. The Prisma `Guide` model and `@/lib/guides` service retain their internal names (a future slice covers the model rename).

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: Shipped
- Created: 2026-04-14
- Brief: `tasks/guides-plan.md` (archived)

## Description
In-app Markdown knowledge base for Wisconsin Athletics Creative operational reference: contact numbers, building numbers, Media Drive context, server paths, SOPs, how-to guides, account notes, troubleshooting steps, and general information. Staff author documents in a Markdown WYSIWYG editor; students read published entries in-app. The landing page is role- and area-aware: admin-curated featured guides appear first, then users can browse by Creative area or reference category while ranked entries stay personalized for the viewer's app role and Creative area.

## Components
- `/resources` — directory landing page with a sticky left filter rail (All / Smart: Recently Updated, My Area / By area: Video, Photo, Graphics, Comms / Reference: Contacts, Building Numbers, Media Drive, Server Paths / category list), a top search + sort (Personalized, Recently updated, Title A-Z) toolbar, active-filter chips, resource freshness badges, Featured badge on cards, and a live Contacts directory that appears only when the Contacts filter is active. Rail collapses into a Filters sheet on mobile. URL-backed via `filter`, `category`, `q`, `sort` params.
- `/resources/[slug]` — Markdown reader with editorial document styling, polished image treatment, sticky desktop table of contents, verification metadata, and an allowed-editor Mark verified action
- `/resources/new` — create page (Staff/Admin only) with starter templates for Contacts, Building Numbers, Media Drive, Server Paths, SOPs, and Troubleshooting
- `/resources/[slug]/edit` — edit page with publish toggle and admin delete

## Data Model
`Guide` model in `prisma/schema.prisma`:
- `id`, `title`, `slug` (unique, auto-generated from title), `category` (freeform)
- `markdown` (Text — Markdown source of truth)
- `targetRoles` (`Role[]` — empty means all roles)
- `targetAreas` (`ShiftArea[]` — empty means all areas)
- `featured`, `featuredRank` (admin-curated landing-page priority)
- `lastVerifiedAt`, `lastVerifiedById` → `User` (nullable freshness signal for living knowledge-base entries)
- `content` (Json — legacy BlockNote `Block[]` array retained for backwards-compatible conversion)
- `published` (boolean, default false)
- `authorId` → `User` (Restrict on delete)

Migrations: `prisma/migrations/0032_add_guides/migration.sql`, `prisma/migrations/0045_drop_guide_order/migration.sql` (drops unused `order` column), `prisma/migrations/0057_add_guide_markdown/migration.sql`, `prisma/migrations/0058_guide_personalization/migration.sql`, `prisma/migrations/0061_add_guide_freshness/migration.sql`

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
| AC-8 | Guides function as a general knowledge base for contacts, building numbers, Media Drive, server paths, SOPs, and reference notes | ✅ Complete |
| AC-9 | Guides landing page prioritizes admin-featured entries and role/area-relevant guides | ✅ Complete |
| AC-10 | Individual guides render as polished editorial knowledge-base articles with theme-aware styling, photos, and desktop TOC | ✅ Complete |
| AC-11 | Contacts reference view can surface current user profile contact fields without duplicating them in Markdown | ✅ Complete |
| AC-12 | Living guides expose freshness state and can be marked verified by allowed editors | ✅ Complete |

## Change Log
| Date | Change |
|------|--------|
| 2026-05-19 | Renamed Guides to Resources: routes moved to `/resources*` (old `/guides*` 301-redirect via `next.config.ts`), sidebar entry relabeled, and the landing page rebuilt as a directory with a sticky left filter rail, top search + sort toolbar, active-filter chips, and Featured badges. Removed the "Featured for you" strip and the three stacked quick-card grids; Contacts directory now shows only under the Contacts filter. Prisma `Guide` model and `@/lib/guides` service keep internal names (model rename deferred to a follow-up slice). |
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
