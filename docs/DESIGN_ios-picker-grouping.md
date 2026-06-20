# iOS Reservation Equipment Picker Grouping

## Status
- Date: 2026-06-19
- Decision: Accepted and implemented in Plan 023
- Scope: Native iOS `CreateBookingSheet` equipment picker only
- Depends on: Plan 020's `/api/assets?sort=name` display-aligned ordering

## Source Checks
- `ios/Wisconsin/Views/CreateBookingSheet.swift` currently renders serialized assets as one flat paginated `Section`, appending 30 rows at a time through `availableAssets += resp.data`.
- `ios/Wisconsin/Core/APIClient.swift` can request `category_id` and `sort`, but does not yet send `location_id`.
- `src/app/api/assets/route.ts` already supports `status`, `location_id`, `category_id`, `sort=name`, `limit`, and `offset`; no new response shape is required for a first grouping slice.
- A read-only live Neon aggregate on 2026-06-19 found one parent-asset location: Camp Randall has 194 serialized parent assets, 193 with stored `AVAILABLE` status. Top stored-available categories were Uncategorized 50, Lenses 33, Camera Bodies 31, Accessories 13, Backpacks 12, Peripherals 11, Monitors 10, Microphones 7, Camera Monitors 7, Tripods 7, Batteries 4, Monopods 3.

## Chosen Approach
Choose Option A: load the bounded picker result set for the selected location and group client-side by category.

The first implementation slice should request available serialized assets for the selected location with `sort=name`, `limit=300`, and `offset=0`, then group the returned rows into iOS `Section`s by `asset.category?.name ?? "Uncategorized"`. Within each group, keep the Plan 020 display order: brand, model, then asset tag.

This is the right first slice because the live upper bound is small enough for one native picker request, the UI becomes stable immediately, and the server contract stays boring. A 194-row payload with existing thumbnail URLs and relation fields is acceptable for a modal picker that opens after the user has already chosen a location and date window. It also avoids the main failure mode of naive paginated grouping: category headers appearing, disappearing, or repeating as pages stream in.

Add one guard: if `resp.total > resp.data.count`, show a compact recovery row that asks the user to search to narrow results, and do not pretend the grouped list is exhaustive. That keeps the design honest if the inventory grows past the cap.

## Options Evaluated

### Option A: Client-side grouping after one bounded fetch
Pros:
- Stable category sections. No duplicate headers across page boundaries.
- Smallest implementation: API client location parameter, one fetch-size change, local grouping, and source-contract tests.
- Uses the existing `/api/assets` response and iOS `Asset.category` model.
- Live inventory evidence supports it: 194 parent assets at the only current location, with the largest category at 50.

Cons:
- One larger request than the current 30-row page.
- If a future location has more than the cap, the picker needs search-first recovery.

Verdict: choose this for the first implementation slice.

### Option B: Server category ordering with paginated client headers
Pros:
- Keeps infinite scroll.
- Could be implemented by extending `sort=category` to include Plan 020's name tie-breakers.

Cons:
- A category can span page boundaries, so the client must remember the previous page's last category to avoid repeated headers.
- Section counts are misleading until all pages load.
- Search reset and pagination state become more complex for little benefit at the current inventory size.

Verdict: reject for now. It preserves pagination at the cost of unstable section semantics.

### Option C: Dedicated grouped response shape
Pros:
- Cleanest long-term API for very large inventories.
- Can return per-category totals and group-level pagination affordances.

Cons:
- New response shape and Swift decoding path.
- More server work before a user-visible improvement.
- Overbuilt for the current 194-item live bound.

Verdict: defer. Revisit only if a location exceeds the single-fetch cap often enough that search-first recovery becomes annoying.

## Data Contract

First slice request:

```http
GET /api/assets?status=AVAILABLE&location_id=<locationId>&sort=name&limit=300&offset=0
```

Existing response shape remains:

```json
{
  "data": [
    {
      "id": "asset_123",
      "assetTag": "CAM-001",
      "brand": "Sony",
      "model": "FX6",
      "category": { "id": "cat_camera", "name": "Camera Bodies" },
      "imageUrl": "https://..."
    }
  ],
  "total": 194,
  "limit": 300,
  "offset": 0
}
```

No `group_by` parameter is needed for the first slice. The grouping key is local:

```swift
asset.category?.name ?? "Uncategorized"
```

The API client should add an optional `locationId` argument that serializes as `location_id`.

## Pagination And Search

Default browse mode:
- Reset current asset state when the user enters Equipment or changes selected location.
- Fetch one bounded page: `limit=300`, `offset=0`, `status=AVAILABLE`, `location_id=<selectedLocationId>`, `sort=name`.
- Group the returned `data` locally into category sections.
- Disable infinite-scroll append in grouped browse mode.
- If `total > data.count`, render a small non-blocking row after the sections: `More equipment exists. Search to narrow results.`

Search mode:
- Keep the same endpoint, selected location, status filter, `sort=name`, and `limit=300`.
- Debounced search still resets the result set.
- Group matching results by category.
- If a search still returns `total > data.count`, keep the same recovery row.

Scan-to-add:
- Scanned asset lookup can remain independent of the grouped browse list.
- A successfully scanned available asset should still be added to `selectedAssetSnapshots` even if it is outside the current grouped search result.

## Thin First Slice

1. Extend `APIClient.assets` with `locationId: String? = nil` and append `location_id`.
2. In `CreateBookingSheet.loadAvailableAssets(reset:)`, pass `selectedLocationId`, request `limit: 300`, `offset: 0`, and stop appending pages for this picker path.
3. Add a grouped computed view model, for example `availableAssetGroups`, ordered by category name with `Uncategorized` last or explicitly first by product choice.
4. Render one `Section` per group in the Equipment list. Keep `AssetPickerRow` unchanged.
5. Preserve selected equipment and scan-to-add behavior.
6. Add source-contract tests that pin `location_id`, `limit: 300`, grouped sections, and the overflow/search recovery copy.

## Implementation Result

Plan 023 shipped the chosen first slice on 2026-06-19. Native reservation creation now:
- Sends `location_id` through `APIClient.assets`.
- Requests `status=AVAILABLE`, `sort=name`, `limit=300`, and `offset=0` for the selected pickup location.
- Groups serialized picker rows by category in SwiftUI sections with Uncategorized last.
- Replaces the old infinite-scroll append path for this picker.
- Shows `More equipment exists. Search to narrow results.` when the response cap is exceeded.

## Non-Goals For The First Slice

- Do not add a new `/api/assets` response shape.
- Do not add `group_by=category`.
- Do not port the full web section/guidance model into iOS.
- Do not add per-category pagination.
- Do not change `Asset` decoding unless the existing category field no longer matches live data.
- Do not make category grouping database-configurable.

## Follow-Up Trigger

Revisit a grouped server response if any one location regularly exceeds 300 available serialized parent assets or if operators report that search-first recovery hides too much gear.
