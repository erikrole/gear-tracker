# Plan 020: Consolidate status-dot UI on a semantic primitive

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8022c88d..HEAD -- src/components/ui/status-indicator.tsx src/app/'(app)'/settings/kiosk-devices/page.tsx src/app/'(app)'/bulk-inventory/'[id]'/BulkSkuUnitsTab.tsx src/app/'(app)'/bulk-inventory/'[id]'/BulkSkuOverviewCard.tsx tests`
> If the cited status-dot code changed since this plan was written, compare the
> excerpts below against the live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `8022c88d`, 2026-06-11

## Why this matters

The app already has a status-dot primitive, but several operational pages still
hand-roll colored spans with raw Tailwind color classes or CSS variable names.
This creates small but persistent visual drift: kiosk online status uses
`bg-emerald-500`, bulk unit status uses `bg-[var(--green)]`, and the shared
primitive uses `bg-green-500` plus slate text. Consolidating the primitive makes
status dots easier to audit and keeps shadcn composition focused on semantic
tokens instead of one-off color fragments.

## Current state

- `src/components/ui/status-indicator.tsx:13-24` maps states to raw color
  classes:

```tsx
case "active":
  return { dot: "bg-green-500", ping: "bg-green-300" };
case "down":
  return { dot: "bg-red-500", ping: "bg-red-300" };
case "fixing":
  return { dot: "bg-yellow-500", ping: "bg-yellow-300" };
case "idle":
default:
  return { dot: "bg-slate-700", ping: "bg-slate-400" };
```

- `src/components/ui/status-indicator.tsx:73-76` uses raw slate text classes
  for the label.
- `src/app/(app)/settings/kiosk-devices/page.tsx:88-95` defines a local
  `StatusDot` with raw spans and raw colors:

```tsx
if (status === "online")
  return <span className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-75 animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-emerald-500" /></span>;
if (status === "recent")
  return <span className="size-2 rounded-full bg-amber-400" />;
if (status === "offline")
  return <span className="size-2 rounded-full bg-destructive" />;
return <span className="size-2 rounded-full bg-muted-foreground/40" />;
```

- `src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx:91-94` renders four
  inline dot spans for unit counts.
- `src/app/(app)/bulk-inventory/[id]/BulkSkuOverviewCard.tsx:54-56` renders
  dots through a local `DOT_STYLES` map.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Inventory | `rg -n "bg-emerald-500|bg-amber-400|bg-green-500|bg-red-500|bg-yellow-500|bg-slate-|DOT_STYLES|StatusDot" src/app src/components --glob '*.tsx'` | shows target call sites |
| Focused contract | `npm run test -- tests/shadcn-component-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| App build | `npm run build:app` | exit 0, Next build succeeds |
| Whitespace | `git diff --check` | exit 0 |

Use `npm run build:app`, not `npm run build`, to avoid live migration deploy.

## Scope

**In scope**:
- `src/components/ui/status-indicator.tsx`
- `src/app/(app)/settings/kiosk-devices/page.tsx`
- `src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx`
- `src/app/(app)/bulk-inventory/[id]/BulkSkuOverviewCard.tsx`
- `tests/shadcn-component-contracts.test.ts` (create if absent; append if earlier plans created it)

**Out of scope**:
- Booking status badges and booking status visual maps.
- Chart legend dots that use dynamic Recharts fill colors.
- iOS status tokens.
- Any change to the meaning of kiosk online/recent/offline thresholds.

## Git workflow

- Branch: `advisor/020-status-dot-primitive`
- Commit message example: `chore: consolidate status dot rendering`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make StatusIndicator semantic and reusable

Update `src/components/ui/status-indicator.tsx` so it:

1. Exports a named `StatusIndicator` in addition to the default export, or converts call sites to the default import consistently. Prefer a named export if no call sites currently depend on default import.
2. Uses semantic status names that cover the existing pages:
   - `online`
   - `recent`
   - `offline`
   - `inactive`
   - `available`
   - `checkedOut`
   - `missing`
   - `retired`
3. Keeps the old states (`active`, `down`, `fixing`, `idle`) as aliases if existing call sites use them.
4. Uses semantic CSS variables or Tailwind semantic tokens instead of raw palette classes:
   - available/online: `bg-[var(--green)]` or existing green token
   - checkedOut: `bg-[var(--blue)]`
   - recent: `bg-[var(--orange)]`
   - missing/offline: `bg-destructive`
   - retired/inactive: `bg-muted-foreground`
5. Uses `text-muted-foreground` for labels instead of raw slate classes.
6. Keeps `size="sm" | "md" | "lg"` support.
7. Supports `animate` as an optional prop, defaulting to true only for online/active if that matches current kiosk behavior.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Replace kiosk local StatusDot

In `src/app/(app)/settings/kiosk-devices/page.tsx`:

1. Import `StatusIndicator`.
2. Remove the local `StatusDot` function.
3. Where the local component was used, render:

```tsx
<StatusIndicator state={status} size="sm" />
```

If TypeScript needs a narrower type, define a small mapping from
`ReturnType<typeof connectionStatus>` to the status indicator state. Do not
change `connectionStatus` thresholds.

**Verify**: `rg -n "function StatusDot|bg-emerald-500|bg-amber-400" 'src/app/(app)/settings/kiosk-devices/page.tsx'` returns no matches.

### Step 3: Replace bulk inventory dot spans

In both bulk SKU files, use `StatusIndicator` for the dot and keep the existing
count labels:

- `available` maps to `state="available"`.
- `checkedOut` maps to `state="checkedOut"`.
- `lost` maps to `state="missing"`.
- `retired` maps to `state="retired"`.

Render the dot without a label when it is inline next to existing text:

```tsx
<StatusIndicator state="available" size="sm" aria-hidden="true" />
```

If `StatusIndicator` does not accept arbitrary span props, add a minimal
`aria-hidden?: boolean` prop or render it with `label` omitted and wrap at the
call site. Keep the component simple.

**Verify**: `rg -n "DOT_STYLES|bg-\\[var\\(--green\\)\\]|bg-\\[var\\(--blue\\)\\]|size-1\\.5 rounded-full" 'src/app/(app)/bulk-inventory/[id]/BulkSkuUnitsTab.tsx' 'src/app/(app)/bulk-inventory/[id]/BulkSkuOverviewCard.tsx'` returns no matches for the migrated local dot patterns.

### Step 4: Add a source contract

In `tests/shadcn-component-contracts.test.ts`, add a test named
`keeps operational status dots on StatusIndicator`.

The test should:
- Read `src/components/ui/status-indicator.tsx` and assert it does not contain `bg-green-500`, `bg-red-500`, `bg-yellow-500`, or `bg-slate-`.
- Read the three target page files and assert they import or use `StatusIndicator`.
- Assert `src/app/(app)/settings/kiosk-devices/page.tsx` no longer contains `function StatusDot`, `bg-emerald-500`, or `bg-amber-400`.
- Assert the two bulk SKU files no longer contain `DOT_STYLES`.

**Verify**: `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0.

### Step 5: Run the app gates

Run:

```bash
npx tsc --noEmit
npm run build:app
git diff --check
```

All three commands must exit 0.

## Test plan

- Source contract catches regression to local raw status dots in the three
  operational pages and raw palette classes inside the primitive.
- Typecheck catches prop/name mismatches.
- App build catches Next compile issues.

## Done criteria

- [ ] `StatusIndicator` supports kiosk connection and bulk unit states without raw green/red/yellow/slate palette classes
- [ ] Kiosk Devices page uses `StatusIndicator` and has no local `StatusDot`
- [ ] Bulk SKU Units and Overview files use `StatusIndicator` for unit status dots
- [ ] `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build:app` exits 0
- [ ] `git diff --check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- `StatusIndicator` has live call sites not covered by this plan that depend on the old default state names.
- A chart or dynamic color legend is accidentally pulled into scope.
- The visual mapping would change business meaning, such as treating recent kiosks as offline.

## Maintenance notes

This plan intentionally covers only simple status dots, not full badges or
chart legends. If a future page needs a tiny colored status dot, use
`StatusIndicator` first and add a state there only when the state is reusable.
