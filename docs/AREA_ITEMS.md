# Items Area Scope (V1 Hardened)

## Document Control
- Area: Items
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-09
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
6. B&H import can auto-prefill metadata, but all prefilled fields remain user-editable.
7. B&H import must never overwrite `tagName`.

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
3. User optionally pastes B&H product URL for metadata prefill.
4. User enters required fields and optional advanced metadata.
5. User attaches image from upload, URL, or metadata prefill source.
6. User saves item and returns to list or adds another.

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
3. `Export` visible to `ADMIN` and `STAFF`; hidden for `STUDENT`.
4. `Customize overview` deferred in V1 unless low effort and no performance risk.

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

### B&H Product Import (V1)
1. User pastes B&H product URL into `Product URL`.
2. Server validates supported domain and fetches product page.
3. Parser extracts best-effort metadata:
   - Title
   - Brand
   - Model/MFR reference
   - Image URL
4. Client prefills:
   - `productName`
   - `brand`
   - `model`
   - image preview
5. User may edit any prefilled field before save.
6. User may remove or replace URL and re-run import.
7. Import failure must not block manual item creation.

### Image Options
1. Upload image
2. Use image from web URL
3. B&H URL metadata prefill when source matches policy
4. Remove/replace image after prefill
5. Preserve manual override behavior and image source tracking

### Validation and Save Behavior
1. Save is blocked on missing required fields.
2. Save is blocked on duplicate serialized identity collisions (for example duplicate `tagName` policy if required).
3. Save returns user to list or allows `Add another` continuation.
4. Draft recovery is supported if user leaves before save.
5. B&H parsing errors show clear warning and fall back to manual entry.

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

### Trap: B&H parser breaks after source markup changes
- Mitigation:
  - Use fallback extraction order with partial-result tolerance.
  - Allow manual completion path when parsing is incomplete.

### Trap: B&H import blocks form completion on fetch failure
- Mitigation:
  - Keep import asynchronous and non-blocking.
  - Show retry action and preserve entered form values.

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
- B&H page provides partial metadata only.
- B&H URL is invalid, unsupported, or temporarily unreachable.
- B&H page returns image but missing brand/model fields.
- Tracking code removal requested on asset with active allocations.
- Item has no QR code and needs first-time generation.
- Item has no purchase metadata and should show inline `Add ...` prompts.
- Item is in an in-progress checkout draft (`Checking Out`) and detail header must deep-link correctly.

## Acceptance Criteria
1. Items list supports required filters, search, and baseline columns.
2. `tagName` is primary in list and detail for serialized assets.
3. Header status line supports the defined labels, colors, and deep links for active reservation, checkout, and draft-checkout states.
4. Item status shown to users is derived, not manually controlled.
5. Create flow enforces required fields by item kind.
6. Default `Info` tab shows both operational overview cards and the item information card.
7. Item detail exposes required tabs and role-appropriate actions.
8. `Actions` menu includes Duplicate, Retire, Delete, and Needs Maintenance with policy-safe gating.
9. Category and fiscal year fields use controlled dropdowns.
10. QR code thumbnail renders from stored text code, and missing-code flow supports generation or manual entry.
11. Empty optional fields show inline `Add ...` prompts instead of blank values.
12. Export and import visibility follow role rules.
13. Image and metadata prefill never overwrite `tagName`.
14. B&H URL import auto-prefills supported fields and allows manual overrides.
15. B&H import failures do not block item creation.
16. All item mutations are auditable.

## Dependencies
- User role and ownership model from `AREA_USERS.md`.
- Reservation and checkout linkage from `AREA_RESERVATIONS.md` and `AREA_CHECKOUTS.md`.
- Metadata enrichment behavior from B&H workflow.
- Integrity rules from `AREA_PLATFORM_INTEGRITY.md`.
- Mobile operations contract from `AREA_MOBILE.md`.

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
5. Implement B&H import boundary with non-blocking prefill and editable overrides.
6. Preserve metadata enrichment safety and audit coverage for every mutation.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 list/create/detail spec based on Cheqroom references and Gear Tracker rules.
- 2026-03-01: Added explicit B&H auto-import and editable-prefill behavior.
- 2026-03-02: Added mobile list/search behavior alignment and contract dependency.
- 2026-03-09: Items page V1 implementation complete (slices 1–4): list columns/filters/pagination, status dot with booking popover, clickable rows, detail tabs (Check-outs/Reservations/Info/History), inline edit for ADMIN/STAFF, item-kind-aware create form.
- 2026-03-09: Expanded item detail spec with status-line states, working `Actions` menu requirements, dashboard-style `Info` tab, `Calendar` and `Settings` tabs, QR generation/manual entry rules, inline missing-value prompts, and fiscal-year dropdown guidance.
