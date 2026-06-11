# Plan 028: Add missing shadcn Sheet descriptions

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/ShiftDetailPanel.tsx src/app/\(app\)/resources/page.tsx src/components/ui/sheet.tsx docs/DESIGN_LANGUAGE.md docs/AREA_RESOURCES.md docs/AREA_SHIFTS.md tests/shadcn-overlay-contracts.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

The app has standardized on shadcn overlay primitives, and the shared design language requires accessible overlay descriptions. Most `SheetContent` call sites already include a `SheetDescription`, but the Resources mobile filter sheet and Schedule shift detail sheet do not. Closing those two gaps gives every current app sheet a named purpose for assistive tech and creates a cheap source contract so new sheets do not regress.

## Current state

- `docs/DESIGN_LANGUAGE.md` sets the overlay contract:

```md
// docs/DESIGN_LANGUAGE.md:69-74
- **Dialogs**: `Dialog` for create/edit flows; `AlertDialog` for destructive or irreversible choices; `Sheet` or `Drawer` for contextual details. Built-in overlay close controls must keep a visible 40px target and focus ring.
```

- The shared shadcn `SheetDescription` exists:

```tsx
// src/components/ui/sheet.tsx:129-140
function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
```

- `src/app/(app)/resources/page.tsx` uses a mobile filter sheet without a description:

```tsx
// src/app/(app)/resources/page.tsx:687-700
<SheetContent side="left" className="w-72 overflow-y-auto p-4">
  <SheetHeader className="mb-4 px-0">
    <SheetTitle>Filters</SheetTitle>
  </SheetHeader>
  <ResourceFilterRail
```

- `src/components/ShiftDetailPanel.tsx` uses the main shift detail sheet without a description:

```tsx
// src/components/ShiftDetailPanel.tsx:483-492
<Sheet open={!!groupId} onOpenChange={(o) => !o && onClose()}>
  <SheetContent className="sm:max-w-lg">
    <SheetHeader>
      <SheetTitle>{group?.event ? eventTitle(group.event) : "Shift Details"}</SheetTitle>
    </SheetHeader>
```

- Good exemplars already exist:
  - `src/components/BookingDetailsSheet.tsx` includes a visually hidden `SheetDescription` for the booking preview.
  - `src/app/(app)/schedule/page.tsx` includes a `SheetDescription` for the Trade Board.
  - `src/app/(app)/schedule/_components/NewEventSheet.tsx` includes a `SheetDescription` for the new event flow.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused test | `npm run test -- tests/shadcn-overlay-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/components/ShiftDetailPanel.tsx`
- `src/app/(app)/resources/page.tsx`
- `tests/shadcn-overlay-contracts.test.ts` (create if absent)
- `docs/AREA_RESOURCES.md`
- `docs/AREA_SHIFTS.md`
- `plans/README.md`

**Out of scope**:
- Any change to overlay layout, width, close controls, focus behavior, or mobile breakpoints.
- Any migration from `Sheet` to `Drawer`. Plan 030 handles one responsive Drawer conversion.
- Any broad accessibility rewrite beyond the two missing descriptions and the source contract.

## Steps

### Step 1: Add the missing Resources sheet description

In `src/app/(app)/resources/page.tsx`:

1. Add `SheetDescription` to the existing import from `@/components/ui/sheet`.
2. Add a description under `<SheetTitle>Filters</SheetTitle>`.
3. Use `className="sr-only"` so the current compact mobile filter layout does not change.
4. Suggested copy: `Filter resource guides by category, Creative area, role, publication state, and sort order.`

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add the missing Shift Detail sheet description

In `src/components/ShiftDetailPanel.tsx`:

1. Add `SheetDescription` to the existing import from `@/components/ui/sheet`.
2. Add a description under the existing `SheetTitle`.
3. Use `className="sr-only"` to preserve the current sheet density.
4. Suggested copy: `Manage event staffing, shift assignments, call windows, trade posting, archive state, and attendance.`

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Add a source contract

Create or extend `tests/shadcn-overlay-contracts.test.ts` using the source-test pattern from `tests/schedule-assign-source.test.ts`.

Add tests that read source files and assert:

- `src/app/(app)/resources/page.tsx` imports `SheetDescription` from `@/components/ui/sheet`.
- `src/app/(app)/resources/page.tsx` contains both `SheetContent` and `SheetDescription`.
- `src/components/ShiftDetailPanel.tsx` imports `SheetDescription` from `@/components/ui/sheet`.
- `src/components/ShiftDetailPanel.tsx` contains both `SheetContent` and `SheetDescription`.
- Every file under `src/app`, `src/components`, and `src/hooks` that contains `SheetContent` also contains `SheetDescription`, excluding only files inside `src/components/ui/`.

Keep this as a source contract. Do not add browser or React rendering infrastructure for this plan.

**Verify**: `npm run test -- tests/shadcn-overlay-contracts.test.ts` -> exit 0, all tests pass.

### Step 4: Sync docs

Update:

- `docs/AREA_RESOURCES.md` change log: the mobile filter sheet now includes a shadcn `SheetDescription` while preserving the filter rail behavior.
- `docs/AREA_SHIFTS.md` change log: the Shift Detail sheet now includes a shadcn `SheetDescription` while preserving staffing and trade workflows.

**Verify**: `git diff --check` -> exit 0.

### Step 5: Final verification

Run:

```bash
npm run test -- tests/shadcn-overlay-contracts.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] Resources mobile filters import and render `SheetDescription`.
- [ ] Shift Detail imports and renders `SheetDescription`.
- [ ] The new source contract fails if an app sheet lacks a `SheetDescription`.
- [ ] No sheet layout, width, footer, or close control behavior changed.
- [ ] `docs/AREA_RESOURCES.md` and `docs/AREA_SHIFTS.md` record the shipped behavior.
- [ ] `npm run test -- tests/shadcn-overlay-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Either target file no longer contains the `SheetContent` excerpts shown above.
- Adding descriptions requires visible copy or layout changes to fit.
- The source contract finds additional missing app sheet descriptions not listed here.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- Keep descriptions short and operational. They are for the overlay purpose, not instructions.
- If a future sheet intentionally has no visible description, prefer an `sr-only` `SheetDescription` over an exception in the contract.
