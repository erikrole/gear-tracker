# Plan 029: Route destructive AlertDialog actions through shadcn variants

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/ConfirmDialog.tsx src/app/\(app\)/kits/\[id\]/page.tsx src/app/\(app\)/resources/\[slug\]/edit/_components/EditGuideClient.tsx src/app/\(app\)/licenses/ReleaseDialog.tsx src/app/\(app\)/licenses/AdminClaimSheet.tsx src/components/ui/alert-dialog.tsx docs/DESIGN_LANGUAGE.md docs/AREA_KITS.md docs/AREA_RESOURCES.md docs/AREA_LICENSES.md tests/shadcn-overlay-contracts.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

The shared `AlertDialogAction` already has a first-class `variant="destructive"` API, but several destructive flows still use default actions or hand-written destructive classes. That creates inconsistent destructive affordances and keeps styling knowledge spread across feature pages. This plan routes delete, retire, release, and shared danger confirmations through the shadcn variant while deliberately leaving non-destructive confirmations alone.

## Current state

- `docs/DESIGN_LANGUAGE.md` defines the destructive confirmation rule:

```md
// docs/DESIGN_LANGUAGE.md:69-74
- **Buttons**: shadcn `Button`; primary action first; destructive actions use confirmations; icon buttons require `aria-label`.
- **Dialogs**: `Dialog` for create/edit flows; `AlertDialog` for destructive or irreversible choices; `Sheet` or `Drawer` for contextual details. Built-in overlay close controls must keep a visible 40px target and focus ring.
```

- `src/components/ui/alert-dialog.tsx` supports variants:

```tsx
// src/components/ui/alert-dialog.tsx:121-134
function AlertDialogAction({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Action> & {
  variant?: "default" | "destructive";
}) {
  return (
    <AlertDialogPrimitive.Action
      className={cn(buttonVariants({ variant }), className)}
      {...props}
    />
  );
}
```

- `src/components/ConfirmDialog.tsx` currently computes destructive classes manually instead of passing the variant:

```tsx
// src/components/ConfirmDialog.tsx:73-78
<AlertDialogAction
  onClick={() => state.onConfirm()}
  className={cn(state.variant === "danger" && buttonVariants({ variant: "destructive" }))}
>
  {state.confirmLabel}
</AlertDialogAction>
```

- `src/app/(app)/kits/[id]/page.tsx` delete confirmation uses manual destructive classes:

```tsx
// src/app/(app)/kits/[id]/page.tsx:902-924
<AlertDialogTitle>Delete this kit?</AlertDialogTitle>
...
<AlertDialogAction
  onClick={handleDelete}
  disabled={deleteBusy}
  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
>
  {deleteBusy ? "Deleting..." : "Delete kit"}
</AlertDialogAction>
```

- `src/app/(app)/resources/[slug]/edit/_components/EditGuideClient.tsx` delete confirmation uses the default action style:

```tsx
// src/app/(app)/resources/[slug]/edit/_components/EditGuideClient.tsx:344-364
<AlertDialogTitle>Delete this resource?</AlertDialogTitle>
...
<AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
```

- `src/app/(app)/licenses/ReleaseDialog.tsx` returns a license to the pool with a default action.
- `src/app/(app)/licenses/AdminClaimSheet.tsx` has release, release-all, retire, and delete confirmations. The delete confirmation uses manual destructive classes, while the others use default actions.
- Good exemplar: `src/app/(app)/items/components/bulk-action-bar.tsx` already uses `AlertDialogAction variant="destructive"` for Retire and Delete.

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
- `src/components/ConfirmDialog.tsx`
- `src/app/(app)/kits/[id]/page.tsx`
- `src/app/(app)/resources/[slug]/edit/_components/EditGuideClient.tsx`
- `src/app/(app)/licenses/ReleaseDialog.tsx`
- `src/app/(app)/licenses/AdminClaimSheet.tsx`
- `tests/shadcn-overlay-contracts.test.ts`
- `docs/AREA_KITS.md`
- `docs/AREA_RESOURCES.md`
- `docs/AREA_LICENSES.md`
- `plans/README.md`

**Out of scope**:
- Changing confirmation copy, API methods, disabled states, or mutation flow.
- Reclassifying non-destructive confirmations such as kit member removal, resource discard, battery quantity adjustments, or status changes.
- Changing `AlertDialogAction` itself.

## Steps

### Step 1: Use the shadcn variant in the shared ConfirmDialog provider

In `src/components/ConfirmDialog.tsx`:

1. Remove the `buttonVariants` import if it becomes unused.
2. Keep `cn` only if another part of the file still needs it. Remove it if unused.
3. Change the action to pass `variant={state.variant === "danger" ? "destructive" : "default"}`.
4. Preserve `onClick`, label, cancel behavior, and provider state cleanup.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Convert page-local destructive actions

Update only destructive or irreversible confirmation actions:

1. `src/app/(app)/kits/[id]/page.tsx`: in the "Delete this kit?" dialog, replace manual destructive classes with `variant="destructive"`.
2. `src/app/(app)/resources/[slug]/edit/_components/EditGuideClient.tsx`: in the "Delete this resource?" dialog, add `variant="destructive"` to `AlertDialogAction`.
3. `src/app/(app)/licenses/ReleaseDialog.tsx`: add `variant="destructive"` to the return-license action because it removes the user's current license custody.
4. `src/app/(app)/licenses/AdminClaimSheet.tsx`: add `variant="destructive"` to actions that release a slot, release all slots, retire a license, or delete a license. Replace manual destructive classes on delete with the variant.

Do not change the kit "Remove from kit" confirmations in this plan. Those remove a membership from a kit, not the item itself, and should get a product copy pass before being styled as destructive.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Add a source contract

Extend `tests/shadcn-overlay-contracts.test.ts`.

Add tests that read source files and assert:

- `src/components/ConfirmDialog.tsx` contains `variant={state.variant === "danger" ? "destructive" : "default"}`.
- `src/components/ConfirmDialog.tsx` no longer imports `buttonVariants`.
- The delete-kit, delete-resource, return-license, admin release, admin release-all, admin retire, and admin delete actions contain `variant="destructive"`.
- The files in this plan no longer contain `bg-destructive text-destructive-foreground hover:bg-destructive/90`.

Use scoped source tests rather than a repo-wide ban. Other button code may legitimately use destructive styles outside `AlertDialogAction`.

**Verify**: `npm run test -- tests/shadcn-overlay-contracts.test.ts` -> exit 0, all tests pass.

### Step 4: Sync docs

Update change logs:

- `docs/AREA_KITS.md`: kit delete confirmation now uses the shared shadcn destructive action variant.
- `docs/AREA_RESOURCES.md`: resource delete confirmation now uses the shared shadcn destructive action variant.
- `docs/AREA_LICENSES.md`: license return, release, release-all, retire, and delete confirmations now use the shared shadcn destructive action variant.

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

- [ ] Shared danger confirmations pass `variant="destructive"` through `AlertDialogAction`.
- [ ] Kit delete, resource delete, license return, admin license release, release-all, retire, and delete actions use `variant="destructive"`.
- [ ] Manual destructive class strings are removed from the in-scope AlertDialog actions.
- [ ] Non-destructive confirmations are not restyled in this plan.
- [ ] A source contract protects the destructive-variant usage.
- [ ] Area docs record the shipped behavior.
- [ ] `npm run test -- tests/shadcn-overlay-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Any in-scope dialog no longer matches the titles or action roles described above.
- `AlertDialogAction` no longer accepts a `variant` prop.
- The change appears to require altering mutation behavior, API payloads, or confirmation copy.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan is intentionally scoped to `AlertDialogAction`. Regular `Button variant="destructive"` usage is a separate concern.
- If reviewers disagree that license return/release should be styled destructive, keep delete and retire variant changes and mark the release changes as rejected in `plans/README.md`.
