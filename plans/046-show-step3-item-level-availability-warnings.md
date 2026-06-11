# Plan 046: Show Step 3 item-level availability warnings

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard src/components/EquipmentPicker.tsx tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 3 currently says that availability warnings exist, but it does not identify which selected equipment rows caused them. That makes the final review less actionable than Step 2, especially when a user selected several serialized assets and bulk quantities. The docs already say Step 3 repeats selected availability warnings when they exist, so the review should carry the warning markers down to the actual item rows, not only show aggregate badges.

## Current state

- `docs/AREA_CHECKOUTS.md` defines the Step 3 checkout contract. Lines 43-47 say confirmation repeats selected availability warnings only when warnings exist, and checkout pickup remains kiosk-owned.
- `docs/AREA_RESERVATIONS.md` defines the reservation flow. Lines 28-30 give the same Step 1, Step 2, and Step 3 booking rhythm for reservations.
- `src/components/booking-wizard/WizardStep3.tsx` receives only aggregate warning counts through `selectionState`:

```tsx
// src/components/booking-wizard/WizardStep3.tsx:80-86
}: Props) {
  const locationName = locations.find((l) => l.id === form.locationId)?.name || "";
  const requester = users.find((u) => u.id === form.requester);
  const isCheckout = config.kind === "CHECKOUT";
  const requesterName = requester?.name || "the requester";
  const availabilityReview = buildAvailabilityReview(selectionState);
  const turnaroundCount = getTurnaroundWarningTotal(selectionState);
```

- `src/components/booking-wizard/WizardStep3.tsx` renders aggregate badges, but no selected item row gets a conflict, next-use, or turnaround marker:

```tsx
// src/components/booking-wizard/WizardStep3.tsx:176-203
{availabilityReview && (
  <Alert
    variant={availabilityReview.tone === "conflict" ? "destructive" : "default"}
    className="mx-auto w-full max-w-3xl"
  >
    <AlertCircleIcon />
    <AlertTitle>{availabilityReview.title}</AlertTitle>
    <AlertDescription className="space-y-2">
      <p>{availabilityReview.description}</p>
      <div className="flex flex-wrap gap-1.5">
        {selectionState.conflictCount > 0 && (
          <Badge variant="orange" size="sm" className="tabular-nums">
            {selectionState.conflictCount} conflict{selectionState.conflictCount !== 1 ? "s" : ""}
          </Badge>
        )}
```

- `src/components/booking-wizard/WizardStep3.tsx` maps selected serialized and bulk rows without any warning metadata:

```tsx
// src/components/booking-wizard/WizardStep3.tsx:229-264
{selectedAssetDetails.map((asset, i) => (
  <div key={asset.id}>
    {i > 0 && <Separator className="opacity-40" />}
    <div className="flex items-center gap-3 px-3 py-2.5">
      <AssetImage
        src={asset.imageUrl}
        alt={asset.assetTag}
        size={40}
        className="rounded-md shrink-0"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{asset.assetTag}</p>
        <p className="text-xs text-muted-foreground truncate">
          {asset.brand} {asset.model}
        </p>
      </div>
    </div>
  </div>
))}
```

- `src/components/booking-wizard/flow-summary.ts` has only aggregate count helpers:

```ts
// src/components/booking-wizard/flow-summary.ts:1-6
export type AvailabilityWarningCounts = {
  conflictCount: number;
  upcomingCommitmentCount: number;
  turnaroundRiskCount: number;
  bulkTurnaroundRiskCount: number;
};
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/components/EquipmentPicker.tsx`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep2.tsx`
- `src/components/booking-wizard/WizardStep3.tsx`
- `src/components/booking-wizard/flow-summary.ts`
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

**Out of scope**:
- Do not change server-side availability or conflict policy.
- Do not block hard-conflict selections in this plan. Current product behavior allows staff to continue with conflict warnings and relies on submit-time server recheck.
- Do not redesign the Step 3 hero or kiosk pickup notice.

## Git workflow

- Branch: `advisor/046-step3-item-warnings`
- Commit style: conventional commit, for example `fix: show booking review warning rows`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Identify the warning metadata already available in the picker

Read `src/components/EquipmentPicker.tsx` and find the data structures that classify selected serialized assets and bulk SKUs as hard conflicts, next-use warnings, serialized turnaround warnings, and bulk turnaround warnings.

Prefer carrying only the minimal row-level warning summary needed by Step 3, for example:

```ts
type SelectedAvailabilityWarning = {
  key: string;
  kind: "conflict" | "upcoming" | "turnaround";
  label: string;
  detail?: string;
};
```

Use separate keys or maps for serialized assets and bulk SKUs if that keeps the code simpler. Do not pass the full availability response object into Step 3.

**Verify**: `rg -n "conflictCount|upcomingCommitmentCount|turnaroundRiskCount|bulkTurnaroundRiskCount|onSelectionStateChange" src/components/EquipmentPicker.tsx src/components/booking-wizard` shows the exact symbols you plan to extend.

### Step 2: Extend the Step 2 to Step 3 selection state

Extend `EquipmentPickerSelectionState` or add a sibling callback from `WizardStep2` to `BookingWizard` so the wizard can pass selected row warning metadata to `WizardStep3`.

Keep aggregate counts unchanged because they already drive the existing Step 2 label and Step 3 alert.

Rules:
- Selected serialized asset warnings should be keyed by asset id.
- Selected bulk warnings should be keyed by bulk SKU id.
- If an item has multiple warning kinds, render the highest-risk marker first: conflict, then next use, then turnaround.
- The data should update whenever selection or availability state changes, just like the existing counts.

**Verify**: `npx tsc --noEmit` exits 0. If it fails, fix only type errors caused by this plan before continuing.

### Step 3: Render row-level warning badges in Step 3

In `WizardStep3.tsx`, render compact shadcn `Badge` components beside or below each affected selected row:

- Serialized row examples: `Conflict`, `Next use`, `Turnaround`
- Bulk row example: `Turnaround`
- Preserve the existing aggregate alert at the top.
- Keep the layout dense and stable on mobile. Badges must wrap inside the row and not push thumbnails out of alignment.
- Use existing badge variants already used for booking warnings. Do not introduce a custom primitive.

If a detail string is available, render it in small muted text or as a concise tooltip using existing project conventions. Do not add long instructional copy.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Add focused helper coverage

Add tests to `tests/booking-create-ux.test.ts` for any new pure helper used to rank, normalize, or count row-level warning markers.

Good test cases:
- A selected serialized asset with both conflict and turnaround displays conflict first.
- Bulk turnaround warnings are keyed separately from serialized asset warnings.
- Empty warning metadata produces no row badges while aggregate counts remain unchanged.

If the implementation does not need a pure helper, add a source-contract test only if the repo already has an adjacent source-contract pattern for booking components. Do not add a brittle DOM test just for class names.

**Verify**: `npx vitest run tests/booking-create-ux.test.ts` exits 0 and includes the new helper tests if a helper was added.

### Step 5: Sync docs

Update the relevant change-log sections in:

- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Record that Step 3 now repeats selected availability warnings at the affected equipment rows while preserving the aggregate alert and submit-time server authority.

**Verify**: `rg -n "Step 3|availability warning|warning row|change log|Changelog" docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md` shows the new documentation entry.

## Test plan

- Unit/helper coverage in `tests/booking-create-ux.test.ts` if any new warning-normalization helper is added.
- Type coverage with `npx tsc --noEmit`.
- Whitespace check with `git diff --check`.

## Done criteria

- [ ] Step 3 still shows the aggregate availability alert only when warnings exist.
- [ ] Step 3 selected serialized rows identify their own conflict, next-use, or turnaround warnings.
- [ ] Step 3 selected bulk rows identify their own turnaround warnings.
- [ ] The submit-time server 409 behavior is unchanged.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant checkout and reservation docs are updated.
- [ ] `plans/README.md` status row for plan 046 is updated.

## STOP conditions

Stop and report back if:

- `EquipmentPicker.tsx` no longer owns the warning classifications or selected warning counts.
- The only way to implement this requires duplicating server availability logic in Step 3.
- The change requires altering `/api/checkouts` or `/api/reservations` response shapes.
- The code at the cited Step 3 excerpts has materially changed.

## Maintenance notes

Reviewers should look for accidental divergence between Step 2 and Step 3 warning truth. Step 3 should display data selected and classified by the picker, not recompute availability. If future booking edits reuse `WizardStep3`, make sure their selection-state plumbing carries the same row-level warning metadata.
