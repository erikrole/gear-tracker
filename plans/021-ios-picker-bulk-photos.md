# Plan 021: Show asset photos for battery / counted-item rows in the iOS booking picker

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e4b35ae..HEAD -- src/app/api/form-options/route.ts ios/Wisconsin/Models/FormModels.swift ios/Wisconsin/Views/CreateBookingSheet.swift`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (UX consistency)
- **Planned at**: commit `6e4b35ae`, 2026-06-13
- **State**: DONE ON MAIN (2026-06-19)

## Why this matters

In the native reservation-creation picker (`CreateBookingSheet`), serialized equipment rows show the asset's photo (`AsyncImage`), but battery / counted-item rows (`BulkQuantityRow`) show a generic `shippingbox` SF Symbol -- even though those SKUs **have** real photos. `BulkSku.imageUrl` is a populated column (plan 004 rehosts those images to Vercel Blob), but the `/api/form-options` endpoint that feeds the picker never selects it, so the iOS `FormBulkSku` model has no image field and the row can't render one. The two halves of the same picker look inconsistent: a Sony battery shows a box, the camera next to it shows its photo. This plan plumbs the existing image through so battery rows match serialized rows, falling back to the box only when a SKU genuinely has no image.

Server half is fully verifiable here; the iOS render is source-verified + `drift:ios` (no Xcode here).

## Current state

### Server -- `src/app/api/form-options/route.ts`

The bulk SKU query selects several fields but **not** `imageUrl` (lines 14-26), and the flat mapping omits it (lines 28-41):

```ts
db.bulkSku.findMany({
  where: { active: true },
  orderBy: { name: "asc" },
  select: {
    id: true, name: true, category: true, unit: true, locationId: true, binQrCodeValue: true, trackByNumber: true,
    // ...counts...
    categoryRel: { select: { name: true } },
  },
}),
// ...
const bulkSkusFlat = bulkSkus.map((s) => {
  // ...
  return {
    id: s.id, name: s.name, category: s.category, unit: s.unit,
    locationId: s.locationId, binQrCodeValue: s.binQrCodeValue, trackByNumber: s.trackByNumber,
    // ...
    categoryName: s.categoryRel?.name ?? null,
    // ...
    availableQuantity,
  };
});
```

`BulkSku.imageUrl` exists in the schema (`prisma/schema.prisma:461`, `imageUrl String? @map("image_url")`).

### iOS model -- `ios/Wisconsin/Models/FormModels.swift:17`

`FormBulkSku` uses synthesized `Codable` (no custom initializer), so adding an optional property is safe -- a missing JSON key decodes to `nil`:

```swift
struct FormBulkSku: Codable, Identifiable, Hashable, Equatable {
    let id: String
    let name: String
    let category: String?
    let unit: String?
    let locationId: String?
    let binQrCodeValue: String?
    let trackByNumber: Bool
    let categoryName: String?
    let currentQuantity: Int
    let availableQuantity: Int
}
```

### iOS row -- `ios/Wisconsin/Views/CreateBookingSheet.swift:1479-1485`

`BulkQuantityRow` renders a static symbol where the photo should go:

```swift
var body: some View {
    HStack(spacing: 12) {
        Image(systemName: "shippingbox")
            .foregroundStyle(.secondary)
            .frame(width: 44, height: 44)
            .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
            .accessibilityHidden(true)
        // ...name + subtitle + stepper...
```

### Exemplar -- `AssetPickerRow` photo treatment (`CreateBookingSheet.swift:1539-1553`)

The serialized row already does exactly the photo+fallback pattern to copy:

```swift
Group {
    if let urlString = asset.imageUrl, let url = URL(string: urlString) {
        AsyncImage(url: url) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            assetPlaceholder
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(RoundedRectangle(cornerRadius: 8).strokeBorder(Color(.separator), lineWidth: 1))
    } else {
        assetPlaceholder.frame(width: 44, height: 44)
    }
}
```

### Convention -- form-options route tests

`tests/form-options-bulk-counts.test.ts` mocks `@/lib/db` + `@/lib/auth` and asserts the shape `GET /api/form-options` returns for bulk SKUs. Extend it. iOS wiring is asserted as source strings in `tests/ios-create-booking-picker-parity.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Form-options tests | `npx vitest run tests/form-options-bulk-counts.test.ts` | all pass |
| Picker wiring tests | `npx vitest run tests/ios-create-booking-picker-parity.test.ts` | all pass |
| Type gate | `npx tsc --noEmit` | exit 0 |
| iOS drift gate | `npm run drift:ios` | exit 0 |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope** (the only files you may modify):

- `src/app/api/form-options/route.ts` -- add `imageUrl` to the bulk SKU `select` and the flat mapping only.
- `ios/Wisconsin/Models/FormModels.swift` -- add `let imageUrl: String?` to `FormBulkSku`.
- `ios/Wisconsin/Views/CreateBookingSheet.swift` -- the `BulkQuantityRow` leading image only (optionally `SelectedBulkRow` for the same treatment -- see Step 3).
- `tests/form-options-bulk-counts.test.ts` and `tests/ios-create-booking-picker-parity.test.ts` -- assertions.

**Out of scope** (do NOT touch):

- The bulk count logic (`availableQuantity`, `currentQuantity`) in form-options -- unchanged.
- `AssetPickerRow` -- it is the exemplar; do not edit it.
- The stepper / quantity controls in `BulkQuantityRow` -- only the leading image changes.
- Any other `/api/form-options` consumer or the web equipment picker.

## Git workflow

- Branch: `improve-exec/021-ios-picker-bulk-photos` (fresh from `main` HEAD).
- Conventional commit, e.g. `fix: battery picker rows show their photo instead of a generic box`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Expose `imageUrl` from form-options

In `src/app/api/form-options/route.ts`, add `imageUrl: true` to the `db.bulkSku.findMany` `select`, and add `imageUrl: s.imageUrl` to the object returned by the `bulkSkusFlat` map.

**Verify**: `npx tsc --noEmit` exits 0; `grep -n "imageUrl" src/app/api/form-options/route.ts` shows both the select and the mapping.

### Step 2: Add the field to the iOS model

In `ios/Wisconsin/Models/FormModels.swift`, add `let imageUrl: String?` to `FormBulkSku` (place it near `categoryName`). No initializer changes are needed (synthesized `Codable`).

**Verify**: `grep -n "imageUrl" ios/Wisconsin/Models/FormModels.swift` shows the new field.

### Step 3: Render the photo in `BulkQuantityRow`

In `ios/Wisconsin/Views/CreateBookingSheet.swift`, replace the static `Image(systemName: "shippingbox")` leading view in `BulkQuantityRow` with the photo+fallback pattern, mirroring `AssetPickerRow`. Keep the box as the fallback for SKUs with no image:

```swift
Group {
    if let urlString = sku.imageUrl, let url = URL(string: urlString) {
        AsyncImage(url: url) { image in
            image.resizable().aspectRatio(contentMode: .fill)
        } placeholder: {
            bulkPlaceholder
        }
        .frame(width: 44, height: 44)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).strokeBorder(Color(.separator), lineWidth: 1))
    } else {
        bulkPlaceholder.frame(width: 44, height: 44)
    }
}
.accessibilityHidden(true)
```

Add a `bulkPlaceholder` computed view inside `BulkQuantityRow` that reproduces the current box look (so behavior is unchanged when there is no image):

```swift
private var bulkPlaceholder: some View {
    Image(systemName: "shippingbox")
        .foregroundStyle(.secondary)
        .frame(width: 44, height: 44)
        .background(Color(.secondarySystemBackground), in: RoundedRectangle(cornerRadius: 10))
}
```

(Optional, same file, same pattern: if `SelectedBulkRow` -- around line 1426 -- shows a leading box too, give it the identical treatment so the selected list matches. If it has no leading image, skip it.)

**Verify**: `grep -n "AsyncImage" ios/Wisconsin/Views/CreateBookingSheet.swift` shows a match inside `BulkQuantityRow` (in addition to the existing one in `AssetPickerRow`).

### Step 4: Tests

1. In `tests/form-options-bulk-counts.test.ts`, extend a bulk-SKU fixture to include `imageUrl: "https://blob.example/sku.jpg"` in the mocked `db.bulkSku.findMany` result and assert the returned `bulkSkus[...]` entry carries `imageUrl: "https://blob.example/sku.jpg"`. Add `imageUrl: null` to any existing fixtures so they still type-check against the widened select if needed.
2. In `tests/ios-create-booking-picker-parity.test.ts`, add a source-contract test:

```ts
it("shows battery/counted-item photos in the native picker", () => {
  const formOptions = source("src/app/api/form-options/route.ts");
  const models = source("ios/Wisconsin/Models/FormModels.swift");
  const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");

  expect(formOptions).toContain("imageUrl: true");
  expect(formOptions).toContain("imageUrl: s.imageUrl");
  expect(models).toContain("let imageUrl: String?");
  // BulkQuantityRow renders the image with a box fallback
  const bulkRow = createSheet.slice(createSheet.indexOf("struct BulkQuantityRow"));
  expect(bulkRow).toContain("AsyncImage(url: url)");
  expect(bulkRow).toContain("bulkPlaceholder");
});
```

**Verify**: `npx vitest run tests/form-options-bulk-counts.test.ts tests/ios-create-booking-picker-parity.test.ts` -> all pass.

### Step 5: Full verification

**Verify**: `npm run test` exit 0; `npm run lint` exit 0; `npm run drift:ios` exit 0.

## Test plan

- `tests/form-options-bulk-counts.test.ts`: the endpoint returns `imageUrl` for bulk SKUs (behavioral, runs here).
- `tests/ios-create-booking-picker-parity.test.ts`: source-contract that the field exists on `FormBulkSku` and `BulkQuantityRow` renders an `AsyncImage` with a `bulkPlaceholder` fallback.
- `npx tsc --noEmit`: proves the widened `select` + mapping type-check.

## Done criteria

ALL must hold:

- [x] `src/app/api/form-options/route.ts` selects `imageUrl: true` and maps `imageUrl: s.imageUrl`
- [x] `FormBulkSku` has `let imageUrl: String?`
- [x] `BulkQuantityRow` renders `AsyncImage` with a `bulkPlaceholder` fallback (box only when no image)
- [x] `npx vitest run tests/form-options-bulk-counts.test.ts tests/ios-create-booking-picker-parity.test.ts` exits 0
- [x] `npx tsc --noEmit` exits 0; `npm run test` exits 0; `npm run lint` exits 0; `npm run drift:ios` exits 0
- [x] No implementation or test files modified outside the in-scope list (`git status`; docs/task tracking updated per project rules)
- [x] `plans/README.md` status row for 021 updated

## Review

- Shipped: `/api/form-options` now carries `BulkSku.imageUrl`, `FormBulkSku` decodes it, and both the bulk quantity row and selected bulk row render the SKU photo with the previous shipping-box fallback.
- Verified: `npx vitest run tests/form-options-bulk-counts.test.ts tests/ios-create-booking-picker-parity.test.ts`; `npx tsc --noEmit`; `npm run drift:ios`; `npm run test`; `npm run lint`; `npm run verify:docs`; `git diff --check`; XcodeBuildMCP `build_sim` for `Wisconsin` on iPhone 17 iOS 26.5.
- Remaining: visual smoke before release to confirm photo and fallback rendering with real SKU images.

## STOP conditions

Stop and report back (do not improvise) if:

- form-options, `FormBulkSku`, or `BulkQuantityRow` no longer match the "Current state" excerpts (drift).
- `BulkSku` has no `imageUrl` column at the planned schema location (`grep -n "imageUrl" prisma/schema.prisma` near `model BulkSku`) -- report; do not invent a field.
- Adding `imageUrl` to `FormBulkSku` breaks an existing decode test in a way a missing key shouldn't (it should decode to nil) -- report.
- The form-options test mock shape has diverged such that adding `imageUrl` to a fixture cascades into unrelated failures you cannot resolve in two attempts.

## Maintenance notes

- iOS compile proof passed on 2026-06-19 via XcodeBuildMCP `build_sim` for `Wisconsin` on iPhone 17 iOS 26.5. A visual smoke can still confirm battery rows show their photo when the SKU has one and fall back to the box otherwise.
- This depends on `BulkSku.imageUrl` being populated; plan 004 rehosts external SKU images to Blob, so most should resolve. SKUs without an image keep the box -- that is expected, not a regression.
- If a future change adds image rendering to the web equipment picker, the same `imageUrl` is now in the form-options payload -- no further server change needed.
- A reviewer should confirm the box fallback is byte-equivalent to the old look so SKUs without images are visually unchanged.
