# AREA: Bulk Inventory Management

## Document Control
- Area: Bulk Inventory Management
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-13
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
8. QR-coded batteries stay in numbered bulk when they follow the existing Sony battery pattern: one SKU with unit-level tracking beneath it.
9. Numbered bulk unit QR values are derived as `{binQrCodeValue}-{unitNumber}` and scan directly as that one unit; printed label text can stay as the unit number only.
10. Camera-slot SD cards are not bulk inventory when assigned to a specific camera slot; they are serialized item attachments under the camera.
11. Numbered battery available quantity derives from `BulkSkuUnit.status = AVAILABLE`; low-stock warnings use available units and default to threshold 10 when the SKU threshold is lower or unset.
12. Quantity-only available quantity derives from current `BulkStockBalance.onHandQuantity`; checkout creation, pending pickup, cancellation, and return paths move that balance through audited stock movements, so read models must not subtract active checkout quantities again.

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

### `/bulk-inventory/batteries`
- **Page:** `src/app/(app)/bulk-inventory/batteries/page.tsx`
- **Type:** Admin/staff operational cockpit for active numbered battery SKUs
- **Purpose:** Make day-to-day battery unit management faster without moving batteries out of numbered bulk inventory.
- **Structure:**
  1. **Metric strip:** available, checked out, lost, retired, and low-SKU counts.
  2. **Compatible battery lows:** camera-family battery health derived from active camera inventory and the existing compatibility rules.
  3. **Checked-out units table:** unit number, battery SKU, holder, booking, due date, and checked-out age.
  4. **Battery SKU cards:** per-SKU available/out/lost/retired counts and direct unit controls.
  5. **Report handoff:** `/reports/bulk-losses` now owns deeper battery audit/reporting for missing units, loss rate, checkout history, and repeat missing patterns.
- **Behaviors:**
  - Only active numbered battery SKUs are shown.
  - Low stock uses the existing battery rule of max(`minThreshold`, 10).
  - Compatible battery lows reuse `src/lib/battery-compatibility.ts`; no separate camera-to-battery schema exists.
  - Unit actions reuse the audited `/api/bulk-skus/[id]/units/[unitNumber]` status endpoint.
  - Checked-out units are read-only in this surface and must be returned through check-in before status changes.

## Data Model

**Key tables:**
- `BulkSku` — name, category FK, unit (string: "count", "pair", "roll", etc.), binQrCodeValue, minThreshold, trackByNumber (boolean), active, location FK, timestamps
- `BulkStockBalance` — bulk SKU FK, location FK, onHandQuantity, timestamps (aggregate per SKU per location)
- `BulkStockMovement` — bulk SKU FK, location FK, quantity change (positive/negative), reason (ADDED / CHECKED_OUT / RETURNED / LOST / RETIRED), timestamps (audit trail)
- `BulkSkuUnit` — bulk SKU FK, unitNumber (sequential), status (AVAILABLE / CHECKED_OUT / LOST / RETIRED), notes, timestamps (only exists if trackByNumber = true)
- `BookingBulkItem` — booking FK, bulk SKU FK, quantity, timestamps
- `BookingBulkUnitAllocation` — bulk SKU unit FK, booking bulk item FK, timestamps (links unit to booking)

**QR behavior:**
- Quantity-only SKUs scan by `BulkSku.binQrCodeValue` and prompt for quantity.
- Numbered SKUs scan by `BulkSku.binQrCodeValue` to open the unit picker, or by `{binQrCodeValue}-{unitNumber}` to submit one specific unit directly.
- Unit QR values are derived; there is no separate QR field on `BulkSkuUnit` in V1.
- Kiosk pickup and check-in accept derived numbered unit QR values so batteries are physically scanned one by one.

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
- [x] AC-7: Numbered battery audit/reporting exposes missing units, loss rate by SKU, custody history, and repeated missing-unit patterns

## Change Log
- 2026-05-13: GAP-37 closed. `/reports/bulk-losses` now includes a numbered battery audit section with missing units by unit number, battery loss rate by SKU, recent battery checkout history, repeated missing SKU/requester patterns, and a handoff back to the battery cockpit.
- 2026-05-10: Status/data wiring ship fixes. Quantity-only bulk read models now report availability from the movement-adjusted stock balance, and checkout cancellation restores outstanding stock with a compensating movement before the booking is cancelled.
- 2026-05-08: API hardening Wave 13. Battery cockpit reads now use short private caching, battery SKU detection uses term-boundary matching, and license/bulk history-style endpoints stay bounded.
- 2026-05-08: API hardening Wave 12. Bulk asset maintenance toggles now run under SERIALIZABLE isolation with transaction-local audit rows, and bulk SKU activity cursors must belong to the requested SKU or unit audit scope before pagination continues.
- 2026-05-08: API hardening Wave 11. Bulk stock adjustments now bound both request deltas and resulting on-hand quantities to prevent overflow-scale inventory counts; numbered-unit status updates were re-verified as SERIALIZABLE read/update/balance operations.
- 2026-05-06: Battery compatibility lows panel shipped on `/bulk-inventory/batteries`. The cockpit now summarizes low compatible battery families by matching active camera inventory to the existing Sony/Canon/V-mount compatibility rules, then comparing available numbered battery units against each family threshold.
- 2026-05-06: Battery Unit Cockpit shipped at `/bulk-inventory/batteries`. The Admin nav now exposes a battery-focused operational page for active numbered battery SKUs with available/out/lost/retired counts, low-stock signals, checked-out unit aging, booking/requester context, and direct audited unit status actions.
- 2026-05-06: Kiosk battery mismatch polish shipped. Derived unit QR handling now checks active numbered battery SKUs beyond the booking SKU list so kiosk pickup/return can explain wrong battery type, already checked-out elsewhere, not checked out on this booking, duplicate scan, and lost/retired unit cases.
- 2026-05-06: Items Fill gaps now includes active bulk SKUs when counting and assigning missing category or department values, suggests departments from same-category inventory patterns including legacy bulk rows with category text but no `categoryId`, and the Items table receives bulk department metadata from `/api/assets`.
- 2026-05-05: Battery compatibility mapping aligned to the current import snapshot: Sony NP-FZ100 bodies (FX3, A7/A1/A9 family) and Sony BP-U bodies (FX6) warn against matching numbered battery SKUs.
- 2026-05-05: Bulk battery hardening — kiosk pickup/check-in now accepts numbered battery unit QR scans, lookup resolves battery units, and checkout creation warns when compatible battery availability is low.
- 2026-05-05: Numbered bulk unit QR scans shipped — values like `94e068d1-7` resolve to the parent SKU and unit #7 without opening the picker.
- 2026-05-05: Clarified battery/media split — QR-coded batteries remain numbered bulk units, while camera-slot SD cards belong to the item attachment model.
- 2026-03-15: Bulk inventory V1 shipped — SKU CRUD, quantity vs numbered tracking modes, unit table, add units, convert to numbered. Color-coded status badges. Mobile card layout. Pagination.
- 2026-04-06: Bulk inventory page hardening (5-pass audit) — 401 redirect on all 3 mutations (add units, convert to numbered, unit status change). List data uses `useFetch` hook.
- 2026-04-09: Design refresh (Phase 2) — UNIT_STATUS_CLASSES token map added. Data-table → shadcn Table. useConfirm instead of native confirm(). Shadcn Pagination. Tailwind classnames. Doc sync.
- 2026-04-09: Created AREA_BULK_INVENTORY.md as formal feature area documentation.
