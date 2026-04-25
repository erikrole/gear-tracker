# AREA: Guides

## Document Control
- Owner: Erik Role (Wisconsin Athletics Creative)
- Status: Shipped
- Created: 2026-04-14
- Brief: `tasks/guides-plan.md` (archived)

## Description
In-app replacement for Google Docs as the home for Wisconsin Athletics Creative SOPs and how-to guides. Staff author rich documents using BlockNote; students read them in-app. Flat list with category filter — no folder tree needed.

## Components
- `/guides` — list page with category filter chips, search, card grid
- `/guides/[slug]` — server-rendered reader with BlockNote view
- `/guides/new` — create page (Staff/Admin only)
- `/guides/[slug]/edit` — edit page with publish toggle and admin delete

## Data Model
`Guide` model in `prisma/schema.prisma`:
- `id`, `title`, `slug` (unique, auto-generated from title), `category` (freeform)
- `content` (Json — BlockNote `Block[]` array)
- `published` (boolean, default false)
- `authorId` → `User` (Restrict on delete)

Migrations: `prisma/migrations/0032_add_guides/migration.sql`, `prisma/migrations/0045_drop_guide_order/migration.sql` (drops unused `order` column)

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
- `listGuides({ published?, category?, search? })`
- `getGuide(id)`, `getGuideBySlug(slug)`
- `createGuide(...)` — auto-slugifies title, handles collision with `-2`, `-3` suffix
- `updateGuide(id, patch, editorRole, editorId)` — STAFF restricted to own guides; regenerates slug only if title changed
- `deleteGuide(id)`

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/guides` | All | List guides; STUDENT sees published only |
| POST | `/api/guides` | STAFF/ADMIN | Create guide |
| GET | `/api/guides/[id]` | All | Single guide by ID or slug |
| PATCH | `/api/guides/[id]` | STAFF/ADMIN | Update guide |
| DELETE | `/api/guides/[id]` | ADMIN | Delete guide |
| POST | `/api/guides/upload-image` | STAFF/ADMIN | Upload image to Vercel Blob; returns `{ url }`. Max 10MB per image. Used by BlockNote `uploadFile` handler to avoid base64 inlining. |

## Acceptance Criteria Status

| ID | Criterion | Status |
|----|-----------|--------|
| AC-1 | Staff can create, edit, publish, and delete guides without leaving the app | ✅ Complete |
| AC-2 | Students can read published guides; drafts are invisible to them | ✅ Complete |
| AC-3 | Category filter chips reduce the list correctly | ✅ Complete |
| AC-4 | BlockNote editor supports headings, lists, code blocks, callouts | ✅ Complete |
| AC-5 | Guide reader renders cleanly on mobile | ✅ Complete (max-w-5xl, responsive) |
| AC-6 | Every mutation is audit-logged | ✅ Complete |
| AC-7 | `npm run build` passes | ✅ Complete |

## Change Log
| Date | Change |
|------|--------|
| 2026-04-14 | Feature shipped: schema (Guide model + migration 0032), service, API routes, list page, reader, create/edit pages, sidebar nav entry. All ACs met. |
| 2026-04-15 | Image upload to Vercel Blob: added `/api/guides/upload-image` route; wired BlockNote `uploadFile` on create/edit pages. Prevents 413 errors from base64-inlined images. Editor canvas widened to `max-w-5xl` / `min-h-600px`; reader matched. |
| 2026-04-25 | MVP audit follow-up (`tasks/audit-guides-web.md`): (1) edit page Cancel + Back link now confirm before discarding unsaved changes; (2) reader's Edit button respects STAFF authorship — only ADMIN or the guide's own author sees it (server PATCH enforcement was already correct); (3) ToC keyed by BlockNote block id instead of heading text — duplicate heading labels no longer break scroll/active state; (4) `/api/guides/upload-image` now rate-limited to 30 uploads / 5 min per user. |
| 2026-04-25 | P2 audit cleanup: (1) dropped unused `order` column via migration 0045; list now sorts by `updatedAt` desc only. (2) PATCH `/api/guides/[id]` now supports optimistic concurrency via `expectedUpdatedAt`; returns 409 if guide changed since load. (3) Filtered empty state on `/guides` offers a Clear-filters action. (4) `/guides/new` and `/guides/[slug]/edit` are now server components that gate via `requireAuth` + role check, eliminating the editor-flash-then-redirect for STUDENT. (5) GET `/api/guides/[id]` detects cuid format and routes directly — single DB read for slug lookups. |
