# Plan 014: Make kiosk checkout completion validate availability and fail with friendly errors

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat e8566c54..HEAD -- src/app/api/kiosk/checkout/complete/route.ts src/lib/services/bookings-lifecycle.ts src/lib/services/availability.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition. Note: this plan was written against
> commit `e8566c54` plus uncommitted working-tree changes; the excerpts below
> are the source of truth.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `e8566c54`, 2026-06-10

## Why this matters

The kiosk iPad checkout flow validates items at **scan** time but the **complete** step trusts the scanned cart blindly. `POST /api/kiosk/checkout/complete` creates the booking and `AssetAllocation` rows without re-checking anything about the assets. Three real failure modes result:

1. **Reserved items 500.** The scan step only rejects assets with an active `CHECKOUT` allocation. An asset with an active `RESERVATION` allocation overlapping the next 24 hours passes the scan, then the DB EXCLUDE constraint `asset_allocations_no_overlap` fires at complete time. The route only catches Prisma `P2002`, so the student sees a raw "Internal server error" banner on the iPad (the iOS view displays the server's error string verbatim).
2. **Maintenance/retired items check out silently.** The EXCLUDE constraint only blocks *overlapping allocations*. An asset moved to `MAINTENANCE` or `RETIRED` after it was scanned (or restored from a stale cart -- the iOS app keeps per-student carts in memory indefinitely) checks out with no error at all. That is a custody-integrity hole in the app's core domain.
3. **Nonexistent asset ids 500** via a foreign-key violation (P2003).

The web booking path (`createBooking` in `src/lib/services/bookings-lifecycle.ts`) already solves all of this: it runs `checkAvailability` inside the transaction and maps allocation-constraint DB errors to a friendly 409. This plan brings the kiosk route to parity. It also adds the first test coverage for this route -- the only kiosk endpoint that *creates* custody currently has zero tests.

## Current state

Files:

- `src/app/api/kiosk/checkout/complete/route.ts` -- the kiosk completion route to fix (121 lines).
- `src/lib/services/bookings-lifecycle.ts` -- web path exemplar; contains the private helpers `prismaErrorText` (line ~103) and `isBookingAllocationConstraintError` (line ~118), and the `checkAvailability` call pattern (lines ~186-198).
- `src/lib/services/availability.ts` -- exports `checkAvailability(tx, args)` (line ~500).
- `src/app/api/kiosk/checkout/scan/route.ts` -- scan-time validation (do not modify; context only).
- `tests/kiosk-bulk-detail-routes.test.ts` -- the structural pattern for kiosk route tests.

The kiosk route's transaction body today (`src/app/api/kiosk/checkout/complete/route.ts`, abridged):

```ts
export const POST = withKiosk(async (req, { kiosk }) => {
  const body = checkoutCompleteBody.parse(await req.json());
  const actorId = body.actorId;
  const locationId = body.locationId || kiosk.locationId;
  const assetIds = body.items;

  // Verify user exists and is active
  const user = await db.user.findFirst({ ... });
  if (!user) throw new HttpError(404, "User not found");

  const now = new Date();
  const endsAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Default: due in 24h

  try {
    const { booking, refNumber } = await db.$transaction(
      async (tx) => {
        const refNumber = await nextBookingRef(tx, "CO");
        const b = await tx.booking.create({ ... });
        const ids = assetIds.map((a) => a.assetId);
        await tx.bookingSerializedItem.createMany({ ... });
        await tx.assetAllocation.createMany({
          data: ids.map((assetId) => ({
            assetId, bookingId: b.id, startsAt: now, endsAt,
            active: true, kind: "CHECKOUT" as const,
          })),
        });
        return { booking: b, refNumber };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    // ... audit + badges + ok(...)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // refNumber collision -> 409 retry; otherwise 409 "items no longer available"
    }
    throw error;
  }
});
```

Note: **no availability check, no asset existence check, no asset status check** between `parse` and `createMany`.

The DB constraint that fires on overlap (`prisma/migrations/0001_manual_constraints/migration.sql`):

```sql
ALTER TABLE asset_allocations
  ADD CONSTRAINT asset_allocations_no_overlap
  EXCLUDE USING gist (
    asset_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (active = true);
```

Postgres raises this as SQLSTATE `23P01`. `fail()` in `src/lib/http.ts` (lines 34-67) handles `HttpError`, `ZodError`, and Prisma `P2034` only; everything else becomes a 500 "Internal server error" plus a Sentry capture.

The web path's guard, which this plan replicates (`src/lib/services/bookings-lifecycle.ts:186-198`):

```ts
const availability = await checkAvailability(tx, {
  locationId: input.locationId,
  startsAt: input.startsAt,
  endsAt: input.endsAt,
  serializedAssetIds: resolvedSerializedAssetIds,
  bulkItems: resolvedBulkItems,
  bookingKind: input.kind,
});
if (availability.conflicts.length > 0 || availability.shortages.length > 0 || availability.unavailableAssets.length > 0) {
  throw new HttpError(409, "Availability conflict", availability);
}
```

And its error mapping (`src/lib/services/bookings-lifecycle.ts:353-355`):

```ts
if (isBookingAllocationConstraintError(error)) {
  throw new HttpError(409, "One or more items are no longer available");
}
```

`isBookingAllocationConstraintError` and `prismaErrorText` are currently **module-private** in `bookings-lifecycle.ts`. It matches: raw code `23P01`, message text containing `asset_allocations_no_overlap`, `P2002` targeting `asset_allocations_asset_id_active_unique`/`asset_id`, and `P2004` mentioning `asset_allocations`.

Repo conventions that apply:

- Kiosk route errors are thrown as `HttpError(status, message)` from `@/lib/http`; `withKiosk` catches and serializes them.
- The iOS kiosk shows error strings verbatim to a student standing at an iPad, so 409 messages must be human ("That item is reserved..." style), not internal jargon.
- Tests mock `@/lib/db`, `@/lib/api` (`withKiosk`), and service modules with `vi.hoisted` + `vi.mock`, then import the route handler directly. See `tests/kiosk-bulk-detail-routes.test.ts:1-90` and model new tests on it exactly.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `npm install` | exit 0 |
| Focused tests | `npx vitest run tests/kiosk-checkout-complete.test.ts` | all pass |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Type/build gate | `npm run build` (needs `DIRECT_URL`; if the env lacks it, use `npx tsc --noEmit` instead) | exit 0 |

## Scope

**In scope** (the only files you should modify):

- `src/app/api/kiosk/checkout/complete/route.ts`
- `src/lib/services/bookings-lifecycle.ts` (only to add `export` to `isBookingAllocationConstraintError`, or to move it plus `prismaErrorText` to a small shared helper -- no behavior changes)
- `tests/kiosk-checkout-complete.test.ts` (create)

**Out of scope** (do NOT touch, even though they look related):

- `src/app/api/kiosk/checkout/scan/route.ts` -- scan-time UX is fine; complete-time is the gap.
- `src/lib/services/availability.ts` -- consume it; do not change it.
- `ios/Wisconsin/Kiosk/*` -- the iOS client needs no change; the response shape and the error envelope (`{error: string}`) stay identical.
- The response body shape of the route on success (`{bookingId, refNumber, itemCount, endsAt}`) -- the deployed iOS app depends on it.
- The 24h default `endsAt` policy -- intentional product behavior.

## Git workflow

- Branch: `advisor/014-kiosk-complete-availability`
- Conventional commits, user-facing outcome phrasing, e.g. `fix: kiosk checkout no longer 500s on reserved items and rejects maintenance assets`
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Export the allocation-constraint error helper

In `src/lib/services/bookings-lifecycle.ts`, add `export` to `isBookingAllocationConstraintError` (and `prismaErrorText` only if you move them to a shared file; simplest is to export in place).

**Verify**: `npx tsc --noEmit` (or `npm run build`) exits 0.

### Step 2: Add availability validation inside the kiosk transaction

In `src/app/api/kiosk/checkout/complete/route.ts`, inside the existing `db.$transaction` callback, **before** `nextBookingRef`:

1. Resolve `const ids = assetIds.map((a) => a.assetId)` once at the top of the transaction (it is currently computed later; reuse one variable).
2. Fetch the assets: `tx.asset.findMany({ where: { id: { in: ids } }, select: { id: true, assetTag: true, name: true, status: true } })`.
   - If `found.length !== ids.length`, throw `HttpError(409, "An item in your cart no longer exists. Remove it and rescan.")`.
   - If any asset has `status === "RETIRED"` or `status === "MAINTENANCE"`, throw `HttpError(409, "<assetTag or name> is unavailable (<maintenance|retired>). Remove it to continue.")` naming the first offending asset.
3. Call `checkAvailability(tx, { locationId, startsAt: now, endsAt, serializedAssetIds: ids, bulkItems: [], bookingKind: "CHECKOUT" })` (import from `@/lib/services/availability`; import the booking-kind value the same way `bookings-lifecycle.ts` does).
   - If `conflicts`, `shortages`, or `unavailableAssets` is non-empty, throw `HttpError(409, "<first conflicting asset's tag/name> was just taken by someone else. Remove it and try again.")`. Use the conflict payload to name the asset when available; fall back to a generic "One or more items are no longer available -- remove them and rescan."

Keep the existing user check, refNumber generation, creates, audit, and badges exactly as they are.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Map residual constraint errors to a friendly 409

In the same route's `catch` block, before the existing P2002 handling, add:

```ts
if (isBookingAllocationConstraintError(error)) {
  throw new HttpError(409, "One or more items were just taken by someone else -- remove them and rescan.");
}
```

(import the helper from `@/lib/services/bookings-lifecycle`). This is the race-window backstop for the gap between Step 2's read and the `createMany`.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Write the tests

Create `tests/kiosk-checkout-complete.test.ts` modeled structurally on `tests/kiosk-bulk-detail-routes.test.ts` (vi.hoisted mock table, `vi.mock("@/lib/db")`, `vi.mock("@/lib/api")` providing a pass-through `withKiosk` with kiosk context `{kioskId, locationId: "loc-1", locationName}`, mock `@/lib/audit`, `@/lib/badges`, `@/lib/services/booking-ref`, `@/lib/services/availability`, and `@/lib/services/bookings-lifecycle` for the exported helper -- or let the real helper run, it is pure). Cover at minimum:

1. Happy path: valid user + available assets -> 200 with `{bookingId, refNumber, itemCount, endsAt}`; booking and allocations created with `kind: "CHECKOUT"`.
2. Asset id not found in `asset.findMany` -> 409, no booking created.
3. Asset with `status: "MAINTENANCE"` -> 409 with message naming the asset.
4. `checkAvailability` returning a non-empty `conflicts` array -> 409, no booking created.
5. `createMany` rejecting with a fake error `{ code: "23P01", message: "...asset_allocations_no_overlap..." }` -> response status 409 (not 500).
6. `locationId` omitted from the body -> booking created with the kiosk's `locationId`.

**Verify**: `npx vitest run tests/kiosk-checkout-complete.test.ts` -> all 6+ tests pass.

### Step 5: Full verification and doc sync

Run the full suite and lint. Then, per the repo's "Doc Sync on Ship" rule, add a change-log row to `docs/AREA_KIOSK.md` describing the user-facing outcome (kiosk checkout now re-validates availability at completion and returns friendly 409s instead of 500s). Doc edits in `docs/AREA_KIOSK.md` are permitted for this step despite the scope list.

**Verify**: `npm run test` exit 0; `npm run lint` exit 0.

## Test plan

Covered by Step 4. Pattern file: `tests/kiosk-bulk-detail-routes.test.ts`. Mock `checkAvailability` per test case; do not hit a real database.

## Done criteria

Machine-checkable. ALL must hold:

- [x] `npx vitest run tests/kiosk-checkout-complete.test.ts` exits 0 with >= 6 tests
- [x] `npm run test` exits 0
- [x] `npm run lint` exits 0, or the repo lint command is documented as blocked and covered by `npm run build:app`
- [x] `grep -n "checkAvailability" src/app/api/kiosk/checkout/complete/route.ts` returns a match
- [x] `grep -n "isBookingAllocationConstraintError" src/app/api/kiosk/checkout/complete/route.ts` returns a match
- [x] No files outside the in-scope list (plus `docs/AREA_KIOSK.md`) modified for this plan (`git status --short src/app/api/kiosk/checkout/complete/route.ts src/lib/services/bookings-lifecycle.ts tests/kiosk-checkout-complete.test.ts docs/AREA_KIOSK.md plans/014-kiosk-checkout-complete-validate-availability.md plans/README.md`)
- [x] `plans/README.md` status row updated

## Review

- `POST /api/kiosk/checkout/complete` now revalidates scanned serialized assets inside the existing SERIALIZABLE transaction before ref-number allocation and booking creation.
- The route rejects missing assets, maintenance/retired assets, availability conflicts, and residual allocation exclusion races with student-readable 409 messages while preserving the success response shape.
- Exported `isBookingAllocationConstraintError` from `bookings-lifecycle.ts` and reused it as the kiosk complete race-window backstop.
- Added `tests/kiosk-checkout-complete.test.ts` with six route tests covering happy path, missing assets, maintenance assets, availability conflicts, exclusion-constraint races, and kiosk-location fallback.
- Updated `docs/AREA_KIOSK.md` with the user-facing outcome.
- Verification: `npx vitest run tests/kiosk-checkout-complete.test.ts`, `npm run test`, `npx tsc --noEmit`, both grep checks, `git diff --check`, and `npm run build:app` passed. `npm run lint` did not run as a usable lint gate because `next lint` prompts to create ESLint config even with `CI=1`; `build:app` completed its lint/type validation phase successfully. `npm run build` was not used because it runs `prisma migrate deploy` against the configured remote Neon database.

## STOP conditions

Stop and report back (do not improvise) if:

- The route file no longer matches the "Current state" excerpt (someone else fixed or refactored it).
- `checkAvailability`'s signature does not accept the call shape shown above (check its definition in `src/lib/services/availability.ts:~500` first).
- `checkAvailability` requires booking-kind enum values you cannot import without pulling in client-only code.
- Adding the reads inside the SERIALIZABLE transaction makes an existing kiosk test fail with serialization conflicts you cannot resolve by mock adjustment.
- You find the route already validates availability (drift).

## Maintenance notes

- The iOS app (`ios/Wisconsin/Kiosk/KioskStore.swift`) keeps per-student carts in memory indefinitely, so "stale cart" completions are expected input to this route; the 409 messages are the user-facing recovery path. A future iOS change could expire carts after a few hours -- deferred.
- If kiosk checkout ever gains bulk items, the `bulkItems: []` argument to `checkAvailability` must be populated.
- Reviewer should scrutinize: that the availability read happens *inside* the transaction (outside reintroduces the race) and that the success response shape is byte-compatible for deployed iOS clients.
- Related deferred nit: `pickup/[id]/scan` has a check-then-act duplicate-scan race (scanEvent findFirst + create outside a transaction). Impact is only duplicate scan events; fix opportunistically if you are already in that file. Out of scope here.
