# Plan 022: Make AssetImage the shadcn-backed item thumbnail primitive

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/AssetImage.tsx src/components/ui/avatar.tsx src/lib/asset-image.ts tests/asset-image.test.ts tests/shadcn-avatar-contracts.test.ts docs/AREA_ITEMS.md plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

`AssetImage` is already the dominant item thumbnail component, but it hand-rolls a thumbnail shell and fallback instead of using the installed shadcn avatar primitive. Item thumbnails are conceptually avatar-like: small identity images with a deterministic fallback. Making `AssetImage` the single shadcn-backed item thumbnail primitive lets item lists, picker rows, and thumbnail stacks share one image failure path.

## Current state

- The shadcn avatar wrapper exists at `src/components/ui/avatar.tsx`.
- `src/components/AssetImage.tsx` owns thumbnail normalization and fallback today:

```tsx
// src/components/AssetImage.tsx:3-7
import { useEffect, useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeAssetImageSrc } from "@/lib/asset-image";
```

```tsx
// src/components/AssetImage.tsx:31-45
if (!normalizedSrc || failed) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", fallbackClassName, className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={alt}
    >
      <Package className="h-4 w-4" aria-hidden="true" />
    </div>
  );
}
```

```tsx
// src/components/AssetImage.tsx:48-66
return (
  <div className={cn("relative shrink-0 overflow-hidden rounded-md bg-muted", className)} style={{ width: size, height: size }}>
    <Image
      src={normalizedSrc}
      alt={alt}
      fill
      sizes={`${size}px`}
      className="object-cover"
      unoptimized
      onError={() => setFailed(true)}
    />
  </div>
);
```

- `src/lib/asset-image.ts` is the normalization helper:

```ts
// src/lib/asset-image.ts:1-10
export function normalizeAssetImageSrc(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }
  const trimmed = src.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.startsWith("http://") ? `https://${trimmed.slice("http://".length)}` : trimmed;
}
```

- `tests/asset-image.test.ts` already covers null, blank, trimmed, and `http://` upgrade behavior for `normalizeAssetImageSrc`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npm run test -- tests/asset-image.test.ts tests/shadcn-avatar-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/components/AssetImage.tsx`
- `tests/shadcn-avatar-contracts.test.ts` (create or extend)
- `tests/asset-image.test.ts` only if a helper contract truly needs to move
- `docs/AREA_ITEMS.md`
- `plans/README.md`

**Out of scope**:
- Renaming `AssetImage` or changing every call site.
- Reworking item detail image edit overlays.
- Changing upload, URL, Brave search, or remove-image behavior.
- Migrating thumbnail stacks. That is plan 023.

## Steps

### Step 1: Recompose AssetImage with shadcn Avatar

In `src/components/AssetImage.tsx`:

1. Replace the custom outer image and fallback `div`s with `Avatar`, `AvatarImage`, and `AvatarFallback` from `@/components/ui/avatar`.
2. Preserve the existing props:
   - `src`
   - `alt`
   - `size = 40`
   - `className`
   - `fallbackClassName`
3. Add an optional prop for stack callers:

```ts
fallback?: React.ReactNode;
```

Default it to `<Package className="h-4 w-4" aria-hidden="true" />`.

4. Preserve `normalizeAssetImageSrc`, `failed`, and the `useEffect` reset when the normalized source changes.
5. Preserve the numeric `size` behavior. It is acceptable to keep `style={{ width: size, height: size }}` on the `Avatar` root because existing call sites pass pixel numbers.
6. Preserve square item thumbnails by overriding the avatar primitive's round default with `rounded-md` on the root and fallback.
7. Use `AvatarImage` for the image case and keep `onError={() => setFailed(true)}`.

Target shape:

```tsx
<Avatar
  className={cn("shrink-0 rounded-md bg-muted", className)}
  style={{ width: size, height: size }}
>
  {normalizedSrc && !failed ? (
    <AvatarImage src={normalizedSrc} alt={alt} className="rounded-md object-cover" onError={() => setFailed(true)} />
  ) : null}
  <AvatarFallback
    className={cn("rounded-md bg-muted text-muted-foreground", fallbackClassName)}
    aria-label={alt}
  >
    {fallback ?? <Package className="h-4 w-4" aria-hidden="true" />}
  </AvatarFallback>
</Avatar>
```

If the live shadcn primitive does not forward `onError` from `AvatarImage`, STOP and report. Do not silently drop image failure handling.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add a source contract for item thumbnail ownership

Create or extend `tests/shadcn-avatar-contracts.test.ts` with checks that:

- `src/components/AssetImage.tsx` imports from `@/components/ui/avatar`.
- `src/components/AssetImage.tsx` uses `Avatar`, `AvatarImage`, and `AvatarFallback`.
- `src/components/AssetImage.tsx` no longer imports `next/image`.
- `src/components/AssetImage.tsx` still imports `normalizeAssetImageSrc`.

Keep this as a source contract, not a rendered DOM test.

**Verify**: `npm run test -- tests/asset-image.test.ts tests/shadcn-avatar-contracts.test.ts` -> exit 0, all tests pass.

### Step 3: Sync docs

Update `docs/AREA_ITEMS.md` with a short changelog entry saying item thumbnails now route through the shared `AssetImage` component backed by shadcn Avatar, preserving fallback and URL normalization behavior.

**Verify**: `git diff --check` -> exit 0.

### Step 4: Final verification

Run:

```bash
npm run test -- tests/asset-image.test.ts tests/shadcn-avatar-contracts.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] `AssetImage` composes shadcn `Avatar`, `AvatarImage`, and `AvatarFallback`.
- [ ] `AssetImage` still normalizes image URLs and marks failed image loads as fallback.
- [ ] `AssetImage` still accepts numeric `size`, `className`, and `fallbackClassName`.
- [ ] `AssetImage` supports an optional fallback node for plan 023.
- [ ] Source contracts cover the shadcn dependency and removal of `next/image`.
- [ ] `docs/AREA_ITEMS.md` records the shipped behavior.
- [ ] `npm run test -- tests/asset-image.test.ts tests/shadcn-avatar-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` all pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `AvatarImage` cannot receive `onError`.
- Switching away from `next/image` causes an obvious app-build or image-domain failure.
- Preserving square item thumbnails requires changing `src/components/ui/avatar.tsx`.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Reviewers should focus on image failure behavior and thumbnail shape. The goal is not a visual redesign.
- This plan intentionally keeps the `AssetImage` name to avoid a broad call-site rename.
- The item detail header has its own edit overlay and should not be folded into this plan unless it becomes a straightforward consumer of `AssetImage`.
