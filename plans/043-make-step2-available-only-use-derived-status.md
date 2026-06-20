# Plan 043: Make Step 2 available-only use derived status

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/api/assets/picker-search/route.ts src/lib/services/status.ts src/components/equipment-picker/use-picker-search.ts tests/api-hardening-wave12.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **State**: DONE ON MAIN (2026-06-19 reconciliation; implementation originally shipped 2026-06-11)
- **Priority**: P1
- **Effort**: S/M
- **Risk**: MED
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 2 has an "Available only" filter. In this product, item availability is derived from active allocations and booking state, not from the stored `Asset.status` column alone. The picker-search route currently applies `only_available=true` by filtering stored `status = AVAILABLE` before deriving `computedStatus`, so checked-out, pending-pickup, or reserved assets can still appear in the "Available only" view if their stored row status is `AVAILABLE`.

That makes the filter read as untrustworthy right where users are selecting gear.

## Current state

The product rule is explicit:

```md
docs/AREA_CHECKOUTS.md:17
Status and availability logic remain derived from allocations, never authoritative stored status.
```

The picker route parses `only_available`:

```ts
// src/app/api/assets/picker-search/route.ts:40-42
const sectionParam = searchParams.get("section")?.trim();
const onlyAvailable = searchParams.get("only_available") === "true";
const idsParam = searchParams.get("ids")?.trim();
```

But the route filters on stored status before computed status is enriched:

```ts
// src/app/api/assets/picker-search/route.ts:64-66
if (onlyAvailable && !ids && !qr) {
  conditions.push({ status: "AVAILABLE" });
}
```

Computed status is added later:

```ts
// src/app/api/assets/picker-search/route.ts:161-166
const assets = await enrichAssetsWithStatusFromLoaded(sorted);
const unavailableIds = assets
  .filter((a) => a.computedStatus !== "AVAILABLE")
  .map((a) => a.id);
```

The status service already has a DB-level helper for derived filtering:

```ts
// src/lib/services/status.ts
export function buildDerivedStatusWhere(statuses: string[])
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused route tests | `npx vitest run tests/api-hardening-wave12.test.ts` | exit 0 |
| Focused UX tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/app/api/assets/picker-search/route.ts`
- `src/lib/services/status.ts` only if the existing helper needs a small exported type or reuse adjustment
- `tests/api-hardening-wave12.test.ts` or a new focused picker-search route test
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Changing the booking creation payload
- Changing item list filters outside the picker
- Changing bulk SKU availability semantics
- Rewriting picker pagination

## Steps

### Step 1: Replace stored-status available filtering

In `src/app/api/assets/picker-search/route.ts`, stop using `{ status: "AVAILABLE" }` as the available-only filter for serialized assets.

Use the derived-status helper already present in `src/lib/services/status.ts`, or match its DB-level semantics locally if the helper shape does not fit this route:

- stored status is `AVAILABLE`
- no active allocation on `OPEN` checkout
- no active allocation on `PENDING_PICKUP` checkout
- no active started `BOOKED` reservation allocation

Preserve the existing exemptions:

- Do not apply available-only filtering for `ids` hydration.
- Do not apply available-only filtering for exact `qr` lookup.
- Retired assets stay excluded for normal browsing.

Verify: route test for available-only includes a stored `AVAILABLE` asset with an active `OPEN` allocation and proves it is excluded.

### Step 2: Keep counts and totals honest

The route returns `total` and `sectionCounts`. Make sure both reflect derived availability when `only_available=true`.

If the implementation uses `buildDerivedStatusWhere(["AVAILABLE"])`, verify section counts include the same derived filter. Do not leave section counts based on stored status while rows are derived-filtered.

Verify: add an assertion that `db.asset.count` receives the derived allocation exclusion when `only_available=true`.

### Step 3: Preserve scan and hydration behavior

Confirm exact scan lookup and selected-ID hydration still work:

- `?qr=...` can return an unavailable asset so the scanner can show the specific "cannot be added" message.
- `?ids=...` can hydrate a previously selected asset even if it is now unavailable, so the UI can show a removable stale selection.

Verify: existing source-contract tests still pass and a new route test covers at least one of these exemptions if not already covered.

### Step 4: Update docs

Add checkout and reservation changelog rows noting that Step 2 "Available only" now uses derived availability, matching D-001 and allocation state.

## Done criteria

- [x] `only_available=true` excludes derived unavailable serialized assets, not just stored non-AVAILABLE rows.
- [x] `total` and `sectionCounts` are consistent with the filtered results.
- [x] `ids` hydration and `qr` lookup still bypass the filter.
- [x] `npx vitest run tests/api-hardening-wave12.test.ts` passes.
- [x] `npx vitest run tests/booking-create-ux.test.ts` passes.
- [x] `npx tsc --noEmit` passes.
- [x] `git diff --check` passes.
- [x] Area docs are updated.

## STOP conditions

- Stop if derived available filtering would require scanning more than the route's bounded result set in memory.
- Stop if `buildDerivedStatusWhere` semantics do not match picker needs and the fix starts changing global item-list behavior.

## Maintenance notes

Reviewers should check that the route still avoids unbounded reads. This is a picker route in the booking flow, so correctness must not create a slow serverless function.

## Review

- Shipped: picker-search available-only filtering uses `buildDerivedStatusWhere(["AVAILABLE"])` for rows, totals, and section counts while preserving `ids` and `qr` bypasses.
- Verified: focused route and booking-create UX tests pass, plus typecheck and diff hygiene in the 2026-06-19 reconciliation pass.
- Deferred: no follow-up needed.
