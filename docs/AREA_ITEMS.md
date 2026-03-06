# Items Area Scope (V1 Hardened)

## Document Control
- Area: Items
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
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
3. Tabs expose contextual history and linked workflows.
4. Side panels expose tracking codes, location details, and policy toggles.

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
3. Derived status badge (for example `Available`, `Checked out`).
4. Primary actions:
   - Reserve
   - Check out
5. Actions button for secondary item operations.

### Tabs
1. `Info`
2. `Reservations`
3. `Check-outs`
4. `History`
5. `Attachments`
6. `Map` is optional and can be deferred if no distinct value over location panel.

### Info Panel
1. Core metadata fields and editable values by role.
2. Immutable identity values displayed clearly where edits are restricted.
3. Audit-backed edit history available via `History` tab.

### Side Panels
1. Tracking codes (QR/barcode/asset code)
2. Location details
3. Settings toggles:
   - Available for reservation
   - Available for check out
   - Available for custody
4. These toggles represent eligibility policy, not current real-time status.

## Bug Traps and Mitigations

### Trap: Manual status edits create drift from allocations
- Mitigation:
  - Do not provide direct editable status field.
  - Always compute status for display from active allocations.

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

## Acceptance Criteria
1. Items list supports required filters, search, and baseline columns.
2. `tagName` is primary in list and detail for serialized assets.
3. Item status shown to users is derived, not manually controlled.
4. Create flow enforces required fields by item kind.
5. Detail page exposes tabs and side panels with role-appropriate actions.
6. Export and import visibility follow role rules.
7. Image and metadata prefill never overwrite `tagName`.
8. B&H URL import auto-prefills supported fields and allows manual overrides.
9. B&H import failures do not block item creation.
10. All item mutations are auditable.

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
3. Implement detail layout with action header, workflow tabs, and policy side panels.
4. Enforce role-based edit visibility and server-side authorization checks.
5. Implement B&H import boundary with non-blocking prefill and editable overrides.
6. Preserve metadata enrichment safety and audit coverage for every mutation.

## Change Log
- 2026-03-01: Initial standalone area scope created.
- 2026-03-01: Rewritten into hardened V1 list/create/detail spec based on Cheqroom references and Gear Tracker rules.
- 2026-03-01: Added explicit B&H auto-import and editable-prefill behavior.
- 2026-03-02: Added mobile list/search behavior alignment and contract dependency.
