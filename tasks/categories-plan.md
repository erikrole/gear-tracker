# Categories Feature Plan

## Summary
Wire in a proper Category model with parent-child hierarchy, a Settings > Categories management page, and integrate categories into the items workflow.

## Current State
- No `Category` model — `Asset.type` and `BulkSku.category` are free-text strings
- No `/settings` route exists
- Categories in create forms are plain text inputs

## Target (from screenshot)
- Settings > Categories page with hierarchical tree view
- Parent categories (bold) with indented subcategories (prefixed with arrow)
- Item count badges (purple) per category
- Search, sort by name, kebab menu per row
- "Add new category" button (top right)
- Left sidebar with description text

---

## Slice 1: Schema + Migration

- [ ] Add `Category` model to Prisma schema:
  - `id` (cuid), `name` (String), `parentId` (String?, self-ref FK)
  - `createdAt`, `updatedAt`
  - Self-relation: `parent` / `children`
  - `@@unique([name, parentId])` to prevent duplicate siblings
  - `@@map("categories")`
- [ ] Run `npx prisma migrate dev`
- [ ] Add `categoryId` (optional FK) to `Asset` model (keep `type` field for now)
- [ ] Add `categoryId` (optional FK) to `BulkSku` model (keep `category` field for now)

## Slice 2: Categories API

- [ ] `GET /api/categories` — return all categories with `_count` of linked assets + bulkSkus, nested as tree
- [ ] `POST /api/categories` — create category (name, parentId?), ADMIN/STAFF only
- [ ] `PATCH /api/categories/[id]` — rename or reparent
- [ ] `DELETE /api/categories/[id]` — delete if no linked items (or reassign), ADMIN only
- [ ] Audit log on all mutations

## Slice 3: Settings Layout + Categories Page

- [ ] Create `/settings` layout with breadcrumb (Settings > Categories)
- [ ] Left sidebar: title "Categories", description text, "Read more" button
- [ ] Main content: search input, sortable "Name" column header
- [ ] Category rows: parent rows bold, child rows indented with arrow prefix
- [ ] Purple item count badge per category (asset count + bulk SKU count)
- [ ] Kebab menu per row (Rename, Add subcategory, Delete)
- [ ] "Add new category" button in top-right
- [ ] Add "Settings" link to Sidebar nav (gear icon), before Profile

## Slice 4: Wire Categories into Items

- [ ] Items create form: replace free-text category with category dropdown
- [ ] Items list: display category name from relation instead of raw `type` string
- [ ] Item detail: show category name, editable via dropdown
- [ ] Category filter on items list (dropdown from categories API)

---

## Decisions
- Keep `Asset.type` and `BulkSku.category` string fields for now (backward compat during migration)
- New `categoryId` FK is optional — existing items keep working with string field
- UI shows category from relation when set, falls back to string field
- Migration script to backfill categoryId from existing type/category strings is a future task

## Files to Create
- `prisma/migrations/[timestamp]_add_categories/migration.sql`
- `src/app/api/categories/route.ts`
- `src/app/api/categories/[id]/route.ts`
- `src/app/(app)/settings/layout.tsx`
- `src/app/(app)/settings/page.tsx` (redirect to categories)
- `src/app/(app)/settings/categories/page.tsx`

## Files to Modify
- `prisma/schema.prisma` — add Category model, add FKs to Asset/BulkSku
- `src/components/Sidebar.tsx` — add Settings nav item
- `src/app/globals.css` — settings page styles
- `src/app/(app)/items/page.tsx` — category dropdown in create + filter
