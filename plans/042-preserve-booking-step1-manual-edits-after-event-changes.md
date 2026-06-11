# Plan 042: Preserve booking Step 1 manual edits after event changes

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard/BookingWizard.tsx src/components/create-booking/types.ts src/components/create-booking/use-event-context.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 1 auto-fills title, dates, and location from selected events. The docs say the title is user-editable and manual date edits are part of the workflow. Today, selecting or removing another event later re-runs auto-fill and can overwrite a user's manual title, date window, or location without warning.

Auto-fill should help the first time, then respect explicit operator edits.

## Current state

The reducer applies auto-filled fields every time `SET_SELECTED_EVENTS` carries them:

```ts
// src/components/booking-wizard/BookingWizard.tsx:103-111
case "SET_SELECTED_EVENTS":
  return {
    ...state,
    selectedEvents: action.events,
    title: action.title ?? state.title,
    startsAt: action.startsAt ?? state.startsAt,
    endsAt: action.endsAt ?? state.endsAt,
    locationId: action.locationId ?? state.locationId,
  };
```

Every event toggle derives and dispatches those fields:

```ts
// src/components/create-booking/use-event-context.ts:129-133
dispatch({
  type: "SET_SELECTED_EVENTS",
  events: next,
  ...deriveFromPrimary(next, sport),
});
```

Manual edits use the same reducer without dirty-field tracking:

```ts
// src/components/booking-wizard/BookingWizard.tsx:112-120
case "SET_TITLE":
  return { ...state, title: action.value };
case "SET_REQUESTER":
  return { ...state, requester: action.value };
case "SET_LOCATION_ID":
  return { ...state, locationId: action.value };
case "SET_STARTS_AT":
  return applyDurationPreservingStartChange(state, action.value);
case "SET_ENDS_AT":
  return { ...state, endsAt: action.value };
```

Product contract:

```md
docs/BRIEF_MULTI_EVENT_BOOKING_V1.md:52-54
- Selected events shown above list as small chips (summary + x to remove), ordered chronologically
- Auto-fill: title from first selected event (user-editable), location from first event, sport from first event, startsAt/endsAt = min/max of selection
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts tests/booking-all-day-event-defaults.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/components/create-booking/types.ts`
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/create-booking/use-event-context.ts`
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Changing the auto-fill formulas in `deriveFromPrimary`
- Changing API payload shape
- Draft schema or server changes unless existing draft loading needs a local default for new client-only metadata
- Step 2 equipment availability behavior

## Steps

### Step 1: Add client-only dirty metadata

Track which auto-fillable fields the user has manually edited:

- `title`
- `startsAt`
- `endsAt`
- `locationId`

Use a client-only structure inside the wizard state or next to it. Do not send dirty metadata to the API or draft payload.

Expected reducer behavior:
- `SET_TITLE` marks `title` dirty.
- `SET_STARTS_AT` marks `startsAt` and likely `endsAt` dirty because duration-preserving start edits intentionally change the window.
- `SET_ENDS_AT` marks `endsAt` dirty.
- `SET_LOCATION_ID` marks `locationId` dirty.
- `RESET` and `LOAD_DRAFT` clear dirty metadata unless there is a product reason to preserve it.

Verify: `npx tsc --noEmit` exits 0.

### Step 2: Apply event auto-fill only to clean fields

When `SET_SELECTED_EVENTS` receives derived fields:
- If no events are selected, keep current manual values.
- If events are selected, update only fields that are not dirty.
- First event selection on a blank form should still fill title, startsAt, endsAt, and locationId.
- Adding a second or third event should still extend the end date only if the user has not manually edited the date window.

Do not silently clear dirty flags when an event is removed. The user can still edit fields manually.

Verify: add pure reducer tests if the reducer is extracted, or source-contract tests if keeping the reducer local.

### Step 3: Consider a tiny reset affordance only if needed

If preserving manual edits creates no way to re-apply event defaults, add a small "Use event defaults" action near the event chips or date fields. Keep this optional and only add it if implementation review shows a real dead end.

Do not add broad helper copy explaining auto-fill mechanics.

### Step 4: Update docs

Add checkout and reservation changelog rows stating that Step 1 event auto-fill now respects manual title, location, and date edits after initial fill.

## Test plan

Add focused tests covering:
- First selected event auto-fills title, window, and location.
- After manual title edit, adding another event does not overwrite the title.
- After manual end-date edit, adding another event does not overwrite the end date.
- After manual location edit, changing event selection does not overwrite location.
- `deriveFromPrimary` all-day behavior still passes existing tests.

Use `tests/booking-create-ux.test.ts` for UX helper coverage. If the reducer remains inside `BookingWizard.tsx`, extract the reducer into a small testable helper rather than testing it by brittle source strings.

## Done criteria

- [ ] Manual title edits survive later event selection changes.
- [ ] Manual date-window edits survive later event selection changes.
- [ ] Manual location edits survive later event selection changes.
- [ ] First event selection still auto-fills blank fields.
- [ ] No client-only dirty metadata is sent in create or draft payloads.
- [ ] `npx vitest run tests/booking-create-ux.test.ts tests/booking-all-day-event-defaults.test.ts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.

## STOP conditions

- Stop if preserving dirty state requires changing server draft payload shape.
- Stop if extracting the reducer creates broad import churn outside the booking wizard and create-booking modules.

## Maintenance notes

This plan intentionally preserves the current auto-fill defaults. It changes when auto-fill is allowed to overwrite fields, not the event-window math itself.
