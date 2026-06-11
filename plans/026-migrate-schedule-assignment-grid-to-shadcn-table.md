# Plan 026: Migrate the schedule assignment grid to shadcn Table

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/app/\(app\)/schedule/assign/_components/AssignmentGrid.tsx src/app/\(app\)/schedule/assign/_components/AssignmentCell.tsx src/components/ui/table.tsx tests/shadcn-table-item-contracts.test.ts docs/AREA_SHIFTS.md plans/README.md`
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

The assignment grid is a high-density staff workflow and one of the remaining raw table surfaces. It already has custom sticky-column behavior, so this is not a trivial find-and-replace. Moving it to shadcn `Table` keeps the table contract consistent while preserving the assignment grid's dense scan layout, sticky event column, and per-cell assignment controls.

## Current state

- `docs/AREA_SHIFTS.md` defines the schedule assignment grid as shipped core workflow:

```md
// docs/AREA_SHIFTS.md:173-174
- 2026-04-27 | **Assignment Grid shipped (`/schedule/assign`):** Month-level shift assignment matrix for staff. Rows = events, columns = area×workerType pairs derived from the month's shift data. Click "+" to assign any user via UserAvatarPicker popover; click avatar to remove. Month nav + sport/area filters. Multi-slot events (same area+workerType > 1 shift) display stacked avatars per cell. Conflict indicator dot shown on assignments with `hasConflict=true`. Accessible via "Assign shifts" button on Schedule page header (staff/admin only). | Grid |
- 2026-04-27 | **Conflict indicators in assignment picker:** New `GET /api/shifts/[id]/conflicts` endpoint checks `StudentAvailabilityBlock` rows against shift time. `UserAvatarPicker` shows yellow dot + "⚠ conflict" label for conflicted users. `AssignmentCell` fetches conflict map on popover open. | Grid |
```

- `src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx` renders raw table markup:

```tsx
// src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx:72-89
return (
  <div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-sm">
    <table className="w-full min-w-[760px] border-collapse text-sm">
      <thead>
        <tr className="border-b border-border/60">
          <th className="sticky left-0 z-10 w-64 min-w-[16rem] bg-card px-3 py-2 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Event
          </th>
          {columns.map((col) => (
            <th
              key={col.key}
              className="border-l border-border/60 px-2 py-2 text-center text-xs font-bold uppercase tracking-wider text-muted-foreground"
```

```tsx
// src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx:90-121
<tbody>
  {events.map((ev, i) => {
    const date = new Date(ev.startsAt);
    const titleParts = scheduleEventTitleParts(ev);
    const venueTone = VENUE_TONES[venueToneFromEvent(ev)];
    ...
    return (
      <tr
        key={ev.id}
        className={cn(
          "group/assign-row border-b border-border/40 transition-colors hover:bg-muted/20",
          i % 2 !== 0 && "bg-muted/10",
        )}
      >
        {/* Event name cell */}
        <td
```

- `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx` returns a raw `<td>`, so the grid migration must update both files:

```tsx
// src/app/(app)/schedule/assign/_components/AssignmentCell.tsx:214-216
return (
  <td className="group/cell border-l border-border/40 px-2 py-2 align-middle transition-colors hover:bg-muted/15">
    <div className="flex min-h-10 items-center justify-center gap-1.5">
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npm run test -- tests/shadcn-table-item-contracts.test.ts tests/schedule-assign-source.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| App build | `npm run build:app` | exit 0, Next app builds |
| Diff hygiene | `git diff --check` | exit 0, no whitespace errors |

Do not run `npm run build` for this plan unless the operator explicitly asks. In this repo it runs Prisma migration deploy first.

## Scope

**In scope**:
- `src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx`
- `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx`
- `tests/shadcn-table-item-contracts.test.ts`
- `docs/AREA_SHIFTS.md`
- `plans/README.md`

**Out of scope**:
- Assignment data loading, filters, date navigation, conflict logic, or mutation behavior.
- `UserAvatarPicker` behavior.
- The normal `/schedule` list table in `ListView.tsx`. That table is more custom and should be audited separately after this grid lands.
- Changes to `src/components/ui/table.tsx`.

## Steps

### Step 1: Migrate AssignmentCell from td to TableCell

In `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx`:

1. Import `TableCell` from `@/components/ui/table`.
2. Replace the returned `<td>` with `<TableCell>`.
3. Preserve the exact class behavior:
   - `group/cell`
   - left border
   - compact padding
   - `align-middle`
   - hover background
4. Do not change assignment, removal, conflict, popover, or add-slot logic.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Migrate AssignmentGrid table wrappers

In `src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx`:

1. Import `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, and `TableRow` from `@/components/ui/table`.
2. Replace `<table>` with `<Table className="min-w-[760px] border-collapse text-sm">`.
3. Replace `<thead>` with `<TableHeader sticky={false}>`. The grid already has a sticky left column and lives inside its own horizontal scroll frame.
4. Replace header `<tr>` with `TableRow` and set `striped={false}` on grid rows where inherited striping would conflict with existing row tint.
5. Replace header `<th>` with `TableHead`, preserving sticky `left-0`, width, text alignment, border, and uppercase class names.
6. Replace `<tbody>` with `TableBody`.
7. Replace event-name `<td>` with `TableCell`, preserving sticky column, venue rail, background, and hover behavior.
8. Keep the outer `<div className="overflow-x-auto rounded-lg border border-border/60 bg-card shadow-sm">` unless the nested overflow from `Table` causes duplicate scrollbars. If duplicate scrollbars appear, STOP and report instead of modifying `src/components/ui/table.tsx`.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 3: Add source contracts

Extend `tests/shadcn-table-item-contracts.test.ts` with a test that reads both assignment files and asserts:

- `AssignmentGrid.tsx` imports from `@/components/ui/table`.
- `AssignmentGrid.tsx` contains `Table`, `TableHeader`, `TableBody`, `TableHead`, `TableRow`, and `TableCell`.
- `AssignmentCell.tsx` imports `TableCell`.
- `AssignmentGrid.tsx` does not contain `<table`, `<thead`, `<tbody`, `<tr`, `<td`, or `<th`.
- `AssignmentCell.tsx` does not contain `<td`.
- `AssignmentGrid.tsx` still contains `sticky left-0` and `min-w-[760px]`.
- `AssignmentCell.tsx` still contains `group/cell`.

Also keep `tests/schedule-assign-source.test.ts` passing unchanged.

**Verify**: `npm run test -- tests/shadcn-table-item-contracts.test.ts tests/schedule-assign-source.test.ts` -> exit 0, all tests pass.

### Step 4: Sync docs

Update `docs/AREA_SHIFTS.md` with a changelog entry saying the `/schedule/assign` assignment grid now uses the shared shadcn `Table` primitive while preserving sticky event columns, dense assignment cells, and conflict review behavior.

**Verify**: `git diff --check` -> exit 0.

### Step 5: Final verification

Run:

```bash
npm run test -- tests/shadcn-table-item-contracts.test.ts tests/schedule-assign-source.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] `AssignmentGrid.tsx` uses shadcn `Table` components and contains no raw table tags.
- [ ] `AssignmentCell.tsx` uses `TableCell` and contains no raw `<td>`.
- [ ] Sticky event column, min width, venue rail, row tint, and cell hover behavior are preserved.
- [ ] Existing schedule assign source tests still pass.
- [ ] New source contracts protect the shadcn table migration.
- [ ] `docs/AREA_SHIFTS.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-table-item-contracts.test.ts tests/schedule-assign-source.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The grid no longer matches the current excerpts.
- `Table` adds an unavoidable second horizontal scrollbar inside the assignment grid.
- The migration requires changing assignment data shape or mutation behavior.
- The migration requires changing `src/components/ui/table.tsx`.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This is the densest table migration in this pass. Review the result in a browser at desktop width before shipping, especially sticky left-column layering.
- The normal schedule list table remains out of scope because its date grouping, expandable rows, and hidden repeated headers need a separate design pass.
