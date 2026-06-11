# Plan 023: Consolidate item thumbnail stacks on AvatarGroup and AssetImage

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/ItemThumbnailStack.tsx src/components/AssetImage.tsx src/components/ui/avatar.tsx src/components/booking-list/BookingCard.tsx src/app/\\(app\\)/dashboard/dashboard-avatars.tsx src/app/\\(app\\)/bookings/BookingEquipmentTab.tsx tests/shadcn-avatar-contracts.test.ts docs/AREA_ITEMS.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/022-make-asset-image-shadcn-backed.md
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

`ItemThumbnailStack` currently duplicates image URL normalization, image failure state, fallback rendering, and avatar-group layout. After plan 022, `AssetImage` owns item thumbnail behavior and shadcn `AvatarGroup` owns stack behavior. Rebuilding the stack on those primitives removes a second item-image code path and makes booking and dashboard thumbnails consistent.

## Current state

- `src/components/ItemThumbnailStack.tsx` currently rolls its own group and image fallback:

```tsx
// src/components/ItemThumbnailStack.tsx:3-5
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { normalizeAssetImageSrc } from "@/lib/asset-image";
```

```tsx
// src/components/ItemThumbnailStack.tsx:32-65
export function ItemThumbnailStack({
  items,
  max = 3,
  size = 28,
  overflowCount = 0,
  className,
  surfaceClassName,
}: ItemThumbnailStackProps) {
  const visibleItems = items.slice(0, max);
  const extraCount = Math.max(0, items.length - visibleItems.length) + overflowCount;

  return (
    <div className={cn("flex -space-x-2", className)} aria-label={items.map((item) => item.name).join(", ")}>
      {visibleItems.map((item) => (
        <StackImage
          key={item.id}
```

```tsx
// src/components/ItemThumbnailStack.tsx:68-90
function StackImage({
  item,
  size,
  className,
}: {
  item: ItemThumbnail;
  size: number;
  className?: string;
}) {
  const normalizedSrc = normalizeAssetImageSrc(item.imageUrl);
  const [failed, setFailed] = useState(false);
```

- Dashboard and booking cards consume the stack:

```tsx
// src/app/(app)/dashboard/dashboard-avatars.tsx:3-5
import { ItemThumbnailStack } from "@/components/ItemThumbnailStack";
import { UserAvatarGroup } from "@/components/UserAvatarGroup";
```

```tsx
// src/components/booking-list/BookingCard.tsx:6-7
import { ItemThumbnailStack, type ItemThumbnail } from "@/components/ItemThumbnailStack";
import { UserAvatar } from "@/components/UserAvatar";
```

- `src/app/(app)/bookings/BookingEquipmentTab.tsx` has a redundant local thumbnail helper and a separate fallback for bulk rows:

```tsx
// src/app/(app)/bookings/BookingEquipmentTab.tsx:315-319
function ItemThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  return <AssetImage src={src} alt={alt} size={40} />;
}
```

```tsx
// src/app/(app)/bookings/BookingEquipmentTab.tsx:471-478
{item.bulkSku.imageUrl ? (
  <ItemThumbnail src={item.bulkSku.imageUrl} alt={item.bulkSku.name} />
) : (
  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
    <ImageIcon className="h-4 w-4" />
  </div>
)}
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npm run test -- tests/shadcn-avatar-contracts.test.ts tests/asset-image.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/components/ItemThumbnailStack.tsx`
- `src/app/(app)/bookings/BookingEquipmentTab.tsx`
- `tests/shadcn-avatar-contracts.test.ts`
- `docs/AREA_ITEMS.md`
- `plans/README.md`

**Allowed only if needed by type errors from the stack API**:
- `src/components/booking-list/BookingCard.tsx`
- `src/app/(app)/dashboard/dashboard-avatars.tsx`

**Out of scope**:
- Changing booking card data mapping or availability behavior.
- Changing dashboard avatar data mapping.
- Refactoring item detail image edit overlays.
- Any new thumbnail upload or URL feature.

## Steps

### Step 1: Rebuild ItemThumbnailStack on shared primitives

In `src/components/ItemThumbnailStack.tsx`:

1. Remove `useEffect`, `useState`, and `normalizeAssetImageSrc`.
2. Import `AssetImage` from `@/components/AssetImage`.
3. Import `AvatarGroup` and `AvatarGroupCount` from `@/components/ui/avatar`.
4. Keep the exported `ItemThumbnail` type and `ItemThumbnailStackProps` shape stable.
5. Render the stack with `AvatarGroup`.
6. Render each item with `AssetImage`.
7. Pass a text fallback to `AssetImage` using the first character of the item name, uppercased.
8. Render overflow with `AvatarGroupCount`.
9. Preserve `max`, `size`, `overflowCount`, `className`, and `surfaceClassName`.
10. Preserve an accessible label that includes the visible item names.

Target behavior:

- `items.slice(0, max)` are visible.
- `extraCount` remains `Math.max(0, items.length - visibleItems.length) + overflowCount`.
- Empty `items` with positive `overflowCount` still shows only the count if that is current behavior at the call site. If that behavior is not representable with `AvatarGroupCount`, STOP and report.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Remove the booking equipment thumbnail fork

In `src/app/(app)/bookings/BookingEquipmentTab.tsx`:

1. Remove `ImageIcon` if it is only used by the custom thumbnail fallback.
2. Remove the local `ItemThumbnail` helper if it now only wraps `AssetImage`.
3. Use `AssetImage` directly for both serialized and bulk rows:

```tsx
<AssetImage src={item.asset.imageUrl} alt={item.asset.assetTag} size={40} />
```

```tsx
<AssetImage src={item.bulkSku.imageUrl} alt={item.bulkSku.name} size={40} />
```

Do not change quantities, scan status, row layout, or booking equipment behavior.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Add source contracts

Extend `tests/shadcn-avatar-contracts.test.ts` with checks that:

- `src/components/ItemThumbnailStack.tsx` imports `AssetImage`.
- `src/components/ItemThumbnailStack.tsx` imports `AvatarGroup` and `AvatarGroupCount` from `@/components/ui/avatar`.
- `src/components/ItemThumbnailStack.tsx` does not import `normalizeAssetImageSrc`.
- `src/components/ItemThumbnailStack.tsx` does not define `function StackImage`.
- `src/app/(app)/bookings/BookingEquipmentTab.tsx` does not define `function ItemThumbnail`.
- `src/app/(app)/bookings/BookingEquipmentTab.tsx` does not import `ImageIcon` from `lucide-react` if it is no longer used.

**Verify**: `npm run test -- tests/shadcn-avatar-contracts.test.ts tests/asset-image.test.ts` -> exit 0, all tests pass.

### Step 4: Sync docs

Update `docs/AREA_ITEMS.md` with a short changelog entry saying item thumbnail stacks and booking-equipment thumbnail fallbacks now share `AssetImage` plus shadcn `AvatarGroup`.

**Verify**: `git diff --check` -> exit 0.

### Step 5: Final verification

Run:

```bash
npm run test -- tests/shadcn-avatar-contracts.test.ts tests/asset-image.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] `ItemThumbnailStack` uses `AssetImage`, `AvatarGroup`, and `AvatarGroupCount`.
- [ ] `ItemThumbnailStack` no longer owns image normalization or image failure state.
- [ ] Booking equipment serialized and bulk rows use `AssetImage` directly for thumbnails and fallback.
- [ ] Source contracts protect the stack and booking equipment simplification.
- [ ] `docs/AREA_ITEMS.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-avatar-contracts.test.ts tests/asset-image.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` all pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Plan 022 has not landed or `AssetImage` does not support a custom fallback node.
- `AvatarGroupCount` cannot preserve the existing overflow count semantics.
- Updating `ItemThumbnailStack` requires changing dashboard or booking-card data contracts.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- The item detail header is intentionally deferred because its thumbnail is also an edit button with overlay controls.
- Reviewers should compare booking cards and dashboard avatar stacks visually after this lands, because this plan changes the stack renderer while preserving the data contract.
