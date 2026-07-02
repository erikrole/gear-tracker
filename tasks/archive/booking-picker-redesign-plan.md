# iOS Reservation Creation Redesign (Steps 1 + 2)

Goal: make the create-reservation flow fast for the real usage pattern
("search, select, search again"), with scan as a first-class add path, and a
tighter metadata screen.

## Design decisions

- **Step 2 becomes a search-first picker.** Tapping a result *adds* it,
  clears the search text, and keeps the keyboard up so the next search starts
  immediately. Tapping an already-added row removes it (undo path).
- **Selected gear lives in a cart drawer.** A pinned bottom bar shows the
  live count and a brief "Added X" confirmation; tapping it opens a sheet
  (medium/large detents) with removable rows and bulk quantity steppers.
  The Review action moves onto this bar.
- **Bulk SKUs behave like assets at pick time.** They appear in the same
  results; tap adds quantity 1; fine-tune the count in the cart. No more
  always-visible stepper wall.
- **Scan is continuous.** Scanner stays open after each hit, shows a
  success/failure banner in-scanner, so a shelf of items is one session.
  Scan button moves to the step 2 toolbar (barcode.viewfinder).
- **Browse fallback.** With no query, category FilterChips filter the
  loaded list instead of dumping 300 rows undifferentiated.
- **Step 1 (metadata) refresh.** Event linking moves to the top (it
  auto-fills title + window = the fast path), inline event list capped at 4
  with an "All events" searchable picker, duration preset chips
  (1/2/4 hr, Overnight, Weekend) under the date pickers, and Notes collapses
  to an "Add note" button until used.

## Slices

- [x] Slice 1 — Step 2 search-first picker + cart drawer
  - VM: `addAsset`, category browse filter, displayed groups/bulk
  - New `CreateBookingEquipmentPicker.swift` (picker, cart bar, cart sheet, bulk result row)
  - `CreateBookingSheet` step 2 swap; Review moves to cart bar
- [x] Slice 2 — Continuous scanning
  - `QRScannerSheet` gains async `resolve` API (dismiss vs continue + banner)
  - VM `addScannedAsset` returns feedback; scanned bulk families add qty 1
  - Scan button relocated to toolbar
- [x] Slice 3 — Step 1 metadata refresh
  - Reorder cards (events first), inline event cap + AllEventsPickerView
  - Duration preset chips, collapsed notes

## Review (2026-07-02)

All three slices shipped in one pass. `SelectedBulkRow` removed as dead code
(cart reuses `BulkQuantityRow`). xcodegen regenerated for the new file;
Wisconsin.entitlements verified intact (APNs + WeatherKit). Simulator build
succeeded. `GlobalSearchSheet`'s one-shot scanner path preserved via the
back-compat `onMatch` init.

## Verification

- `xcodegen generate` (new file) + restore Wisconsin.entitlements
- Simulator build compiles clean
- Manual reasoning pass over selection/undo/scan-duplicate edge cases
