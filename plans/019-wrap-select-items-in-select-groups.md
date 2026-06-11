# Plan 019: Wrap SelectItem lists in SelectGroup

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8022c88d..HEAD -- src tests`
> If the `SelectContent` or `SelectItem` call sites have materially changed,
> rerun the inventory command in Step 1 and update the target list before
> editing. If most call sites are already grouped, mark this plan REJECTED as
> already fixed.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `8022c88d`, 2026-06-11

## Why this matters

The installed shadcn `Select` primitive exports `SelectGroup`, but most app
select menus place `SelectItem` directly under `SelectContent`. That works
today in Radix, but it violates the repo's shadcn composition rule and makes
future grouped labels, separators, and static checks harder to enforce. This
plan performs a mechanical cleanup and adds a source-level guard so new select
menus follow the same composition.

## Current state

- `src/components/ui/select.tsx:15-18` exports `SelectGroup`.
- `src/components/ui/select.tsx:175-186` exports it with the other select parts.
- The inventory at planning time:

```bash
rg -l "SelectItem" src/app src/components --glob '*.tsx' | wc -l
# 23
rg -l "SelectGroup" src/app src/components --glob '*.tsx' | wc -l
# 7
```

- Example that already follows the intended pattern: `src/components/onboarding/OnboardingDialog.tsx:545-557`

```tsx
<SelectContent>
  <SelectGroup>
    {inviteRoleOptions.map((option) => (
      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
    ))}
  </SelectGroup>
</SelectContent>
```

- Example that still needs grouping: `src/components/booking-wizard/WizardStep1.tsx:172-179`

```tsx
<SelectContent>
  <SelectItem value="__all__">All sports</SelectItem>
  {SPORT_CODES.map((s) => (
    <SelectItem key={s.code} value={s.code}>
      {s.label}
    </SelectItem>
  ))}
</SelectContent>
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Inventory | `rg -n "SelectItem|SelectGroup" src/app src/components --glob '*.tsx'` | shows target call sites |
| Focused contract | `npm run test -- tests/shadcn-component-contracts.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| App build | `npm run build:app` | exit 0, Next build succeeds |
| Whitespace | `git diff --check` | exit 0 |

Do not use `npm run build` for this plan because it runs migration deploy.
`npm run lint` currently prompts for Next lint config and is not a reliable
non-interactive gate.

## Scope

**In scope**:
- App/component `.tsx` files under `src/app` and `src/components` that render `SelectItem`.
- `tests/shadcn-component-contracts.test.ts` (create if absent; append if Plan 018 already created it).

**Out of scope**:
- `src/components/ui/select.tsx`, unless it has drifted and no longer exports `SelectGroup`.
- Non-select menus such as `DropdownMenuItem`, `CommandItem`, or tabs.
- Visual redesign of forms or filters.

## Git workflow

- Branch: `advisor/019-select-group-composition`
- Commit message example: `chore: normalize select menu composition`
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Generate the target list

Run:

```bash
rg -l "SelectItem" src/app src/components --glob '*.tsx'
```

For every listed file except `src/components/ui/select.tsx`, check whether
`SelectGroup` is imported from `@/components/ui/select`. If the file renders
`SelectItem` without `SelectGroup`, add `SelectGroup` to the import.

**Verify**: `rg -l "SelectItem" src/app src/components --glob '*.tsx'` exits 0 and gives the files to inspect.

### Step 2: Wrap direct SelectItem children

For each `<SelectContent>` that contains direct `<SelectItem>` children:

```tsx
<SelectContent>
  <SelectGroup>
    ...
  </SelectGroup>
</SelectContent>
```

Keep existing `SelectLabel`, `SelectSeparator`, conditional rendering, and map
logic intact. If a `SelectContent` already contains one or more `SelectGroup`
nodes, do not add a nested group.

For mixed content, group only the item list:

```tsx
<SelectContent>
  <SelectGroup>
    <SelectItem value="__none__">None</SelectItem>
    {options.map(...)}
  </SelectGroup>
</SelectContent>
```

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Add a source contract for select grouping

In `tests/shadcn-component-contracts.test.ts`, add a test named
`keeps SelectItem lists grouped inside SelectContent`.

The test should:
- Read every `.tsx` file under `src/app` and `src/components`, excluding `src/components/ui/select.tsx`.
- For each file containing `SelectItem`, assert that the file also imports or uses `SelectGroup`.
- For a stronger check, scan each `<SelectContent>...</SelectContent>` block and fail if it contains `SelectItem` but not `SelectGroup`.

Keep the test simple and source-based, matching the repo's existing contract
tests. Do not introduce a JSX parser dependency.

**Verify**: `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0.

### Step 4: Run the app gates

Run:

```bash
npx tsc --noEmit
npm run build:app
git diff --check
```

All three commands must exit 0.

## Test plan

- Source contract in `tests/shadcn-component-contracts.test.ts`.
- Typecheck catches missing imports.
- App build catches Next compile issues from touched client/server components.

## Done criteria

- [ ] Every file under `src/app` and `src/components` that renders `SelectItem` outside `src/components/ui/select.tsx` also uses `SelectGroup`
- [ ] No `<SelectContent>...</SelectContent>` block contains `SelectItem` without `SelectGroup`
- [ ] `npm run test -- tests/shadcn-component-contracts.test.ts` exits 0
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build:app` exits 0
- [ ] `git diff --check` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:

- A select menu has dynamic children that cannot be safely wrapped without changing behavior.
- `src/components/ui/select.tsx` no longer exports `SelectGroup`.
- The source contract becomes complex enough to need a JSX parser.

## Maintenance notes

The intent is mechanical consistency, not a UX redesign. Reviewers should
mainly check that no `SelectContent` lost an item, label, separator, or disabled
state during wrapping.
