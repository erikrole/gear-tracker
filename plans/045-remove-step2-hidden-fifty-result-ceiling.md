# Plan 045: Remove Step 2 hidden fifty-result ceiling

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/equipment-picker/use-picker-search.ts src/components/EquipmentPicker.tsx src/app/api/assets/picker-search/route.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

The Step 2 docs say there is no 50-item cap, but the picker hook hard-codes `limit=50`. The UI may show "100 visible" or "100 matching" based on the server total while rendering only the first 50 rows. Operators in large categories can miss equipment unless they guess the right search term.

Either the picker needs a real load-more path, or the UI needs an explicit capped-result recovery state. The current hidden cap is the worst version because it looks complete.

## Current state

The area spec:

```md
docs/AREA_CHECKOUTS.md:97-101
- Each section has a persistent search input.
- Match count displayed when search is active.
- No 50-item cap. Search makes the full list manageable.
```

The hook hard-codes a 50-row request:

```ts
// src/components/equipment-picker/use-picker-search.ts:36-41
const params = new URLSearchParams();
params.set("section", section);
if (q) params.set("q", q);
params.set("only_available", String(available));
params.set("limit", "50");
const res = await fetch(`/api/assets/picker-search?${params}`, { signal: controller.signal });
```

The route supports up to 100 rows today:

```ts
// src/app/api/assets/picker-search/route.ts:16-17
const VALID_SECTIONS = new Set<string>(ALL_SECTION_KEYS);
const MAX_PICKER_LIMIT = 100;
```

The UI uses the total count but does not expose that only a subset is rendered:

```ts
// src/components/EquipmentPicker.tsx:551-559
const totalSelected = selectedAssetIds.length + bulkQuantity;
const currentSectionSelected = selectedBySection[activeSection] || 0;
const visibleCount = sectionResults.length + sectionBulk.length;
const matchingCount = total + sectionBulk.length;
const visibleLabel = searchLoading
  ? `Loading ${activeSectionMeta.label.toLowerCase()}`
  : sectionSearch
    ? `${matchingCount} matching ${activeSectionMeta.label.toLowerCase()}`
    : `${visibleCount} visible`;
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused UX tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0 |
| Picker route tests | `npx vitest run tests/api-hardening-wave12.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/components/equipment-picker/use-picker-search.ts`
- `src/components/EquipmentPicker.tsx`
- `src/app/api/assets/picker-search/route.ts` only if pagination metadata needs a small response addition
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Rebuilding the picker as virtualized infinite scroll
- Changing item classification
- Changing search ranking beyond what is necessary for pagination or capped-state clarity
- Changing booking create APIs

## Steps

### Step 1: Pick the smallest honest result strategy

Use one of these approaches:

1. Preferred: implement "Load more" per section using `offset` and `limit`, appending results until `sectionResults.length >= total`.
2. Acceptable smaller slice: raise the request to the route max of 100 and show explicit copy when `total > assets.length`, for example "Showing first 100 of 143. Search to narrow."

Do not keep "No 50-item cap" semantics with a hidden first-page-only implementation.

Verify: source-contract test catches that `use-picker-search.ts` no longer hard-codes `limit`, `"50"`.

### Step 2: Keep selected asset hydration independent

Selected asset hydration in `EquipmentPicker.tsx` uses `ids` and a custom `limit` based on selected IDs. Do not route that through the new page state.

Verify: existing selected hydration code still requests `ids` directly.

### Step 3: Make the visible count truthful

Update the visible label so users can distinguish:

- no query and complete result set
- search query with complete result set
- capped or partially loaded result set

Examples:

- "Showing 50 of 143 cameras"
- "Showing 50 of 143 matching cameras"
- "All 24 cameras visible"

If implementing Load more, place the button near the bottom of the item list and keep the selected shelf stable.

Verify: add tests for the label helper. If no helper exists, extract one into a small pure function rather than testing string fragments in the full component.

### Step 4: Update docs

If Load more ships, keep the "No 50-item cap" claim and add a changelog row. If the smaller capped-state approach ships, update the spec line to describe the explicit cap and recovery path instead of claiming no cap.

Update both checkout and reservation changelogs because the picker is shared.

## Done criteria

- [ ] The picker no longer silently renders only the first 50 rows while presenting the list as complete.
- [ ] Users get either a Load more control or explicit capped-result copy.
- [ ] Search, available-only, and section switching reset or preserve pagination intentionally.
- [ ] Selected shelf remains stable while loading more results.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` passes.
- [ ] `npx vitest run tests/api-hardening-wave12.test.ts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.
- [ ] Docs match the implemented behavior.

## STOP conditions

- Stop if the chosen approach requires unbounded fetching of an entire large equipment section.
- Stop if adding pagination conflicts with availability checks for selected items. Availability only needs visible plus selected assets; do not expand it to every matching row.

## Maintenance notes

If a future slice adds list virtualization, keep the result-count copy. Virtualization changes DOM rendering, not the user's need to know whether more matching gear exists.
