# Plan 059: Require an explicit image upload endpoint

> **Executor instructions**: Execute this plan in order and stop on any STOP condition. Update plan 059 in `plans/README.md` when done unless a reviewer owns the index.
>
> **Drift check (run first)**: `git diff --stat 189ea5ab..HEAD -- src/components/ChooseImageModal.tsx 'src/app/(app)/items/[id]/page.tsx' 'src/app/(app)/items/new-item-sheet.tsx' 'src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx' tests/pending-action-feedback-source.test.ts`

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `189ea5ab`, 2026-07-16

## Why this matters

`ChooseImageModal` supports both the preferred `uploadEndpoint` and a deprecated optional `assetId`. Because both are optional, the component type permits an invalid `/api/assets/undefined/image` endpoint and a generic image picker still knows asset routing. All callers can provide an explicit endpoint, so the compatibility branch has no remaining value.

## Current state

At `src/components/ChooseImageModal.tsx:58-68`:

```ts
uploadEndpoint?: string;
/** @deprecated Use uploadEndpoint instead */
assetId?: string;
```

At line 139:

```ts
const endpoint = uploadEndpoint ?? `/api/assets/${assetId}/image`;
```

- Bulk SKU already passes `uploadEndpoint={`/api/bulk-skus/${sku.id}/image`}`.
- Item detail and new-item creation still pass `assetId`.
- Upload, URL selection, image search, deletion, confirmation, authentication recovery, and pending-action guards must remain unchanged.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused test | `npx vitest run tests/pending-action-feedback-source.test.ts` | passes |
| Typecheck | `npx tsc --noEmit --pretty false` | exits 0; all callers supply endpoint |
| Lint | `npx eslint src/components/ChooseImageModal.tsx 'src/app/(app)/items/[id]/page.tsx' 'src/app/(app)/items/new-item-sheet.tsx' 'src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx'` | exits 0 |
| Build | `npm run build:app` | succeeds |

## Scope

**In scope**:

- `src/components/ChooseImageModal.tsx`
- `src/app/(app)/items/[id]/page.tsx`
- `src/app/(app)/items/new-item-sheet.tsx`
- `src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx` only if formatting/type cleanup is required
- `tests/pending-action-feedback-source.test.ts` only if its contract needs adjustment

**Out of scope**:

- API image routes
- Search-provider behavior or ranking
- File validation limits, accepted types, image processing, or UI redesign
- Extracting the modal into multiple components

## Git workflow

- Suggested branch: `codex/059-explicit-image-upload-endpoint`
- Commit if requested: `refactor: require explicit image upload endpoints`
- Do not stage, commit, push, or open a PR without instruction.

## Steps

### Step 1: Migrate asset callers

In item detail, replace `assetId={asset.id}` with `uploadEndpoint={`/api/assets/${asset.id}/image`}`. In the new-item flow, pass the equivalent endpoint using `createdAssetId`. Confirm the modal is rendered only when the created ID exists; do not paper over a nullable ID with a non-null assertion.

**Verify**: `rg -n 'assetId=' src --glob '*.tsx' | rg 'ChooseImageModal|assetId='` and inspect results. No `ChooseImageModal` call should use its deprecated prop.

### Step 2: Make the endpoint required

Change `uploadEndpoint` to a required string, remove `assetId`, remove the deprecated comment, remove the fallback, and use `uploadEndpoint` directly. Do not add runtime route construction inside the component.

**Verify**: `rg -n 'assetId|uploadEndpoint \?\?' src/components/ChooseImageModal.tsx` → no matches for the removed prop/fallback.

### Step 3: Verify unchanged behavior

Run focused tests, lint, TypeScript, `build:app`, and `git diff --check`. Inspect the diff to confirm the modal body is otherwise untouched.

## Test plan

- TypeScript is the primary contract: every caller must supply a string endpoint.
- Keep the existing pending-action regression test green.
- Do not add a brittle source-text test for a condition the component prop type already proves.

## Done criteria

- [ ] `ChooseImageModal` has one required `uploadEndpoint` prop.
- [ ] No modal caller passes `assetId`.
- [ ] No route fallback can construct an undefined URL.
- [ ] Focused test, TypeScript, lint, app build, and diff check pass.
- [ ] Plan 059 status is updated.

## STOP conditions

- A caller cannot know its upload endpoint at render time.
- A caller relies on the component to distinguish asset types.
- The change requires API behavior or image-flow redesign.
- Verification fails twice.

## Maintenance notes

Future image-owning entities should pass their route explicitly. Keep resource identity and API routing outside this reusable modal.

