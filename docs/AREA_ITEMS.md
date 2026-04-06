# Items Area Scope (V1 Hardened)

## Document Control
- Area: Items
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-25
- Status: Active
- Version: V1

## Direction
Treat physical gear identity as primary, make list and detail views action-oriented, and keep item state reliable through derived logic.

## Core Rules
1. `tagName` is the primary label for serialized assets.
2. `productName`, `brand`, and `model` are supporting metadata.
3. Asset availability/status shown in UI is derived from active allocations and booking context.
4. Item creation starts with explicit item kind selection:
   - Serialized item
   - Bulk item
5. Role behavior follows `AREA_USERS.md`:
   - `ADMIN` and `STAFF` can create and edit items.
   - `STUDENT` can view all items, no item edit rights.
6. Metadata enrichment from external product URLs is not supported in V1.

## V1 Workflow

### Items List
1. User lands on all items list (default table mode).
2. User filters by status/category/location/item kind and searches by tagName, productName, brand, model, serial, or tracking code.
3. User opens row details or row actions.

### Create Item
1. User starts `New asset`.
2. User selects item kind:
   - Serialized: one physical unit per record with unique identity.
   - Bulk: quantity-based stock record.
3. User enters required fields and optional advanced metadata.
4. User attaches image from upload or URL.
6. User saves item and returns to list or adds another.

> **Picker Roadmap:** Form comboboxes (Department, Location, Category, Bulk SKU) are covered in `tasks/item-picker-roadmap.md` — see FormCombobox V1 cleanup for normalization plan.

### Item Detail
1. User opens item details from list.
2. Header exposes fast actions (`Reserve`, `Check out`) by permission and policy.
3. Header status line exposes live operational state with linked booking context when applicable.
4. `Info` tab opens the default dashboard view with active check-out, upcoming reservations, and editable item information in a split layout.
5. Additional tabs expose contextual history, calendars, linked workflows, and policy settings.

## Items List Surface (V1)

### Top Bar Actions
1. `New asset` visible to `ADMIN` and `STAFF`.
2. `Import` visible to `ADMIN` and `STAFF`.
3. `Export` visible to `ADMIN` and `STAFF`; hidden for `STUDENT`. **(Deferred — not yet implemented)**
4. `Customize overview` deferred — not in V1.

### Filters and Controls
1. Search input for identity and metadata fields.
2. Filters control plus quick filter chips:
   - Status
   - Category
   - Location
   - Flag
   - Item kind
   - Kit status
3. Sort defaults to tagName ascending.
4. View toggle supports table mode as required baseline.
5. Mobile keeps search and filter access pinned at top for long lists per `AREA_MOBILE.md`.

### Table Columns (V1 Baseline)
1. Selection checkbox
2. Name cell:
   - Primary: `tagName`
   - Secondary: status indicator, tracking code, and key metadata
3. Category
4. Location
5. Brand
6. Model
7. Row actions (kebab)

### Row Behavior
1. Row click opens item details.
2. Status indicator reflects derived availability.
3. Kebab menu includes state-appropriate actions by role.
4. Multi-select is allowed for future bulk actions; bulk mutations are out of scope for V1.
5. Mobile list interactions should avoid deep category drilling as the primary path, favoring search and direct item rows.

### Pagination
1. Show `Showing X to Y of Z`.
2. Rows per page defaults to 25.

## Create Item Surface (V1)

### Required Fields

#### Serialized Item
1. Item kind = serialized
2. `tagName` (required)
3. Category (required)
4. Location (required)

#### Bulk Item
1. Item kind = bulk
2. `productName` or display name (required)
3. Category (required)
4. Location (required)
5. Quantity (required)

### Optional Metadata (Collapsed by default)
1. Brand
2. Model
3. Product URL
4. Serial number
5. Purchase date
6. Purchase price
7. Warranty date
8. Residual value
9. Department
10. Fiscal year purchased
11. Notes/description

### Image Options
1. Upload image
2. Use image from web URL
3. Remove/replace image
4. Preserve manual override behavior and image source tracking

### Validation and Save Behavior
1. Save is blocked on missing required fields.
2. Save is blocked on duplicate serialized identity collisions (for example duplicate `tagName` policy if required).
3. Save returns user to list or allows `Add another` continuation.
4. Draft recovery is supported if user leaves before save.

## Item Detail Surface (V1)

### Header
1. Primary title: `tagName` for serialized items.
2. Secondary metadata: `productName`, `brand`, `model`, and tracking code.
3. Derived status line sits directly under the headline and uses these labels and colors:
   - `Available` (green)
   - `Check Out by {user}` (red, clickable to the active checkout)
   - `Reserved by {user}` (purple, clickable to the active reservation)
   - `Checking Out` (blue, clickable to the in-progress checkout draft)
   - `Needs Maintenance` (orange)
   - `Retired` (gray)
4. Status remains derived from active allocations, booking state, maintenance flag, and retirement state. It is not manually editable freeform text.
4. Primary actions:
   - Reserve
   - Check out
5. `Actions` button exposes secondary operations:
   - Duplicate
   - Retire
   - Delete
   - Needs Maintenance
6. `Delete` is allowed only for policy-safe records with no linked reservation history, checkout history, or active allocations. Otherwise the action is hidden or blocked with guidance to use `Retire`.

### Tabs
1. `Info`
2. `Check Outs`
3. `Reservations`
4. `Calendar`
5. `History`
6. `Settings`

### Info Tab Dashboard Layout
1. `Info` is the default tab and acts as the item dashboard.
2. Desktop layout is split:
   - Left column: operational overview cards
   - Right column: item information card
3. Mobile stacks these sections vertically with operational cards first.

### Left Column: Operational Overview
1. Show both check-outs and reservations by default without requiring a tab switch.
2. Active check-out card displays:
   - Due-back countdown
   - Checkout name or linked event name
   - Current holder
   - Direct link into the checkout record
3. Reservation overview lists upcoming reservations for the item:
   - Reservation title or event
   - Time window
   - Owner
   - Direct link into the reservation record
4. If no active check-out or upcoming reservation exists, show a clear empty state instead of blank space.

### Right Column: Item Information Card
1. Core metadata fields and editable values by role.
2. Immutable identity values displayed clearly where edits are restricted.
3. Empty optional fields render as action-oriented placeholder text in a distinct muted-accent color, for example `Add purchase price`.
4. Audit-backed edit history remains available via `History` tab.
5. `Category` uses a dropdown wired to the canonical category list.
6. `Link` field is available for item-specific external URL entry.
7. `Fiscal Year Purchased` uses predetermined dropdown options based on July 1 fiscal-year rollover:
   - On March 9, 2026, the current fiscal year option is `2026`
   - Option generation should align future values to the same July 1 rule

### Tracking Code and QR Behavior
1. Show QR code / tracking code inside the item information card instead of a detached side panel.
2. Render a QR thumbnail from the stored text code when a code exists.
3. If no QR code exists, provide:
   - `Generate QR code` action that creates a new unique code
   - Manual text input to type or paste a QR code
4. Manual QR entry must validate uniqueness before save.
5. Tracking code edits must remain auditable.

### Settings Tab
1. Settings toggles:
   - Available for reservation
   - Available for check out
   - Available for custody
2. These toggles represent eligibility policy, not current real-time status.
3. Toggle help text should make the operational meaning explicit:
   - Available for reservation: item can be used in reservations
   - Available for check out: item can be used in check-outs
   - Available for custody: item can be taken into custody by a user

## Bug Traps and Mitigations

### Trap: Manual status edits create drift from allocations
- Mitigation:
  - Do not provide direct editable status field.
  - Always compute status for display from active allocations.

### Trap: Item delete conflicts with audit and booking history
- Mitigation:
  - Allow deletion only for records with no active allocations and no historical booking links.
  - Route all other end-of-life handling through `Retire`.

### Trap: QR generation creates duplicate tracking identity
- Mitigation:
  - Use unique-code generation with collision check before save.
  - Validate manually entered QR codes against the same uniqueness rule.

### Trap: Info tab becomes blank when item has no linked activity or metadata
- Mitigation:
  - Use explicit empty states and inline `Add ...` prompts for missing values.
  - Keep item information card populated even when no booking data exists.

### Trap: Serialized and bulk logic bleed into each other
- Mitigation:
  - Split create and validation paths by item kind.
  - Keep item-kind-specific required fields explicit.

### Trap: Duplicate or ambiguous tag identities
- Mitigation:
  - Enforce uniqueness policy for serialized identifiers.
  - Show conflict error with direct resolution guidance.

### Trap: Image metadata prefill overwrites operator intent
- Mitigation:
  - Never overwrite `tagName`.
  - Let user explicitly accept or override image and metadata values.
### Trap: Detail toggles interpreted as status controls
- Mitigation:
  - Label toggles as policy eligibility.
  - Keep derived status visible separately in header.

### Trap: Students discover hidden edit paths via direct route
- Mitigation:
  - Enforce server-side item mutation authorization.
  - Return consistent authorization errors and audit denied attempts.

## Edge Cases
- Missing thumbnail in list row.
- Item has linked reservations/checkouts while category/location edits are attempted.
- Mixed-location history on item with `locationMode = MIXED`.
- Imported item missing `productName`, requiring fallback to `tagName`.
- Tracking code removal requested on asset with active allocations.
- Item has no QR code and needs first-time generation.
- Item has no purchase metadata and should show inline `Add ...` prompts.
- Item is in an in-progress checkout draft (`Checking Out`) and detail header must deep-link correctly.

## Acceptance Criteria
- [x] AC-1: Items list supports required filters, search, and baseline columns.
- [x] AC-2: `tagName` is primary in list and detail for serialized assets.
- [x] AC-3: Header status line supports the defined labels, colors, and deep links for active reservation, checkout, and draft-checkout states.
- [x] AC-4: Item status shown to users is derived, not manually controlled.
- [x] AC-5: Create flow enforces required fields by item kind.
- [x] AC-6: Default `Info` tab shows both operational overview cards and the item information card.
- [x] AC-7: Item detail exposes required tabs and role-appropriate actions.
- [x] AC-8: `Actions` menu includes Duplicate, Retire, Delete, and Needs Maintenance with policy-safe gating.
- [x] AC-9: Category and fiscal year fields use controlled dropdowns.
- [x] AC-10: QR code thumbnail renders from stored text code, and missing-code flow supports generation or manual entry.
- [x] AC-11: Empty optional fields show inline `Add ...` prompts instead of blank values.
- [x] AC-12: Export visibility follows role rules. **(Shipped — Export button in items page header, visible to ADMIN/STAFF only. Downloads filtered CSV.)**
- [x] AC-13: Image and metadata prefill never overwrite `tagName`.
- [x] AC-14: All item mutations are auditable.

## Dependencies
- User role and ownership model from `AREA_USERS.md`.
- Reservation and checkout linkage from `AREA_RESERVATIONS.md` and `AREA_CHECKOUTS.md`.
- Integrity rules from `DECISIONS.md` (D-001, D-006, D-007).
- Mobile operations contract from `AREA_MOBILE.md`.

## Numbered Bulk Item Tracking

### Overview
Bulk SKUs can optionally enable `trackByNumber` to assign individually numbered units (e.g., Battery #1–#40) under a single QR code. This supports loss tracking by unit number without requiring individual QR codes per item.

### Creation
1. User toggles "Track by number" during bulk SKU creation.
2. Initial quantity creates numbered units #1–N via `createMany`.
3. Physical labels on items must match assigned numbers (user responsibility).

### Unit Lifecycle
- **Statuses:** AVAILABLE, CHECKED_OUT, LOST, RETIRED
- **Status transitions:** click-to-cycle in UI (Available → Lost → Retired → Available); checked-out units are locked
- **Adding units:** POST to units endpoint appends from max+1
- **Conversion:** existing quantity-only SKUs can be converted to numbered tracking

### Checkout/Check-in Flow
1. Staff scans the single bin QR code.
2. Unit picker bottom sheet opens with multi-select grid of available units.
3. Staff selects specific unit numbers (or "Select all") and confirms.
4. Selected units are allocated to the booking via `BookingBulkUnitAllocation`.
5. Check-in flow pre-selects checked-out units; staff deselects any missing.
6. Missing units are flagged with specific unit numbers.

### Data Model
- `BulkSkuUnit`: numbered unit with status, linked to BulkSku (cascade delete)
- `BookingBulkUnitAllocation`: links specific units to bookings with checkout/checkin timestamps
- `trackByNumber` boolean on BulkSku determines behavior branching

### Inventory Display
- Numbered SKUs show available/total count and status summary in table
- Expandable unit grid with color-coded status dots
- Unit status changes adjust on-hand balance automatically

### Decision Reference
- D-022: Numbered Bulk Items (see DECISIONS.md)

## Out of Scope (V1)
1. Procurement workflow and purchase-order lifecycle.
2. Depreciation accounting model.
3. Bulk mutation operations beyond basic import/export.
4. Full customizable analytics overview on items list.

## Developer Brief (No Code)
1. Implement list controls and table schema with tag-first identity and derived status indicators.
2. Implement create flow split by serialized vs bulk item kind, with strict validation.
3. Implement detail layout with linked status header, workflow tabs, dashboard-style `Info` view, and `Settings` tab policy controls.
4. Enforce role-based edit visibility and server-side authorization checks.
5. Preserve audit coverage for every mutation.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 list/create/detail spec based on Cheqroom references and Gear Tracker rules.
- 2026-03-01: Added explicit B&H auto-import and editable-prefill behavior.
- 2026-03-02: Added mobile list/search behavior alignment and contract dependency.
- 2026-03-09: Items page V1 implementation complete (slices 1–4): list columns/filters/pagination, status dot with booking popover, clickable rows, detail tabs (Check-outs/Reservations/Info/History), inline edit for ADMIN/STAFF, item-kind-aware create form.
- 2026-03-09: Expanded item detail spec with status-line states, working `Actions` menu requirements, dashboard-style `Info` tab, `Calendar` and `Settings` tabs, QR generation/manual entry rules, inline missing-value prompts, and fiscal-year dropdown guidance.
- 2026-03-11: Docs hardening — resolved "Customize overview" ambiguity: deferred, not in V1. Updated AREA_PLATFORM_INTEGRITY ref to DECISIONS.md.
- 2026-03-14: Added Numbered Bulk Item Tracking section — trackByNumber flag, unit picker scan flow, conversion endpoint, D-022 reference.
- 2026-03-15: Removed B&H enrichment — scraping blocked by source. Removed all B&H references from rules, workflow, traps, and acceptance criteria.
- 2026-03-16: Item Bundling (Accessories) V1 shipped — parent-child self-ref FK on Asset, accessories CRUD API, detail page accessories section with attach/detach, items list hides children by default with +N badge on parents, scan preview shows "Accessory of" banner. See D-023.
- 2026-03-22: Items list page redesign — 6 slices shipped:
  - API performance: derived status filtering pushed to DB via Prisma relation subqueries (eliminates 2000-row in-memory cap). Server-side sorting with `sort`/`order` query params.
  - Page decomposition: 561-line monolithic page → 4 hooks (`use-url-filters`, `use-items-query`, `use-filter-options`, `use-bulk-actions`) + 4 components (`ItemsToolbar`, `ItemsPagination`, `BulkActionBar`, `ItemCard`).
  - Search expansion: now covers 9 fields (assetTag, brand, model, serialNumber, name, notes, category name, location name, department name). Department filter added. Accessories toggle added. Accessory count badge on parent rows.
  - UX polish: differentiated empty states (no inventory vs no matches), first/last page buttons, "Showing X–Y of Z" range display, keyboard shortcuts (/ to search, Escape to clear, arrow keys for pagination).
  - Mobile card view: responsive card layout on <768px with 44px+ tap targets, status badges, kebab menu.
  - Consolidated fetch: single `/api/items-page-init` endpoint replaces 4 separate mount-time fetches.
- 2026-03-22: Items list page hardening (5-pass audit):
  - Design system: accessories count badge migrated to shadcn Badge, bulk action spinner uses Spinner component.
  - Data flow: AbortController prevents race conditions on rapid filter changes, unmount cleanup aborts in-flight requests. Silent failures on row actions (duplicate, maintenance, retire) replaced with toast feedback. Double-click guard via actionBusy state.
  - Resilience: refresh failures preserve visible data (toast error instead of replacing table with error screen). Initial load vs refresh distinguished — skeleton only on first load, shimmer progress bar on subsequent refreshes.
  - UX polish: loading skeleton matches actual table layout (image placeholder + two-line text, pill-shaped status badge, varied widths). Retire confirmation names the specific item and states consequences. Bulk actions toast success/failure with action type and count. Retire button shows "Retiring…" during in-flight action.
  - Bulk action hook now toasts success/failure messages.
- 2026-03-23: Items page roadmap created — V1 polish, V2 enhanced UX, V3 advanced features. See `tasks/items-roadmap.md`.
- 2026-03-24: Item details page roadmap created — V1 hardening, V2 enhanced workflows, V3 intelligent features. See `tasks/item-details-roadmap.md`.
- 2026-03-25: Doc sync — standardized ACs to checkbox format. Marked export feature as deferred (AC-12). Updated Last Updated date.
- 2026-03-25: **Items list UX polish** — Status badges simplified: removed "Checked out by"/"Reserved by" prefix, now shows just the username with badge color indicating status (title tooltip preserves full text). Column widths tightened for higher density (Name 280→260, Status 200→160, Category/Dept 140→120, Location 160→130).
- 2026-04-06: **Data integrity fixes (4 total):** (1) QR update TOCTOU — catches P2002 instead of pre-check. (2) Delete asset — wrapped in `$transaction`. (3) Generate QR TOCTOU — removed pre-check loop, now catches P2002 with retry. (4) Duplicate asset tag collision — catches P2002 with retry, increased suffix entropy from 12→16 bits, fixed null serialNumber creating "null-COPY-XXX".

## Roadmaps
- **Items list page**: `tasks/items-roadmap.md` — V1 polish, V2 enhanced UX, V3 advanced features
- **Item details page**: `tasks/item-details-roadmap.md` — V1 hardening, V2 reduced friction, V3 predictive/proactive
