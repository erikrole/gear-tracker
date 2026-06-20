# Plan 019: Count batteries in kiosk return completion (fix "All 0 items returned") and add the missing kiosk-return tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report -- do not improvise. When done, update the status row for this plan
> in `plans/README.md` -- unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 6e4b35ae..HEAD -- src/lib/services/bookings-checkin.ts src/app/api/kiosk/checkin ios/Wisconsin/Kiosk/KioskReturnView.swift`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **State**: DONE ON MAIN (2026-06-19) — service count fix was already present; this pass added focused kiosk return scan/complete route coverage and a battery-count regression.
- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug + tests
- **Planned at**: commit `6e4b35ae`, 2026-06-13

## Why this matters

When a student returns gear at the kiosk, the completion endpoint computes its item counts from **serialized items only** -- numbered battery units are excluded. The iOS success screen is built directly from those counts. For a **battery-only checkout** (no serialized items -- the common case for the numbered-battery feature, D-022 / plan 051's Brother battery labels), `totalItems` is `0`, so a fully successful return greets the student with **"All 0 items returned. Thanks!"**, and a partial one says **"0 of 0 items returned."** Meanwhile the progress ring counted "2 of 2" the entire time, so the success screen flatly contradicts what the student just did.

The bug went unnoticed because the kiosk *return* flow has **no direct test coverage**: the serialized return scan route, the completion route, and the `kioskCheckinAsset` / `kioskCompleteCheckin` services are untested (only the battery-unit service `scanKioskCheckinBulkUnit` is covered). The pickup flow got this coverage from plan 014; this plan brings the return flow to parity and lands the regression test for the count fix.

This is server-only and fully verifiable in this environment (no iOS code change, no Xcode needed) -- the iOS success message is already correct *given* correct server counts.

## Current state

### The bug -- `src/lib/services/bookings-checkin.ts`

`kioskCompleteCheckin` (the service behind `POST /api/kiosk/checkin/[id]/complete`) loads the booking and computes counts (lines 394-416):

```ts
const booking = await tx.booking.findUnique({
  where: { id: args.bookingId },
  include: { serializedItems: true, bulkItems: true },
});
if (
  !booking ||
  booking.kind !== BookingKind.CHECKOUT ||
  booking.status !== BookingStatus.OPEN
) {
  throw new HttpError(404, "Active checkout not found");
}

const totalItems = booking.serializedItems.length;
const returnedItems = booking.serializedItems.filter(
  (i) => i.allocationStatus === "returned",
).length;
```

`totalItems` / `returnedItems` ignore `booking.bulkItems` entirely. They flow back through the route (`src/app/api/kiosk/checkin/[id]/complete/route.ts:50-54`) and into the iOS success message (`ios/Wisconsin/Kiosk/KioskReturnView.swift:372-377`):

```swift
private func successMessage(for result: KioskCheckinCompleteResult) -> String {
    if result.completed {
        return "All \(result.totalItems) items returned. Thanks!"
    }
    return "\(result.returnedItems) of \(result.totalItems) items returned."
}
```

The kiosk return **checklist** already counts a battery unit as one returnable item (the detail route emits one row per `unitAllocation`; `KioskReturnView` shows `returnedCount` of `totalItems` over serialized + numbered-bulk rows). So the completion counts should match: serialized items **plus numbered battery units**.

### Convention to match -- numbered-bulk counting

The detail route already counts numbered bulk the right way (`src/app/api/kiosk/checkout/[id]/route.ts:97-106`): it filters `booking.bulkItems` to `bi.bulkSku.trackByNumber`, counts **out** as `unitAllocations.length` (equivalently `checkedOutQuantity`) and **completed** as allocations with `checkedInAt` set (equivalently `checkedInQuantity`). Mirror that here using the quantity fields. Only **numbered** bulk is counted -- non-numbered bulk is not part of the kiosk return checklist (kiosk bookings are serialized + numbered-bulk only).

### The test gap

`grep -rln "kioskCompleteCheckin\|kioskCheckinAsset\|checkin/\[id\]/complete\|checkin/\[id\]/scan" tests/` returns nothing. The only kiosk-return coverage is `tests/bulk-unit-kiosk-scans.test.ts` (the `scanKioskCheckinBulkUnit` battery-unit service). There are two existing test patterns to copy:

- **Service-level** (mock a fake `tx`, call the service directly): `tests/bulk-unit-kiosk-scans.test.ts` -- see its `makeTx()` helper.
- **Route-level** (mock services + `withKiosk` passthrough, assert the `Response` or `.rejects.toThrow`): `tests/kiosk-bulk-detail-routes.test.ts`.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| New tests (focused) | `npx vitest run tests/kiosk-checkin-routes.test.ts` | all pass |
| Existing return tests still green | `npx vitest run tests/bulk-unit-kiosk-scans.test.ts` | all pass |
| Type gate | `npx tsc --noEmit` | exit 0 |
| Full suite | `npm run test` | exit 0 |
| Lint | `npm run lint` | exit 0 |

(`npm run build` runs `prisma migrate deploy` and needs `DIRECT_URL`; use `npx tsc --noEmit` for a type-only check.)

## Scope

**In scope** (the only files you may modify):

- `src/lib/services/bookings-checkin.ts` -- the count computation in `kioskCompleteCheckin` only (plus widening its booking-include to get `bulkSku.trackByNumber`).
- `tests/kiosk-checkin-routes.test.ts` -- **new file**.
- `docs/AREA_KIOSK.md` -- one change-log row (Step 4).

**Out of scope** (do NOT touch, even though they look related):

- `maybeAutoComplete` and its completion side effects -- the `completed` boolean it produces is already correct; only the *display counts* are wrong. Do not change auto-complete gating.
- `markCheckoutCompleted`, `checkinItems`, `checkinBulkItem` -- the web/partial paths; their counting is separate and out of scope.
- `ios/Wisconsin/Kiosk/KioskReturnView.swift` -- no change needed; it is correct given fixed server counts. (Exemplar only.)
- The serialized scan route, the complete route handlers -- you add tests for them but do **not** modify their logic.
- The kiosk audit `before/after` shape in the complete route -- it will naturally carry the corrected counts; do not restructure it.

## Git workflow

- Branch: `improve-exec/019-kiosk-return-count-batteries` (fresh from `main` HEAD; do NOT reuse any `codex/*` or `advisor/*` branch).
- Conventional commits, e.g. `fix: kiosk return success message counts battery units instead of saying "All 0 items returned"`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Count numbered bulk units in `kioskCompleteCheckin`

In `src/lib/services/bookings-checkin.ts`, widen the booking include in `kioskCompleteCheckin` so the bulk items carry `trackByNumber`:

```ts
const booking = await tx.booking.findUnique({
  where: { id: args.bookingId },
  include: {
    serializedItems: true,
    bulkItems: { include: { bulkSku: { select: { trackByNumber: true } } } },
  },
});
```

Then replace the two count lines (currently serialized-only) with serialized + numbered-bulk counts:

```ts
const numberedBulk = booking.bulkItems.filter((item) => item.bulkSku.trackByNumber);
const bulkUnitsOut = numberedBulk.reduce(
  (sum, item) => sum + (item.checkedOutQuantity ?? 0),
  0,
);
const bulkUnitsReturned = numberedBulk.reduce(
  (sum, item) => sum + (item.checkedInQuantity ?? 0),
  0,
);

const totalItems =
  booking.serializedItems.length + bulkUnitsOut;
const returnedItems =
  booking.serializedItems.filter((i) => i.allocationStatus === "returned").length +
  bulkUnitsReturned;
```

Leave everything else (the `checkinBulkItems` stock-return array, the `maybeAutoComplete` call, the `completed`/`badgeEvent` return) unchanged.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: New test file -- service-level regression for the count fix

Create `tests/kiosk-checkin-routes.test.ts`. First block: a **service-level** test of `kioskCompleteCheckin` proving battery units are counted. Mock `@/lib/db` so `db.$transaction(cb)` invokes `cb(tx)` with a fake `tx`, and stub the collaborators so no completion side effects run. Use a battery-only booking with one unit still out, so `maybeAutoComplete` returns `null` early (after just the serialized `count` + bulk `findMany`) and `completed` is `false` -- this isolates the counts with minimal mocking.

Skeleton (adapt names to match the repo's vitest style; model the `tx` shape on `makeTx()` in `tests/bulk-unit-kiosk-scans.test.ts`):

```ts
import { describe, expect, it, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  bookingFindUnique: vi.fn(),
  serializedCount: vi.fn(),
  bulkFindMany: vi.fn(),
  badgeOnCheckoutReturned: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/badges", () => ({
  badges: { onCheckoutReturned: mocks.badgeOnCheckoutReturned },
}));

import { kioskCompleteCheckin } from "@/lib/services/bookings-checkin";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation((cb: any) =>
    cb({
      booking: { findUnique: mocks.bookingFindUnique },
      bookingSerializedItem: { count: mocks.serializedCount },
      bookingBulkItem: { findMany: mocks.bulkFindMany },
    }),
  );
});

describe("kioskCompleteCheckin counts", () => {
  it("counts numbered battery units, not just serialized items", async () => {
    mocks.bookingFindUnique.mockResolvedValue({
      id: "booking-1",
      kind: "CHECKOUT",
      status: "OPEN",
      refNumber: "CO-1001",
      locationId: "loc-1",
      requesterUserId: "user-1",
      endsAt: new Date("2026-05-06T12:00:00.000Z"),
      serializedItems: [], // battery-only checkout
      bulkItems: [
        {
          bulkSkuId: "sku-1",
          plannedQuantity: 2,
          checkedOutQuantity: 2,
          checkedInQuantity: 1,
          bulkSku: { trackByNumber: true },
        },
      ],
    });
    // maybeAutoComplete: serialized active count = 0, but one battery still out
    mocks.serializedCount.mockResolvedValue(0);
    mocks.bulkFindMany.mockResolvedValue([
      { checkedInQuantity: 1, checkedOutQuantity: 2, plannedQuantity: 2 },
    ]);

    const result = await kioskCompleteCheckin({
      bookingId: "booking-1",
      actorUserId: "user-1",
    });

    expect(result.completed).toBe(false); // one unit still out
    expect(result.totalItems).toBe(2); // 0 serialized + 2 battery units out
    expect(result.returnedItems).toBe(1); // 1 battery unit returned
    expect(mocks.badgeOnCheckoutReturned).not.toHaveBeenCalled();
  });
});
```

If `kioskCompleteCheckin` reaches a `tx` method you did not stub (it shouldn't, given the early `null` return), the error message names the missing method -- add it to the fake `tx` and re-run; do not change the service to accommodate the test.

**Verify**: `npx vitest run tests/kiosk-checkin-routes.test.ts` -> this test passes. (It will FAIL against the unfixed service -- run it before Step 1 if you want to see the bug, or trust the regression.)

### Step 3: Same file -- route-level coverage for scan + complete

Add two more `describe` blocks to `tests/kiosk-checkin-routes.test.ts`, modeled on `tests/kiosk-bulk-detail-routes.test.ts` (mock `@/lib/api`'s `withKiosk` as a passthrough that injects `kiosk` + `params`; mock the services). Note: because these blocks need different `@/lib/db` and service mocks than Step 2, either put them in the same file with a superset of mocks, or split into clearly separated `describe`s with their own `vi.mock` -- keep all `vi.mock` calls at top-level module scope (hoisted).

**Serialized return scan route** (`POST` from `src/app/api/kiosk/checkin/[id]/scan/route.ts`). Mock `findAssetByScanValue`, `scanKioskCheckinBulkUnit` (return `{ handled: false }` so control falls to the serialized path), `kioskCheckinAsset`, and `badges.onScanResult`. Cases:

- **success**: booking `OPEN`; asset found; `kioskCheckinAsset` -> `{ ok: true, alreadyReturned: false }`. Expect the `Response` JSON to be `{ success: true, item: { id, name, tagName } }`.
- **already returned**: `kioskCheckinAsset` -> `{ ok: false, reason: "already_returned" }`. Expect `{ success: false, error: "<assetTag> already returned" }`.
- **not in booking**: `kioskCheckinAsset` -> `{ ok: false, reason: "not_in_booking" }`. Expect `{ success: false, error: "<assetTag> is not in this checkout" }`.
- **asset not found**: `findAssetByScanValue` -> `null`. Expect `{ success: false, error: "Item not found" }`.
- **wrong booking state**: `booking.findUnique` -> a non-`OPEN` booking. Expect `.rejects.toThrow("Active checkout not found")` (mirror the `.rejects.toThrow` style at `tests/kiosk-bulk-detail-routes.test.ts:333-338`).

**Complete route** (`POST` from `src/app/api/kiosk/checkin/[id]/complete/route.ts`). Mock `db.user.findFirst`, `kioskCompleteCheckin`, and `createAuditEntry`. Cases:

- **happy path**: user active; `kioskCompleteCheckin` -> `{ refNumber: "CO-1", totalItems: 2, returnedItems: 2, completed: true }`. Expect the `Response` JSON `{ returnedItems: 2, totalItems: 2, completed: true }`, and assert `createAuditEntry` was called with `expect.objectContaining({ action: "kiosk_checkin", after: expect.objectContaining({ source: "KIOSK", kioskDeviceId: "kiosk-1" }) })`.
- **user not found**: `db.user.findFirst` -> `null`. Expect `.rejects.toThrow("User not found")`.

**Verify**: `npx vitest run tests/kiosk-checkin-routes.test.ts` -> all pass.

### Step 4: Full verification + doc sync

Add one change-log row to `docs/AREA_KIOSK.md` noting that kiosk return completion now counts battery units (no more "All 0 items returned" on battery-only checkouts) and that the kiosk return scan/complete paths gained test coverage.

**Verify**: `npm run test` exit 0; `npm run lint` exit 0.

## Test plan

New file `tests/kiosk-checkin-routes.test.ts`:

- **Service regression (Step 2)**: `kioskCompleteCheckin` on a battery-only booking returns `totalItems`/`returnedItems` that include numbered units (this is the fix's regression guard -- it fails against the current code).
- **Scan route (Step 3)**: success, already-returned, not-in-booking, asset-not-found, wrong-state(404).
- **Complete route (Step 3)**: happy path (counts + audit shape) and user-not-found(404).

Structural patterns: `makeTx()` in `tests/bulk-unit-kiosk-scans.test.ts` for the service test; the `vi.mock` + `withKiosk` passthrough + `.rejects.toThrow` style in `tests/kiosk-bulk-detail-routes.test.ts` for the route tests.

## Done criteria

ALL must hold:

- [ ] `kioskCompleteCheckin` filters `bulkItems` by `bulkSku.trackByNumber` and adds `checkedOutQuantity`/`checkedInQuantity` into `totalItems`/`returnedItems` (`grep -n "trackByNumber" src/lib/services/bookings-checkin.ts` shows a match inside `kioskCompleteCheckin`)
- [ ] `tests/kiosk-checkin-routes.test.ts` exists with the service regression + scan-route + complete-route cases
- [ ] `npx vitest run tests/kiosk-checkin-routes.test.ts` exits 0
- [ ] `npx vitest run tests/bulk-unit-kiosk-scans.test.ts` exits 0 (return-unit service untouched)
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run test` exits 0; `npm run lint` exits 0
- [ ] No files modified outside the in-scope list plus `docs/AREA_KIOSK.md` (`git status`)
- [ ] `plans/README.md` status row for 019 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `kioskCompleteCheckin` no longer matches the "Current state" excerpt (drift since this plan was written).
- The service reaches a `tx` method in Step 2 that implies `maybeAutoComplete` is NOT returning early (i.e. it tries completion writes) -- that means your fake booking made it auto-complete; re-check that one battery unit is still out (`checkedInQuantity < checkedOutQuantity`) before adding more mocks.
- You discover `BookingBulkItem.checkedInQuantity`/`checkedOutQuantity` are not nullable numbers as assumed, or `bulkSku.trackByNumber` is not selectable here -- report rather than guessing the schema.
- A route test needs you to change route/service *logic* (not just mocks) to pass -- that is out of scope; report it.
- Any previously-passing test in the suite regresses and you cannot trace it to your change.

## Maintenance notes

- The counts now mean "serialized items + numbered battery units" out/returned, matching the kiosk return checklist. If the kiosk ever returns **non-numbered** bulk (today an upstream invariant says it never does -- a non-numbered bulk item would also make kiosk *pickup* confirm impossible via the `incompleteBulk` guard), this counting and the checklist both need to be revisited together.
- A reviewer should confirm the iOS side was deliberately left unchanged: `KioskReturnView.successMessage` is correct once the server counts include batteries. No Xcode build is required for this plan.
- The new `tests/kiosk-checkin-routes.test.ts` is the return-flow analogue of `tests/kiosk-bulk-detail-routes.test.ts`; future kiosk return changes should extend it rather than starting a third file.
