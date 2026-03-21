# New Item Sheet Refactor Plan

## Issues to Fix
1. File is ~900 lines — split into sub-components
2. Bulk SKU dropdown doesn't scale — swap for searchable combobox
3. Single booking toggle hides 3-field mismatch with detail page
4. No testing — form submission, validation, adjust endpoint untested
5. `__none__` sentinel values scattered through select logic
6. No image upload — ChooseImageModal needs asset ID

---

## Slice 1: Extract shared types, helpers, layout (Foundation)

**Complexity:** Low
**Dependencies:** None

- [ ] Create `src/app/(app)/items/new-item-sheet/types.ts`
  - `CategoryOption`, `Location`, `Department`, `BulkSkuOption`, `ParentSearchResult`, `ItemKind`, `BulkMode`, `NewItemSheetProps`
- [ ] Create `src/app/(app)/items/new-item-sheet/helpers.ts`
  - `generateQrCode`, `useIsMobile`, `getFiscalYearOptions`, `FISCAL_YEARS`, `useParentSearch`
- [ ] Create `src/app/(app)/items/new-item-sheet/layout.tsx`
  - `FormRow`, `FormRow2Col`, `SectionHeading`, `SuccessFlash`
- [ ] Update `new-item-sheet.tsx` to import from these modules

---

## Slice 2: Split into SerializedItemForm and BulkItemForm

**Complexity:** Medium
**Dependencies:** Slice 1

- [ ] Create `src/app/(app)/items/new-item-sheet/SerializedItemForm.tsx`
  - Owns: `categoryId`, `locationId`, `departmentId`, `fiscalYear`, `qrCodeValue`, `showScanner`, `isAccessory`, `parentAsset`, booking toggles
  - Exposes via `forwardRef` + `useImperativeHandle`: `validate(): string | null`, `getSubmitBody(): Record<string, unknown>`, `reset(keepShared?: boolean)`
- [ ] Create `src/app/(app)/items/new-item-sheet/BulkItemForm.tsx`
  - Owns: `bulkMode`, `existingBulkSkus`, `selectedBulkSkuId`, `addQty`, `bulkQrCode`, `categoryId`, `locationId`
  - Same imperative API
- [ ] Slim down `new-item-sheet.tsx` to thin orchestrator
  - Keeps: `kind` radio, `open`, `addAnother`, `successMsg`, `submitting`, Sheet chrome, `<form>` wrapper
  - Calls `ref.current.validate()` then `ref.current.getSubmitBody()` in `handleSubmit`

---

## Slice 3: Searchable combobox + `__none__` cleanup

**Complexity:** Medium
**Dependencies:** Slice 2
**Can parallelize with:** Slices 4, 5

- [ ] Create `src/app/(app)/items/new-item-sheet/BulkSkuCombobox.tsx`
  - Popover + Command pattern (matches `ItemInfoTab.tsx` lines 401-480)
  - CommandInput filters by name/location/category
  - Shows: `{name} — {qty} on hand ({location})`
- [ ] Replace bulk SKU Select dropdown with BulkSkuCombobox
- [ ] Replace category/department/fiscal year Selects with Popover+Command comboboxes
  - Initialize state to `""` instead of `"__none__"`
  - Remove all `=== "__none__"` checks from validation and submit logic
- [ ] Verify no `__none__` values reach the API

---

## Slice 4: Fix booking toggle mismatch

**Complexity:** Low
**Dependencies:** Slice 2
**Can parallelize with:** Slices 3, 5

- [ ] Replace single "Available for booking" Switch with three toggles matching detail page:
  - "Available for reservation" — "Item is available to be used in reservations"
  - "Available for check out" — "Item is available to be used in check-outs"
  - "Available for custody" — "Item can be taken into custody by a user"
- [ ] State: `availableForReservation`, `availableForCheckout`, `availableForCustody` (all default `true`)
- [ ] When `isAccessory` toggled on → set all three to `false`
- [ ] Submit body sends three fields individually (API already accepts them)

---

## Slice 5: Image upload post-creation

**Complexity:** Medium-High
**Dependencies:** Slice 2
**Can parallelize with:** Slices 3, 4

- [ ] Add state: `createdAssetId: string | null`, `showImageModal: boolean`
- [ ] After successful serialized creation:
  - Store `createdAssetId` from API response (`json.data.id`)
  - Show success state with "Add Image" button + "Done" / "Add Another"
  - "Add Image" opens `ChooseImageModal` with `assetId={createdAssetId}`
  - On image change callback or skip → proceed with close/reset
- [ ] Bulk items: no image upload (BulkSku has no imageUrl)
- [ ] No changes to ChooseImageModal needed — already takes `assetId` prop

---

## Slice 6: Testing

**Complexity:** Medium
**Dependencies:** All other slices

- [ ] Create test file(s) in `src/app/(app)/items/__tests__/`
- [ ] Test cases:
  - Serialized form validation (required fields show errors)
  - Serialized submit sends correct payload to POST /api/assets
  - Bulk "create new" submits to POST /api/bulk-skus
  - Bulk "add to existing" calls POST /api/bulk-skus/{id}/adjust
  - Three booking toggles send independent values
  - Accessory mode disables all three booking toggles
  - No `__none__` values in any submitted payload
  - Combobox search filters results
  - Image upload flow triggers after creation

---

## Execution Order

```
Slice 1 (Foundation)
  │
  ▼
Slice 2 (Split forms)
  │
  ├──▶ Slice 3 (Combobox + __none__)  ─┐
  ├──▶ Slice 4 (Booking toggles)       ├──▶ Slice 6 (Testing)
  └──▶ Slice 5 (Image upload)         ─┘
```

Slices 3, 4, 5 can run in parallel after Slice 2 completes.

---

## Files Summary

| File | Action |
|------|--------|
| `items/new-item-sheet.tsx` | Slim to orchestrator |
| `items/new-item-sheet/types.ts` | Create |
| `items/new-item-sheet/helpers.ts` | Create |
| `items/new-item-sheet/layout.tsx` | Create |
| `items/new-item-sheet/SerializedItemForm.tsx` | Create |
| `items/new-item-sheet/BulkItemForm.tsx` | Create |
| `items/new-item-sheet/BulkSkuCombobox.tsx` | Create |
| `items/__tests__/new-item-sheet.test.tsx` | Create |
