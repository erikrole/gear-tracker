# Plan 024: Migrate the settings audit log table to shadcn Table

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`
> unless a reviewer dispatched you and told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat c90837ce..HEAD -- src/app/\(app\)/settings/audit/page.tsx src/components/ui/table.tsx tests/shadcn-table-item-contracts.test.ts docs/AREA_SETTINGS.md plans/README.md`
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

The settings audit log is an admin trust surface, but it still renders raw table markup while the repo already has a shared shadcn `Table` wrapper. This keeps table spacing, sticky header behavior, and row hover treatment page-local on a page where operators need predictable scanning. Migrating this small table first gives a low-risk contract for the larger table migrations in plans 025 and 026.

## Current state

- The repo's shadcn table primitive is `src/components/ui/table.tsx`. It wraps the table in an overflow container and provides sticky headers by default:

```tsx
// src/components/ui/table.tsx:5-13
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div data-slot="table-container" className="relative w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
```

```tsx
// src/components/ui/table.tsx:17-31
function TableHeader({
  className,
  sticky = true,
  ...props
}: React.ComponentProps<"thead"> & { sticky?: boolean }) {
  return (
    <thead
      data-slot="table-header"
      className={cn(
        "[&_tr]:border-b bg-muted/30",
        sticky && "sticky top-0 z-10 backdrop-blur-sm",
        className
```

- `docs/DESIGN_LANGUAGE.md` explicitly says tables should use shadcn `Table`:

```md
// docs/DESIGN_LANGUAGE.md:69-74
- **Buttons**: shadcn `Button`; primary action first; destructive actions use confirmations; icon buttons require `aria-label`.
- **Forms**: shadcn `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Combobox` where available; show form-level errors for API, validation, permission, and network failures.
- **Dialogs**: `Dialog` for create/edit flows; `AlertDialog` for destructive or irreversible choices; `Sheet` or `Drawer` for contextual details. Built-in overlay close controls must keep a visible 40px target and focus ring.
- **Tables**: shadcn `Table`; compact rows; sticky headers when useful; row click and row actions must be siblings, not nested.
```

- `src/app/(app)/settings/audit/page.tsx` currently hand-rolls the audit table:

```tsx
// src/app/(app)/settings/audit/page.tsx:370-385
<div className="rounded-md border border-border overflow-hidden">
  <table className="w-full text-sm">
    <thead className="bg-muted/50 border-b border-border">
      <tr>
        <th className="text-left font-medium text-muted-foreground px-3 py-2 w-44">Time</th>
        <th className="text-left font-medium text-muted-foreground px-3 py-2">Entity</th>
        <th className="text-left font-medium text-muted-foreground px-3 py-2">Action</th>
        <th className="text-left font-medium text-muted-foreground px-3 py-2">Actor</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-border">
      {rows.map((row) => (
        <AuditTableRow key={row.id} row={row} />
```

```tsx
// src/app/(app)/settings/audit/page.tsx:410-428
function AuditTableRow({ row }: { row: AuditRow }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-3 py-2.5 tabular-nums text-muted-foreground text-xs whitespace-nowrap">
        {formatTs(row.createdAt)}
      </td>
      <td className="px-3 py-2.5">
        <span className="font-medium">{row.entityType}</span>
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
- `src/app/(app)/settings/audit/page.tsx`
- `tests/shadcn-table-item-contracts.test.ts` (create if absent)
- `docs/AREA_SETTINGS.md`
- `plans/README.md`

**Out of scope**:
- Any audit API, pagination, filtering, auto-refresh, or retention behavior.
- Any visual redesign of the audit page.
- Other raw tables. Plans 025 and 026 handle the next two.

## Steps

### Step 1: Replace raw table tags with shadcn Table components

In `src/app/(app)/settings/audit/page.tsx`:

1. Import `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, and `TableRow` from `@/components/ui/table`.
2. Replace the raw `<table>`, `<thead>`, `<tbody>`, `<tr>`, `<th>`, and `<td>` elements in the audit table with those shadcn components.
3. Keep the outer rounded border wrapper if it is still needed for the card frame.
4. Preserve the column widths, tabular timestamp treatment, actor fallback, and action badge.
5. Use `TableHeader sticky={false}` if the current audit table should not gain sticky-header behavior inside the page. Do not accept a sticky header visual change without checking it in the browser.
6. Keep `AuditTableRow` as a small helper, but make it return `TableRow` and `TableCell`.

**Verify**: `npx tsc --noEmit` -> exit 0, no TypeScript errors.

### Step 2: Add a source contract

Create or extend `tests/shadcn-table-item-contracts.test.ts` using the source-test pattern from `tests/schedule-assign-source.test.ts`.

Add a test that reads `src/app/(app)/settings/audit/page.tsx` and asserts:

- It imports from `@/components/ui/table`.
- It contains `TableHeader`, `TableBody`, `TableHead`, `TableRow`, and `TableCell`.
- It does not contain `<table`, `<thead`, `<tbody`, `<tr`, `<td`, or `<th` in the audit page source.

Keep this as a source contract. Do not add React rendering infrastructure for this plan.

**Verify**: `npm run test -- tests/shadcn-table-item-contracts.test.ts` -> exit 0, all tests pass.

### Step 3: Sync docs

Update the `docs/AREA_SETTINGS.md` change log with a scoped entry: the Audit Log table now uses the shared shadcn `Table` primitive while preserving filters, pagination, auto-refresh, and row content.

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

- [ ] The audit log table imports and uses shadcn `Table` components.
- [ ] `src/app/(app)/settings/audit/page.tsx` contains no raw table tags.
- [ ] The audit log row content and pagination behavior are unchanged.
- [ ] A source contract protects the table migration.
- [ ] `docs/AREA_SETTINGS.md` records the shipped behavior.
- [ ] `npm run test -- tests/shadcn-table-item-contracts.test.ts`, `npx tsc --noEmit`, `npm run build:app`, and `git diff --check` pass.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The audit page no longer contains the raw table excerpt shown above.
- Switching to `TableHeader` changes sticky behavior in a way that overlaps controls or the load-more area.
- The source contract would need to allow raw table tags in `settings/audit/page.tsx`.
- Any verification command fails twice after a reasonable fix attempt.

## Maintenance notes

- This plan is deliberately small so the table contract can land before broader table work.
- If the executor discovers the audit table needs a non-sticky header, encode that in the source contract so the choice stays intentional.
