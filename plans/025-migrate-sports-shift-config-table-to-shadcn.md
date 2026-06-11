# Plan 025: Migrate the sports shift-count matrix to shadcn Table

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/app/\(app\)/settings/sports/ShiftConfigTable.tsx src/components/ui/table.tsx tests/shadcn-table-item-contracts.test.ts docs/AREA_SETTINGS.md plans/README.md`
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

The sports settings page contains a dense operational matrix for Staff and Student shift counts. It is one of the remaining raw tables and carries a long selector-heavy class string that duplicates shared table styling. Migrating it to shadcn `Table` reduces local styling surface while preserving the two-level header and small numeric inputs.

## Current state

- `docs/AREA_SETTINGS.md` defines the sports settings surface and confirms this matrix is core behavior:

```md
// docs/AREA_SETTINGS.md:89-95
### Sports (`/settings/sports`)
- Toggle sports active/inactive for shift generation.
- Configure separate Staff and Student home/away shift counts per area (Video, Photo, Graphics, Comms).
- Configure the sport-level default call time window used when a shift or assignment does not have a more specific call override.
- Expandable roster panel per sport - add/remove users.
- Mobile: card layout replaces dense table for shift configs.
```

- `src/app/(app)/settings/sports/ShiftConfigTable.tsx` hand-rolls the desktop matrix:

```tsx
// src/app/(app)/settings/sports/ShiftConfigTable.tsx:117-126
{/* Shift counts table */}
<div className="overflow-x-auto">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
    <p className="text-sm font-medium">Minimum crew</p>
    <p className="text-xs text-muted-foreground">
      Generated shifts create both Staff slots and Student slots from these counts.
    </p>
  </div>
  <table className="w-full border-collapse text-sm [&_th]:text-left [&_th]:px-4 [&_th]:py-2 [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/40 [&_td]:px-4 [&_td]:py-2.5 [&_td]:border-b [&_td]:border-border/40 [&_tr:last-child_td]:border-b-0">
```

```tsx
// src/app/(app)/settings/sports/ShiftConfigTable.tsx:126-140
<thead>
  <tr>
    <th className="w-24"></th>
    {AREAS.map((a) => (
      <th key={a} className="text-center" colSpan={2}>{AREA_LABELS[a]}</th>
    ))}
  </tr>
  <tr>
    <th></th>
    {AREAS.flatMap((a) => [
      <th key={`${a}-staff`} className="text-center normal-case">Staff slots</th>,
      <th key={`${a}-student`} className="text-center normal-case">Student slots</th>,
    ])}
  </tr>
</thead>
```

```tsx
// src/app/(app)/settings/sports/ShiftConfigTable.tsx:141-221
<tbody>
  <tr>
    <td>
      <Badge variant="green" size="sm">Home</Badge>
    </td>
    {AREAS.flatMap((area) => [
      <td key={`${area}-home-staff`} className="text-center">
        <Input
          id={coverageInputName(primaryCode, area, "homeStaffCount")}
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
- `src/app/(app)/settings/sports/ShiftConfigTable.tsx`
- `tests/shadcn-table-item-contracts.test.ts`
- `docs/AREA_SETTINGS.md`
- `plans/README.md`

**Out of scope**:
- Mobile sports layout changes.
- Sport roster add/remove behavior.
- Shift-generation business rules.
- `src/components/ui/table.tsx` changes.

## Steps

### Step 1: Replace the raw matrix with shadcn Table components

In `src/app/(app)/settings/sports/ShiftConfigTable.tsx`:

1. Import `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, and `TableRow` from `@/components/ui/table`.
2. Replace the raw table elements in the "Minimum crew" matrix with shadcn table components.
3. Keep the two-level header exactly:
   - first header row: empty leading column, each area label with `colSpan={2}`
   - second header row: empty leading column, Staff slots and Student slots per area
4. Keep the Home and Away rows exactly, including green and orange badges.
5. Preserve every input `id`, `name`, `type`, `min`, `max`, `value`, `onChange`, `disabled`, and `aria-label`.
6. Use `TableHeader sticky={false}` because this matrix sits inside each sport card, not a scrolling page-level data table.
7. Keep `text-center`, `w-24`, and `w-14` input alignment as local class names on `TableHead` and `TableCell`.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add a source contract

Extend `tests/shadcn-table-item-contracts.test.ts` with a test that reads `src/app/(app)/settings/sports/ShiftConfigTable.tsx` and asserts:

- It imports from `@/components/ui/table`.
- It contains `TableHeader`, `TableBody`, `TableHead`, `TableRow`, and `TableCell`.
- It does not contain `<table`, `<thead`, `<tbody`, `<tr`, `<td`, or `<th`.
- It still contains `coverageInputName(primaryCode, area, "homeStaffCount")`.
- It still contains `coverageInputName(primaryCode, area, "awayStudentCount")`.

**Verify**: `npm run test -- tests/shadcn-table-item-contracts.test.ts` -> exit 0, all tests pass.

### Step 3: Sync docs

Update `docs/AREA_SETTINGS.md` with a scoped changelog entry saying the Sports minimum-crew matrix now uses the shared shadcn `Table` primitive while preserving home/away Staff and Student count inputs.

**Verify**: `git diff --check` -> exit 0.

### Step 4: Final verification

Run:

```bash
npm run test -- tests/shadcn-table-item-contracts.test.ts
npx tsc --noEmit
npm run build:app
git diff --check
```

All commands must exit 0.

## Done criteria

- [ ] The sports minimum-crew matrix imports and uses shadcn `Table` components.
- [ ] The two-level area and worker-type header is preserved.
- [ ] All count inputs keep their `id`, `name`, `aria-label`, disabled state, and update handlers.
- [ ] Source contracts protect shadcn table usage and the key input names.
- [ ] `docs/AREA_SETTINGS.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-table-item-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The sports matrix is no longer raw table markup at the cited location.
- The migration would require changing `src/components/ui/table.tsx`.
- The table wrapper introduces nested horizontal scroll inside an existing scroll container that clips inputs or focus rings.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan should remain a markup migration. Do not combine it with sport roster or call-time control changes.
- Review the final diff for input identity churn. Browser autofill and accessibility checks depend on the stable `id` and `name` metadata.
