# Items Area Scope (V1 Hardened)

## Document Control
- Area: Items
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-06-10
- Status: Active
- Version: V1

## Direction
Treat physical gear identity as primary, make list and detail views action-oriented, and keep item state reliable through derived logic.

Design language reference: `docs/DESIGN_LANGUAGE.md`.

## Core Rules
1. `tagName` is the primary label for serialized assets.
2. `productName`, `brand`, and `model` are supporting metadata.
3. Asset availability/status shown in UI is derived from active allocations and booking context.
4. Item creation starts with friendly tracking-style selection:
   - **Standard**: one physical item with its own identity, for example a camera body, lens, or laptop.
   - **Units**: one item with many scannable units, for example batteries, radios, or card readers.
   - **Quantity**: one item tracked by count only, for example tape, zip ties, or cleaning supplies.
5. Item families are normal catalog rows backed by `BulkSku`; they appear in `/items` beside serialized assets and show availability such as `43/46 available`.
6. Unit-tracked item families use `BulkSkuUnit` records for pickup, return, loss, and audit custody without creating one catalog row per physical unit.
7. Quantity-tracked item families use the same first-class Items discovery model without unit-level QR custody.
8. Role behavior follows `AREA_USERS.md`:
   - `ADMIN` and `STAFF` can create and edit items.
   - `STUDENT` can view all items, no item edit rights.
9. Metadata enrichment from external product URLs is not supported in V1.
10. Camera-tied SD cards, cages, and fixed camera parts are tracked as item attachments when they should travel with the parent camera and not be individually checked out.

## V1 Workflow

### Items List
1. User lands on all items list (default table mode).
2. User filters by status/category/location/item kind and searches by tagName, productName, brand, model, serial, or tracking code.
3. Searches return one row per item family/SKU; exact unit QR scans resolve to unit context under the parent family rather than producing separate catalog rows.
4. User opens row details or row actions.

### Native iOS Items
1. Search stays in the native search bar.
2. Favorites and Status scope controls are visible named controls above the list, not icon-only toolbar buttons.
3. Row actions remain swipe and context-menu based: Favorite, Reserve, and Copy Asset Tag.
4. The mobile Items list intentionally avoids desktop-only sorting, bulk actions, and advanced filter density.

### Inventory Hygiene
1. Staff/admin opens `/items/hygiene` from the Admin nav.
2. The page shows cleanup checks that improve picker, search, checkout, kit, and scan quality.
3. Each issue card links to the existing repair surface instead of adding new mutation paths.
4. Slice 1 checks missing category, missing department, missing primary scan code, missing image, duplicate scan identity, retired items still in active kits, camera bodies with no attachments, and active bulk SKUs below threshold.
5. The page frames those checks as a read-only cleanup queue with priority ordering, clean/check progress, needs-work/all/clean views, partial-failure warnings, and tag-first sample rows.

### Create Item
1. User starts `Add item`.
2. User selects tracking style:
   - Standard: one physical unit per record with unique identity.
   - Units: one catalog row with numbered/scannable units underneath.
   - Quantity: one catalog row with count-only stock.
3. User enters required fields and optional advanced metadata.
4. User attaches image from upload or URL.
6. User saves item and chooses the next step: open the created record, add an image, return to the refreshed list, or add another asset.

> **Picker Roadmap:** Form comboboxes (Department, Location, Category, Bulk SKU) are covered in `tasks/item-picker-roadmap.md` — see FormCombobox V1 cleanup for normalization plan.

### Item Detail
1. User opens item details from list.
2. Header exposes fast actions (`Reserve`, `Check out`) by permission and policy.
3. Header status line exposes live operational state with linked booking context when applicable.
4. `Info` tab opens the default dashboard view with active check-out, upcoming reservations, and editable item information in a split layout.
5. Additional tabs expose schedule context, lightweight insights, complete touch history, attachments, and policy settings.
6. The Attachments tab groups child items into SD Cards, Cages and Rigging, and Misc Parts. SD card tags such as `MBB 17 IV 1A` display as camera-slot assignments.

## Items List Surface (V1)

### Top Bar Actions
1. `Add item` visible to `ADMIN` and `STAFF`.
2. `Import` visible to `ADMIN` and `STAFF`.
3. `Export` visible to `ADMIN` and `STAFF`; hidden for `STUDENT`. Downloads the current filtered CSV view.
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
6. Attachments are hidden by default and only shown through the Hidden attachments only filter or direct scan/search.

### Pagination
1. Show `Showing X to Y of Z`.
2. Rows per page defaults to 25.

## Create Item Surface (V1)

### Required Fields

#### Standard
1. Tracking style = Standard
2. `tagName` (required)
3. Category (required)
4. Location (required)
5. QR code / tracking code (required)

#### Units
1. Tracking style = Units
2. `productName` or display name (required)
3. Category (required)
4. Location (required)
5. Initial unit count (optional, creates numbered units)

#### Quantity
1. Tracking style = Quantity
2. `productName` or display name (required)
3. Category (required)
4. Location (required)
5. Initial quantity (optional)

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

### Firmware Watch
1. Firmware watch targets are model-level metadata; installed firmware is stored per asset as item metadata key `installedFirmwareVersion`.
2. Watched products use explicit official manufacturer support URLs and parser types.
3. The daily watcher records latest version, release date, baseline status, last check time, and last parse/fetch error.
4. New version notifications are admin-facing operational alerts; item detail compares any recorded installed version against latest available firmware for the matched model.
5. Item detail displays a compact firmware badge in the `Info` card when the item brand/model matches a watched target. Green means the recorded installed version matches latest available firmware, orange/yellow means it is behind, and gray means no installed version or no latest version is known.
6. Clicking the firmware badge opens the installed-version editor, a mark-updated-to-latest action, and the official manufacturer update page link.

### Image Options
1. Upload image
2. Use image from web URL
3. Search for a product photo through the configured Brave Search API
4. Remove/replace image
5. Preserve manual override behavior and image source tracking

### Validation and Save Behavior
1. Save is blocked on missing required fields.
2. Save is blocked on duplicate serialized identity collisions (for example duplicate `tagName` policy if required).
3. Standard manual intake keeps asset tag, category, location, and QR code required while allowing product name, brand, model, and department to be filled later.
4. Blank Standard brand/model values submit explicit `Unknown` placeholders until operators replace them, preserving the current non-null asset schema without blocking high-volume intake.
5. Submit disables form controls, guards rapid duplicate submits, handles expired sessions through the shared auth redirect, and shows form-level errors for validation, permission, server, or network failures.
6. Save returns user to list, opens the created/updated record, offers the image step for serialized assets, or allows `Add another` continuation.
7. The sheet does not persist drafts in V1. Long-lived draft recovery remains reserved for full-page wizard flows such as booking creation.

## Item Detail Surface (V1)

### Header
1. Primary title: `tagName` for serialized items.
2. Secondary metadata: `productName`, `brand`, `model`, and tracking code.
3. Derived status line sits directly under the headline and uses these labels and colors:
   - `Available` (green)
   - `Awaiting pickup by {user}` (orange, clickable to the pending pickup checkout)
   - `Checked out by {user}` (blue, red when overdue, clickable to the active checkout)
   - `Reserved by {user}` (purple, clickable to the active reservation once the reservation window has started)
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
2. `Schedule`
3. `Insights`
4. `History`
5. `Attachments`
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
4. Recent past bookings render below upcoming reservations for quick context without requiring a tab switch.
   - Rows stay compact, use the requester avatar when available, and prioritize title, requester, date range, booking kind, and status.
5. If no active check-out, upcoming reservation, or past booking context exists, show a clear empty state instead of blank space.

### Right Column: Item Information Card
1. Core metadata fields and editable values by role.
2. Immutable identity values displayed clearly where edits are restricted.
3. Empty optional fields render as action-oriented placeholder text in a distinct muted-accent color, for example `Add purchase price`.
4. Audit-backed edit history and booking touches remain available via `History` tab.
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
1. Settings is the policy surface, not an item-status editor.
2. Show a small status-source summary so users understand current availability is derived.
3. Settings toggles:
   - Check-out eligible
   - Reservation eligible
   - Custody eligible
4. These toggles represent eligibility policy, not current real-time status.
5. Toggle help text should make the operational meaning explicit:
   - Check-out eligible: item can leave inventory through check-out workflows
   - Reservation eligible: item can be reserved for future use
   - Custody eligible: item can be assigned into custody outside short-term bookings

### Schedule Tab
1. Month cells show multi-day bookings as continuous week-spanning bars so one booking reads as one schedule block.
2. Booking bars remain clickable so users can still open the linked booking from any occupied day span.
3. The tab includes a compact month agenda so the calendar answers which booking is occupying the item, not only that a day is occupied.
4. Cancelled bookings stay out of the calendar, agenda, and quick Past Bookings context because they no longer occupy the item schedule.
5. Mobile keeps the agenda-style list so schedule context is usable without relying on the desktop grid.
6. Clicking a schedule booking opens an in-place preview sheet for quick context; deeper edits belong on the full booking page.
7. Booking preview identity should use requester/creator avatars where available so the sheet reads as human activity, not only booking metadata.

### Insights Tab
1. Insights stay lightweight and operational, focused on demand, usage, lifecycle, borrower, and sport signals.
2. Lifecycle values should use human-readable units, for example item age in years instead of raw day counts for older items.
3. Return-timing metrics must avoid overstated precision unless backed by a recorded completion/check-in event.

### History Tab
1. History is the complete item touch log for admins and staff.
2. Users can scope the feed to:
   - All activity
   - Item updates
   - Booking activity involving this item
3. Activity loading is paginated with a visible `Load older entries` action.
4. Timeline rows should translate legacy backend action names into operational language and hide noisy import metadata from field-change pills.

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

### Trap: Serialized and item-family logic bleed into each other
- Mitigation:
  - Split create and validation paths by serialized asset vs item family kind.
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

## Unit-Tracked Item Families

### Overview
Item families can optionally enable `trackByNumber` on the backing `BulkSku` implementation record to assign individually numbered units (e.g., Battery #1-#40) under one parent bin QR. Unit QR values are derived from that parent QR plus the unit number, so physical labels can show only the unit number while scans still resolve a specific unit.

### Creation
1. Staff toggle "Track by number" during item-family creation.
2. Initial quantity creates numbered units #1–N via `createMany`.
3. Physical labels on items must match assigned numbers (user responsibility).

### Unit Lifecycle
- **Statuses:** AVAILABLE, CHECKED_OUT, LOST, RETIRED (`LOST` is usually presented to staff as Missing)
- **Status transitions:** click-to-cycle in UI (Available → Missing → Retired → Available); checked-out units are locked
- **Adding units:** POST to units endpoint appends from max+1
- **Conversion:** existing quantity-only SKUs can be converted to numbered tracking

### Checkout/Check-in Flow
1. Booking creation records numbered batteries by quantity, not by unit number.
2. Kiosk pickup scans each physical unit QR and allocates that unit via `BookingBulkUnitAllocation`.
3. Kiosk check-in scans each physical unit QR and returns only that unit.
4. The bin QR plus picker flow remains available for non-kiosk scan surfaces.
5. Missing units are flagged with specific unit numbers.

### Data Model
- `BulkSkuUnit`: numbered unit with status, linked to BulkSku (cascade delete)
- `BookingBulkUnitAllocation`: links specific units to bookings with checkout/checkin timestamps
- `trackByNumber` boolean on BulkSku determines behavior branching

### Inventory Display
- Unit-tracked families show available/total count and status summary in table
- Expandable unit grid with color-coded status dots
- Numbered battery available quantity derives from units with `AVAILABLE` status

### Decision Reference
- D-022: Item Families With Checkoutable Units (see DECISIONS.md)

## Out of Scope (V1)
1. Procurement workflow and purchase-order lifecycle.
2. Depreciation accounting model.
3. Bulk mutation operations beyond basic import/export.
4. Full customizable analytics overview on items list.

## Developer Brief (No Code)
1. Implement list controls and table schema with tag-first identity and derived status indicators.
2. Implement create flow split by Standard, Units, and Quantity tracking styles, with strict validation.
3. Implement detail layout with linked status header, workflow tabs, dashboard-style `Info` view, and `Settings` tab policy controls.
4. Enforce role-based edit visibility and server-side authorization checks.
5. Preserve audit coverage for every mutation.

## Change Log
- 2026-06-10: **Inventory-driven Sony firmware watch shipped.** Gear Tracker now has model-level firmware watch targets for verified official Sony support URLs, latest version/release date, active versus maintenance support mode, baseline state, and parse errors. The daily maintenance job polls enabled targets and notifies active admins when a newer version appears after baseline. Canon is not seeded; non-Sony adapters and unresolved Sony support URLs remain explicit follow-up work.
- 2026-06-10: **Item detail firmware badge shipped.** The Info card now shows firmware as a compact badge backed by per-asset `installedFirmwareVersion` metadata: green when recorded installed firmware matches latest, orange/yellow when it is behind, and gray when unset or unknown. Clicking the badge opens an editor with a Mark updated to latest action and the official Sony update page link.
- 2026-06-10: **Item detail firmware display shipped.** Serialized item details now show matched model-level firmware watch data in the Info card: latest available version, release date, support mode, check status, and an official-source link. Firmware release/check dates render in UTC to preserve vendor date-only releases across local timezones.
- 2026-06-10: **Add item quick fixes shipped.** Standard item creation now shows repeat-tag context for asset families such as `FX3`, `FX3 2`, and the next likely tag, marks purchase price as USD with currency-aware parsing, saves fiscal year to the same `fiscalYearPurchased` metadata key used by item detail, and includes an inline photo upload field that saves through the existing asset image endpoint after create.
- 2026-06-10: **Add item repeat-tag suggestions are live.** The Standard asset-tag helper now updates while typing, not only on blur, and treats partial text as a prefix. Typing `F`, `FX`, `FX3`, or `70-200` can surface the strongest existing tag family and suggested next tag before the operator enters a number.
- 2026-06-10: **B&H product images work in the image picker again.** Brave returns B&H image URLs behind Cloudflare bot protection (`www.bhphotovideo.com/cdn-cgi/...`), which 403'd hotlinked previews, server-side rehosting, and even Brave's own thumbnail proxy, so B&H tiles were blank and saving failed. B&H URLs are now rewritten to the openly served `static.bhphoto.com` host: search tiles render the 500px static image, and saving rehosts the 1000x1000 hero white-background product photo to Vercel Blob. Result tiles across all sources now prefer the hotlink-safe thumbnail with full-image fallback, and the rehost fetch sends browser-like headers so other strict CDNs accept it. Follow-up in the same day: `multiple_images/` gallery URLs (B&H product galleries) also rewrite to the static host, and B&H Explora blog images, which are blocked on every host including Brave's thumbnail proxy, are dropped from search results instead of rendering as permanently blank tiles.
- 2026-06-10: **Generated QR codes are shorter.** New asset QR generation now creates 8-character uppercase codes without the old `QR-` prefix, so physical labels are easier to read while existing prefixed labels and scan fallbacks keep working.
- 2026-06-10: **Scalar notes no longer hidden as metadata.** `parseNotes` on `/api/assets/[id]` treated any successful `JSON.parse` as import metadata, so a note that happened to parse ("1234", "true") was suppressed from the notes field and returned a non-object `metadata` value that could break the iOS asset-detail decode. Only plain JSON objects are treated as metadata now; everything else stays a visible user note.
- 2026-06-10: **Add item form field accessibility cleanup.** Standard, Units, and Quantity creation fields now associate visible labels with text, number, date, URL, textarea, combobox, and switch controls. Manual inventory-entry fields also declare conservative autofill behavior so Chrome no longer flags the Add item sheet for missing labels or autocomplete metadata. Validation, payloads, and mutation routes are unchanged.
- 2026-06-10: **Add item section-card polish.** Standard, Units, and Quantity creation sections now use shared booking-style card surfaces with compact badges and section-level guidance. Field ids, names, validation, and submit behavior are unchanged.
- 2026-06-10: **Booking-inspired Add item polish.** Add item now borrows the checkout/reservation wizard's compact badge summary, card-style choice rhythm, and review-style post-create handoff while staying a sheet instead of becoming a multi-step wizard. Standard, Units, and Quantity creation behavior is unchanged.
- 2026-06-10: **Manual one-by-one intake readiness.** Standard item creation now keeps asset tag, category, location, and QR code required for safe manual intake while allowing product name, brand, model, and department to be filled later. Blank brand/model values submit explicit `Unknown` placeholders to satisfy the current non-null asset schema without forcing metadata research during high-volume entry. Tracking-style copy now distinguishes Standard, Units, and Quantity choices for manual intake.
- 2026-06-06: **iOS Items empty-state recovery.** Native search-empty and Favorites-only empty states now include direct recovery actions, Clear search and Show all items, while preserving the current search, Favorites, Status scope, row actions, and no-inventory copy.
- 2026-06-06: **iOS Items load error copy.** Native Items initial-load and pagination failures now use recovery-oriented Items copy instead of raw Swift error descriptions, while keeping the existing Retry controls, pull-to-refresh, search, filters, and row actions unchanged.
- 2026-06-05: **iOS Items retired reserve gating.** Native retired items remain visible with their derived Retired status, but iOS no longer exposes Reserve from list swipe actions, row context menus, or item detail. Favorite, copy-tag, row navigation, search, and status filtering are unchanged.
- 2026-06-05: **iOS Items favorite failure recovery.** Native item-list favorite actions now preserve optimistic update plus rollback behavior while showing a shared bottom toast when the server rejects the favorite change, so a reverted star is no longer silent. Search, Favorites, Status filters, swipe actions, context menus, and the favorite API contract are unchanged.
- 2026-06-05: **iOS Items row detail hint.** Native item rows now expose a VoiceOver hint that double-tap opens item details while keeping tag-first identity, derived status labels, search, Favorites, Status filters, swipe actions, and context menus unchanged.
- 2026-06-03: **iOS Items control clarity slice.** Native Items now exposes Favorites and Status as visible named controls above the list instead of icon-only toolbar buttons. The slice preserves search, pagination, row favorite/reserve actions, reserve prefill, and the intentional V1 mobile deferral for admin lifecycle actions.
- 2026-05-25: **Web bug sweep Batch 48.** The Labels print queue now distinguishes serialized item rows from item-family rows in checkbox and open-link accessible names, including tracking mode and location for item families, preventing duplicate labels such as `Select Sony Battery` when serialized assets and multiple bulk families share the same visible product name.
- 2026-05-25: **Web bug sweep Batch 45.** Items list selection/favorites, item detail reads/actions/history/insights/attachments, Inventory Hygiene, and the Fill Gaps dialog now safe-parse success bodies and reject unreadable or incomplete payloads instead of silently trusting raw `res.json()` reads.
- 2026-05-25: **Web bug sweep Batch 35.** Item detail link-field icon buttons now have explicit accessible names independent of hover tooltips, and the link input exposes stable browser form metadata. Duplicate tag/serial blur checks now use the shared auth and safe-JSON response path, and inline category creation reports unreadable success responses instead of silently failing to attach the new category.
- 2026-05-25: **Web bug sweep Batch 34.** The shared image modal now fails loudly when a successful paste/search image save returns an unreadable or missing `imageUrl` instead of silently leaving the modal open with no feedback. The Paste URL and hidden file controls also expose stable form metadata, and image-search result tiles have explicit action labels for browser accessibility checks.
- 2026-05-25: **Web bug sweep Batch 27.** Serialized item detail tabs now use the shared URL-state hook, so `?tab=` links, browser Back/Forward, and same-route query changes rehydrate the visible tab instead of staying on the first mounted tab.
- 2026-05-25: **Web bug sweep Batch 25.** The custom Items URL filter/query hooks now rehydrate search, filters, item kind, favorites/accessories flags, sort, page, and limit from browser back/forward or external query strings. Filter URL writes also preserve pagination params instead of stripping `page`/`limit` on load.
- 2026-05-25: **Web bug sweep Batch 22.** The shared item list query hook now routes expired sessions through the shared auth redirect and rejects malformed asset payloads before React Query treats them as valid item data. Labels now uses shared fetch error state to show a retryable load failure instead of the false `No labels available` empty state when item data cannot be read.
- 2026-05-24: **Item creation sheet response reliability sweep.** Standard, unit, and quantity item creation handoffs now safe-parse success responses before opening post-create actions; asset-tag uniqueness, parent attachment search, and existing stock lookup now tolerate malformed JSON and route expired sessions through the shared auth redirect.
- 2026-05-24: **Shared image modal reliability sweep.** The item image modal now uses shared safe JSON parsing for image search, paste-URL saves, and uploads; upload/remove paths now route 401 responses through the shared login redirect and use the same ref-backed double-submit guard as search and pasted URL saves. This protects item detail, post-create image handoff, and any shared item-family image selection from non-JSON proxy/server responses and rapid repeated clicks.
- 2026-05-24: **Item detail accessibility smoke fix.** Browser smoke on item detail caught unlabeled form-control metadata on select/date/notes controls. The item info tab now threads stable `id`/`name` attributes through saveable native selects, the shared date picker input, and notes textarea so browser autofill/accessibility checks no longer flag those controls.
- 2026-05-21: **Attachments MVP hardening:** Item detail attachment management now uses a structured add/move dialog with searchable candidate states, status/location/category context, blocked-candidate explanations, and warnings for busy items. Child attachment detail now exposes the existing move-parent workflow, detach copy names the child and parent while pending states prevent repeat clicks, attachment rows show image/status/slot context, and `/items` makes hidden child attachments clearer through filter copy and informative parent count hover text. No schema change; the slot-schema decision remains deferred.
- 2026-05-21: Labels and Search target audit raised compact clear/open/view controls to the 40px operational target baseline while preserving their focused print and global-command surface shapes.
- 2026-05-21: **Design language slices 25-26:** Image-search result selection now exposes visible keyboard focus and 40px source-link targets. Item detail scan identity controls now use explicit keyboard-visible 40px QR/serial copy buttons, and the QR preview button exposes a focus ring.
- 2026-05-20: **Design language slice 23:** Item detail image edit/add buttons now show visible focus rings and reveal the edit affordance on keyboard focus, not only hover.
- 2026-05-20: **Design language slice 20:** Item detail header utility controls now use the 40px target baseline for refresh, favorite, and the secondary action trigger.
- 2026-05-20: **Design language slices 15-16:** Item detail empty states now use the shared inline `EmptyState` treatment across booking history, calendar agenda, insights, and attachments. The Items bulk action bar now reads as a selected-row toolbar with 40px controls and a clearer `Bulk actions` dropdown label.
- 2026-05-20: **Design language slice 12:** Item detail secondary actions now use the shared `OperationalRowActions` dropdown wrapper while preserving Duplicate, Print label, Maintenance, Retire, and Delete policy.
- 2026-05-20: **Favorites cross-filter cache fix**: Favoriting/unfavoriting only updated the active React Query cache key (`["items", url]`), so toggling the favorites filter could resurrect stale fav state within the 60s `staleTime` (fav 4, filter on, unstar 3, filter off, removed favs reappeared). Favorite mutations now invalidate the whole `["items"]` query family: single-item toggles mark sibling filter views stale without refetching the current view (no flicker), and bulk mutations refetch the active view plus mark siblings stale.
- 2026-05-20: **Favorites hardening pass**: (1) Bulk favorites (`/api/assets/favorites/bulk`) cap raised 100 to 5,000 to match `/api/assets/bulk`, so "Select all matching" can be starred/unstarred in one request instead of returning a 400. (2) Bulk route now filters to existing, not-already-favorited assets before `createMany`, preventing an FK-violation 500 on stale/invalid ids and keeping the returned count accurate. (3) Bulk route now enforces `asset.favorite` permission and writes batched audit entries (`favorite_added`/`favorite_removed`), matching the single-item endpoint. (4) Single-item star toggle now ignores re-clicks while a request is in flight (per-asset lock) and reconciles the row to the server's authoritative `favorited` value instead of trusting the optimistic guess, fixing double-click and multi-tab desync.
- 2026-05-20: **Design language slice 6:** Items table row actions now use the shared `OperationalRowActions` trigger, preserving existing open, label, duplicate, maintenance, and retire behavior while aligning overflow hit area and destructive styling.
- 2026-05-20: **Design language slice 5:** Items filters now expose shared removable active-filter chips for type, favorites, status, category, location, department, brand, and attachments-only filters, matching Users toolbar recovery behavior.
- 2026-05-20: **Design language slice 3:** Items toolbar now uses the shared `OperationalToolbar` shell, keeping its search, item-type toggle, filter disclosure, and attachment switch as the reference command surface for operational list pages.
- 2026-05-20: **Design language slice 2:** Inventory Hygiene now uses the shared operational metric card and partial-results warning primitives so cleanup queue status, warning tone, and fallback copy match Fix Today.
- 2026-05-20: **Human-pick product image search shipped.** Staff/admin image selection now includes an optional Search tab when `BRAVE_SEARCH_API_KEY` is configured. Searches are seeded from the submitted or current product title, try B&H first through Brave's `site:bhphotovideo.com` operator, mix in broader product-photo-biased Brave results so blocked retailer previews do not monopolize the grid, show source domains, and save the selected result through the existing Vercel Blob image routes. This replaces the withdrawn B&H scraping direction for photos only and does not perform metadata enrichment.
- 2026-05-20: **Asset photos no longer go missing after CSV import.** Image re-hosting moved out of the import request path: the importer used to mirror external Cheqroom CDN images to Vercel Blob inline in batches, which blew the serverless timeout on large imports and left most assets pointing at fragile third-party URLs (the cause of "asset photos not displaying" once the team migrated off that SaaS). Imported assets now keep their source URL and a new daily cron (`/api/cron/rehost-images`) drains any non-Blob `imageUrl` in small batches well under the 10s budget, rewriting to Blob on success and capping retries via `Asset.imageRehostAttempts` (migration `0069`) so dead URLs stop being retried. The import response/audit now reports `imagesQueued` instead of `imagesHosted`. The existing ~180-image production backlog is fixed out-of-band by running `scripts/backfill-asset-images.mjs --apply` once.
- 2026-05-13: Item-family detail pages now read as normal item detail pages: headers use Units or Quantity without row badges, QR copy avoids web-print assumptions, settings say item instead of implementation terms, and unit exception states use Missing language.
- 2026-05-13: Item creation now uses friendlier Standard, Units, and Quantity tracking-style choices with examples, while the Items list lets availability carry the distinction instead of adding kind badges. Unit creation sends `trackByNumber=true`; quantity creation stays count-only.
- 2026-05-13: Reframed bulk SKUs as first-class item families in `/items`: one mixed catalog row per SKU, unit-tracked/quantity-tracked filter language, `/items/bulk-{id}` detail routing, and app scan lookup for parent and derived unit QR values.
- 2026-05-12: **Creation-flow standard slice** — Items New asset now uses a clearer post-create handoff for serialized assets, new bulk SKUs, and add-to-existing bulk stock: operators can open the created item/bulk record, add an image, return to the refreshed list, or continue adding another. The sheet now guards duplicate submits with a ref-backed lock, disables form controls while saving, routes 401 responses through the shared login redirect, and surfaces safe form-level errors for non-JSON, server, permission, and network failures. Asset creation API validation now accepts existing department IDs from current data, including UUID-shaped department IDs.
- 2026-05-12: **Item thumbnail reliability fix**: shared gear thumbnails now normalize stored image URLs, reset failed-image state when a source changes, and bypass optimizer-dependent rendering so imported or Blob-hosted item photos render consistently across list, booking, picker, stack, scan, and detail surfaces.
- 2026-05-24: **Web bug sweep item detail fixes**: authenticated browser smoke now confirms item detail editable select/date/notes controls expose stable `id`/`name` metadata, and the above-the-fold item image is marked priority so Next.js no longer warns on the detail page's LCP image.
- 2026-05-10: **Status/data wiring ship fixes**: `PENDING_PICKUP` is now a first-class active item state across server status derivation, item filters, web/iOS badges, and item detail headers. Future reservations no longer show as the active item booking before their window starts. Quantity-only bulk availability now uses the movement-adjusted stock balance instead of subtracting active checkout quantities a second time.
- 2026-05-10: **Items ownership polish**: `/items` now keeps persisted density and column visibility hydration-safe, prevents bulk SKU rows from entering serialized-item selection, favorites, labels, and lifecycle bulk actions, and tightens toolbar plus pagination control hit areas. Bulk rows continue to open their Bulk Inventory detail route while serialized asset actions stay on serialized assets only.
- 2026-05-10: **Inventory Hygiene ownership polish** — `/items/hygiene` now has priority ordering, a cleanup queue summary, checklist progress, needs-work/all/clean views, partial API failure warning state, refresh toast feedback, and tag-first sample labels from `GET /api/inventory-hygiene`. The surface remains read-only and continues linking to existing item, kit, and bulk repair routes.
- 2026-05-10: **Item row action semantics cleanup** — Mobile item cards now separate the primary open target from the selection checkbox instead of making the whole card a fake button that contains another control. This keeps card tap behavior, context menus, and checkbox selection distinct.
- 2026-05-09: **Labels print queue polish** — `/labels` now reads as a focused print queue with matching/selected/ready metrics, a clearer search and queue toolbar, accessible selectable rows, item-detail escape links, filtered-empty recovery, and a preserved browser-print label grid.
- 2026-05-08: API hardening Wave 2. `/api/items-page-init` and `/api/inventory-hygiene` now use partial-failure handling for parallel reference and checklist queries. Failed side queries fall back to empty data, log the failed segment, and return `partialFailures` metadata instead of taking down the entire items list bootstrap or hygiene checklist.
- 2026-05-06: **Inventory Hygiene Center shipped** at `/items/hygiene`. The first slice is a read-only staff/admin checklist backed by `GET /api/inventory-hygiene`, covering missing category, missing department, missing primary scan code, missing image, duplicate scan identity, retired items still in active kits, camera bodies without attachments, and low-threshold bulk SKUs. Each sample links to the existing repair surface.
- 2026-05-06: **Item detail tabs final polish** — Schedule now pairs the month grid with a compact month agenda and quieter calendar chrome. Insights now uses recorded completion audit activity for return-timing when available, labels that metric more honestly, and renders item age in human-readable units. Attachments no longer shows a misleading travel rule on items with no attached children, and its empty state now explains when fixed accessories should be added.
- 2026-05-06: **Item detail tabs follow-up** — Schedule now uses start, continuation, and end markers so long bookings no longer visually repeat the same title on every occupied day. Past Bookings now receives requester avatar URLs from the item detail API and renders a denser context row with title, requester, range, kind, and status. History now supports scoped backend activity queries, cursor pagination, cleaner legacy audit labels, and quieter field-change output for import metadata.
- 2026-05-06: **Item detail tab direction pass** — the detail tab rail now removes the redundant Bookings tab, renames Calendar to Schedule, removes visible keyboard shortcut numerals from tab labels, and keeps only meaningful count badges. The Info tab now adds recent Past Bookings under upcoming reservations for quick context. Insights was simplified into lightweight usage signals instead of a dense chart dashboard, History is framed as the complete item touch log including booking activity, Attachments gained stronger operational summary/direction, and Settings now reads as workflow eligibility policy rather than current status control.
- 2026-05-06: **Item detail data form hardening** — inline item detail fields now guard against rapid duplicate saves, disable text/select/date/notes/QR inputs while saving, toast actual save errors, use parsed API error messages for relationship saves, and align PATCH normalization with clearable form fields for names, serials, dates, links, and financial values. The local save path now passes same-origin localhost PATCH requests through the shared CSRF guard while preserving 403s for bad origins. The info card also normalizes select/category/date/year control framing with gray picker surfaces, makes Fiscal Year a year-only picker, uses the shared Admin badge style, and top-aligns textarea rows.
- 2026-05-06: **Item detail UX/UI cleanup slice 4** — the admin scan identity panel now uses a compact inset layout with labeled QR/Serial values, matching copyable mono text, and a larger QR preview that owns the manage/view action without a redundant text button.
- 2026-05-06: **Item detail UX/UI cleanup slice 3** — header buttons now read as one action cluster with workflow actions first, `Actions` kept with the workflow controls, and refresh/favorite plus date/time freshness text moved into a quieter utility row without a blocking tooltip.
- 2026-05-06: **Item detail UX/UI cleanup slice 2** — serial number no longer competes with the status in the header, duplicated brand/model sublines collapse when the product name already carries that identity, location/category/department read with explicit separators, Check out is the primary available item action with Reserve secondary, and scan identity rows now label QR vs Serial.
- 2026-05-06: **Item detail UX/UI cleanup slice 1** — the default Overview now follows the spec: operational state sits first, item facts sit in the right column, and QR/scan identity is inside the item information card instead of a detached admin-only sidebar. The header is quieter, uses the derived status as the lead signal, and makes unavailable Reserve/Check out actions explicit.
- 2026-05-06: **Item detail hardening and polish pass** — header actions now share the detail action busy state, optimistic favorite toggles are guarded against double-submit, failed item photos fall back to the empty-photo treatment instead of leaving a blank image frame, the mobile calendar tab now shows a month booking list, booking filters use the standard toggle-group control, and detail tab fetches cancel stale requests with consistent 401 handling.
- 2026-05-06: **Items compact and Fill gaps upgrade** — compact density now removes row thumbnails so the desktop list reads closer to a standard shadcn data table. Fill gaps now treats cleanup as a small mixed serialized/bulk queue with batch prefetch, retryable count/load/save errors, ranked suggestions, same-category department hints that also work for legacy bulk category text, Department-first field ordering, explicit no-photo handling, and a skipped-item review path before closing the session.
- 2026-05-06: **Items page UX/UI polish pass** — toolbar controls now sit in one command surface with search, item type, favorites, and a collapsible advanced filter row. Header actions now share a compact 32px sizing rhythm. The inventory status summary is a compact health grid instead of a loose chip rail. Desktop rows and mobile cards now put tag/product identity first while keeping serial and duplicate department metadata out of the name stack.
- 2026-05-06: **Items page hardening pass** — export, duplicate, maintenance, and retire handlers now release busy state from `finally` blocks, including auth redirects and unexpected failures. The list uses merged serialized/bulk rows for empty-state and pagination visibility, clears selected rows when item type/favorites/attachments/sort filters change, and CSV export now honors favorites plus the same extended search fields as the list.
- 2026-05-05: Camera attachment scope shipped — item detail now labels grouped Attachments, shows SD card slot labels, and keeps attached SD cards out of day-to-day checkout selection while preserving direct scan/search visibility.
- 2026-04-30: **Items list — screenshot-review polish**. (1) Subtitle hidden when it duplicates the assetTag — kills the doubled "100-400 1 / 100-400 1" rows. (2) Sort indicators now only render on the active sort column or on header hover, dropping the per-column ⇅ noise. (3) Row kebab menu fades in only on row hover or focus. (4) Status breakdown summary chips are now clickable filters that toggle status into the URL filter set; all 5 buckets (Available + Out + Reserved + Maintenance + Retired) always render with zeros greyed, so the strip's information is shape-stable. (5) Density toggle (Compact / Comfortable) added to the page header, persisted to `items-density` localStorage key.
- 2026-04-30: **Items list — tighter assignee status pill**. The CHECKED_OUT/RESERVED pill is now a single line: `[avatar] STATUS · due-label`. Name moved off the pill into a hover tooltip on the avatar. Status label hover tooltip shows the full due-back date + time. Cleaner visual weight at row density; full information still one hover away.
- 2026-04-30: **Items list — assignee avatar status + bulk sort fix**. The CHECKED_OUT and RESERVED cells now render a richer status pill: `[avatar] [STATUS label] · [name]` instead of using the requester's name as the status label. API now returns `activeBooking.requesterAvatarUrl`. Bulk-row merging logic updated: serialized items keep server-side sort order (so the user's chosen sort actually wins), bulks are grouped together at the end and sorted alphabetically with numeric awareness so "16-35" sorts before "100-400". Closes the audit's "merged sort silently breaks" finding.
- 2026-04-30: **iOS items list audit + parity wins** — see `tasks/items-list-ios-audit.md`. Added `Asset.withFavorited(_:)` helper, collapsing 30 lines of struct rebuilds in the optimistic favorite path. iOS status filter went single-select → multi-select (`Set<AssetComputedStatus>`) closing one parity gap with web. APIClient `assets(status:)` parameter renamed to `assets(statuses:)`. CHECKED_OUT badge surfaces `due Xd` / `Xd overdue` (and turns red on overdue) from `activeBooking.endsAt` — same data already on the wire, mirrors web slice 2.
- 2026-04-30: **Items list audit — bigger bets (mobile cards, due dates, select-all-matching)**. Mobile now renders a real card list (image + name + status + meta) instead of the desktop table on small screens. CHECKED_OUT badge surfaces `due Xd` / `Xd overdue` from `activeBooking.endsAt`. Bulk-bar shows "Select all N matching" when more rows match the filter than are on the current page (new `/api/assets?ids_only=true` endpoint, 5000-row cap). Bulk-action `ids` cap raised 50 → 5000 to support select-all flows. Kits prefetch moved into `/api/items-page-init` (one fewer client fetch every time selection becomes non-empty).
- 2026-04-30: **Items list audit quick wins + bigger bets** — see `tasks/items-list-audit.md`. Fixed unreachable `loadError` in `use-items-query` (now `isError && !response`); `showAccessories` now part of `hasActiveFilters` and reset by `clearAllFilters`; `clearAllFilters` resets search too. Centralized `bulk-` row-id branching in `items/lib/item-href.ts` (replaces 5 scattered call sites). Cmd/Ctrl/middle-click on a list row now opens in a new tab. Sticky table header. URL-synced `?page=` and `?limit=` so list state survives reload and is shareable. Bulk Retire shows an Undo toast (8s) backed by new `unretire` action on `/api/assets/bulk`. Desktop loading skeleton column count fixed to match real table (8 cols). Removed dead `onExportCsv` prop from `BulkActionBar`. Demoted duplicated inline error in bulk bar (toast already covers it).
- 2026-04-24: **iOS items audit fixes** — see `tasks/audit-items-ios.md`. Closes AC-5/AC-7 role gating gaps on iOS detail; the AC-8 admin actions menu (Duplicate/Retire/Delete/Needs Maintenance) remains web-only by design (V1 mobile is student/operational-first). iOS list now matches web's filter race-safety, pagination error handling, dark-mode parity, and 44pt tap targets. Reserve from item context menu now prefills the booking with the asset.
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
- 2026-03-26: **Favorites UI shipped (GAP-22)** — Star column in DataTable, optimistic toggle on detail page, "Favorites" filter chip in toolbar, `favorites_only` query param. Batched favorite lookup (no N+1).
- 2026-03-26: **CSV export shipped (AC-12)** — Export button in items page header (ADMIN/STAFF only). Downloads current filtered view as CSV. Truncation warning at 5,000 items.
- 2026-03-26: **Inventory summary bar shipped** — "X items · Y checked out · Z maintenance" display above table. Status breakdown from API.
- 2026-03-26: **Column visibility persistence shipped** — Column visibility saved to localStorage and restored on mount.
- 2026-04-03: **Item detail page hardened** — AbortController on all fetches, 401 redirect, refresh-preserves-data, error differentiation (not-found/network/server), manual refresh button with freshness tooltip, breadcrumb, mobile tab overflow scroll, tab badge counts, page decomposed (738→313 lines).
- 2026-04-06: **Data integrity fixes (4 total):** (1) QR update TOCTOU — catches P2002 instead of pre-check. (2) Delete asset — wrapped in `$transaction`. (3) Generate QR TOCTOU — removed pre-check loop, now catches P2002 with retry. (4) Duplicate asset tag collision — catches P2002 with retry, increased suffix entropy from 12→16 bits, fixed null serialNumber creating "null-COPY-XXX".
- 2026-04-06: **Kits detail page hardening:** Added 401 redirect on all 6 mutations (save name, save description, add member, remove member, toggle archive, delete). Kits list page already uses `useFetch` hook (has AbortController, 401 handling, visibility refresh).
- 2026-04-06: **Bulk inventory page hardening:** Added 401 redirect on all 3 mutations (add units, convert to numbered, unit status change). List data already uses `useFetch`.
- 2026-05-05: **Bulk battery hardening:** Numbered battery units now use derived unit QR scans for kiosk pickup/check-in and available quantity derives from `AVAILABLE` unit status.
- 2026-04-06: **Accessory operations wrapped in transactions** — Attach, move, and detach now use `$transaction` to prevent TOCTOU races (e.g., concurrent attach of same child to different parents).
- 2026-04-06: **Export permission corrected** — `/api/assets/export` now uses `requirePermission("asset", "export")` instead of `"asset", "create"`. New `export` action added to permissions map. Same ADMIN/STAFF gate, correct semantics.

- 2026-04-09: **DataTable rebuilt with standard shadcn pattern** — Removed custom column resizing (fixed layout, colgroup, mouse-drag handlers), removed mobile card view (`ItemCard` deleted — table scrolls horizontally via `overflow-x-auto`), moved toolbar/bulkBar slots above the bordered table container instead of inside it. Shimmer animation now uses global CSS keyframe instead of inline `<style>` tag. Added `aria-busy` for screen reader refresh indication. Fixed `data-state` attribute emitting `"false"` instead of `undefined`. Column size/minSize constraints removed — columns auto-size via CSS.
- 2026-04-09: **Items list stress test (6 fixes)** — (1) Stale closure on `actionBusy` replaced with ref guard to prevent double-execute on rapid clicks. (2) 401 handling added to all 6 mutation paths (favorite, duplicate, maintenance, retire, export, bulk) via `handleAuthRedirect`. (3) Favorite API TOCTOU fixed — catch P2002 on concurrent toggle, use `deleteMany` for concurrent unfavorite. (4) Maintenance API TOCTOU fixed — read-then-toggle wrapped in SERIALIZABLE transaction. (5) Bulk action dialog buttons disabled during busy. (6) Bulk action bar kits fetch gets AbortController cleanup.
- 2026-04-09: **Item detail pages rebuilt** — (1) Stale actionBusy closure in use-item-actions fixed with ref guard. (2) 401 handling added to all 15 mutation paths across 5 files (field saves, category/dept/location, QR generate/manual, settings toggles, accessory attach/detach, favorite, duplicate, retire, maintenance, delete). (3) Dead `details-grid` CSS class replaced with Tailwind grid. (4) CSS vars (`--text-tertiary`, `--accent`, `--accent-soft`) replaced with Tailwind tokens. (5) `text-secondary` (background token) corrected to `text-muted-foreground`. (6) Unstable `toast` removed from useCallback deps in use-item-data.
- 2026-04-09: **Item detail header redesign** (commit 37d127b) — "Equipment manifest" aesthetic. Replaces flat header with card-based design: top red accent stripe, atmospheric corner glow, Gotham typography for asset tag (weight 900) and name, mono brand/model/serial lines, refined property pills row with status badge and vertical divider. Tab bar labels updated to Gotham Medium with mono shortcut indicators. File modified: `ItemHeader.tsx` (392→275 lines; refactored for brand identity).
- 2026-04-09: **Gap Wizard shipped** (commit 3f4ca67) — One-by-one dialog for assigning missing category or department to items. Reachable via "Fill gaps" button in items page header. Shows upfront count of items missing each field. Walks through items one-by-one: user can assign value via picker, skip to next, or stop. API: `GET /api/assets?missing=category|department` returns count and data, `PATCH /api/assets/[id]` to assign. New file: `gap-wizard-dialog.tsx` (320 lines). Imports `CategoryCombobox`, `FormCombobox`, `AssetImage`.
- 2026-05-07: **Items list context menu** — Right-clicking item rows now opens a row context menu with open, open-in-new-tab, select, copy tag, favorite, print label, and staff/admin lifecycle actions. Bulk rows keep safe open/copy/select actions only, so serialized-only mutations are not exposed for bulk inventory records.
- 2026-05-07: **Item row photo visibility fix** — Item list rows now keep the thumbnail slot visible in both comfortable and compact density; importer upserts no longer clear existing asset photos when the source row lacks an image URL.
- 2026-05-08: **API hardening Wave 10** — Asset retire now reads current status, writes `RETIRED`, and records audit metadata inside one SERIALIZABLE transaction. Favorite toggles now use explicit `asset.favorite` permission and verify the asset exists before creating or deleting the favorite row.
- 2026-05-08: **API hardening Wave 12** — Asset import now reports duplicate asset tags/tracking codes instead of silently skipping create conflicts, item CSV export is actor-rate-limited and formula-safe, picker search caps at 100 rows, and external image mirroring uses an explicit 5s timeout.
- 2026-05-08: **API hardening Wave 13** — Asset brand reference reads now use short private caching, item activity uses the explicit `asset.audit` permission, and the permission map includes `asset.audit` for ADMIN/STAFF.

## Roadmaps
- **Items list page**: `tasks/items-roadmap.md` — V1 polish, V2 enhanced UX, V3 advanced features
- **Item details page**: `tasks/item-details-roadmap.md` — V1 hardening, V2 reduced friction, V3 predictive/proactive
