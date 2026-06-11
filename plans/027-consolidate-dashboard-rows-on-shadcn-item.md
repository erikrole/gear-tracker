# Plan 027: Consolidate dashboard queue rows on shadcn Item

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/app/\(app\)/dashboard/booking-row.tsx src/app/\(app\)/dashboard/my-gear-column.tsx src/app/\(app\)/dashboard/team-activity-column.tsx src/components/ui/item.tsx tests/shadcn-table-item-contracts.test.ts docs/AREA_DASHBOARD.md plans/README.md`
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

The dashboard is an operational queue, and its rows are exactly the shape that `src/components/ui/item.tsx` was added to standardize: media/content/actions with stable dense spacing. `EquipmentPicker`, notifications, and labels already use the shadcn `Item` primitive successfully, but dashboard queue rows still hand-roll repeated flex row shells. This plan migrates only dashboard rows, where the benefit is high and the surface is cohesive.

## Current state

- `src/components/ui/item.tsx` exports the item row primitives:

```tsx
// src/components/ui/item.tsx:8-16
function ItemGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      role="list"
      data-slot="item-group"
      className={cn("group/item-group flex flex-col", className)}
      {...props}
    />
```

```tsx
// src/components/ui/item.tsx:54-70
function Item({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof itemVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-slot="item"
```

```tsx
// src/components/ui/item.tsx:106-152
function ItemContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="item-content"
      className={cn(
        "flex flex-1 flex-col gap-1 [&+[data-slot=item-content]]:flex-none",
        className
      )}
```

- `src/components/EquipmentPicker.tsx` is the best current row exemplar. It uses `ItemGroup`, `Item`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, and `ItemSeparator` for dense picker rows:

```tsx
// src/components/EquipmentPicker.tsx:781-814
<ItemGroup aria-label={`${activeSectionMeta.label} equipment`}>
  {sectionResults.map((asset, index) => {
    ...
    return (
      <div key={asset.id}>
        {index > 0 && <ItemSeparator />}
        <Item
          size="sm"
          className={cn(
            "min-h-[56px] rounded-none px-3",
```

- Notifications and labels also use the item primitive:

```tsx
// src/app/(app)/notifications/page.tsx:531-575
return (
  <Item
    size="sm"
    className={
      unread
        ? "group bg-primary/5 transition-[background-color,box-shadow] hover:bg-primary/10 dark:bg-primary/10 dark:hover:bg-primary/15"
        : "group bg-background transition-[background-color] hover:bg-muted/35"
    }
  >
    <ItemMedia variant="icon" className={meta.toneClass}>
      <Icon className="size-4" />
    </ItemMedia>
    <ItemContent>
```

```tsx
// src/app/(app)/labels/page.tsx:366-390
<ItemGroup className="max-h-[380px] overflow-y-auto p-2">
  {(labelItems ?? []).map((item) => (
    <Item
      key={item.id}
      size="sm"
      className={cn(
        "border border-transparent transition-colors",
```

- `docs/AREA_DASHBOARD.md` defines the dashboard as an action console with compact row behavior:

```md
// docs/AREA_DASHBOARD.md:10-13
## Direction
Make dashboard an action console for daily operations, not a reporting screen.

Design language reference: `docs/DESIGN_LANGUAGE.md`.
```

```md
// docs/AREA_DASHBOARD.md:119-126
## Interaction Rules
- Desktop:
  - Row hover reveals actions.
  - Row click opens detail sheet.
- Mobile:
  - Row tap opens action sheet.
  - Keep critical tap targets at 44px minimum.
```

- `src/app/(app)/dashboard/booking-row.tsx` hand-rolls the main dashboard booking row:

```tsx
// src/app/(app)/dashboard/booking-row.tsx:82-109
return (
  <div
    className={cn(
      "group flex min-h-14 items-center gap-2.5 px-4 py-2.5 transition-colors [&+&]:border-t [&+&]:border-border/40 border-l-[3px] pl-[13px]",
      accentClasses[accent],
    )}
  >
    <button
      type="button"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
```

- `src/app/(app)/dashboard/my-gear-column.tsx` has hand-rolled My Shifts and Drafts rows:

```tsx
// src/app/(app)/dashboard/my-gear-column.tsx:202-239
<div key={s.id} className="group flex items-center justify-between gap-3 w-full px-4 py-2 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40">
  <div className="flex flex-col gap-0.5 min-w-0">
    <span className="text-sm font-bold text-foreground truncate">
      {s.event.sportCode && <span className="text-xs font-bold mr-1">{sportLabel(s.event.sportCode)}</span>}
      <span className="text-muted-foreground font-normal">{eventTitle}</span>
    </span>
```

```tsx
// src/app/(app)/dashboard/my-gear-column.tsx:253-260
{data.drafts.map((d) => (
  <div key={d.id} className="group flex items-center justify-between gap-3 w-full px-4 py-2 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40">
    <div className="flex flex-col gap-0.5 min-w-0">
      <span className="text-sm font-medium text-foreground truncate">
```

- `src/app/(app)/dashboard/team-activity-column.tsx` has a hand-rolled upcoming-events row family:

```tsx
// src/app/(app)/dashboard/team-activity-column.tsx:255-285
<CardContent className="p-0 py-1">
  {cappedEvents.map((e) => (
    <div
      key={e.id}
      className={cn(
        "group flex items-start justify-between gap-3 w-full border-l-[3px] px-4 py-2.5 transition-colors hover:bg-muted/50 [&+&]:border-t [&+&]:border-border/40 no-underline text-inherit",
        eventBorder(e),
        e.coverage && e.coverage.filled < e.coverage.total && "bg-[var(--red-bg)]/10",
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused test | `npm run test -- tests/shadcn-table-item-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/app/(app)/dashboard/booking-row.tsx`
- `src/app/(app)/dashboard/my-gear-column.tsx`
- `src/app/(app)/dashboard/team-activity-column.tsx`
- `tests/shadcn-table-item-contracts.test.ts`
- `docs/AREA_DASHBOARD.md`
- `plans/README.md`

**Out of scope**:
- Dashboard data fetching, filtering, action routing, or role visibility.
- Booking list rows outside dashboard, including `src/components/booking-list/BookingRow.tsx` and `BookingCard.tsx`.
- Users mobile cards and report mobile cards.
- Any change to `src/components/ui/item.tsx`.

## Steps

### Step 1: Migrate DashboardBookingRow to Item

In `src/app/(app)/dashboard/booking-row.tsx`:

1. Import `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`, and `ItemActions` from `@/components/ui/item`.
2. Replace the outer row `<div>` with `Item size="sm"`.
3. Preserve the left status rail through the existing `border-l-[3px] pl-[13px]` class.
4. Keep the primary clickable button as a child inside `ItemContent`. Do not wrap the entire row in a button because row actions are siblings.
5. Use `ItemTitle` for `booking.title`.
6. Use `ItemDescription` for requester, item count, and date metadata.
7. Use `ItemActions` for the action buttons, due/pickup badges, and gear avatar stack.
8. Preserve `actions`, `showDueBadge`, `showPickupBadge`, tooltip content, `GearAvatarStack`, and `onSelectBooking`.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Migrate MyGearColumn repeated dashboard rows to Item

In `src/app/(app)/dashboard/my-gear-column.tsx`:

1. Import `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, and `ItemGroup` from `@/components/ui/item`.
2. Wrap the My Checkouts list, My Reservations list, My Shifts list, and Drafts list content in `ItemGroup` where the list is a sequence of rows.
3. Leave existing `DashboardBookingRow` calls intact after Step 1 because that component now owns its own item row.
4. Replace the My Shifts hand-rolled row `<div>` with `Item size="sm">`.
5. Replace the Drafts hand-rolled row `<div>` with `Item size="sm">`.
6. Preserve all action buttons, `GearAvatarStack`, badges, and create-booking callbacks.
7. Preserve row density by keeping `min-h`, compact padding, and hover classes where needed.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Migrate TeamActivity upcoming-event rows to Item

In `src/app/(app)/dashboard/team-activity-column.tsx`:

1. Import `Item`, `ItemContent`, `ItemTitle`, `ItemDescription`, `ItemActions`, and `ItemGroup` from `@/components/ui/item`.
2. Wrap the upcoming events list in `ItemGroup`.
3. Replace each upcoming-event row `<div>` with `Item size="sm">`.
4. Keep the `Link` to `/events/${e.id}` inside `ItemContent`. Do not make the whole row a link because badges and avatar stacks are sibling row content.
5. Preserve `eventBorder(e)`, under-covered red tint, `ShiftAvatarStack`, coverage badge, and venue badge.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 4: Add source contracts

Extend `tests/shadcn-table-item-contracts.test.ts` with a test that reads the three dashboard files and asserts:

- `dashboard/booking-row.tsx` imports from `@/components/ui/item`.
- `dashboard/booking-row.tsx` contains `ItemContent`, `ItemTitle`, `ItemDescription`, and `ItemActions`.
- `dashboard/my-gear-column.tsx` imports from `@/components/ui/item`.
- `dashboard/my-gear-column.tsx` contains `ItemGroup`.
- `dashboard/team-activity-column.tsx` imports from `@/components/ui/item`.
- `dashboard/team-activity-column.tsx` contains `ItemGroup`.
- The files still contain the domain hooks that must not be dropped:
  - `GearAvatarStack`
  - `onSelectBooking`
  - `onCreateBooking`
  - `eventCoverageBadge`

Do not assert that every hand-rolled flex row disappeared. Some dashboard layout wrappers can remain.

**Verify**: `npm run test -- tests/shadcn-table-item-contracts.test.ts` -> exit 0, all tests pass.

### Step 5: Sync docs

Update `docs/AREA_DASHBOARD.md` with a changelog entry saying dashboard queue rows now route through the shared shadcn `Item` row primitive while preserving booking selection, row actions, gear/avatar summaries, and operational badges.

**Verify**: `git diff --check` -> exit 0.

### Step 6: Final verification

Run:

```bash
npm run test -- tests/shadcn-table-item-contracts.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] `DashboardBookingRow` uses shadcn `Item` primitives.
- [ ] My Shifts and Drafts rows in `MyGearColumn` use shadcn `Item` primitives.
- [ ] Upcoming event rows in `TeamActivityColumn` use shadcn `Item` primitives.
- [ ] Existing dashboard actions, links, badges, avatar stacks, and booking selection callbacks are preserved.
- [ ] Source contracts protect the dashboard `Item` adoption.
- [ ] `docs/AREA_DASHBOARD.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-table-item-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- Any cited dashboard file has already been rewritten away from the current excerpts.
- Preserving row actions without nested interactive controls requires changing `src/components/ui/item.tsx`.
- `Item` cannot preserve the left status rail and action layout without broad CSS changes.
- The migration changes dashboard routing, filters, or role-based action visibility.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan intentionally avoids booking-list mobile cards and user mobile cards. Those are separate row families and should be judged after the dashboard pattern lands.
- Reviewers should check that item rows still meet the dashboard requirement that row hover reveals actions and row click opens the detail sheet.
