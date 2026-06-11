# Plan 041: Add booking Step 1 field-level validation

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving on. If anything in the STOP conditions occurs, stop and report instead of improvising. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard/BookingWizard.tsx src/components/booking-wizard/WizardStep1.tsx tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the current code against the excerpts below before proceeding.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: UX/UI bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 1 validates title, requester, location, and date range, but errors appear only as a page-level banner above the step. The invalid control itself is not marked with `aria-invalid`, no field-level message appears beside the field, and focus does not move to the field the user needs to fix.

For a creation wizard, this makes a routine mistake feel like a page-level failure.

## Current state

Step 1 validation returns one string:

```ts
// src/components/booking-wizard/BookingWizard.tsx:312-320
function validateStep1(): string | null {
  if (!form.title.trim()) return "Give this booking a name";
  if (!form.requester) return "Select who this is for";
  if (!form.locationId) return "Choose a pickup location";
  const s = new Date(form.startsAt);
  const e = new Date(form.endsAt);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "Invalid date. Check start and end times";
  if (e <= s) return "End date must be after start date";
  return null;
}
```

The error banner is global:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:600-604
{createError && (
  <Alert variant="destructive" className="mb-5">
    <AlertCircleIcon />
    <AlertDescription>{createError}</AlertDescription>
  </Alert>
)}
```

Step 1 fields render labels and controls but no field error slots:

```tsx
// src/components/booking-wizard/WizardStep1.tsx:396-404
<Field label="Booking name" required htmlFor="booking-title">
  <Input
    id="booking-title"
    name="booking-title"
    value={form.title}
    onChange={(e) => dispatch({ type: "SET_TITLE", value: e.target.value })}
    placeholder={form.tieToEvent ? "Select an event..." : "Game day equipment"}
    required
  />
</Field>
```

The repo already has shadcn form primitives with `aria-invalid` support in `src/components/ui/form.tsx`, but this wizard uses reducer state rather than React Hook Form.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0 |
| Typecheck | `npx tsc --noEmit` | exit 0, no errors |
| Diff hygiene | `git diff --check` | exit 0 |

## Scope

In scope:
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep1.tsx`
- `tests/booking-create-ux.test.ts` or a new focused source-contract test
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Out of scope:
- Rewriting the wizard to React Hook Form
- Server validation changes
- Step 2 and Step 3 validation UI
- Changing date picker internals unless strictly needed for `aria-invalid`

## Steps

### Step 1: Return structured Step 1 validation

Replace the `string | null` Step 1 validator with a structured result, for example:

```ts
type Step1Field = "title" | "requester" | "locationId" | "startsAt" | "endsAt";
type Step1Errors = Partial<Record<Step1Field, string>>;
```

Store the errors in state separately from `createError`, such as `step1Errors`.

Expected behavior:
- Missing title marks title.
- Missing requester marks requester.
- Missing location marks location.
- Invalid date values mark both start and end or the specific bad field if the code can know it.
- End before start marks end with "End date must be after start date."

Verify: `npx tsc --noEmit` exits 0.

### Step 2: Render field-level messages and invalid states

Extend the local `Field` helper in `WizardStep1.tsx` to accept an optional `error` and render a compact destructive message below the control. Pass `aria-invalid` and `aria-describedby` to native inputs where straightforward.

For shadcn/Radix Select and DateTimePicker controls, use the repo's current component APIs. If they do not accept `aria-invalid` cleanly, add visual error text and a destructive border wrapper instead of editing the shared primitives.

Keep the page-level banner for submit or server errors. Step 1 validation errors should be field-local first.

Verify: source-contract test confirms `WizardStep1` accepts or renders field error props.

### Step 3: Focus the first invalid field

On `handleNext` from Step 1:
- Set structured errors.
- Move focus to the first invalid field when possible.
- Keep the global banner silent for routine Step 1 field validation, or make it a short summary that does not replace field messages.

Use stable ids already present in the controls:
- `booking-title`
- `booking-requester-trigger`
- `booking-location-trigger`
- `booking-starts-at`
- `booking-ends-at`

Do not use brittle text matching to find elements.

Verify: add a source-contract test checking those ids remain present and the wizard has a first-invalid focus path.

### Step 4: Update docs

Add checkout and reservation changelog rows stating that Step 1 validation now marks the exact fields needing attention.

## Done criteria

- [ ] Step 1 validation errors appear next to the affected fields.
- [ ] The first invalid field receives focus or an explicitly documented focus fallback.
- [ ] Required fields and invalid date windows still block navigation to Step 2.
- [ ] Server and submission errors still render in the existing alert path.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `git diff --check` passes.

## STOP conditions

- Stop if `DateTimePicker` cannot expose invalid state without shared primitive changes larger than this plan.
- Stop if the implementation starts rewriting wizard state management or adopting React Hook Form across the full wizard.

## Maintenance notes

Step 2 has its own warning and conflict model. Do not generalize this field-error structure into Step 2 unless a later plan audits that flow directly.
