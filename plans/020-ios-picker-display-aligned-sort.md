# Plan 020: Sort the iOS booking equipment picker by the product name the user actually reads

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e4b35ae..HEAD -- src/app/api/assets/route.ts ios/Wisconsin/Core/APIClient.swift ios/Wisconsin/Views/CreateBookingSheet.swift`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `6e4b35ae`, 2026-06-13

## Why this matters

In the native reservation-creation sheet (`CreateBookingSheet`), the "available equipment" list shows each row's **product name** (`brand model`), but the list is **ordered by `assetTag`** -- a code the user can't see. The iOS client never sends a `sort` param, so `/api/assets` falls back to its default `assetTag` ascending. The result: a staffer scanning the picker sees product names in what looks like random order ("Sony FX3", then "Canon C70", then "Aputure 600d"...), because the sort key and the visible text are different things. Even if the client asked for `sort=brand`, the server's `brand` ordering has no `model` tiebreaker, so items within a brand still come back in undefined order. This plan makes the picker's order match what the user reads: by brand, then model, then tag.

This is a small, surgical change across two layers. The server half (a new compound sort key) is fully verifiable here; the iOS half is source-verified + `drift:ios` (no Xcode in this environment).

## Current state

### Server -- `src/app/api/assets/route.ts`

`SORT_MAP` (lines 47-63) maps a sort key to a single Prisma `orderBy` object; the default is `assetTag`:

```ts
/** Map sort param to Prisma orderBy clause. */
const SORT_MAP: Record<string, Prisma.AssetOrderByWithRelationInput> = {
  assetTag: { assetTag: "asc" },
  "-assetTag": { assetTag: "desc" },
  brand: { brand: "asc" },
  "-brand": { brand: "desc" },
  model: { model: "asc" },
  "-model": { model: "desc" },
  createdAt: { createdAt: "asc" },
  "-createdAt": { createdAt: "desc" },
  category: { category: { name: "asc" } },
  "-category": { category: { name: "desc" } },
  location: { location: { name: "asc" } },
  "-location": { location: { name: "desc" } },
  department: { department: { name: "asc" } },
  "-department": { department: { name: "desc" } },
};
```

The key is resolved and applied (lines 84-87), then used as `orderBy` in every `db.asset.findMany` in the route:

```ts
const sortParam = searchParams.get("sort") ?? "";
const orderParam = searchParams.get("order") ?? "";
const sortKey = orderParam === "desc" && sortParam && !sortParam.startsWith("-")
  ? `-${sortParam}`
  : sortParam || "assetTag";
const orderBy = SORT_MAP[sortKey] ?? SORT_MAP["assetTag"];
```

Note: `SORT_MAP`'s value type is a single object today. The fix needs a **compound** order (array of objects), so the type must widen to allow arrays. Prisma's `findMany` accepts `orderBy` as either a single object or an array, so passing an array through the existing `orderBy` variable is safe for every call site.

### iOS client -- `ios/Wisconsin/Core/APIClient.swift:443`

`assets(...)` has no `sort` parameter:

```swift
func assets(
    search: String? = nil,
    qr: String? = nil,
    statuses: Set<AssetComputedStatus> = [],
    categoryId: String? = nil,
    favoritesOnly: Bool = false,
    limit: Int = 30,
    offset: Int = 0
) async throws -> AssetsResponse {
    var items: [URLQueryItem] = [
        .init(name: "limit", value: "\(limit)"),
        .init(name: "offset", value: "\(offset)"),
    ]
    // ... appends q, qr, status, category_id, favorites_only ...
    return try await perform(request(path: "/api/assets", queryItems: items))
}
```

### iOS call site + display -- `ios/Wisconsin/Views/CreateBookingSheet.swift`

The picker loads assets without a sort (lines 293-298) and renders `asset.displayName` as the row title:

```swift
let resp = try await APIClient.shared.assets(
    search: capturedSearch.isEmpty ? nil : capturedSearch,
    statuses: [.available],
    limit: 30,
    offset: assetOffset
)
```

`Asset.displayName` is `[brand, model].joined(separator: " ")` (`ios/Wisconsin/Models/AssetModels.swift:78`), shown at `CreateBookingSheet.swift:1556`. So the display string is `brand model`, and the new sort must match that: brand, then model, then a stable `assetTag` tiebreaker.

### Convention -- existing iOS contract tests are source-string assertions

The repo verifies iOS/server contracts by reading source files as strings -- see `tests/ios-create-booking-picker-parity.test.ts` (a `source(file)` + `expect(...).toContain(...)` style). Use that exact style for the wiring assertions in this plan.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Type gate (proves Prisma accepts the compound orderBy) | `npx tsc --noEmit` | exit 0 |
| New/updated tests | `npx vitest run tests/ios-create-booking-picker-parity.test.ts` | all pass |
| iOS drift gate | `npm run drift:ios` | exit 0 |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |

(`npm run build` needs `DIRECT_URL`; use `npx tsc --noEmit` for the type-only gate.)

## Scope

**In scope** (the only files you may modify):

- `src/app/api/assets/route.ts` -- `SORT_MAP` type + a new `name` / `-name` compound entry only.
- `ios/Wisconsin/Core/APIClient.swift` -- add a `sort` parameter to `assets(...)`.
- `ios/Wisconsin/Views/CreateBookingSheet.swift` -- pass `sort: "name"` at the `loadAvailableAssets` call site only.
- `tests/ios-create-booking-picker-parity.test.ts` -- add wiring assertions.

**Out of scope** (do NOT touch):

- The `sortKey` resolution logic (lines 84-87) -- it already handles `name`/`-name` and the `order=desc` form; do not change it.
- The other `SORT_MAP` entries and any other `/api/assets` consumer (web list, exports) -- they keep their current default behavior.
- The scanned-asset `insert(at: 0)` behavior (`CreateBookingSheet.swift:371` and the scan-add path) -- pinning a just-scanned item to the top is intentional immediate-feedback behavior; leave it. (Documented in maintenance notes.)
- `Asset.displayName` -- do not change how rows render.

## Git workflow

- Branch: `improve-exec/020-ios-picker-sort` (fresh from `main` HEAD).
- Conventional commit, e.g. `fix: booking equipment picker sorts by product name instead of an invisible asset tag`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add a compound display-aligned sort key on the server

In `src/app/api/assets/route.ts`, widen the `SORT_MAP` value type to allow an array and add a `name` / `-name` entry that orders by brand, then model, then assetTag:

```ts
const SORT_MAP: Record<
  string,
  Prisma.AssetOrderByWithRelationInput | Prisma.AssetOrderByWithRelationInput[]
> = {
  // Display-aligned: rows show "brand model", so sort by brand → model → tag.
  name: [{ brand: "asc" }, { model: "asc" }, { assetTag: "asc" }],
  "-name": [{ brand: "desc" }, { model: "desc" }, { assetTag: "desc" }],
  assetTag: { assetTag: "asc" },
  // ... rest unchanged ...
};
```

Leave the `sortKey`/`orderBy` resolution and all `findMany` calls unchanged -- they pass `orderBy` straight through.

**Verify**: `npx tsc --noEmit` exits 0 (this proves Prisma's `findMany` accepts the array `orderBy` at every call site).

### Step 2: Let the iOS client request a sort

In `ios/Wisconsin/Core/APIClient.swift`, add a `sort: String? = nil` parameter to `assets(...)` (place it near `categoryId`/`favoritesOnly`), and append it as a query item when present:

```swift
if let sort, !sort.isEmpty { items.append(.init(name: "sort", value: sort)) }
```

**Verify**: `grep -n "sort" ios/Wisconsin/Core/APIClient.swift` shows the new parameter and query item inside `assets(`.

### Step 3: Request the display-aligned sort from the picker

In `ios/Wisconsin/Views/CreateBookingSheet.swift`, at the `loadAvailableAssets` call site (the `APIClient.shared.assets(...)` call around line 293), pass `sort: "name"`:

```swift
let resp = try await APIClient.shared.assets(
    search: capturedSearch.isEmpty ? nil : capturedSearch,
    statuses: [.available],
    sort: "name",
    limit: 30,
    offset: assetOffset
)
```

**Verify**: `grep -n "sort: \"name\"" ios/Wisconsin/Views/CreateBookingSheet.swift` returns one match.

### Step 4: Lock the wiring with source-contract tests

In `tests/ios-create-booking-picker-parity.test.ts`, add a test that asserts the three layers are wired (model after the existing `source(...)` + `toContain` tests in that file):

```ts
it("sorts the available equipment picker by the displayed product name", () => {
  const assetsRoute = source("src/app/api/assets/route.ts");
  const apiClient = source("ios/Wisconsin/Core/APIClient.swift");
  const createSheet = source("ios/Wisconsin/Views/CreateBookingSheet.swift");

  // server exposes a compound display-aligned sort
  expect(assetsRoute).toMatch(/name:\s*\[\{\s*brand:\s*"asc"\s*\},\s*\{\s*model:\s*"asc"\s*\},\s*\{\s*assetTag:\s*"asc"\s*\}\]/);
  // client can send it
  expect(apiClient).toContain("sort: String? = nil");
  expect(apiClient).toContain('items.append(.init(name: "sort", value: sort))');
  // picker requests it
  expect(createSheet).toContain('sort: "name"');
});
```

**Verify**: `npx vitest run tests/ios-create-booking-picker-parity.test.ts` -> all pass.

### Step 5: Full verification

**Verify**: `npm run test` exit 0; `npm run lint` exit 0; `npm run drift:ios` exit 0.

## Test plan

- Source-contract test in `tests/ios-create-booking-picker-parity.test.ts` (Step 4) locks: server compound `name` sort key, client `sort` param + query item, picker passing `sort: "name"`.
- `npx tsc --noEmit` is the behavioral proof for the server -- it fails if the array `orderBy` is not accepted by Prisma at any `db.asset.findMany` call site.
- Optional (only if you can mock the route cheaply): a behavioral test mocking `@/lib/db` + `withAuth` that calls `GET` with `?sort=name&status=available` and asserts the first `db.asset.findMany` received `orderBy: [{ brand: "asc" }, { model: "asc" }, { assetTag: "asc" }]`. The route is branchy; if mocking exceeds two attempts, skip it and rely on the source-contract + tsc gates (do not weaken the route to make a test pass).

## Done criteria

ALL must hold:

- [ ] `SORT_MAP` has a `name` entry equal to `[{ brand: "asc" }, { model: "asc" }, { assetTag: "asc" }]` and its type allows arrays
- [ ] `npx tsc --noEmit` exits 0
- [ ] `ios/Wisconsin/Core/APIClient.swift` `assets(` has a `sort` param that is appended as a `sort` query item
- [ ] `CreateBookingSheet.swift` passes `sort: "name"` to `APIClient.shared.assets`
- [ ] `npx vitest run tests/ios-create-booking-picker-parity.test.ts` exits 0 with the new test
- [ ] `npm run test` exits 0; `npm run lint` exits 0; `npm run drift:ios` exits 0
- [ ] No files modified outside the in-scope list (`git status`)
- [ ] `plans/README.md` status row for 020 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `SORT_MAP` or the `assets(...)` signature no longer matches the "Current state" excerpts (drift).
- `npx tsc --noEmit` rejects the array `orderBy` -- that would mean the Prisma client version here does not accept array `orderBy` (unexpected); report instead of restructuring every call site.
- The `sortKey` logic has changed such that `name`/`-name` would not resolve -- report.
- Adding the `sort` parameter forces a change to any **other** `assets(...)` call site (the parameter is optional with a default, so it should not) -- if it does, report rather than editing unrelated call sites.

## Maintenance notes

- iOS build check before merge: confirm the picker list visibly orders by product name and that a freshly scanned item still appears at the top (intentional "just added" behavior; it is the one item not in sorted position).
- If a future change wants the scanned item to slot into sorted position instead of the top, that is a separate decision -- this plan deliberately preserved the pin-to-top behavior.
- The new `name` sort is now available to every `/api/assets` consumer (web included); if the web list later adopts it, no server change is needed.
- A reviewer should confirm no other `SORT_MAP` entry changed and the default (`assetTag`) is intact for callers that pass no `sort`.
