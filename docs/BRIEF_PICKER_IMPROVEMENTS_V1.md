# Feature Brief: Equipment Picker Improvements V1

## 1) Feature Header
- Feature name: Equipment Picker Improvements V1 (Multi-Select, Availability Preview, Scan-to-Add)
- Owner: Wisconsin Athletics Creative Product
- Date: 2026-03-15
- Priority: `High`
- Target phase: `Phase B`
- Status: **Shipped** (2026-03-15)

## 2) Problem
- Current pain: The equipment picker requires one click per item with no batch selection, no date-range conflict visibility during selection, no search within sections, and no way to scan a QR code to add items. Staff building a 10-item checkout must click 10 individual rows, then discover conflicts only at submission.
- Why now: Checkout is the #1 workflow by frequency (NORTH_STAR.md §4). Every second saved in the picker multiplies across hundreds of daily operations. The picker is also the last major UX bottleneck before Phase A can be considered operationally excellent.
- Who is blocked: Staff coordinators building game-day checkouts with 5-15 items. Students doing quick self-service checkouts.

## 3) Outcome
- Expected behavior after release: Staff can checkbox-select multiple items per section, see real-time date-range conflict badges before submitting, search within sections by tag/name/brand, and scan a QR code to instantly add an item to the cart — all without leaving the picker.
- Success signal: Checkout creation time drops measurably. Zero "surprise conflicts" at submission time. Scan-to-add becomes the preferred path for staff with gear in hand.

## 4) Scope

### In scope
1. **Checkbox multi-select** — Add checkboxes to serialized asset rows in the picker. "Select all available" and "Deselect all" per section. Bulk items keep their quantity stepper.
2. **Availability preview badges** — Wire the existing `POST /api/availability/check` endpoint into the picker. Show date-range-specific conflict badges (not just current status) when a booking window is set. Badge shows conflicting booking title and window.
3. **Picker search** — Add a search input within each section to filter items by tagName, productName, brand, or model.
4. **Scan-to-add** — Add a "Scan to add" button in the picker that opens the camera. Scanning a QR code identifies the item and adds it to the selected list (with section auto-navigation). Works for both serialized assets and bulk bins.
5. **Extract EquipmentPicker component** — Extract the picker from BookingListPage.tsx into a standalone `src/components/EquipmentPicker.tsx` for maintainability. No behavior change — pure refactor.

### Out of scope
- Kit-based checkout (D-020, Phase B separate feature)
- Database-configurable guidance rules (D-016, Phase C)
- Picker pagination/virtualization (only if performance issues arise)
- Bulk item scan-to-add with unit number selection (existing scan flow handles this)
- Changes to the post-creation scan flow

## 5) Guardrails (Project Invariants)
- Asset status remains derived from active allocations (D-001).
- SERIALIZABLE transactions for booking mutations (D-006).
- Audit logging on all mutations (D-007).
- Tag-first identity in all picker surfaces (D-004).
- Availability check must be a single batched API call, not per-item (avoid N+1 queries).
- Mobile-first: all picker improvements must work on 375px+ screens with 44px+ touch targets.

## 6) Affected Areas
- Domain area: `Checkouts`, `Reservations`
- User roles affected: `ADMIN`, `STAFF`, `STUDENT`
- Location impact: `Mixed`

## 7) Data and API Impact (High-Level)
- Data model impact: None — no schema changes required.
- Read-path impact: `POST /api/availability/check` already exists; picker will call it when the booking date window changes. May need to accept a list of asset IDs to batch-check.
- Write-path impact: None — the selected items are submitted the same way (serializedAssetIds + bulkItems arrays).
- External integration impact: None.

## 8) UX Flow

### Multi-select flow
1. Each serialized asset row gets a checkbox (left of tag name).
2. Checking a box adds the asset to `selectedAssetIds`. Unchecking removes it.
3. Section header shows count: "Cameras (3 selected)".
4. "Select all available" button selects all non-conflicting items in the visible (filtered) section.
5. Selected items appear in a summary strip below the picker tabs showing tag names with remove buttons.

### Availability preview flow
1. When `startsAt` and `endsAt` are set on the booking form, the picker fires a batched availability check.
2. Items with date-range conflicts show an amber/red badge: "Reserved: [booking title] [dates]".
3. Conflicting items are still selectable (staff may override) but show a warning confirmation.
4. Badge updates when the date range changes (debounced 500ms).

### Picker search flow
1. Each section tab content area has a search input at the top.
2. Search filters the visible items by tagName, productName, brand, or model (client-side, case-insensitive).
3. Search term persists per section (switching tabs preserves each section's search).
4. "X items matching" count shown. Clear button resets.

### Scan-to-add flow
1. A "Scan" button appears in the picker header (camera icon).
2. Tapping opens a compact camera overlay (not full-page navigation).
3. Scanning a QR code (`bg://item/<uuid>`) identifies the asset.
4. If the asset is in the picker's data set: auto-select it, auto-navigate to its section, show brief success feedback.
5. If the asset is not in the data set or is retired: show error feedback.
6. Camera stays open for continuous scanning (debounce 2s between reads).
7. Close button returns to picker without losing selections.

## 9) Acceptance Criteria (Testable)
1. User can select multiple serialized assets via checkboxes without leaving the section.
2. "Select all available" selects only items without date-range conflicts in the current section.
3. Availability badges show booking-window-specific conflicts when dates are set.
4. Availability badges update when the booking date range changes.
5. Picker search filters items by tagName, productName, brand, or model within each section.
6. Scan-to-add identifies an asset by QR code and adds it to selections.
7. Scan-to-add auto-navigates to the correct section for the scanned item.
8. Selected item summary strip shows all selected items with remove capability.
9. All picker improvements work on mobile (375px+) with 44px+ touch targets.
10. Conflicting items are selectable with a warning, not hard-blocked.
11. No increase in API calls beyond the single batched availability check per date change.
12. Equipment picker is extracted into a standalone component with no behavior regression.

## 10) Edge Cases
- No dates set yet (skip availability check; show current status only).
- All items in a section are unavailable.
- Scan-to-add scans an item not in the current booking's location.
- Scan-to-add scans a bulk bin QR (add the bulk SKU, not a serialized asset).
- Search returns zero results in a section.
- User changes dates after selecting items (re-check availability, update badges, warn if newly conflicting).
- Camera permission denied during scan-to-add.
- More than 50 items in a section (current cap) — search helps surface items beyond the cap.

## 11) File Scope for Implementation
- Extract: `src/components/EquipmentPicker.tsx` (new, from BookingListPage.tsx)
- Modify: `src/components/BookingListPage.tsx` (use extracted picker)
- Modify: `src/app/api/availability/check/route.ts` (ensure batch-friendly interface)
- Modify: `src/app/globals.css` (picker styles)
- Reuse: `src/components/QrScanner.tsx` (for scan-to-add overlay)
- Reuse: `src/lib/equipment-sections.ts`, `src/lib/equipment-guidance.ts`

## 12) Slice Plan
1. **Slice 1: Extract EquipmentPicker component** — Pure refactor. Extract picker from BookingListPage into standalone component. Zero behavior change. Testable: existing checkout/reservation creation still works identically.
2. **Slice 2: Checkbox multi-select + selected summary strip** — Add checkboxes, select-all-available, deselect-all, and summary strip. Testable: can select/deselect multiple items, summary updates.
3. **Slice 3: Picker search** — Add per-section search input with client-side filtering. Remove 50-item cap (search makes it manageable). Testable: search filters items, persists per section.
4. **Slice 4: Availability preview badges** — Wire availability check API into picker when dates are set. Show conflict badges. Testable: badges appear for conflicting items, update on date change.
5. **Slice 5: Scan-to-add** — Camera overlay in picker, scan QR to add item. Testable: scanning adds item and navigates to section.
6. **Slice 6: Mobile hardening + docs** — Touch target audit, mobile-specific layout fixes, update AREA_CHECKOUTS.md and GAPS_AND_RISKS.md.

## 13) Test Plan (High-Level)
- Unit: checkbox state management, search filtering, availability badge rendering.
- Integration: multi-select → create booking with multiple items, scan-to-add → item appears in selections.
- Regression: existing single-click selection still works, bulk quantity steppers unchanged, guidance rules still fire.
- Manual: mobile picker usability on 375px screen, camera overlay dismiss behavior, conflict badge readability.

## 14) Risks and Mitigations
- Risk: Availability check API latency slows picker responsiveness.
  - Mitigation: Debounce 500ms on date changes; show loading skeleton on badges; single batched call.
- Risk: Camera overlay conflicts with picker state on mobile.
  - Mitigation: Overlay is a portal/modal that doesn't unmount the picker; selections preserved.
- Risk: Extracting picker introduces regressions in BookingListPage.
  - Mitigation: Slice 1 is a pure refactor with build verification before any behavior changes.
- Risk: 50-item cap removal causes performance issues.
  - Mitigation: Search reduces visible items; virtualization deferred unless needed.

## Change Log
- 2026-03-15: Initial brief created.
