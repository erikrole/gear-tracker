# Items List Improvement Audit
**Date**: 2026-04-30
**Target**: `src/app/(app)/items/` (page, table, hooks, toolbar, bulk bar) + `src/app/api/assets/route.ts`, `src/app/api/items-page-init/route.ts`
**Type**: Page

---

## What's Smart

- **Consolidated init endpoint** — `src/app/api/items-page-init/route.ts:11–31` collapses 4 separate option fetches (locations / departments / categories / brands + role) into one parallel `Promise.all`. This is the right pattern; it should be the standard for every list page that has filter dropdowns.
- **Hook decomposition** — `use-url-filters`, `use-items-query`, `use-filter-options`, `use-bulk-actions`, `use-keyboard-shortcuts` cleanly separate concerns. Most other big pages keep all of this inline. Worth replicating elsewhere.
- **React Query for the list** (`use-items-query.ts:93–97`) with `staleTime: 60_000`, `AbortSignal` propagation, and optimistic `setItems` via `queryClient.setQueryData` is significantly more elegant than the manual `useState + fetch + AbortController` pattern still in use on sibling pages.
- **Optimistic favorite with rollback** — `page.tsx:141–156` updates the cache, fires the request, reverts on failure. Clean.
- **Server-side derived status** — `assets/route.ts:124–136` uses `buildDerivedStatusWhere` so filtering/counting works on the source-of-truth allocations rather than a stored `status` column. Aligns with lessons.md ("Asset status is derived, not stored").
- **Skeleton fidelity for mobile** — `page.tsx:449–463` provides a real mobile card skeleton (only place in the codebase that does both desktop + mobile skeletons). Should propagate.

---

## What Doesn't Make Sense

- **`loadError` is unreachable** — `use-items-query.ts:139` returns `loadError: isError && isLoading`. React Query never has both flags true at the same time. The page's "Failed to load items" empty state at `page.tsx:465–466` therefore never renders; initial-load failures fall through to the "no items" empty state and look like an empty inventory. Real bug.
- **`showAccessories` is excluded from `hasActiveFilters`** — `use-url-filters.ts:62–69` does not include it, so when "Accessories only" is on the toolbar's "Clear filters" button is hidden and `clearAllFilters()` (lines 92–100) silently leaves it enabled. Same for `showAccessories` not being reset in `clearAllFilters`. UI lies about active state.
- **Two ways to open a row** — `data-table.tsx:130–131` and `page.tsx:200` independently re-implement the same `id.startsWith("bulk-") ? /bulk-inventory/… : /items/…` branching. Diverge silently when one changes.
- **Export query-string built twice** — `page.tsx:163–171` rebuilds the same param structure that `use-items-query.buildUrl` already builds (lines 55–72). Two places to keep in sync; e.g. `favorites_only` is missing from export but supported by the API.
- **Mobile renders the desktop table** — Loading shows a real mobile card layout (`page.tsx:449`), but `data-table.tsx` only renders `<Table>`. The actual content view is never the cards-on-mobile experience the skeleton promises.
- **Skeleton column count is wrong** — Skeleton renders 5 columns (`page.tsx:419–425`); real table renders up to 8 (select, favorite, name, status, category, dept, location, actions). Visible jump on every load.
- **`busyRef` + `actionBusy` doubled state** — `page.tsx:83–84` keeps an identical guard in a ref and `useState`. Either suffices; the ref is what actually blocks reentry, the state only drives the dialog button label.
- **`STATUS_OPTIONS` duplicated** — Hard-coded in `items-toolbar.tsx:11–17`, again as a `switch` in `columns.tsx:65–129`, again as `statusKeys` array in `assets/route.ts:169`, again in the summary bar conditions in `page.tsx:338–388`. Four places, same five values.
- **`clearAllFilters` doesn't clear search** — `page.tsx:481` works around it by calling both `filters.clearAllFilters()` and `filters.setSearch("")`. Every consumer has to remember to do this.
- **Bulk items only on offset === 0** — `assets/route.ts:193`. Paginating past page 1 silently drops bulk SKUs from the list, but the toolbar pretends bulk + pagination work together.

---

## What Can Be Simplified

- **Status-breakdown N+1** — `assets/route.ts:170–175` runs 5 separate `db.asset.count()` queries on every list fetch (one per status). Replace with one `groupBy` over the derived status, or compute the breakdown from a single full-table count + 4 partials joined into one round-trip. Current → 5 round-trips per page load.
- **Bulk-bar `/api/kits` fetch** — `bulk-action-bar.tsx:67–76` re-fetches kits every time the bar mounts (i.e., every time a row is selected from zero). Move into `items-page-init` so the page's option payload covers it like locations and categories.
- **`useEffect` selection-clear deps** — `page.tsx:87–89` lists six filter strings. Use `query.page + filters.hasActiveFilters + filters.debouncedSearch` triple as the key, or memoize a `filterKey` string in `use-url-filters` and depend on that — single dep.
- **`setItems` callback uses `[url, queryClient]`** — `use-items-query.ts:115–124` already disables exhaustive-deps. Just key off `queryKey` (which is `["items", url]`) — one less moving piece.
- **Two prefix branches for row open** — Extract a `getItemHref(asset)` helper used by both `data-table.tsx:130` and `page.tsx:200`. Same with the `bulk-${id}` constructor at `page.tsx:114` and the `id.startsWith("bulk-")` check at `use-bulk-actions.ts:29`.
- **`mergedData` resorts by `assetTag` only** — `page.tsx:135–137` runs `localeCompare` on the merged list, ignoring `filters.sorting`. Either drop the resort (server already returns serialized rows in the user's sort, append bulks at the end) or extend it to honour the active sort. The current sort silently breaks whenever bulk items appear.
- **`itemType !== "serialized"` / `!== "bulk"` triple-mode** — `page.tsx:112–133` handles 3 cases; the merged-data block is 25 lines that could be a 5-line `if`/`else`.
- **`exporting` boolean** — `page.tsx:159` is set inside an event handler — `useTransition`'s `isPending` would remove the manual `setExporting(true)` / `setExporting(false)` pair (which is also missing a `finally`, so a thrown error before the `catch` block locks the button forever — except `setExporting(false)` is outside the try, so it works, but it's positioned where a real throw still locks the UI).

---

## What Can Be Rethought

- **Schema opportunity — `_count.accessories` is rendered as a "+N" pill** (`columns.tsx:213–217`) but the page never surfaces the actual accessory data. Hovering or expanding to show the linked asset tags would make the pill informative instead of decorative.
- **`activeBooking.endsAt`** is included in the API response (`assets/route.ts:293`) but never rendered. The `CHECKED_OUT` badge could show "due in 2d" instead of just the requester's name. Tradeoff: badge width.
- **API response shape** — The list returns `data: Asset[]` and a separate `bulkItems: BulkItem[]`. The client immediately re-shapes bulks into `Asset` rows (`page.tsx:111–131`). Server should return one heterogeneous list with a `kind` discriminator; client never sees two arrays.
- **`itemType` segmented control + `showAccessories` switch + "Favorites" button** — Three distinct mental models for "what subset am I looking at". Group them into one "View" pill row or a left rail. Current toolbar has 8 controls competing for attention.
- **Clearing search vs filters** — Two empty states ("no items" vs "no matches") and the wizard's "Fill gaps" button overlap. A single empty state with contextual recommendation (filters → clear; search → broaden; truly empty → create) would simplify `page.tsx:467–482`.

---

## Consistency & Fit

### Pattern Drift

- **Data fetching** — This page uses React Query (`use-items-query`); most sibling pages still use raw `useState + fetch + useEffect + AbortController`. This is the *good* direction — flag those siblings for adoption rather than the other way around. (See "Raise the Bar".)
- **`url` vs `_id` URL keys** — `use-url-filters` writes `?location=…&category=…&brand=…&department=…`, but the API expects `location_id`/`category_id`/`department_id`. The mapping happens implicitly inside `use-items-query.buildUrl`. Sibling pages share the same drift; consider standardizing on `_id` everywhere or stripping it everywhere.
- **`localStorage` for column visibility** — `page.tsx:69–81` rolls its own JSON read/write. If other table pages exist (e.g. `users`, `bookings`), they likely don't share this pattern; extract a `usePersistedColumnVisibility(key)` hook.

### Dead Code

- `BulkActionBar.onExportCsv` prop — `bulk-action-bar.tsx:51, 61, 175–183` defines and renders an "Export CSV" menu item, but `page.tsx:524` never passes the prop. The entire `<DropdownMenuSeparator />` + menu item is unreachable.
- `categoryOptions` is computed in `use-filter-options.ts:35–44` and passed to `BulkActionBar` (`page.tsx:528`), but the bar's "Change category" submenu uses it, which is fine — *however* `useFilterOptions` also returns the raw `categories` array, which is unused anywhere except passed into `NewItemSheet`/`GapWizardDialog`. OK in context but worth a comment that they're not interchangeable.
- `Asset.activeBooking.endsAt` — included in API response (`assets/route.ts:293`), never read in any column or UI.
- `Asset.kind` discriminator on `BulkItem` (`use-items-query.ts:33`) is set but never consumed — bulks are detected via the `bulk-` id prefix instead.
- `useBulkActions.error` state — `page.tsx:530` passes `bulk.error` to the bar, which renders it (`bulk-action-bar.tsx:267`), but every error path also calls `toast.error` first. Result: same error appears twice (toast + inline red text).

### Ripple Map

- **If `/api/assets` response shape changes** → `page.tsx`, `columns.tsx`, `use-items-query.ts`, plus any consumer of `Asset` type. `Asset` is also imported by `data-table.tsx`, `new-item-sheet.tsx`, and likely `items/[id]/`. Grep `from "./columns"` before changing.
- **If `/api/items-page-init` payload changes** → only `use-filter-options.ts:17–28`. Tight blast radius.
- **If `getItemHref`-style logic changes** (the `bulk-${id}` prefix scheme) → `page.tsx:114, 200`, `data-table.tsx:130, 131`, `use-bulk-actions.ts:29`, plus anything that links to items elsewhere. Five sites; centralize.
- **If `Asset` type loses `_count.accessories`** → `columns.tsx:213` would render `undefined`. Currently guarded; OK.
- **If `STATUS_OPTIONS` adds a new state** (e.g. `LOST`) → must update `items-toolbar.tsx:11`, `columns.tsx` switch, `assets/route.ts:169` `statusKeys`, the summary bar in `page.tsx:338–388`, and `STATUS_STYLES`. Four-place edit minimum.

### Navigation Integrity

- All outbound links resolve: `/import`, `/bulk-inventory/[id]`, `/items/[id]`. ✅
- `searchParams.get("page")` (`use-items-query.ts:84`) is parsed but never written back to the URL — only filter state syncs in `use-url-filters.ts:72–90`. Sharing a URL with `?page=3` works on first load, but changing pages won't update the URL. Inconsistent with the rest of the URL-state model.

---

## Polish Checklist

| Check | Status | Notes |
|---|---|---|
| Empty states | ⚠️ | Two states (no items / no matches) but the load-error state is unreachable due to `loadError` bug (`use-items-query.ts:139`). |
| Skeleton fidelity | ⚠️ | Mobile skeleton implies card layout, but real content is desktop table on mobile. Desktop skeleton has 5 cols vs 7–8 real cols (`page.tsx:419–425`). |
| Silent mutations | ✅ | All mutations toast. |
| Confirmation quality | ✅ | Single retire dialog names the asset; bulk dialog names the count. |
| Mobile breakpoints | ⚠️ | Toolbar has `sm:` only on Export/Fill-gaps buttons; the rest of the toolbar wraps but does not stack ergonomically on narrow screens. Data table never collapses to cards. |
| Error message quality | ✅ | Uses `parseErrorMessage` consistently; differentiates network vs server. |
| Button loading states | ⚠️ | Export button has `disabled` + label change ✅. Single retire AlertDialogAction has `disabled={actionBusy}` ✅. Bulk retire/delete actions in `bulk-action-bar.tsx:226, 253` only disable the action button, but the dialog stays open after click — busy spinner is shown but the user could click again on a re-render before the bar closes. |
| Role gating | ✅ | `canEdit` gates new/duplicate/maintenance/retire; `canDelete` gates permanent delete. |
| Performance (N+1, over-fetch) | ❌ | **5 sequential-style `count()` queries for status breakdown** (`assets/route.ts:170–175`) on every fetch. Bulk-bar refetches `/api/kits` every selection cycle (`bulk-action-bar.tsx:67–76`). |
| Debug cleanup | ✅ | No `console.*` / TODO / FIXME found. |
| Accessibility basics | ✅ | Icon-only buttons have `aria-label`; row has `role="row"` + `aria-label`; checkboxes labeled. Minor: row uses `tabIndex=0` on a `<TableRow>` (`data-table.tsx:127`) — keyboard nav works but screen readers may announce it as a generic row plus a button-like control. |

---

## Raise the Bar

This page does several things better than its neighbors and should be the template:

- **React Query for list data with abort + stale-time** (`use-items-query.ts`) — propagate to `bookings`, `users`, `kits`, `checkouts` lists. Eliminates manual `AbortController` choreography.
- **Hook decomposition** (`hooks/use-url-filters`, `use-bulk-actions`, etc.) — propagate the directory layout to other heavy list pages.
- **Consolidated `*-page-init` endpoint** — replicate `items-page-init`'s pattern for any page that fires 3+ option fetches on mount (booking wizard, user-edit page, kit edit page).
- **Real mobile skeleton** (`page.tsx:449–463`) — only place that ships one. Either propagate or remove (because the real page doesn't render cards anyway, the skeleton is currently misleading on its own page).

---

## Quick Wins

- **`page.tsx` / `use-items-query.ts:139`** — Fix `loadError` to `isError && !response`. One-line change; restores the load-error empty state.
- **`use-url-filters.ts:62–69, 92–100`** — Add `showAccessories` to `hasActiveFilters` and reset it in `clearAllFilters`. Also reset `search` inside `clearAllFilters` so callers stop double-calling.
- **`page.tsx:419–425`** — Make the desktop skeleton match real column count (8 cols including select/favorite/actions); align widths to actual columns.
- **`bulk-action-bar.tsx:51, 61, 175–183`** — Delete the `onExportCsv` prop and the dead "Export CSV" menu item, or wire it up. Pick one.
- **`assets/route.ts:170–175`** — Replace 5 separate `count()` calls with a single grouped query (or compute the breakdown from the already-loaded `data` plus one `count` for the unfiltered total). Saves 4 round-trips per page load on Vercel.
- **Extract `getItemHref(asset)` helper** — Replaces the 5 scattered `id.startsWith("bulk-")` sites (`page.tsx:114, 200`, `data-table.tsx:130–131`, `use-bulk-actions.ts:29`).

## Bigger Bets

- **Unify list response shape** — Server returns one heterogeneous array with `kind: "asset" | "bulk"`, removing `mergedData` reshape, the `bulk-` ID prefix scheme, the `offset === 0` carve-out, and the broken merged-sort behavior. Costs: API + client refactor; touches `assets/route.ts`, `columns.tsx`, `use-items-query.ts`, `data-table.tsx`. Worth it — the prefix scheme is a recurring source of confusion and bugs.
- **Render cards on mobile, table on desktop** — Make the data-table a responsive component (table for `sm:` and up, card list below). The skeleton already promises this; today's table on a phone is unusable for anything beyond the first column. Touches `data-table.tsx` only — additive, no API changes.
