# Plan 040: Make booking Step 1 event selection explicit

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard/WizardStep1.tsx src/components/create-booking/use-event-context.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **Priority**: P1
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 1 supports linking up to three events, but the event list still reads like a button list with a trailing check icon only after selection. The multi-event brief explicitly calls for a left-side checkbox per event row. The current at-cap state disables every unselected event row, so the cap explanation inside `toggleEvent` is unreachable for mouse and keyboard users.

This should feel like deliberate selection, not a mystery tap target.

## Current state

- `src/components/booking-wizard/WizardStep1.tsx` renders selected chips and a scrollable event list.
- `src/components/create-booking/use-event-context.ts` owns the three-event cap and currently returns `{ ok: false, reason: "cap" }` while also firing a toast.
- `src/components/ui/checkbox.tsx` already exists and should be used for checkbox UI.

Current event-list cap and disabled behavior:

```tsx
// src/components/booking-wizard/WizardStep1.tsx:270-280
{events.map((ev) => {
  const selected = selectedEventIds.has(ev.id);
  const disabled = !selected && atCap;
  return (
    <Button
      key={ev.id}
      type="button"
      variant="ghost"
      onClick={() => toggleEvent(ev)}
      disabled={disabled}
      aria-pressed={selected}
```

Current cap feedback is unreachable when the row is disabled:

```ts
// src/components/create-booking/use-event-context.ts:121-124
if (selectedEvents.length >= MAX_SELECTED_EVENTS) {
  toast.error(`You can link at most ${MAX_SELECTED_EVENTS} events to a booking`);
  return { ok: false, reason: "cap" };
}
```

Product contract:

```md
docs/BRIEF_MULTI_EVENT_BOOKING_V1.md:50-54
- Replace single-select button list with a multi-select list: each event row gets a left-side checkbox; clicking row or checkbox toggles selection
- Selected events shown above list as small chips (summary + x to remove), ordered chronologically
- Auto-fill: title from first selected event (user-editable), location from first event, sport from first event, startsAt/endsAt = min/max of selection
```

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/components/booking-wizard/WizardStep1.tsx`
- `src/components/create-booking/use-event-context.ts` only if a small cap-feedback helper change is needed
- `tests/booking-create-ux.test.ts` or a new focused source-contract test
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Multi-event schema, API, or draft payload changes
- Range selection
- Booking detail display
- Step 2 equipment picker changes

## Steps

### Step 1: Add visible checkbox affordances to event rows

In `WizardStep1.tsx`, import `Checkbox` from `@/components/ui/checkbox`. Render a left-side checkbox in every event row before the event text.

Target behavior:
- Row click toggles the event.
- Checkbox click toggles the same event and does not double-toggle through row bubbling.
- Selected row keeps its current selected background.
- Checkbox state mirrors `selected`.
- Use `aria-label` or visible row text so screen readers can tell what event is being selected.

Keep the row height stable. Do not turn the event rows into large cards.

Verify: `npx vitest run tests/booking-create-ux.test.ts` exits 0.

### Step 2: Make the three-event cap explain itself

Do not render unselected rows as disabled buttons that cannot call `toggleEvent`. Use one of these approaches:

- Preferred: keep rows focusable and clickable, set `aria-disabled={atCap && !selected}`, style with lower opacity, and let `toggleEvent` return the cap reason so the existing toast appears.
- Acceptable: keep rows disabled but add an inline compact warning above the list when `atCap` is true, such as "Remove an event before linking another."

The preferred approach is better because it preserves keyboard feedback. If using `aria-disabled`, ensure the handler does not add the fourth event.

Verify: add a source-contract test that fails if `disabled={disabled}` remains on event rows while cap feedback is only in `toggleEvent`.

### Step 3: Update docs and tests

Add a changelog row to both checkout and reservation area docs noting that Step 1 event rows now use explicit checkbox selection and visible cap feedback.

Extend `tests/booking-create-ux.test.ts` or create a small source-contract test that checks:
- `WizardStep1.tsx` imports and renders `Checkbox`.
- Event rows do not hide cap feedback behind disabled buttons.
- Selected chips remain present.

## Done criteria

- [ ] Event rows have a visible checkbox affordance.
- [ ] Clicking or keyboard-activating an at-cap unselected event produces visible feedback or a visible inline explanation.
- [ ] Existing selected-event chips still remove events.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.
- [ ] `docs/AREA_CHECKOUTS.md` and `docs/AREA_RESERVATIONS.md` changelogs are updated.

## STOP conditions

- Stop if `Checkbox` cannot be used without nested interactive elements inside the row button. In that case, switch the row to a non-button container with a sibling checkbox and test keyboard behavior before continuing.
- Stop if making rows focusable at cap would allow a fourth event to be added.

## Maintenance notes

If future work adds range selection, keep the checkbox row grammar. The row should still communicate individual selection first, with range selection as an accelerator.
