# Plan 051: Add item-family image handoff after create

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/(app)/items/new-item-sheet.tsx src/app/(app)/items/new-item-sheet/BulkItemForm.tsx src/components/ChooseImageModal.tsx src/app/api/bulk-skus/[id]/image/route.ts tests/new-item-sheet-ui-source.test.ts docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: feature
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Standard item creation already offers a post-create image handoff. Units and Quantity item families do not, even though they appear in `/items` beside serialized assets and already have a shared BulkSku image endpoint and detail-page image picker. This creates avoidable thumbnail gaps for batteries, supplies, and countable families created manually through Add Item.

## Current state

- `docs/AREA_ITEMS.md` lines 164-169 list image options for Create Item, and line 61 says save can lead to an image step.
- `NewItemSheet` supports post-create image handoff only for Standard assets:

```tsx
// src/app/(app)/items/new-item-sheet.tsx:292-317
// For serialized items, show image upload prompt before proceeding
if (kind === "standard" && json?.data?.id) {
  const createdId = json.data.id;
  const pendingImageFile = serializedRef.current?.getPendingImageFile() ?? null;
  let handoffDescription = "Open the item record to finish photos, QR details, policy settings, and booking context.";
  if (pendingImageFile) {
    try {
      await uploadCreatedAssetImage(createdId, pendingImageFile);
      handoffDescription = "Photo uploaded. Open the item record to finish QR details, policy settings, and booking context.";
    } catch (uploadError) {
      const message = uploadError instanceof Error ? uploadError.message : "Image upload failed.";
      handoffDescription = `${message} Use Add image below or open the item record to try again.`;
    }
  }
```

- The post-create Add image card is also Standard-only:

```tsx
// src/app/(app)/items/new-item-sheet.tsx:399-414
{createdHandoff?.kind === "standard" && (
  <div className="flex flex-col items-center gap-1 rounded-xl border border-border/50 bg-muted/20 px-4 py-4">
    <Button
      type="button"
      variant="outline"
      className="gap-2"
      onClick={() => setShowImageModal(true)}
    >
      <ImageIcon className="size-4" />
      Add image
    </Button>
```

- The modal can already target non-asset endpoints:

```tsx
// src/components/ChooseImageModal.tsx:50-60
type Props = {
  open: boolean;
  onClose: () => void;
  /** Base upload endpoint, e.g. `/api/assets/{id}/image` or `/api/bulk-skus/{id}/image` */
  uploadEndpoint?: string;
  currentImageUrl: string | null;
  onImageChanged: (newUrl: string | null) => void;
  searchQuery?: string;
  /** @deprecated Use uploadEndpoint instead */
  assetId?: string;
};
```

- BulkSku detail already uses that endpoint:

```tsx
// src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx:97-108
{canEdit && (
  <ChooseImageModal
    open={imageModalOpen}
    onClose={() => setImageModalOpen(false)}
    uploadEndpoint={`/api/bulk-skus/${sku.id}/image`}
    currentImageUrl={sku.imageUrl}
    searchQuery={sku.name}
    onImageChanged={(url) => {
      setImageModalOpen(false);
      onImageChanged?.(url);
    }}
  />
)}
```

- The BulkSku image route supports upload, URL, search-result URL, and delete through the same modal contract:

```ts
// src/app/api/bulk-skus/[id]/image/route.ts:13-18
/**
 * POST /api/bulk-skus/:id/image - upload or replace a bulk SKU image
 */
export const POST = withAuth<{ id: string }>(async (req, { user, params }) => {
  requirePermission(user.role, "bulk_sku", "edit");
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Source-contract tests | `npx vitest run tests/new-item-sheet-ui-source.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/(app)/items/new-item-sheet.tsx`
- `tests/new-item-sheet-ui-source.test.ts`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`

**Reference only, do not edit unless required by type drift**:
- `src/components/ChooseImageModal.tsx`
- `src/app/api/bulk-skus/[id]/image/route.ts`
- `src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx`

**Out of scope**:
- Do not add a pre-create image upload field to Units or Quantity in this plan.
- Do not change BulkSku image API behavior.
- Do not change serialized item image behavior.
- Do not add image requirements to item-family creation.

## Git workflow

- Branch: `advisor/051-item-family-image-handoff`
- Commit style: conventional commit, for example `feat: offer image handoff for item families`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Generalize post-create image state

In `NewItemSheet`, replace `createdAssetId` with a more general image-target state, for example:

```ts
type CreatedImageTarget = {
  uploadEndpoint: string;
  searchQuery: string;
};
```

For Standard creations, set `uploadEndpoint` to `/api/assets/${createdId}/image`. For Units and Quantity creations, set `uploadEndpoint` to `/api/bulk-skus/${bulkId}/image`.

Preserve `createdHandoff` as the main success state.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Show Add image for created item families

Change the post-create Add image card so it appears when there is an image target, not only when `createdHandoff.kind === "standard"`.

Copy:
- For Standard: keep existing "You can also add an image later from the item detail page."
- For Units and Quantity: use concise copy such as "You can also add an image later from the item detail page."

Do not add long guidance. Keep the existing card shape.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Open ChooseImageModal with the correct endpoint

Render `ChooseImageModal` when the new image target exists.

Use:
- `uploadEndpoint={createdImageTarget.uploadEndpoint}`
- `currentImageUrl={null}`
- `searchQuery={createdImageTarget.searchQuery}`
- existing `onImageChanged` flow that closes the modal and completes handoff through `finishCreatedHandoff(addAnother ? "another" : "list")`

For Standard, stop relying on the deprecated `assetId` prop in this file. Use `uploadEndpoint` consistently.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Ensure bulk handoff gets a real id

In the non-Standard submit path, `bulkId` currently comes from `json?.data?.id ?? bulkHandoffHref?.split("/").pop()`. Keep that fallback for existing adjustments, but only create an image target when the operation created or updated a BulkSku with a valid id.

Rules:
- New Units: image target yes.
- New Quantity: image target yes.
- Quantity add-to-existing: image target yes if a selected existing id is known, because adding stock is a good time to fix the family thumbnail.
- If no id can be resolved, do not render Add image.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 5: Add source-contract coverage

Extend `tests/new-item-sheet-ui-source.test.ts` to assert:

- `new-item-sheet.tsx` uses `uploadEndpoint` for `ChooseImageModal`.
- It includes `/api/bulk-skus/${` or an equivalent endpoint construction for item-family image handoff.
- The Add image card is not gated only by `createdHandoff?.kind === "standard"`.

Avoid brittle assertions about exact variable names if the implementation is clear.

**Verify**: `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0.

### Step 6: Sync docs

Update `docs/AREA_ITEMS.md` and `docs/AREA_BULK_INVENTORY.md` change logs.

Document that Add Item now offers the shared image picker after Units or Quantity family creation or stock update, using the existing BulkSku image endpoint.

**Verify**: `rg -n "image handoff|BulkSku image|Add item|Change Log" docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md` shows the new entries.

## Test plan

- Source-contract coverage in `tests/new-item-sheet-ui-source.test.ts`.
- `npx tsc --noEmit`.
- `git diff --check`.

## Done criteria

- [ ] Standard post-create image behavior still works.
- [ ] Units post-create handoff offers Add image through `/api/bulk-skus/[id]/image`.
- [ ] Quantity new-family post-create handoff offers Add image through `/api/bulk-skus/[id]/image`.
- [ ] Quantity add-to-existing handoff offers Add image when the existing family id is known.
- [ ] The shared `ChooseImageModal` remains the only image picker used.
- [ ] `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 051 is updated.

## STOP conditions

Stop and report back if:

- `ChooseImageModal` no longer supports `uploadEndpoint`.
- `/api/bulk-skus/[id]/image` no longer accepts the same modal upload/URL contract.
- The non-Standard submit response no longer returns or exposes a reliable BulkSku id.
- Implementing this requires adding new image storage or changing Blob behavior.

## Maintenance notes

This plan intentionally uses the existing BulkSku image endpoint rather than adding a new image model. Future work could add pre-create photo upload for item families, but post-create handoff is the lower-risk slice because it mirrors the existing detail-page image flow.
