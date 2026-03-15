# Categories Feature Plan

## Summary
Wire in a proper Category model with parent-child hierarchy, a Settings > Categories management page, and integrate categories into the items workflow.

## Status: All slices shipped (2026-03-15)

---

## Slice 1: Schema + Migration

- [x] Add `Category` model to Prisma schema
- [x] Run migration
- [x] Add `categoryId` (optional FK) to `Asset` model
- [x] Add `categoryId` (optional FK) to `BulkSku` model

## Slice 2: Categories API

- [x] `GET /api/categories` — return all with item counts
- [x] `POST /api/categories` — create (ADMIN/STAFF)
- [x] `PATCH /api/categories/[id]` — rename or reparent
- [x] `DELETE /api/categories/[id]` — delete with linked-item guard
- [x] Audit log on all mutations

## Slice 3: Settings Layout + Categories Page

- [x] `/settings` layout with breadcrumb
- [x] Left sidebar with description
- [x] Search, sortable Name column
- [x] Hierarchical tree with parent bold / child indented
- [x] Purple item count badges
- [x] Kebab menu (Rename, Add subcategory, Delete)
- [x] "Add new category" button

## Slice 4: Wire Categories into Items

- [x] Serialized item create form: category dropdown (items/page.tsx)
- [x] Bulk item create form: category dropdown (items/page.tsx + bulk-inventory/page.tsx)
- [x] Items list: display `category?.name || type`
- [x] Item detail: CategoryField with dropdown + inline create
- [x] Category filter chip on items list
- [x] Bulk SKU API: accept + save `categoryId` on create
- [x] Bulk SKU API: return `categoryRel` in GET response
- [x] Bulk inventory page: category dropdown + display from relation

---

## Decisions
- Keep `Asset.type` and `BulkSku.category` string fields (backward compat)
- `categoryId` FK is optional — fallback to string field in display
- Migration to backfill categoryId from strings is a future task
