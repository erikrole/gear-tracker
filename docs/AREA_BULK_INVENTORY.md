# AREA: Bulk Inventory Management

## Document Control
- Area: Bulk Inventory Management
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-05-20
- Status: Active
- Version: V1

## Direction
Operate item families backed by `BulkSku` records. Normal discovery happens in `/items`; this area is the admin/staff cockpit for stock adjustment, thresholds, numbered-unit audit, lost/retired handling, QR labels, and maintenance. Product UI should describe the two user-facing family styles as Units and Quantity, while docs/code can use unit-tracked and quantity-tracked when implementation precision matters.

## Core Rules
1. `BulkSku` is the implementation record for an item family with category, unit (e.g., "count", "pair", "roll"), and parent/bin QR code.
2. Two tracking modes: **Quantity-tracked** (just a number) or **Unit-tracked** (individual `BulkSkuUnit` records).
3. `/items` shows one item-family row with availability like `43/46 available`; this area exposes the operational controls behind that row.
4. Unit statuses: AVAILABLE, CHECKED_OUT, LOST, RETIRED (color-coded per status); user-facing copy can describe `LOST` units as Missing when the goal is staff follow-up.
5. Conversion from quantity to numbered is one-way (creates N units; cannot convert back).
6. Staff (ADMIN/STAFF) can add units, convert to numbered, mark units lost/retired.
7. Students see item families in equipment picker during checkout and request quantity, not exact physical units.
8. QR-coded batteries stay as unit-tracked item families when they follow the existing Sony battery pattern: one SKU/family with unit-level tracking beneath it.
9. Numbered bulk unit QR values are derived as `{binQrCodeValue}-{unitNumber}` and scan directly as that one unit; printed label text can stay as the unit number only.
10. Camera-slot SD cards are not bulk inventory when assigned to a specific camera slot; they are serialized item attachments under the camera.
11. Numbered battery available quantity derives from `BulkSkuUnit.status = AVAILABLE`; low-stock warnings use available units and default to threshold 10 when the SKU threshold is lower or unset.
12. Quantity-only available quantity derives from current `BulkStockBalance.onHandQuantity`; checkout creation, pending pickup, cancellation, and return paths move that balance through audited stock movements, so read models must not subtract active checkout quantities again.

## Routes

### `/bulk-inventory`
- **Page:** `src/app/(app)/bulk-inventory/page.tsx`
- **Type:** Redirect to `/items`
- **Audience:** Admin/staff operations, not the primary item catalog
- **Behaviors:**
  - The legacy bulk inventory landing route redirects to `/items` so normal discovery stays in the primary catalog.
  - Direct `/bulk-inventory/{id}` links remain as the staff/admin stockroom path for item-family operations.

### `/bulk-inventory/batteries`
- **Page:** `src/app/(app)/bulk-inventory/batteries/page.tsx`
- **Type:** Admin/staff operational cockpit for active unit-tracked battery families
- **Navigation label:** Battery Ops
- **Purpose:** Make day-to-day battery unit management faster while keeping normal discovery in `/items`.
- **Structure:**
  1. **Metric strip:** available, checked out, lost, retired, and low-family counts.
  2. **Compatible battery lows:** camera-family battery health derived from active camera inventory and the existing compatibility rules.
  3. **Checked-out units table:** unit number, battery family, holder, booking, due date, and checked-out age.
  4. **Battery family cards:** per-family available/out/lost/retired counts and direct unit controls.
  5. **Report handoff:** `/reports/bulk-losses` now owns deeper battery audit/reporting for missing units, loss rate, checkout history, and repeat missing patterns.
- **Behaviors:**
  - Only active unit-tracked battery families are shown.
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
- Kiosk checkout detail responses mark numbered battery rows with type/SKU/unit metadata and include scan-summary counts so the iOS kiosk can separate battery-unit scan progress from generic item progress.

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
- `PageHeader` for title + item-family action buttons
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
- Item-family image replacement uses the shared image modal. When Brave image search is configured, `BulkSku` detail headers seed the search from the SKU name and save the chosen result through `/api/bulk-skus/[id]/image`, preserving the same re-host and audit path as pasted URLs.

## Acceptance Criteria
- [x] AC-1: Staff can add bulk SKU with name, category, unit type, location
- [x] AC-2: Quantity mode: show on-hand count per location
- [x] AC-3: Numbered mode: show table of units with status (AVAILABLE/CHECKED_OUT/LOST/RETIRED)
- [x] AC-4: Convert quantity to numbered (one-way conversion)
- [x] AC-5: Add units to quantity-only or numbered-unit SKU
- [x] AC-6: Change unit status (mark lost, retire, release) with audit trail
- [x] AC-7: Unit-tracked battery audit/reporting exposes missing units, loss rate by family, custody history, and repeated missing-unit patterns

## Change Log
- 2026-05-21: Battery Ops summary metrics now use the shared `OperationalMetricCard` primitive instead of a route-local metric card helper, keeping available, checked-out, missing, retired, and low-family tones aligned with the design-language metric contract.
- 2026-05-20: Battery Ops checked-out-units panel now uses shared inline `EmptyState` copy when no battery units are currently checked out, matching item-family detail empty-state behavior.
- 2026-05-20: Unit-tracked item-family detail now uses shared inline `EmptyState` copy and recovery action when no units exist, replacing the local text-only empty row.
- 2026-05-20: Item-family image replacement now participates in the shared Brave-backed product image search flow. Bulk SKU detail headers seed search from `sku.name`, and selected results still save through the existing bulk image endpoint so future manually chosen photos are re-hosted rather than stored as raw third-party image URLs.
- 2026-05-13: Admin navigation now labels the battery operations surface as Battery Ops, and item-family detail handoff copy uses Stockroom view for the direct staff/admin operations path.
- 2026-05-13: Native kiosk battery-unit scan clarity now shows required/scanned unit counts, exact scanned/returned unit chips, and clearer blocked pickup-confirm guidance for unit-tracked battery families.
- 2026-05-13: Battery cockpit and Missing Units report copy now use Missing and Units language in metrics, empty states, unit actions, and section descriptions instead of old lost/numbered wording.
- 2026-05-13: Item-family detail copy now treats the page as a normal item detail surface, with compact Units/Quantity tracking labels, Missing wording for `LOST` unit exceptions, clearer low-stock threshold labels, and QR copy that no longer assumes web-app label printing.
- 2026-05-13: Reframed this area as admin/staff operations for first-class item families. `/items` now owns normal discovery/detail routing, while `/bulk-inventory` keeps stock, unit, QR, threshold, and audit controls.
- 2026-05-13: Creation/list language now favors Standard, Units, and Quantity for users. `unit-tracked` and `quantity-tracked` remain implementation/doc terms where precision is useful.
- 2026-05-13: Label/report/admin polish brought print labels, Battery Ops metrics, item-family settings, and report docs into the first-class item-family language while keeping `BulkSku` as the implementation record.
- 2026-05-13: Battery follow-through polish. Kiosk checkout detail now returns typed numbered-battery item metadata plus scan-summary counts, and the iOS kiosk pickup/return screens show a dedicated battery-unit scan progress card.
- 2026-05-13: GAP-37 closed. `/reports/bulk-losses` now appears as Missing Units and includes a unit-tracked battery audit section with missing units by unit number, missing rate by family, recent battery checkout history, repeated missing family/requester patterns, and a handoff back to Battery Ops.
- 2026-05-10: Status/data wiring ship fixes. Quantity-only bulk read models now report availability from the movement-adjusted stock balance, and checkout cancellation restores outstanding stock with a compensating movement before the booking is cancelled.
- 2026-05-08: API hardening Wave 13. Battery cockpit reads now use short private caching, battery-family detection uses term-boundary matching, and license/bulk history-style endpoints stay bounded.
- 2026-05-08: API hardening Wave 12. Bulk asset maintenance toggles now run under SERIALIZABLE isolation with transaction-local audit rows, and bulk SKU activity cursors must belong to the requested SKU or unit audit scope before pagination continues.
- 2026-05-08: API hardening Wave 11. Bulk stock adjustments now bound both request deltas and resulting on-hand quantities to prevent overflow-scale inventory counts; numbered-unit status updates were re-verified as SERIALIZABLE read/update/balance operations.
- 2026-05-06: Battery compatibility lows panel shipped on `/bulk-inventory/batteries`. The cockpit now summarizes low compatible battery families by matching active camera inventory to the existing Sony/Canon/V-mount compatibility rules, then comparing available numbered battery units against each family threshold.
- 2026-05-06: Battery Unit Cockpit shipped at `/bulk-inventory/batteries`. The Admin nav now exposes a battery-focused operational page for active unit-tracked battery families with available/out/lost/retired counts, low-stock signals, checked-out unit aging, booking/requester context, and direct audited unit status actions.
- 2026-05-06: Kiosk battery mismatch polish shipped. Derived unit QR handling now checks active unit-tracked battery families beyond the booking family list so kiosk pickup/return can explain wrong battery type, already checked-out elsewhere, not checked out on this booking, duplicate scan, and lost/retired unit cases.
- 2026-05-06: Items Fill gaps now includes active bulk SKUs when counting and assigning missing category or department values, suggests departments from same-category inventory patterns including legacy bulk rows with category text but no `categoryId`, and the Items table receives bulk department metadata from `/api/assets`.
- 2026-05-05: Battery compatibility mapping aligned to the current import snapshot: Sony NP-FZ100 bodies (FX3, A7/A1/A9 family) and Sony BP-U bodies (FX6) warn against matching unit-tracked battery families.
- 2026-05-05: Bulk battery hardening — kiosk pickup/check-in now accepts numbered battery unit QR scans, lookup resolves battery units, and checkout creation warns when compatible battery availability is low.
- 2026-05-05: Numbered bulk unit QR scans shipped — values like `94e068d1-7` resolve to the parent SKU and unit #7 without opening the picker.
- 2026-05-05: Clarified battery/media split — QR-coded batteries remain numbered bulk units, while camera-slot SD cards belong to the item attachment model.
- 2026-03-15: Bulk inventory V1 shipped — SKU CRUD, quantity vs numbered tracking modes, unit table, add units, convert to numbered. Color-coded status badges. Mobile card layout. Pagination.
- 2026-04-06: Bulk inventory page hardening (5-pass audit) — 401 redirect on all 3 mutations (add units, convert to numbered, unit status change). List data uses `useFetch` hook.
- 2026-04-09: Design refresh (Phase 2) — UNIT_STATUS_CLASSES token map added. Data-table → shadcn Table. useConfirm instead of native confirm(). Shadcn Pagination. Tailwind classnames. Doc sync.
- 2026-04-09: Created AREA_BULK_INVENTORY.md as formal feature area documentation.
