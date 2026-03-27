# Search-on-Type Equipment Picker Refactor

*Created: 2026-03-27*

## Problem

`GET /api/form-options` loads ALL non-retired assets on mount (unbounded). This is the last unbounded query and the first thing that will break at scale.

## Current Architecture

1. `form-options` loads all assets + locations + departments + users + bulk SKUs
2. Parent components store full asset array in state
3. `EquipmentPicker` receives full `assets[]` as props
4. All filtering (per-section search, "only available", global search) is client-side
5. Scan-to-add does synchronous `.find()` across full array

**Consumers of form-options assets:**
- `BookingListPage.tsx` → `CreateBookingSheet` → `EquipmentPicker`
- `BookingDetailsSheet.tsx` → `EquipmentPicker`
- `CreateBookingCard.tsx` → `EquipmentPicker`

**Bulk inventory, users pages** only use `locations` — unaffected.

## Key Decisions

1. **Empty picker state:** Show first page of items for active section (preserves browsing)
2. **Selected items cache:** Separate `Map<string, PickerAsset>` — survives search changes
3. **Global search:** Same API, no section filter
4. **Scan-to-add:** Server call via `?qr=<value>` instead of local `.find()`
5. **Section counts:** Returned as metadata in every search response
6. **Bulk SKUs stay in form-options** (bounded, < 100)
7. **Select-all = select visible page** (behavioral change at scale, more predictable)

---

## Slice 1: New Search API Endpoint

**New file:** `src/app/api/assets/picker-search/route.ts`

**Query params:**
- `q` — text search (assetTag, brand, model, serialNumber, name, type)
- `section` — EquipmentSectionKey, filter to matching equipment section
- `only_available` — boolean, default true
- `limit` / `offset` — pagination (default 50)
- `qr` — exact QR/scan code lookup (scan-to-add)
- `ids` — fetch specific assets by ID (hydrate selected on mount/edit)

**Response:**
```typescript
{
  data: {
    assets: PickerAsset[],
    total: number,
    sectionCounts: Record<EquipmentSectionKey, number>,
  }
}
```

**New helper:** `src/lib/equipment-section-filters.ts`
- `sectionWhere(section: EquipmentSectionKey): Prisma.AssetWhereInput`
- Encodes same logic as `classifyAssetType` but as database WHERE clauses
- Uses `CATEGORY_MAP` and `BUCKET_KEYWORDS` from `equipment-sections.ts`

**Checklist:**
- [ ] Create `equipment-section-filters.ts` with Prisma WHERE builders
- [ ] Create `picker-search/route.ts` with text search + section + availability + QR + IDs
- [ ] Add `deriveAssetStatuses` on bounded result set
- [ ] Return `sectionCounts` metadata (5 parallel COUNTs)
- [ ] Build passes
- [ ] Manual test: curl endpoint with various params

---

## Slice 2: EquipmentPicker Refactor

**Modify:** `src/components/EquipmentPicker.tsx`

**Props change:**
```typescript
// Remove: assets: PickerAsset[]
// Add: initialSelectedAssets?: PickerAsset[]  (for edit flow)
```

**New internal state:**
- `sectionResults: PickerAsset[]` — current page from API
- `sectionCounts: Record<EquipmentSectionKey, number>` — from API metadata
- `searchLoading: boolean`
- `selectedAssetsCache: Map<string, PickerAsset>` — all ever-selected items

**Search flow:**
1. Section change or search text change (debounced 300ms) → API call
2. Response updates `sectionResults` + `sectionCounts`
3. Initial mount: fire search with empty `q` for default section
4. AbortController pattern (already used in availability preview)

**Scan-to-add → async:**
- `GET /api/assets/picker-search?qr={value}&limit=1`
- Show brief loading state in scan feedback
- Bulk SKU scan still client-side (bounded)

**Global search → API-backed:**
- `GET /api/assets/picker-search?q={globalSearch}&only_available={flag}&limit=30`
- Same keyboard navigation logic

**Checklist:**
- [ ] Add `selectedAssetsCache` Map and seed from `initialSelectedAssets`
- [ ] Replace `sectionAssets` memo with API-backed `sectionResults`
- [ ] Replace global search memo with API call
- [ ] Replace scan `.find()` with async API call
- [ ] Section tab counts from API metadata
- [ ] Loading states and AbortController
- [ ] Equipment guidance still works from `selectedAssetsCache`
- [ ] Build passes

---

## Slice 3: Remove Assets from form-options

**Modify:** `src/app/api/form-options/route.ts`
- Remove `availableAssets` query, `deriveAssetStatuses` call, enrichment loop
- Response: `{ locations, departments, users, bulkSkus }`

**Consumer updates:**
- `BookingListPage.tsx` — remove `availableAssets` state, stop passing to sheet
- `BookingDetailsSheet.tsx` — pass `initialSelectedAssets` from booking data
- `CreateBookingCard.tsx` — remove `availableAssets` prop

**Checklist:**
- [ ] Strip assets from form-options endpoint
- [ ] Update all 3 consumers
- [ ] Build passes
- [ ] No references to `availableAssets` remain in booking components

---

## Slice 4: Testing and Hardening

**Manual test scenarios:**
1. Open picker, no search → first page of cameras loads
2. Type in section search → results update after debounce
3. Switch tabs → new section loads
4. Global search → cross-section results
5. Scan QR → async lookup, item added
6. Select across sections → counts update, guidance fires
7. "Only available" toggle → re-fetches
8. Edit booking → previously selected items visible
9. Empty results → "No matching items"

**Performance:**
- pg_trgm GIN indexes already added (migration 0021)
- Cache section counts 5-10s to avoid 5 COUNTs per keystroke
- AbortController on stale requests

**Edge cases:**
- Stale response race → AbortController
- Scan while search loading → not blocked
- Selected item becomes unavailable → conflict preview flags it

**Checklist:**
- [ ] All 9 manual test scenarios pass
- [ ] Section count caching implemented
- [ ] AbortController on all search paths
- [ ] No regressions in booking create/edit flows
