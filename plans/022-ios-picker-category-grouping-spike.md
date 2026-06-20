# Plan 022: Design spike -- group the iOS booking equipment picker by category

> **Executor instructions**: This is a DESIGN SPIKE, not a build-everything
> plan. Your deliverable is a written design decision (a doc), not a shipped
> feature. Do the investigation, make the call with evidence, and write it up.
> Do NOT implement the full grouped picker. If the investigation contradicts
> this plan's assumptions, that finding IS the deliverable -- record it and
> stop. Follow the STOP conditions.
>
> **Drift check (run first)**: `git diff --stat 6e4b35ae..HEAD -- src/app/api/assets/route.ts ios/Wisconsin/Views/CreateBookingSheet.swift`
> If either file changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding.

## Status

- **Priority**: P3
- **Effort**: M (spike) / L (full implementation, out of scope here)
- **Risk**: LOW (spike writes a doc, not code)
- **Depends on**: plans/020-ios-picker-display-aligned-sort.md (grouping needs a
  display-aligned within-group sort; do not start this until 020's `name` sort
  exists, or assume it and note the dependency in the design doc)
- **Category**: direction
- **Planned at**: commit `6e4b35ae`, 2026-06-13
- **State**: DONE ON MAIN (2026-06-19)

## Why this matters

The native reservation picker (`CreateBookingSheet`) renders all available serialized assets as **one flat list** under a single section. With a real inventory (hundreds of assets across cameras, lenses, audio, lighting, grip...), a flat list -- even correctly sorted (plan 020) -- is slow to scan. Every other inventory surface thinks in categories; the picker doesn't. Grouping assets under category section headers (Cameras, Lenses, Audio...) would make the picker navigable.

The reason this is a spike and not a direct build: the current picker **paginates** (`/api/assets` with `limit`/`offset`, infinite scroll), and naive client-side grouping would only group the pages loaded so far, causing sections to reflow and duplicate as the user scrolls. Getting grouping right requires a deliberate choice about where grouping happens (client vs server) and how it coexists with pagination and search. That decision should be made and written down before anyone writes the UI.

## Current state

### The flat list -- `ios/Wisconsin/Views/CreateBookingSheet.swift:838-882`

```swift
Section {
    // ...error / empty states...
    } else {
        ForEach(vm.availableAssets) { asset in
            AssetPickerRow(asset: asset, isSelected: ..., isConflicted: ...) { ... }
                .onAppear {
                    if asset.id == vm.availableAssets.last?.id && vm.hasMoreAssets {
                        Task { await vm.loadAvailableAssets() }   // infinite scroll
                    }
                }
        }
    }
}
```

### Pagination -- `CreateBookingSheet.swift:277-312`

`loadAvailableAssets` appends pages: `availableAssets += resp.data`, tracking `assetOffset` / `assetTotal`, with `hasMoreAssets = availableAssets.count < assetTotal`. Search (`onSearchChange`) resets and reloads. The list grows one 30-item page at a time.

### `Asset.category` is available but unused for layout

`Asset` carries `category: AssetCategory?` (`ios/Wisconsin/Models/AssetModels.swift:68`), and the server `/api/assets` supports `sort=category` and `category_id` filters (`src/app/api/assets/route.ts` `SORT_MAP`). So the data to group by exists; the question is the mechanism.

## Deliverable

A design decision document at `docs/DESIGN_ios-picker-grouping.md` (create it) containing:

1. **The chosen approach** (one of the options below, or a better one you justify), with the rationale.
2. **The data contract** it implies (any `/api/assets` change: a new sort, a `group_by`, or a category-sectioned response shape -- written as request/response examples).
3. **The pagination story** (how infinite scroll behaves with sections; what happens on search).
4. **A thin first slice** definition (the smallest mergeable step), so a follow-up implementation plan can pick it up.
5. **Explicit non-goals** for the first slice.

Also append a one-line pointer to this doc in `docs/DECISIONS.md` (if that file exists; the project CLAUDE.md references it).

## Options to evaluate (investigate, then choose)

**Option A -- Client-side grouping of the full result set (drop pagination for the picker).**
Load all available assets for the location in one request (the picker is location-scoped and "available" only, so the set is bounded), then group + sort client-side into `Section`s by `category.name`. Trade-off: simplest UI, but one larger request; viable only if the available-at-location count is small enough (investigate typical/`max` counts -- check `assetTotal` in practice, or the `/api/assets` total for a location with `status=available`). Removes infinite scroll.

**Option B -- Server returns category-ordered pages; client renders sticky section headers.**
Add/confirm a `sort=category` (then `name`) ordering and keep pagination; the client starts a new `Section` whenever `category` changes across the ordered stream. Trade-off: keeps pagination, but a category that spans a page boundary needs careful header de-duplication, and the header for a partially-loaded category can be misleading.

**Option C -- Dedicated grouped endpoint / response shape.**
`/api/assets?group_by=category` returns `{ groups: [{ category, total, items: [...] }], ... }` with per-group caps and a "show more in <category>" affordance. Trade-off: cleanest UX, most server work; a new response shape the iOS model must decode.

Evaluate each against: typical inventory size per location, search behavior, the existing infinite-scroll code, and how much server change each requires. Recommend one and say why the others lose.

## Commands you will need (investigation only)

| Purpose | Command | Use |
|---------|---------|-----|
| Inspect the assets route ordering/filters | `sed -n '40,210p' src/app/api/assets/route.ts` | confirm sort/group/pagination options |
| Inspect the picker pagination | `sed -n '277,312p' ios/Wisconsin/Views/CreateBookingSheet.swift` | confirm current behavior |
| Find any existing grouped list in the app to reuse a pattern | `grep -rn "Section(header" ios/Wisconsin/ \| head` | reuse conventions |
| Type gate (only if you write a tiny spike slice) | `npx tsc --noEmit` | exit 0 |

(No source changes are required for the spike beyond the doc. If you choose to prototype the thin slice, keep it behind the scope rules below.)

## Scope

**In scope**:

- `docs/DESIGN_ios-picker-grouping.md` (create) -- the design decision.
- `docs/DECISIONS.md` -- one pointer line (only if the file exists).

**Out of scope** (do NOT do in this spike):

- Implementing the grouped picker UI in `CreateBookingSheet.swift`.
- Changing `/api/assets` response shape or `SORT_MAP` (that is the *follow-up* plan the spike defines; plan 020 already adds the `name` sort).
- Removing or rewriting the infinite-scroll logic.
- Any iOS model change.

If you find yourself editing `CreateBookingSheet.swift` or `route.ts` beyond reading them, STOP -- that is the implementation, not the spike.

## Git workflow

- Branch: `improve-exec/022-ios-picker-grouping-spike` (fresh from `main` HEAD).
- Commit: `docs: design decision for grouping the iOS booking picker by category`.
- Do NOT push or open a PR unless the operator instructed it.

## Done criteria

- [x] `docs/DESIGN_ios-picker-grouping.md` exists and contains all five Deliverable sections (chosen approach + rationale, data contract, pagination story, thin first slice, non-goals)
- [x] The doc names the dependency on plan 020's `name` sort for within-group ordering
- [x] At least the three options above are evaluated with the inventory-size evidence that drives the choice
- [x] `docs/DECISIONS.md` has a pointer line (if that file exists)
- [x] No source files modified (`git status` shows only the doc(s), plan index, and task tracking)
- [x] `plans/README.md` status row for 022 updated

## Review

- Shipped: `docs/DESIGN_ios-picker-grouping.md` chooses a bounded full-fetch client grouping approach for native iOS reservation creation, backed by live inventory counts and the existing `/api/assets` contract.
- Verified: `npm run verify:docs`; `git diff --check`.
- Deferred: implementation is intentionally out of scope and should become Plan 023.

## STOP conditions

Stop and report back (do not improvise) if:

- You cannot determine a realistic upper bound on "available assets at one location" from the codebase or a read-only query -- that number decides Option A's viability; report what you found and present the decision as conditional on it.
- The investigation shows the picker no longer paginates (drift) -- the whole framing changes; report.
- You are tempted to implement the UI to "prove" the design -- don't; the deliverable is the decision doc. If a tiny throwaway prototype is essential, note it but do not include it in scope.

## Maintenance notes

- This spike produces the design; the **implementation** should be a separate plan (e.g. 023) scoped to the chosen option's thin first slice. Sequence: 020 (sort) -> 022 (this design) -> implementation plan.
- Whoever writes the implementation plan should treat the data contract in the design doc as the source of truth and keep the iOS `Asset.category` decoding unchanged unless the contract demands a new shape.
- A reviewer of the design doc should pressure-test the pagination story specifically -- that is where naive grouping fails.
