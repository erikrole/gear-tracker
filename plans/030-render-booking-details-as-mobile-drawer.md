# Plan 030: Render booking details as a mobile Drawer

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/components/BookingDetailsSheet.tsx src/components/ui/drawer.tsx src/components/ui/sheet.tsx src/hooks/use-mobile.ts docs/AREA_MOBILE.md docs/AREA_CHECKOUTS.md tests/shadcn-overlay-contracts.test.ts plans/README.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding. On a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `c90837ce`, 2026-06-11

## Why this matters

`BookingDetailsSheet` is a high-traffic overlay for checkouts and reservations, and it currently uses a side sheet on every viewport. The project already has a shadcn `Drawer` primitive for mobile detail previews, and `docs/AREA_MOBILE.md` says row taps should open detail surfaces while secondary actions stay reachable. Rendering booking details as a bottom Drawer on mobile makes the overlay fit the mobile interaction model without changing the desktop sheet.

## Current state

- `docs/AREA_MOBILE.md` sets the mobile contract:

```md
// docs/AREA_MOBILE.md:16-24
- Mobile is first-class.
- Touch targets should stay at or above the 44px practical baseline where space allows.
```

```md
// docs/AREA_MOBILE.md:51-60
- Row tap opens details.
- Secondary actions open action sheet.
```

- The repo has a viewport hook:

```tsx
// src/hooks/use-mobile.ts:1-16
const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)
  ...
  return !!isMobile
}
```

- The shared Drawer primitive already provides a bottom detail surface and description:

```tsx
// src/components/ui/drawer.tsx:46-74
function DrawerContent({
  className,
  children,
  showClose = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Content> & { showClose?: boolean }) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        className={cn(
          "bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-[10px] border-t",
          className,
        )}
```

```tsx
// src/components/ui/drawer.tsx:115-126
function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Description>) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}
```

- `src/components/BookingDetailsSheet.tsx` currently renders only `Sheet`:

```tsx
// src/components/BookingDetailsSheet.tsx:660-681
return (
  <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
    <SheetContent className="flex flex-col sm:max-w-lg">
      <SheetHeader>
        ...
        <SheetTitle className="truncate">
          {booking?.title || "Loading..."}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Booking preview with timing, requester, equipment, history, and a link to the full booking page.
        </SheetDescription>
```

```tsx
// src/components/BookingDetailsSheet.tsx:930-958
{booking && !editMode && !equipEditMode && (
  <SheetFooter className="bg-background">
    <div className="flex items-center gap-2 w-full">
      {canEdit && <Button variant="outline" size="sm" onClick={enterEditMode}>Edit</Button>}
      {canCancel && <Button variant="destructive" size="sm" onClick={handleCancel} disabled={cancelling}>...</Button>}
      ...
      {canConvert && <Button size="sm" variant="brand" onClick={handleConvert} disabled={converting}>...</Button>}
      <Button variant="outline" size="sm" asChild>
        <Link href={detailHref}>Open full booking <ExternalLinkIcon className="size-3.5 ml-1" /></Link>
      </Button>
    </div>
  </SheetFooter>
)}
```

- `src/app/(app)/scan/_components/ItemPreviewDrawer.tsx` is a good Drawer exemplar. It uses `Drawer`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, and `DrawerDescription` for a mobile-friendly preview.

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
- `src/components/BookingDetailsSheet.tsx`
- `tests/shadcn-overlay-contracts.test.ts`
- `docs/AREA_MOBILE.md`
- `docs/AREA_CHECKOUTS.md`
- `plans/README.md`

**Out of scope**:
- Changing booking fetch, edit, cancel, convert, check-in, equipment edit, or history behavior.
- Changing desktop overlay behavior. Desktop must remain a `Sheet`.
- Converting `ShiftDetailPanel` to Drawer. That should be a separate plan after this pattern lands.
- Introducing a shared responsive overlay abstraction in this plan.

## Steps

### Step 1: Split the booking overlay content into local render helpers

In `src/components/BookingDetailsSheet.tsx`:

1. Keep the component as the owner of all state and handlers.
2. Extract the repeated header, body, and footer JSX into local variables or small local render helpers inside the component.
3. Preserve existing `SheetTitle`, `SheetDescription`, `SheetBody`, and `SheetFooter` behavior for the desktop path.
4. Do not rename state variables or handlers unless TypeScript requires it.

The goal is to share content between Sheet and Drawer without moving business logic out of the file.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add the mobile Drawer path

In `src/components/BookingDetailsSheet.tsx`:

1. Import `useIsMobile` from `@/hooks/use-mobile`.
2. Import `Drawer`, `DrawerContent`, `DrawerDescription`, `DrawerFooter`, `DrawerHeader`, and `DrawerTitle` from `@/components/ui/drawer`.
3. Call `const isMobile = useIsMobile();`.
4. If `isMobile` is true, render:
   - `<Drawer open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>`
   - `<DrawerContent>`
   - `<DrawerHeader>` with the same avatar/status context, using `DrawerTitle` and `DrawerDescription`.
   - A scrollable body using the same body content. Keep the body within the Drawer max height and do not create a nested full-page scroll trap.
   - `<DrawerFooter>` for the existing Edit, Cancel, Start checkout, and Open full booking actions.
5. If `isMobile` is false, render the existing `Sheet` path.
6. Preserve the `detailHref`, loading, fetch error, missing booking, edit mode, equipment edit mode, and normal preview states.

For the Drawer footer, allow the actions to wrap or stack so button text does not overflow on narrow mobile screens. Do not remove any action.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Add a source contract

Extend `tests/shadcn-overlay-contracts.test.ts`.

Add a test that reads `src/components/BookingDetailsSheet.tsx` and asserts:

- It imports `useIsMobile` from `@/hooks/use-mobile`.
- It imports Drawer primitives from `@/components/ui/drawer`.
- It still imports Sheet primitives from `@/components/ui/sheet`.
- It contains `isMobile`.
- It contains both `SheetDescription` and `DrawerDescription`.
- It contains the user-visible actions `Edit`, `Cancel`, `Start checkout`, and `Open full booking`.

Keep this as a source contract. Do not add viewport mocking or React rendering infrastructure for this plan.

**Verify**: `npm run test -- tests/shadcn-overlay-contracts.test.ts` -> exit 0, all tests pass.

### Step 4: Sync docs

Update:

- `docs/AREA_MOBILE.md` change log: booking detail previews now use a Drawer on mobile and keep the desktop Sheet.
- `docs/AREA_CHECKOUTS.md` change log: booking details retain edit, cancel, conversion, check-in, and full-page actions while using a mobile Drawer.

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

- [ ] `BookingDetailsSheet` renders a shadcn `Drawer` on mobile viewports.
- [ ] `BookingDetailsSheet` keeps the shadcn `Sheet` on desktop viewports.
- [ ] Both overlay paths include descriptions.
- [ ] Edit, Cancel, Start checkout, Open full booking, retry, edit mode, equipment edit mode, and preview behavior remain available.
- [ ] A source contract protects the responsive overlay structure.
- [ ] `docs/AREA_MOBILE.md` and `docs/AREA_CHECKOUTS.md` record the shipped behavior.
- [ ] `npm run test -- tests/shadcn-overlay-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- `BookingDetailsSheet` no longer matches the Sheet-only excerpt shown above.
- The shared content extraction would require moving mutation logic out of this file.
- The Drawer path creates nested focus traps or nested overlay primitives.
- Any footer action has to be removed to fit mobile.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan deliberately avoids a reusable `ResponsiveOverlay` abstraction. Build the pattern once in `BookingDetailsSheet`; extract later only if the Shift Detail conversion needs the same shape.
- After this lands, re-audit `ShiftDetailPanel` for the same Sheet-to-Drawer mobile treatment.
