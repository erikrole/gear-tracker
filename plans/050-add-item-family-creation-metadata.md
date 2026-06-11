# Plan 050: Capture item-family unit, threshold, and department on create

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/(app)/items/new-item-sheet.tsx src/app/(app)/items/new-item-sheet/BulkItemForm.tsx src/app/(app)/items/new-item-sheet/types.ts src/app/api/bulk-skus/route.ts src/lib/validation.ts prisma/schema.prisma tests/new-item-sheet-ui-source.test.ts docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Add Item creates Units and Quantity families with only name, category, location, QR, initial quantity, and tracking mode. The underlying `BulkSku` model and detail page already support a unit label, low-stock threshold, and department. Missing those fields at creation pushes common inventory facts into a later detail-page cleanup step and makes count-only items less clear, especially supplies measured as rolls, pairs, cards, packs, or kits.

## Current state

- `docs/AREA_ITEMS.md` lines 53-62 define the Create Item flow and line 61 says the user can open the record, add an image, return to list, or add another asset after save.
- `docs/AREA_BULK_INVENTORY.md` lines 57-60 describe `BulkSku.unit`, `BulkStockBalance`, and `BulkStockMovement`.
- The Prisma model already has these fields:

```prisma
// prisma/schema.prisma:447-456
model BulkSku {
  id                  String              @id @default(cuid())
  name                String
  category            String
  unit                String
  locationId          String              @map("location_id")
  categoryId          String?             @map("category_id")
  departmentId        String?             @map("department_id")
  binQrCodeValue      String              @map("bin_qr_code_value")
  minThreshold        Int                 @default(0) @map("min_threshold")
```

- `BulkItemForm.tsx` currently tracks only these new-family fields:

```tsx
// src/app/(app)/items/new-item-sheet/BulkItemForm.tsx:42-48
// New bulk SKU fields
const [bulkName, setBulkName] = useState("");
const [categoryId, setCategoryId] = useState("");
const [locationId, setLocationId] = useState("");
const [bulkQrCode, setBulkQrCode] = useState("");
const [initialQuantity, setInitialQuantity] = useState("0");
```

- Its create payload omits `unit`, `departmentId`, and `minThreshold`, so the API falls back to defaults:

```tsx
// src/app/(app)/items/new-item-sheet/BulkItemForm.tsx:104-114
return {
  url: "/api/bulk-skus",
  body: {
    name: bulkName.trim(),
    category: "general",
    ...(categoryId ? { categoryId } : {}),
    locationId,
    binQrCodeValue: bulkQrCode.trim(),
    initialQuantity: parseInt(initialQuantity, 10) || 0,
    trackByNumber: trackingMode === "units",
  },
```

- `createBulkSkuSchema` accepts `unit` and `minThreshold`, but not `departmentId`:

```ts
// src/lib/validation.ts:133-144
export const createBulkSkuSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  categoryId: z.string().cuid().nullable().optional(),
  unit: z.string().min(1).default("ea"),
  locationId: z.string().cuid(),
  binQrCodeValue: z.string().min(1),
  minThreshold: z.number().int().min(0).default(0),
  active: z.boolean().default(true),
  initialQuantity: z.number().int().min(0).default(0),
  trackByNumber: z.boolean().default(false)
});
```

- The detail page can already edit department and threshold after creation:

```tsx
// src/app/(app)/bulk-inventory/[id]/BulkSkuInfoTab.tsx:104-116
<InfoRow label="Department">
  {canEdit ? (
    <DepartmentSelect
      value={sku.department?.name ?? ""}
      options={departments}
      id="bulk-sku-department"
      name="department"
      onSave={saveDepartment}
    />
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Source-contract tests | `npx vitest run tests/new-item-sheet-ui-source.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build check | `npm run build:app` | exit 0 in an environment with required app env vars |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/(app)/items/new-item-sheet.tsx`
- `src/app/(app)/items/new-item-sheet/BulkItemForm.tsx`
- `src/app/(app)/items/new-item-sheet/types.ts`
- `src/lib/validation.ts`
- `src/app/api/bulk-skus/route.ts`
- `tests/new-item-sheet-ui-source.test.ts`
- `docs/AREA_ITEMS.md`
- `docs/AREA_BULK_INVENTORY.md`

**Out of scope**:
- Do not add new Prisma fields.
- Do not change item-family edit screens beyond what is required for type compatibility.
- Do not add purchase price, purchase link, or notes to the Add Item family form in this slice.
- Do not create a full multi-step wizard.

## Git workflow

- Branch: `advisor/050-item-family-create-metadata`
- Commit style: conventional commit, for example `feat: capture item family metadata on create`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Pass departments into the bulk form

`NewItemSheet` already receives `departments`. Update `BulkItemForm` props to accept departments and pass them from `new-item-sheet.tsx`.

Build department combobox options the same way `SerializedItemForm.tsx` does.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Add new-family fields for unit, low-stock threshold, and department

In `BulkItemForm.tsx`, add state for:

- `unit`, defaulting to `"each"` or another current repo convention if one is more common.
- `minThreshold`, defaulting to `"0"`.
- `departmentId`, defaulting to `""`.

Render these only for `bulkMode === "new"`:

- `Unit label`, required. Placeholder examples: `each`, `roll`, `pair`, `pack`.
- `Low-stock threshold`, optional numeric input with min 0.
- `Department`, optional `FormCombobox`.

Keep fields compact and use existing `FormRow`, `FormCombobox`, `Input`, and `Label` patterns. Do not introduce custom primitives.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Validate and submit the new fields

In `BulkItemForm.validate()`:

- Require nonblank `unit`.
- Reject invalid `minThreshold` values. It must parse to an integer >= 0.
- Keep existing required name/category/location/QR behavior.

In `getSubmitPayload()`:

- Send `unit: unit.trim()`.
- Send `minThreshold: parsedMinThreshold`.
- Send `departmentId` only when set.

In `reset()`, reset the new fields.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Extend the create API schema and route

In `src/lib/validation.ts`, add `departmentId: z.string().cuid().nullable().optional()` to `createBulkSkuSchema`.

In `src/app/api/bulk-skus/route.ts`, persist `departmentId: body.departmentId ?? null` in the `tx.bulkSku.create` data. Include it in the create audit `after` object if that matches nearby audit style.

Do not add a migration; the Prisma field already exists.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 5: Add source-contract coverage

Extend `tests/new-item-sheet-ui-source.test.ts` to assert:

- `BulkItemForm.tsx` contains field labels for `Unit label`, `Low-stock threshold`, and `Department`.
- The payload includes `unit`, `minThreshold`, and `departmentId`.
- `createBulkSkuSchema` includes `departmentId` if you choose to add a source-contract assertion for `src/lib/validation.ts`.

If a small pure parser helper is created for threshold parsing, add a focused unit test instead of source-only checks.

**Verify**: `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0.

### Step 6: Sync docs

Update `docs/AREA_ITEMS.md` and `docs/AREA_BULK_INVENTORY.md` change logs.

Document that Add Item family creation now captures unit label, optional low-stock threshold, and optional department at creation time.

**Verify**: `rg -n "unit label|Low-stock threshold|department|Change Log" docs/AREA_ITEMS.md docs/AREA_BULK_INVENTORY.md` shows the new entries.

## Test plan

- Source-contract coverage in `tests/new-item-sheet-ui-source.test.ts`.
- `npx tsc --noEmit`.
- `npm run build:app` when app env is available.
- `git diff --check`.

## Done criteria

- [ ] Units and Quantity new-family creation forms include a required unit label.
- [ ] Units and Quantity new-family creation forms include optional low-stock threshold and department fields.
- [ ] `POST /api/bulk-skus` persists `departmentId` when provided.
- [ ] `unit` and `minThreshold` are sent from Add Item instead of relying only on schema defaults.
- [ ] Existing Standard item creation behavior is unchanged.
- [ ] `npx vitest run tests/new-item-sheet-ui-source.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 050 is updated.

## STOP conditions

Stop and report back if:

- `BulkSku.departmentId`, `unit`, or `minThreshold` no longer exist in Prisma.
- The product owner wants item-family department assignment deferred to detail pages by design.
- Adding these fields pushes the Add Item sheet into an unusably long mobile form without a clear compact grouping.
- You discover that `POST /api/bulk-skus` is consumed by external clients that cannot tolerate a schema addition.

## Maintenance notes

This plan intentionally captures only high-value operational metadata. Purchase link, purchase price, and notes can stay in item-family detail until there is evidence operators need them during fast Add Item intake.
