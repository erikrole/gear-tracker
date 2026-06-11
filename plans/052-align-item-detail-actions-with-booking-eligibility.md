# Plan 052: Align item-detail actions with booking eligibility

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/(app)/items/[id]/_components/ItemHeader.tsx src/app/(app)/items/[id]/types.ts src/components/booking-wizard/BookingWizard.tsx src/lib/services/availability.ts tests/availability.test.ts tests/item-detail-actions-source.test.ts docs/AREA_ITEMS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

The item detail header is the fastest path from an item to a new checkout or reservation. It already blocks check-out for maintenance items, but it still allows Reserve when `availableForReservation` is true and the item's derived status is `MAINTENANCE`. Server-side booking availability later rejects any non-`AVAILABLE` stored status, so the header can send staff into a flow that is doomed at submit time. The detail page should use the same eligibility contract as booking validation and the equipment picker: policy flags enable workflows, while maintenance and retired status block actual booking starts.

## Current state

- `docs/AREA_ITEMS.md` says the item detail header owns the primary `Reserve` and `Check out` actions, and the derived status is the lead operational signal.
- `ItemHeader.tsx` blocks check-out for retired, maintenance, and active checkout states, but reserve only checks policy and retired:

```tsx
// src/app/(app)/items/[id]/_components/ItemHeader.tsx:138-144
const isRetired = asset.computedStatus === "RETIRED";
const isMaintenance = asset.computedStatus === "MAINTENANCE";
const hasBlockingCheckout =
  (asset.computedStatus === "CHECKED_OUT" || asset.computedStatus === "PENDING_PICKUP") &&
  asset.activeBooking?.kind === "CHECKOUT";
const canReserve = asset.availableForReservation && !isRetired;
const canCheckOut = asset.availableForCheckout && !isRetired && !isMaintenance && !hasBlockingCheckout;
```

- The disabled reserve fallback always says only the policy is disabled:

```tsx
// src/app/(app)/items/[id]/_components/ItemHeader.tsx:318-325
{canReserve ? (
  <Button size="sm" variant="outline" asChild>
    <Link href={`/reservations?newFor=${asset.id}`}>Reserve</Link>
  </Button>
) : (
  <Button size="sm" variant="outline" disabled title="Reservations are disabled for this item">
    Reserve
  </Button>
)}
```

- Booking creation consumes `newFor` directly as a selected asset id:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:154-160
const initialTitle = searchParams.get("title") || "";
const initialStartsAt = searchParams.get("startsAt") || undefined;
const initialEndsAt = searchParams.get("endsAt") || undefined;
const initialLocationId = searchParams.get("locationId") || undefined;
const initialAssetIds = searchParams.get("newFor") ? [searchParams.get("newFor")!] : undefined;
```

- Server validation rejects maintenance and retired assets before workflow policy flags:

```ts
// src/lib/services/availability.ts:145-151
for (const a of assets) {
  if (a.status !== "AVAILABLE") {
    unavailable.push({ assetId: a.id, status: a.status as string });
  } else if (args.bookingKind === BookingKind.CHECKOUT && !a.availableForCheckout) {
    unavailable.push({ assetId: a.id, status: "NOT_AVAILABLE_FOR_CHECKOUT" });
  } else if (args.bookingKind === BookingKind.RESERVATION && !a.availableForReservation) {
```

- Existing tests already prove this server behavior:

```ts
// tests/availability.test.ts:387-395
it("flags assets in MAINTENANCE status", async () => {
  const tx = createMockTx();
  tx.asset.findMany.mockResolvedValue([
    { id: "a-1", status: "MAINTENANCE", availableForCheckout: true, availableForReservation: true },
  ]);

  const result = await checkAssetStatuses(tx as any, { serializedAssetIds: ["a-1"] });
  expect(result[0]).toEqual({ assetId: "a-1", status: "MAINTENANCE" });
});
```

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused source contract | `npx vitest run tests/item-detail-actions-source.test.ts` | exit 0, all tests pass |
| Availability regression | `npx vitest run tests/availability.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/app/(app)/items/[id]/_components/ItemHeader.tsx`
- `tests/item-detail-actions-source.test.ts` (create if absent)
- `docs/AREA_ITEMS.md`

**Out of scope**:
- Do not change booking availability validation in `src/lib/services/availability.ts`; it is the source of truth.
- Do not change booking wizard state or `newFor` routing.
- Do not change checkout, reservation, kiosk, or picker APIs in this plan.
- Do not redesign the item detail header layout.

## Git workflow

- Branch: `advisor/052-item-detail-booking-action-eligibility`
- Commit style: conventional commit, for example `fix: align item detail booking actions with item status`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Centralize header action eligibility locally

In `ItemHeader.tsx`, replace the raw `canReserve` and `canCheckOut` booleans with small local helpers or clearly named constants that encode:

- Reserve requires `asset.availableForReservation`.
- Check out requires `asset.availableForCheckout`.
- Both Reserve and Check out require `asset.computedStatus === "AVAILABLE"` unless they are opening an existing active booking link.
- Keep the existing `Open reservation`, `Open pickup`, and `Open checkout` link behavior unchanged.

Suggested shape:

```tsx
const isAvailable = asset.computedStatus === "AVAILABLE";
const canReserve = asset.availableForReservation && isAvailable;
const canCheckOut = asset.availableForCheckout && isAvailable;
```

If this removes `hasBlockingCheckout`, preserve its user-facing title text by moving active checkout reasons into the disabled-title helper from Step 2.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 2: Make disabled reasons specific

Add tiny local title helpers in `ItemHeader.tsx` so disabled buttons explain the actual blocker:

- Retired: "Retired items cannot be reserved" and "Retired items cannot be checked out".
- Maintenance: "Maintenance items cannot be reserved" and "Maintenance items cannot be checked out".
- Checked out or pending pickup: preserve the existing checkout title language.
- Policy off: keep "Reservations are disabled for this item" and "Check out is disabled for this item".

Do not add visible instructional text. Use button `title` and, if the current button primitive supports it cleanly, keep the existing disabled button pattern.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Add source-contract coverage

Create `tests/item-detail-actions-source.test.ts` modeled after `tests/item-bookable-policy-source.test.ts`.

Cover:

- `ItemHeader.tsx` contains an `isAvailable` or equivalent computed-status gate for Reserve.
- The Reserve link is still `/reservations?newFor=${asset.id}` when enabled.
- Disabled reserve copy includes a maintenance-specific title.
- The checkout enabled condition also depends on the same available-status gate.
- The test must not assert brittle class names.

**Verify**: `npx vitest run tests/item-detail-actions-source.test.ts` exits 0.

### Step 4: Sync docs

Update `docs/AREA_ITEMS.md` change log with a 2026-06-11 entry stating that item-detail Reserve and Check out actions now align with booking availability: policy flags enable workflows, but maintenance and retired status block new booking starts.

**Verify**: `rg -n "item-detail|Reserve|maintenance|retired|Change Log" docs/AREA_ITEMS.md` shows the new entry.

## Test plan

- New source-contract test in `tests/item-detail-actions-source.test.ts`.
- Existing availability regression in `tests/availability.test.ts`.
- `npx tsc --noEmit`.
- `git diff --check`.

## Done criteria

- [ ] Reserve is disabled when `asset.computedStatus` is `MAINTENANCE` or `RETIRED`.
- [ ] Check out still stays disabled for maintenance, retired, checked-out, and pending-pickup states.
- [ ] Enabled Reserve and Check out links are unchanged for truly available items.
- [ ] Disabled button titles name maintenance and retired blockers specifically.
- [ ] `npx vitest run tests/item-detail-actions-source.test.ts` exits 0.
- [ ] `npx vitest run tests/availability.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant docs are updated.
- [ ] `plans/README.md` status row for plan 052 is updated.

## STOP conditions

Stop and report back if:

- Booking availability validation no longer rejects non-`AVAILABLE` asset statuses.
- Product docs have changed to allow maintenance items to be reserved.
- Fixing this requires changing booking wizard initialization or server validation.
- A source-contract test already covers this exact reserve-maintenance gate.

## Maintenance notes

This plan deliberately keeps policy and status separate. Future item-detail action work should continue to treat `availableForCheckout` and `availableForReservation` as workflow policy, then layer current status on top before offering a new booking action.
