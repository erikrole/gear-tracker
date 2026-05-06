# Inventory Hygiene Center Plan

Status: Shipped
Started: 2026-05-06

## Goal

Ship the first admin/staff Inventory Hygiene Center slice as a read-only checklist that points admins to existing repair surfaces.

## Slice 1

- [x] Add `GET /api/inventory-hygiene` with counts and sample rows for high-value data quality issues.
- [x] Add `/items/hygiene` page with issue cards and direct links into Items, Bulk Inventory, Kits, and item detail pages.
- [x] Add Admin nav access.
- [x] Sync docs and todo.
- [x] Verify TypeScript, migration-prefix health, whitespace, and local Next build.

## Checks Included

- Missing category.
- Missing department.
- Missing primary scan code.
- Missing image.
- Duplicate scan identity across tag, QR, and primary scan code values.
- Retired items still in active kits.
- Camera bodies with no attachments.
- Active bulk SKUs below threshold.

## Out Of Scope

- Bulk repair mutations.
- Auto-fixes.
- New attachment slot schema.

## Review

Shipped 2026-05-06. The first slice adds a read-only hygiene center at `/items/hygiene` and `GET /api/inventory-hygiene`. It surfaces high-value cleanup issues with sample rows and direct links to existing repair surfaces. No mutation paths or auto-fixes were added.
