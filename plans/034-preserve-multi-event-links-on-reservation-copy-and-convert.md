# Plan 034: Preserve multi-event links on reservation duplicate and conversion

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/app/api/reservations/[id]/convert/route.ts src/app/api/reservations/[id]/duplicate/route.ts src/lib/services/bookings-lifecycle.ts tests docs/AREA_RESERVATIONS.md docs/AREA_CHECKOUTS.md docs/BRIEF_MULTI_EVENT_BOOKING_V1.md`
> If any in-scope file changed since this plan was written, compare the current-state excerpts below against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: MED
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why This Matters

Multi-event bookings were added so one reservation can stay discoverable from every linked event. Reservation duplicate and conversion still copy only the legacy primary `eventId`, so secondary `BookingEvent` links are dropped when an operator duplicates a multi-event reservation or starts checkout from it. That breaks the V1 contract that multi-event links survive booking workflows and makes the resulting checkout or copy disappear from secondary event contexts.

## Current State

- `src/app/api/reservations/[id]/convert/route.ts` loads only `serializedItems` and `bulkItems`, then passes `eventId: full.eventId`.
- `src/app/api/reservations/[id]/duplicate/route.ts` has the same shape for duplication.
- `src/lib/services/bookings-lifecycle.ts` already accepts `eventIds?: string[]`, sorts them chronologically, sets `Booking.eventId` to ordinal 0, and writes `BookingEvent` rows.
- `docs/BRIEF_MULTI_EVENT_BOOKING_V1.md` states that `eventIds[]` is the multi-event contract and that `Booking.eventId` is compatibility-only primary metadata.

Evidence excerpts:

```ts
// src/app/api/reservations/[id]/convert/route.ts:24-31
const full = await db.booking.findUniqueOrThrow({
  where: { id },
  include: {
    serializedItems: true,
    bulkItems: true,
  },
});

// src/app/api/reservations/[id]/convert/route.ts:48-50
sourceReservationId: id,
eventId: full.eventId ?? undefined,
sportCode: full.sportCode ?? undefined,
```

```ts
// src/app/api/reservations/[id]/duplicate/route.ts:22-28
const source = await db.booking.findUniqueOrThrow({
  where: { id },
  include: {
    serializedItems: true,
    bulkItems: true,
  },
});

// src/app/api/reservations/[id]/duplicate/route.ts:45-48
notes: source.notes ?? undefined,
createdBy: user.id,
eventId: source.eventId ?? undefined,
sportCode: source.sportCode ?? undefined,
```

```ts
// src/lib/services/bookings-lifecycle.ts:201-204
const requestedEventIds = input.eventIds && input.eventIds.length > 0
  ? input.eventIds
  : input.eventId ? [input.eventId] : [];
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/create-booking.test.ts tests/booking-list-routes.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| DB schema check | `npx prisma validate` | schema valid |
| Migration drift check | `npm run db:migrate:check` | exit 0 |
| App build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | no output |

## Scope

**In scope**:

- `src/app/api/reservations/[id]/convert/route.ts`
- `src/app/api/reservations/[id]/duplicate/route.ts`
- Existing or new focused tests under `tests/`
- `docs/AREA_RESERVATIONS.md`
- `docs/AREA_CHECKOUTS.md` only if checkout conversion behavior text changes
- `docs/GAPS_AND_RISKS.md` only if a new or closed gap is needed

**Out of scope**:

- Changing `createBooking` multi-event semantics.
- Editing the wizard multi-select UI.
- Adding post-creation event-list editing.
- Changing the `BookingEvent` schema or migrations.

## Steps

### Step 1: Preserve event links in conversion

In `src/app/api/reservations/[id]/convert/route.ts`, include `events` ordered by ordinal when loading the source reservation:

```ts
events: {
  orderBy: { ordinal: "asc" },
  select: { eventId: true },
},
```

Build `eventIds` from `full.events.map((link) => link.eventId)`. When that array is non-empty, pass `eventIds` to `createBooking` and do not pass legacy `eventId`. If there are no junction rows, keep the legacy fallback `eventId: full.eventId ?? undefined`.

**Verify**: `npx vitest run tests/booking-list-routes.test.ts` should still pass before new coverage is added.

### Step 2: Preserve event links in duplicate

Apply the same ordered `events` include and eventId fallback logic in `src/app/api/reservations/[id]/duplicate/route.ts`.

The duplicate action should clone the same multi-event event set because `docs/AREA_RESERVATIONS.md` says duplicate clones the same items, dates, and settings.

**Verify**: `npx vitest run tests/booking-list-routes.test.ts` should still pass before new coverage is added.

### Step 3: Add focused route tests

Add or extend route tests so both endpoints prove the contract:

- Multi-event source with two junction rows calls `createBooking` with `eventIds: [first, second]` and no `eventId`.
- Legacy single-event source with no junction rows still calls `createBooking` with `eventId`.
- Existing permission and status behavior stays intact.

Use existing route-test patterns from `tests/booking-list-routes.test.ts` and `tests/booking-lifecycle-route-contract.test.ts`: mock `requireAuth`, `requireBookingAction`, `db.booking.findUniqueOrThrow`, and `createBooking`.

**Verify**: `npx vitest run tests/booking-list-routes.test.ts` or the new focused test file exits 0.

### Step 4: Update docs

Update `docs/AREA_RESERVATIONS.md` change log with the shipped behavior: reservation duplicate and conversion now preserve all `BookingEvent` links, not only the primary `Booking.eventId`.

Only update `docs/AREA_CHECKOUTS.md` if you changed checkout-facing conversion copy or behavior.

**Verify**: `git diff --check` has no output.

## Test Plan

- Route-level test for convert preserving multi-event links.
- Route-level test for duplicate preserving multi-event links.
- Regression test for legacy `eventId` fallback where `events` is empty.
- Keep existing `createBooking` tests as the service-level guard for chronological sorting and junction writes.

## Done Criteria

- [ ] Convert route passes `eventIds` for source reservations with `BookingEvent` rows.
- [ ] Duplicate route passes `eventIds` for source reservations with `BookingEvent` rows.
- [ ] Legacy single-event sources still work.
- [ ] Focused route tests pass.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build:app` passes.
- [ ] Relevant area docs are updated.
- [ ] `plans/README.md` row is marked `DONE`.

## STOP Conditions

- Stop if the source reservation route cannot load ordered `events` without changing Prisma schema.
- Stop if preserving event links would require changing `createBooking` behavior.
- Stop if tests show duplicate or convert intentionally should not preserve multi-event links. That would contradict current docs and needs a product decision first.

## Maintenance Notes

Reviewers should check that the route sends either `eventIds` or `eventId`, never both. The service already enforces exclusivity, but route clarity matters because this was the root cause of earlier multi-event create failures.

