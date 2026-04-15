# Guides Feature — Implementation Plan

**Created:** 2026-04-09  
**Status:** Planning — not started  
**Area:** New — AREA_GUIDES.md to be created on ship  

---

## Overview

Replace Google Docs as the home for Wisconsin Athletics Creative SOPs and how-to guides. Staff author rich documents using BlockNote; students read them in-app. Flat list + category filter — no folder tree needed.

**Installed packages:** `@blocknote/core`, `@blocknote/react`, `@blocknote/shadcn`

---

## Data Model

```prisma
model Guide {
  id         String   @id @default(cuid())
  title      String
  slug       String   @unique          // url-friendly, auto-generated from title
  category   String                    // "Photo" | "Video" | "Graphics" | freeform
  content    Json                      // BlockNote block JSON
  published  Boolean  @default(false)
  order      Int      @default(0)      // manual sort within a category
  authorId   String   @map("author_id")
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")
  author     User     @relation(fields: [authorId], references: [id])

  @@index([category])
  @@index([published])
}
```

No parent/child nesting. Internal document structure (Football, Basketball sections inside Clip Naming Guide) is handled by BlockNote headings.

---

## Routes

| Route | Access | Description |
|---|---|---|
| `/guides` | All | List page — category filter chips + search |
| `/guides/[slug]` | All | Read-only BlockNote view |
| `/guides/new` | Staff/Admin | Create guide — title, category, editor |
| `/guides/[slug]/edit` | Staff/Admin | Edit existing guide + publish toggle |

API:
- `GET /api/guides` — list (published only for students; all for staff/admin)
- `POST /api/guides` — create (staff/admin)
- `GET /api/guides/[id]` — single guide
- `PATCH /api/guides/[id]` — update title/content/category/published/order
- `DELETE /api/guides/[id]` — delete (admin only)

---

## Slice Plan

### Slice 1 — Schema + API (mergeable alone)
- [ ] Add `Guide` model to `prisma/schema.prisma`
- [ ] Generate and run migration (`0036_guides`)
- [ ] Regenerate Prisma client (`npx prisma generate`)
- [ ] Write `src/lib/guides.ts` — service functions:
  - `listGuides({ published?, category?, search? })` 
  - `getGuide(id)` and `getGuideBySlug(slug)`
  - `createGuide({ title, category, content, authorId })` — auto-slugify title
  - `updateGuide(id, patch)`
  - `deleteGuide(id)`
- [ ] `POST /api/guides` — auth guard: STAFF/ADMIN only, audit log
- [ ] `GET /api/guides` — published filter for STUDENT, all for STAFF/ADMIN
- [ ] `GET /api/guides/[id]`
- [ ] `PATCH /api/guides/[id]` — auth guard: STAFF/ADMIN; audit log
- [ ] `DELETE /api/guides/[id]` — auth guard: ADMIN only; audit log
- [ ] `npm run build` — verify clean

### Slice 2 — List + Reader pages (user-facing core loop)
- [ ] `/guides` list page:
  - Category filter chips (All + unique categories from DB)
  - Client-side search on title
  - Card grid or table — title, category badge, last updated
  - "New Guide" button (staff/admin only, links to `/guides/new`)
  - Published/Draft badge visible to staff on unpublished guides
  - Loading: Skeleton cards
  - Empty state: "No guides yet" (staff sees CTA to create one)
- [ ] `/guides/[slug]` reader page:
  - `BlockNoteView` with `editable={false}` — uses `@blocknote/shadcn` theme
  - Title + category badge in header
  - "Edit" button for staff/admin (links to `/guides/[slug]/edit`)
  - Back link to `/guides`
  - Breadcrumb: Guides > Category > Title
- [ ] Add "Guides" to sidebar nav (`BookOpenTextIcon` or `FileTextIcon`)
  - Lives in primary nav group alongside Schedule, Items, Bookings
- [ ] `npm run build` — verify clean

### Slice 3 — Create + Edit pages
- [ ] `/guides/new` page (staff/admin only):
  - Title input (auto-generates slug on first save)
  - Category input — combobox using existing categories + free-type new one
  - BlockNote editor (`useCreateBlockNote` + `BlockNoteView` editable)
  - Save as Draft / Publish toggle
  - Submit → POST /api/guides → redirect to reader
- [ ] `/guides/[slug]/edit` page (staff/admin only):
  - Same form, pre-populated from existing guide
  - Published toggle visible — switch between draft and published
  - Delete button (admin only) with confirmation dialog
  - Unsaved-changes warning before navigation (standard `beforeunload` guard)
  - Submit → PATCH /api/guides/[id] → redirect to reader
- [ ] `npm run build` — verify clean

### Slice 4 — Polish (ship separately if needed)
- [ ] Category management: rename/merge categories via settings (or just edit in-guide for now)
- [ ] Manual drag-to-reorder within category (updates `order` field)
- [ ] "Related guides" on item detail page (filter by category matching item type)
- [ ] Mobile read view audit — confirm BlockNote renders cleanly on 375px

---

## Key Implementation Notes

### BlockNote API pattern
```tsx
// Editor (create/edit pages)
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import "@blocknote/react/style.css";

const editor = useCreateBlockNote({
  initialContent: existingGuide?.content ?? undefined,
});

// Save: editor.document is the JSON to POST/PATCH
await fetch("/api/guides", {
  method: "POST",
  body: JSON.stringify({ ..., content: editor.document }),
});

// Reader (view page) — same component, editable=false
const editor = useCreateBlockNote({ initialContent: guide.content });
<BlockNoteView editor={editor} editable={false} />
```

### Slug generation
Auto-generate from title on create: `title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")`. Append `-2`, `-3` etc. on collision (catch P2002).

### Auth rules
- `GET /api/guides` — authenticated, role filters published field
- `POST /api/guides` — STAFF or ADMIN
- `PATCH /api/guides/[id]` — STAFF or ADMIN (STAFF can only edit their own; ADMIN can edit any)
- `DELETE /api/guides/[id]` — ADMIN only
- All mutations → `createAuditEntry` (D-007)

### Content storage
BlockNote's `editor.document` is a `Block[]` array. Store as Prisma `Json`. No sanitization needed for display since BlockNoteView is the renderer (not innerHTML). Safe.

---

## Acceptance Criteria

- [ ] Staff can create, edit, publish, and delete guides without leaving the app
- [ ] Students can read published guides; drafts are invisible to them
- [ ] Category filter chips reduce the list correctly
- [ ] BlockNote editor supports headings, lists, code blocks, callouts, images (Vercel Blob)
- [ ] Guide reader renders cleanly on mobile (375px)
- [ ] Every mutation is audit-logged
- [ ] `npm run build` passes after each slice

---

## Doc Sync (on ship)
- [ ] Create `docs/AREA_GUIDES.md`
- [ ] Add sidebar entry to `docs/AREA_MOBILE.md`
- [ ] Update `docs/GAPS_AND_RISKS.md` — no new gaps expected
- [ ] Update `tasks/todo.md` — add to Recently Shipped
- [ ] Move this file to `tasks/archive/guides-plan.md`
