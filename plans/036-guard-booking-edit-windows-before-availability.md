# Plan 036: Guard booking edit windows before availability rewrites

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/lib/services/bookings-lifecycle.ts src/lib/validation.ts tests/update-booking.test.ts tests/booking-lifecycle-route-contract.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current-state excerpts below against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why This Matters

Create flows explicitly reject invalid booking windows before availability work starts. Edit flows compute the next window and immediately call availability checks, then rebuild booking allocations. A bad update window should fail with a clear 400 before availability queries or allocation rewrites. This keeps edit behavior aligned with the documented create guardrails and gives clients predictable error copy.

## Current State

- `createBooking` calls `assertValidCreateWindow` before opening the transaction.
- `updateReservation` computes `nextStartsAt` and `nextEndsAt`, then calls `checkAvailability` without an explicit window guard.
- `updateCheckout` computes `nextStartsAt` and `nextEndsAt`, then calls `checkAvailability` without an explicit window guard.
- Existing focused tests cover invalid create windows but not invalid edit windows.

Evidence excerpts:

```ts
// src/lib/services/bookings-lifecycle.ts:387-407
const nextStartsAt = updates.startsAt ?? existing.startsAt;
const nextEndsAt = updates.endsAt ?? existing.endsAt;
const nextLocationId = updates.locationId ?? existing.locationId;

const availability = await checkAvailability(tx, {
  locationId: nextLocationId,
  startsAt: nextStartsAt,
  endsAt: nextEndsAt,
  serializedAssetIds,
  bulkItems,
  excludeBookingId: bookingId,
  bookingKind: "RESERVATION",
});
```

```ts
// src/lib/services/bookings-lifecycle.ts:586-607
const nextEndsAt = updates.endsAt ?? existing.endsAt;
const nextLocationId = updates.locationId ?? existing.locationId;
const nextStartsAt = existing.startsAt; // start is fixed for OPEN checkouts

const availability = await checkAvailability(tx, {
  locationId: nextLocationId,
  startsAt: nextStartsAt,
  endsAt: nextEndsAt,
  serializedAssetIds,
  bulkItems,
  excludeBookingId: bookingId,
  bookingKind: "CHECKOUT",
});
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/update-booking.test.ts tests/booking-lifecycle-route-contract.test.ts tests/booking-create-validation.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| DB schema check | `npx prisma validate` | schema valid |
| Migration drift check | `npm run db:migrate:check` | exit 0 |
| App build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | no output |

## Scope

**In scope**:

- `src/lib/services/bookings-lifecycle.ts`
- `tests/update-booking.test.ts`
- `tests/booking-lifecycle-route-contract.test.ts` if route-level behavior needs an assertion.
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

**Out of scope**:

- Changing create-flow validation.
- Changing date picker UI.
- Changing availability overlap semantics.
- Changing `extendBooking`, which already checks that the new end is later than the current end and in the future.

## Steps

### Step 1: Extract a reusable booking window guard

In `src/lib/services/bookings-lifecycle.ts`, rename or generalize `assertValidCreateWindow` to an internal helper such as `assertValidBookingWindow`.

It should preserve the current behavior:

- invalid `Date` values throw `HttpError(400, "Invalid startsAt or endsAt")`
- `endsAt <= startsAt` throws `HttpError(400, "endsAt must be later than startsAt")`

Keep the helper local to the service file unless another module already needs it.

**Verify**: `npx vitest run tests/create-booking.test.ts` exits 0.

### Step 2: Guard reservation edits before availability

In `updateReservation`, after `nextStartsAt` and `nextEndsAt` are computed and before `checkAvailability`, call the shared window guard.

Add a test in `tests/update-booking.test.ts`:

- Existing reservation starts at `2026-04-10T08:00:00Z`.
- Update with `endsAt: new Date("2026-04-10T07:00:00Z")`.
- Expect rejection with `"endsAt must be later than startsAt"`.
- Assert `checkAvailability` was not called.
- Assert no delete/create allocation calls were made.

**Verify**: `npx vitest run tests/update-booking.test.ts`.

### Step 3: Guard checkout edits before availability

In `updateCheckout`, after `nextStartsAt` and `nextEndsAt` are computed and before `checkAvailability`, call the same window guard.

Add a test:

- Existing checkout starts at `2026-04-10T08:00:00Z`.
- Update with `endsAt: new Date("2026-04-10T07:00:00Z")`.
- Expect rejection with `"endsAt must be later than startsAt"`.
- Assert `checkAvailability` was not called.
- Assert no delete/create allocation calls were made.

**Verify**: `npx vitest run tests/update-booking.test.ts`.

### Step 4: Update docs

Update `docs/AREA_CHECKOUTS.md` and `docs/AREA_RESERVATIONS.md` only if the docs need a change-log row to reflect edit-window hardening. The core rules already say invalid create windows are guarded; add edit-window wording if missing.

**Verify**: `git diff --check` has no output.

## Test Plan

- Two service tests in `tests/update-booking.test.ts`: reservation invalid edit window and checkout invalid edit window.
- Existing create validation tests remain unchanged.
- No browser test is required because this is service/API guardrail work with no UI surface change.

## Done Criteria

- [ ] `updateReservation` rejects invalid windows before availability checks.
- [ ] `updateCheckout` rejects invalid windows before availability checks.
- [ ] Tests prove no allocation rebuild starts after invalid windows.
- [ ] Existing create-window behavior is unchanged.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build:app` passes.
- [ ] Relevant docs are updated if behavior wording changes.
- [ ] `plans/README.md` row is marked `DONE`.

## STOP Conditions

- Stop if `checkAvailability` is already expected to own invalid-window validation in a way tests depend on.
- Stop if route-level Zod validation is changed instead of service validation. The service is the shared guardrail.
- Stop if the fix appears to require schema or availability overlap changes.

## Maintenance Notes

The reviewer should verify that invalid edit windows fail before any destructive rebuild calls. The point is not just the error message, but preventing delete/recreate work from starting on impossible windows.

