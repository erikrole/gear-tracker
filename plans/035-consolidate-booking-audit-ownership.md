# Plan 035: Consolidate booking create and edit audit ownership

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/lib/services/bookings-lifecycle.ts src/app/api/checkouts/route.ts src/app/api/reservations/route.ts src/app/api/bookings/[id]/route.ts src/app/api/reservations/[id]/convert/route.ts src/app/api/reservations/[id]/duplicate/route.ts tests docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current-state excerpts below against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/034-preserve-multi-event-links-on-reservation-copy-and-convert.md
- **Category**: tech debt
- **Planned at**: commit `8d445512`, 2026-06-11

## Why This Matters

Booking audit logging is split between service-layer transactional writes and route-layer follow-up writes. Creates and edits can produce overlapping broad audit rows in addition to the service's canonical rows. The service rows are safer because they live in the same transaction as the mutation and include richer equipment and event context. Consolidating ownership reduces audit noise and prevents future flows from forgetting that the service already writes the authoritative audit record.

## Current State

- `createBooking` writes a transactional `created` audit row with kind, title, dates, equipment, source reservation, and sorted event IDs.
- `POST /api/checkouts` writes a second `create` audit row after `createBooking`.
- `POST /api/reservations` writes a second `create` audit row after `createBooking`.
- `PATCH /api/bookings/[id]` writes a route-level broad `updated` audit row after calling `updateReservation` or `updateCheckout`, while those services already write field and equipment audit rows inside their transactions.
- Convert and duplicate routes write route-level action rows. Those may still be useful, but the policy should be explicit after plan 034 lands.

Evidence excerpts:

```ts
// src/lib/services/bookings-lifecycle.ts:297-313
await createAuditEntryTx(tx, {
  actorId: input.createdBy,
  actorRole,
  entityType: "booking",
  entityId: booking.id,
  action: "created",
  after: {
    kind: input.kind,
    title: input.title,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    serializedAssetIds: resolvedSerializedAssetIds,
    bulkItems: resolvedBulkItems,
    sourceReservationId: input.sourceReservationId,
    eventIds: sortedEventIds,
  },
});
```

```ts
// src/app/api/checkouts/route.ts:122-129
await createAuditEntry({
  actorId: user.id,
  actorRole: user.role,
  entityType: "booking",
  entityId: checkout.id,
  action: "create",
  after: { title: checkout.title ?? body.title, kind: "CHECKOUT" },
});
```

```ts
// src/app/api/bookings/[id]/route.ts:87-95
await createAuditEntry({
  actorId: user.id,
  actorRole: user.role,
  entityType: "booking",
  entityId: id,
  action: "updated",
  before: beforeSnapshot,
  after: body as Record<string, unknown>,
});
```

## Commands You Will Need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/create-booking.test.ts tests/update-booking.test.ts tests/booking-lifecycle-route-contract.test.ts tests/booking-list-routes.test.ts` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0 |
| DB schema check | `npx prisma validate` | schema valid |
| Migration drift check | `npm run db:migrate:check` | exit 0 |
| App build | `npm run build:app` | exit 0 |
| Whitespace | `git diff --check` | no output |

## Scope

**In scope**:

- `src/app/api/checkouts/route.ts`
- `src/app/api/reservations/route.ts`
- `src/app/api/bookings/[id]/route.ts`
- `src/lib/services/bookings-lifecycle.ts` only if service audit payloads need small enrichment.
- Tests that currently expect route-level duplicate audit rows.
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

**Out of scope**:

- Changing audit table schema.
- Rewriting audit history UI.
- Removing convert or duplicate action audit rows unless tests and docs clearly classify them as duplicate noise.
- Changing notification behavior.

## Steps

### Step 1: Define audit ownership in code comments and tests

Make the service layer the canonical owner for booking mutation audit rows that change booking state, fields, equipment, allocations, or event links.

Route-level audit rows should remain only for action semantics that are not already represented by the service row, such as an explicit `duplicate` action on the new copied booking if reviewers still value it.

**Verify**: no code behavior change yet; `npx vitest run tests/create-booking.test.ts tests/update-booking.test.ts` exits 0.

### Step 2: Remove duplicate create audit rows from create routes

In `src/app/api/checkouts/route.ts` and `src/app/api/reservations/route.ts`:

- Remove `createAuditEntry` imports if they become unused.
- Remove the post-`createBooking` route-level `action: "create"` audit write.
- Keep low-stock notification and reservation lifecycle notification behavior unchanged.

The service `created` row is richer and transactional. Do not change its action name in this plan unless every consumer and test is updated deliberately.

**Verify**: update affected tests, then run `npx vitest run tests/create-booking.test.ts tests/booking-list-routes.test.ts`.

### Step 3: Remove duplicate route edit audit row

In `src/app/api/bookings/[id]/route.ts`:

- Keep optimistic locking, `requireBookingAction`, and dispatch to `updateReservation` or `updateCheckout`.
- Remove the route-level `createAuditEntry` call after the service update.
- Remove the `beforeSnapshot` construction if it becomes unused.
- Keep the enriched refetch and `allowedActions` response unchanged.

Update `tests/booking-lifecycle-route-contract.test.ts`; it should assert dispatch, optimistic locking, and response behavior, not a second route-level audit row.

**Verify**: `npx vitest run tests/booking-lifecycle-route-contract.test.ts tests/update-booking.test.ts`.

### Step 4: Decide convert and duplicate route action rows after plan 034

After plan 034 is landed, re-read:

- `src/app/api/reservations/[id]/convert/route.ts`
- `src/app/api/reservations/[id]/duplicate/route.ts`
- `src/lib/services/bookings-lifecycle.ts` conversion audit rows

Keep route-level `convert` and `duplicate` audit rows only if they add distinct action semantics not represented by `created`, `cancelled_by_checkout_conversion`, or the duplicate booking's `created` row. If kept, document that these are action breadcrumbs. If removed, update tests accordingly.

**Verify**: focused route tests for convert and duplicate pass.

### Step 5: Update docs

Update `docs/AREA_CHECKOUTS.md` and `docs/AREA_RESERVATIONS.md` to state that booking create/edit audit ownership lives in the service transaction, with route-level rows reserved for action breadcrumbs only.

**Verify**: `git diff --check` has no output.

## Test Plan

- Keep service tests proving `createBooking`, `updateReservation`, and `updateCheckout` write audit rows.
- Update route contract tests to stop requiring route-level duplicate audit rows.
- Add a lightweight source-contract test if useful: create routes import `createBooking` but not `createAuditEntry`.

## Done Criteria

- [ ] Create routes no longer write duplicate `create` audit rows.
- [ ] Booking PATCH route no longer writes a duplicate broad `updated` row.
- [ ] Service audit tests still pass.
- [ ] Route contract tests still prove auth, optimistic locking, dispatch, and response shape.
- [ ] Docs describe service-owned booking audit behavior.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run build:app` passes.
- [ ] `plans/README.md` row is marked `DONE`.

## STOP Conditions

- Stop if any UI or API response depends on the removed route-level audit row action names.
- Stop if audit history display intentionally expects both broad and granular edit rows.
- Stop if removing route audit rows would hide an action not represented anywhere else.

## Maintenance Notes

The main review risk is accidentally deleting the only audit row for a non-service action. Review every removed route-level audit row against the service transaction before approving.

