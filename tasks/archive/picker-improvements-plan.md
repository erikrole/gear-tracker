# Picker Improvements V1 — Implementation Plan

Brief: `docs/BRIEF_PICKER_IMPROVEMENTS_V1.md`
Branch: `claude/v3-development-AxnBo`
Status: **All slices shipped** (2026-03-15)

---

## Slice 1: Extract EquipmentPicker Component

**Goal:** Pure refactor — extract picker from BookingListPage.tsx into standalone component.

- [ ] Read BookingListPage.tsx fully, identify picker boundary (state, props, render)
- [ ] Create `src/components/EquipmentPicker.tsx` with extracted picker code
- [ ] Define clean props interface:
  ```
  EquipmentPickerProps {
    assets: Asset[]
    bulkSkus: BulkSku[]
    selectedAssetIds: string[]
    selectedBulkItems: { bulkSkuId: string, quantity: number }[]
    onAssetToggle: (id: string) => void
    onBulkChange: (bulkSkuId: string, quantity: number) => void
    onAssetRemove: (id: string) => void
    onBulkRemove: (bulkSkuId: string) => void
  }
  ```
- [ ] Update BookingListPage.tsx to use the extracted component
- [ ] Move picker-specific CSS to component or keep in globals with clear section comment
- [ ] `npm run build` — must pass
- [ ] Verify checkout and reservation creation still work identically
- [ ] Commit: `feat: extract EquipmentPicker into standalone component`

## Slice 2: Checkbox Multi-Select + Summary Strip

**Goal:** Replace one-at-a-time click selection with checkbox multi-select.

- [ ] Add checkbox input to each serialized asset row (left of tag name)
- [ ] Wire checkbox to toggle asset in selectedAssetIds
- [ ] Add "Select all available" button per section (only selects non-retired/non-maintenance items)
- [ ] Add "Deselect all" button per section
- [ ] Update section tab labels to show selected count: "Cameras (3)"
- [ ] Add selected items summary strip below picker tabs:
  - Shows tag names of all selected serialized assets + bulk items with quantities
  - Each item has an × remove button
  - Horizontal scroll on mobile
- [ ] Ensure bulk items keep their existing quantity stepper (no checkbox for bulk)
- [ ] Touch targets: checkboxes 44px+, summary strip items 44px+ height
- [ ] `npm run build` — must pass
- [ ] Commit: `feat: checkbox multi-select and selected items summary strip in picker`

## Slice 3: Picker Search

**Goal:** Add per-section search to filter items by tag/name/brand/model.

- [ ] Add search input at top of each section's item list
- [ ] Client-side filter: case-insensitive match on tagName, productName, brand, model
- [ ] Store search term per section (Map<SectionKey, string>) — persists when switching tabs
- [ ] Show match count: "12 items" or "3 of 47 items"
- [ ] Clear button (×) to reset search for current section
- [ ] Remove the 50-item `.slice(0, 50)` cap — search makes full list manageable
- [ ] If section has >50 items and no search term, show first 50 + "Search to see all N items"
- [ ] Mobile: search input 44px height, 16px font (prevent iOS zoom)
- [ ] `npm run build` — must pass
- [ ] Commit: `feat: per-section search in equipment picker`

## Slice 4: Availability Preview Badges

**Goal:** Show date-range-specific conflict badges during item selection.

- [ ] Review `POST /api/availability/check` endpoint — ensure it accepts a full asset ID list and returns per-asset conflict details
- [ ] In EquipmentPicker, when `startsAt` and `endsAt` are set:
  - Debounce 500ms after date change
  - Call availability check with all visible asset IDs and the booking date range
  - Store conflict map: `Map<assetId, { bookingTitle, conflictWindow }>`
- [ ] Render conflict badge on each item row:
  - Amber badge for items reserved by another booking
  - Red badge for items currently checked out through the requested period
  - Badge text: short booking title + date range
- [ ] Conflicting items remain selectable but checkbox shows warning styling
- [ ] If user selects a conflicting item, show inline warning (not a blocking modal)
- [ ] Show loading skeleton on badges while availability check is in-flight
- [ ] When dates are not yet set, fall back to current derived status dots (existing behavior)
- [ ] Props addition: `startsAt?: Date, endsAt?: Date` passed to EquipmentPicker
- [ ] `npm run build` — must pass
- [ ] Commit: `feat: availability preview badges in equipment picker`

## Slice 5: Scan-to-Add

**Goal:** Camera overlay in picker for QR scan to instantly add items.

- [ ] Add "Scan" button (camera icon) in picker header, next to section tabs
- [ ] On tap, open a modal/portal overlay with QrScanner component
  - Overlay sits above picker, does NOT navigate away (no route change)
  - Picker state (selections) is fully preserved underneath
- [ ] On successful scan:
  - Parse QR value (`bg://item/<uuid>` or `bg://case/<uuid>` or raw asset tag)
  - Match against loaded assets in form-options data
  - If match found:
    - Add asset to selectedAssetIds
    - Auto-switch to the correct section tab
    - Brief green flash/toast: "Added [tagName]"
    - Haptic feedback (if available)
  - If bulk bin QR scanned:
    - Add bulk SKU to selectedBulkItems with quantity 1
    - Auto-switch to correct section
  - If no match or retired:
    - Red flash/toast: "Item not found" or "Item is retired"
- [ ] Camera stays open for continuous scanning (2s debounce between reads)
- [ ] Close button dismisses overlay, returns to picker with selections intact
- [ ] Manual code entry fallback input in the overlay
- [ ] Mobile: overlay takes full viewport width, camera preview centered
- [ ] Handle camera permission denied with clear fallback message
- [ ] `npm run build` — must pass
- [ ] Commit: `feat: scan-to-add QR camera overlay in equipment picker`

## Slice 6: Mobile Hardening + Docs

**Goal:** Final polish pass and documentation updates.

- [ ] Touch target audit: all interactive elements in picker 44px+ on mobile
- [ ] Test picker at 375px width — no horizontal overflow, no tiny controls
- [ ] Verify scan-to-add overlay works on mobile (camera preview sizing, close button)
- [ ] Verify search input doesn't trigger iOS zoom (16px font)
- [ ] Verify summary strip scrolls horizontally on narrow screens
- [ ] Update `docs/AREA_CHECKOUTS.md`:
  - Update Equipment Picker section to reflect multi-select, search, availability badges, scan-to-add
  - Add change log entry
- [ ] Update `docs/GAPS_AND_RISKS.md`:
  - Close any picker-related gaps
  - Add change log entry
- [ ] Update `tasks/todo.md` with completion status
- [ ] `npm run build` — must pass
- [ ] Commit: `feat: picker improvements mobile hardening and docs`

---

## Verification Checklist (before declaring done)

- [ ] Checkout creation with multi-selected items works end-to-end
- [ ] Reservation creation with multi-selected items works end-to-end
- [ ] Availability badges appear when dates are set and update on date change
- [ ] Scan-to-add works for serialized assets and bulk bins
- [ ] Search filters items correctly across all sections
- [ ] Mobile picker is usable at 375px width
- [ ] Guidance rules still fire correctly
- [ ] Bulk quantity steppers still work
- [ ] `npm run build` passes
- [ ] All doc updates reflect shipped reality
