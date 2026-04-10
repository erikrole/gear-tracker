# AREA: Bulk Inventory Management

## Document Control
- Area: Bulk Inventory Management
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-04-09
- Status: Active
- Version: V1

## Direction
Track non-serialized (bulk) inventory — quantities of identical items (e.g., 50 tennis balls, 10 athletic tapes). Support both quantity-only mode and numbered-unit mode (e.g., 10 numbered units of tape where each unit is individually tracked during checkout). Provide admin interface for adding units, converting between modes, and updating unit status.

## Core Rules
1. Bulk SKU is a named item with category, unit (e.g., "count", "pair", "roll"), bin QR code.
2. Two tracking modes: **Quantity-only** (just a number) or **Numbered** (individual `BulkSkuUnit` records).
3. Quantity mode shows on-hand count; numbered mode shows units table with individual statuses.
4. Unit statuses: AVAILABLE, CHECKED_OUT, LOST, RETIRED (color-coded per status).
5. Conversion from quantity to numbered is one-way (creates N units; cannot convert back).
6. Staff (ADMIN/STAFF) can add units, convert to numbered, mark units lost/retired.
7. Students see bulk SKUs in equipment picker during checkout and can scan bin QR codes.

## Routes

### `/bulk-inventory`
- **Page:** `src/app/(app)/bulk-inventory/page.tsx`
- **Type:** Pagination list with search, inline unit management, per-SKU expand panel
- **Structure:**
  1. **Header:** "Bulk Inventory" title, "Add SKU" button (opens create dialog)
  2. **Search bar:** Search by SKU name or category
  3. **Pagination:** Shows page X of Y; 20 SKUs per page
  4. **Collapsible SKU rows:** Each row shows:
     - SKU name, category, unit type
     - On-hand quantity (if quantity-only) OR "X numbered units" (if numbered mode)
     - Status badge (Active/Archived)
     - Expand button (chevron down)
  5. **Expanded panel (per SKU):**
     - If quantity-only: "Convert to numbered" button
     - If numbered: Table of units (unit #, status color dot, status label, usage/allocation info, remove button)
     - "Add units" button + quantity input + "Add" submit
     - All add/convert/remove buttons show confirmation dialogs before executing
- **Behaviors:**
  - Clicking expand loads unit details (lazy-loaded if not cached)
  - Add units: input quantity, submit → creates N unit records
  - Convert to numbered: confirm dialog → converts quantity to numbered units (creates one unit per quantity)
  - Remove unit: confirm dialog → marks unit RETIRED and removes it from visible list
  - Change unit status: inline button per unit (AVAILABLE ↔ CHECKED_OUT ↔ LOST ↔ RETIRED)
  - Error toast + retry on mutation failure
  - 401 redirect on all mutations
- **Loading state:** SkeletonTable while fetching
- **Empty states:** "No bulk SKUs" or "No results match your search"

## Data Model

**Key tables:**
- `BulkSku` — name, category FK, unit (string: "count", "pair", "roll", etc.), binQrCodeValue, minThreshold, trackByNumber (boolean), active, location FK, timestamps
- `BulkStockBalance` — bulk SKU FK, location FK, onHandQuantity, timestamps (aggregate per SKU per location)
- `BulkStockMovement` — bulk SKU FK, location FK, quantity change (positive/negative), reason (ADDED / CHECKED_OUT / RETURNED / LOST / RETIRED), timestamps (audit trail)
- `BulkSkuUnit` — bulk SKU FK, unitNumber (sequential), status (AVAILABLE / CHECKED_OUT / LOST / RETIRED), notes, timestamps (only exists if trackByNumber = true)
- `BookingBulkItem` — booking FK, bulk SKU FK, quantity, timestamps
- `BookingBulkUnitAllocation` — bulk SKU unit FK, booking bulk item FK, timestamps (links unit to booking)

## API

**GET `/api/bulk-skus`**
- Query params: `limit`, `offset`, `search`, `includeArchived`
- Returns: `{ data: BulkSku[], total: number, limit: number, offset: number }`
- SKUs sorted by name; includes `_count.units` if numbered

**GET `/api/bulk-skus/[id]/units`**
- Returns: `{ data: BulkSkuUnit[], total: number }`
- Used for lazy-loading unit details when expanding a SKU row

**POST `/api/bulk-skus`**
- Body: `{ name, categoryId, unit, binQrCodeValue, minThreshold, locationId }`
- Returns: Created `BulkSku` object
- Requires: ADMIN/STAFF

**PATCH `/api/bulk-skus/[id]`**
- Body: `{ active }` (archive/unarchive)
- Returns: Updated `BulkSku`
- Requires: ADMIN/STAFF

**POST `/api/bulk-skus/[id]/add-units`**
- Body: `{ quantity }`
- Creates N unit records if `trackByNumber = true`, or increments `BulkStockBalance.onHandQuantity`
- Returns: Updated `BulkSku` with new unit count
- Requires: ADMIN/STAFF

**POST `/api/bulk-skus/[id]/convert-to-numbered`**
- Body: (none; no additional params)
- Converts SKU from quantity mode to numbered mode by creating one unit per current on-hand quantity
- Sets `trackByNumber = true` in Prisma
- Returns: Updated `BulkSku` with new units array
- Requires: ADMIN/STAFF

**PATCH `/api/bulk-skus/[id]/units/[unitId]/status`**
- Body: `{ status: "AVAILABLE" | "CHECKED_OUT" | "LOST" | "RETIRED" }`
- Returns: Updated `BulkSkuUnit`
- Requires: ADMIN/STAFF

**DELETE `/api/bulk-skus/[id]/units/[unitId]`**
- Marks unit as RETIRED (soft delete; cannot actually delete for audit trail)
- Returns: Updated `BulkSkuUnit` with status = RETIRED
- Requires: ADMIN/STAFF

## Components

**Shared:**
- `PageHeader` for title + "Add SKU" button
- `Input` for search bar
- `Pagination` for page controls
- `Table` + `TableHeader`/`TableBody`/`TableRow`/`TableCell` for unit list (desktop) or card layout (mobile)
- `Badge` for status indicators (color-coded per status)
- `Button` for actions (Add units, Convert to numbered, Remove)
- `Alert` for errors
- `ConfirmDialog` for destructive actions (via `useConfirm` hook)
- `SkeletonTable` for loading state

**Custom:**
- **BulkSkuRow** — single SKU row (click to expand)
- **BulkUnitTable** — table of units within expanded panel (desktop layout)
- **BulkUnitCard** — card layout for each unit (mobile layout)

## Hardening Notes

See `AREA_ITEMS.md` 2026-04-06 entry for bulk inventory page hardening:
- All 3 mutations (add units, convert to numbered, unit status change) wrapped with `requireAuth()` + 401 redirect
- List data already uses `useFetch` hook (AbortController, 401 handling, focus refresh)

## Acceptance Criteria
- [x] AC-1: Staff can add bulk SKU with name, category, unit type, location
- [x] AC-2: Quantity mode: show on-hand count per location
- [x] AC-3: Numbered mode: show table of units with status (AVAILABLE/CHECKED_OUT/LOST/RETIRED)
- [x] AC-4: Convert quantity to numbered (one-way conversion)
- [x] AC-5: Add units to quantity-only or numbered-unit SKU
- [x] AC-6: Change unit status (mark lost, retire, release) with audit trail

## Change Log
- 2026-03-15: Bulk inventory V1 shipped — SKU CRUD, quantity vs numbered tracking modes, unit table, add units, convert to numbered. Color-coded status badges. Mobile card layout. Pagination.
- 2026-04-06: Bulk inventory page hardening (5-pass audit) — 401 redirect on all 3 mutations (add units, convert to numbered, unit status change). List data uses `useFetch` hook.
- 2026-04-09: Design refresh (Phase 2) — UNIT_STATUS_CLASSES token map added. Data-table → shadcn Table. useConfirm instead of native confirm(). Shadcn Pagination. Tailwind classnames. Doc sync.
- 2026-04-09: Created AREA_BULK_INVENTORY.md as formal feature area documentation.
