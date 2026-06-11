# Plan 048: Gate Step 3 on availability recheck

> **Executor instructions**: Follow this plan step by step. Run every verification command and confirm the expected result before moving to the next step. If anything in the "STOP conditions" section occurs, stop and report. Do not improvise. When done, update the status row for this plan in `plans/README.md` unless a reviewer told you they maintain the index.
>
> **Drift check (run first)**: `git diff --stat 8d445512..HEAD -- src/components/booking-wizard/BookingWizard.tsx src/components/booking-wizard/WizardStep2.tsx src/components/booking-wizard/WizardStep3.tsx src/components/booking-wizard/flow-summary.ts tests/booking-create-ux.test.ts docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md`
> If any in-scope file changed since this plan was written, compare the "Current state" excerpts against the live code before proceeding. On a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S/M
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `8d445512`, 2026-06-11

## Why this matters

Step 2 owns an active availability recheck state, but the wizard can still advance to Step 3 and submit while that recheck is pending. That lets the confirmation screen show stale or missing warning counts immediately before creation. The server still rechecks availability, but the UX contract says Step 3 repeats selected warnings when they exist, so the wizard should not review or submit from a known in-flight warning state.

## Current state

- `BookingWizard.tsx` allows Step 2 to advance after item validation. It does not check `pickerSelectionState.checkingAvailability`:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:337-345
} else if (step === 2) {
  if (itemCount === 0 && pickerSelectionState.unresolvedAssetCount > 0) {
    setCreateError("Remove unavailable selected items or pick replacement equipment before review");
    return;
  }
  const error = validateStep2();
  if (error) { setCreateError(error); return; }
  setCreateError("");
  setStep(3);
}
```

- The Step 2 footer disabled state only blocks empty equipment selection, not an active availability recheck:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:355-358
const step2NeedsEquipment =
  step === 2 &&
  itemCount === 0 &&
  pickerSelectionState.unresolvedAssetCount === 0;
```

- The Step 3 submit button is disabled only by `submitting`:

```tsx
// src/components/booking-wizard/BookingWizard.tsx:702-710
{step === 3 && (
  <Button
    onClick={handleSubmit}
    disabled={submitting}
    loading={submitting}
    variant="brand"
    size="lg"
  >
    {submitting ? config.actionLabelProgress : config.actionLabel}
```

- `src/components/booking-wizard/flow-summary.ts` currently uses warning counts for labels, but has no helper for availability-check gating:

```ts
// src/components/booking-wizard/flow-summary.ts:26-39
export function getStep2PrimaryActionLabel(input: Step2PrimaryLabelInput) {
  if (input.itemCount > 0) {
    const itemLabel = `${input.itemCount} item${input.itemCount !== 1 ? "s" : ""}`;
    if (getAvailabilityWarningTotal(input) > 0) return `Review with warnings (${itemLabel})`;
    return `Review (${itemLabel})`;
  }

  if (input.unresolvedAssetCount > 0) {
    return input.unresolvedAssetCount === 1
      ? "Remove unavailable item"
      : "Remove unavailable items";
  }

  return "Select equipment";
}
```

- `docs/AREA_CHECKOUTS.md` lines 37-47 and `docs/AREA_RESERVATIONS.md` lines 28-30 both state that Step 2 shows active availability rechecks and Step 3 repeats selected availability warnings.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Focused tests | `npx vitest run tests/booking-create-ux.test.ts` | exit 0, all tests pass |
| Typecheck | `npx tsc --noEmit` | exit 0, no TypeScript errors |
| Whitespace | `git diff --check` | exit 0, no whitespace errors |

## Scope

**In scope**:
- `src/components/booking-wizard/BookingWizard.tsx`
- `src/components/booking-wizard/WizardStep2.tsx`
- `src/components/booking-wizard/WizardStep3.tsx`
- `src/components/booking-wizard/flow-summary.ts`
- `tests/booking-create-ux.test.ts`
- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

**Out of scope**:
- Do not change the availability API.
- Do not remove submit-time server rechecks.
- Do not introduce polling or retries.
- Do not block submission after a failed recheck has completed. This plan only gates the known pending state.

## Git workflow

- Branch: `advisor/048-step3-availability-gate`
- Commit style: conventional commit, for example `fix: wait for booking availability recheck before review`
- Do not push or open a PR unless the operator instructs it.

## Steps

### Step 1: Make the Step 2 action label reflect active checking

Extend the Step 2 label helper in `flow-summary.ts` to accept `checkingAvailability` or add a sibling helper. When `itemCount > 0` and `checkingAvailability` is true, return a label such as `Checking availability...`.

Keep existing unresolved and empty-selection labels intact.

**Verify**: `npx vitest run tests/booking-create-ux.test.ts` exits 0 after adding or adjusting helper tests.

### Step 2: Block Step 2 advance while checking

In `BookingWizard.tsx`, before Step 2 calls `validateStep2`, check `pickerSelectionState.checkingAvailability`.

Behavior:
- If the user clicks Next while checking, set `createError` to a concise message such as `Wait for availability to finish checking before review`.
- Disable the primary Step 2 button while `checkingAvailability` is true and `itemCount > 0`, or leave it clickable only if you need the inline error. Prefer disabling if the current button state already communicates the pending label.
- Preserve the existing disabled state for empty selections.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 3: Guard Step 3 submit as a belt-and-suspenders path

In `BookingWizard.tsx`, guard `handleSubmit` against `pickerSelectionState.checkingAvailability` in case the state flips while the user is already on Step 3:

- Before setting `submittingRef.current = true`, check the flag.
- If true, set a concise inline error and return.
- Disable the Step 3 submit button and change its label to `Checking availability...` while the flag is true.

Do not remove the server recheck. This client gate prevents stale review, while the server remains authoritative.

**Verify**: `npx tsc --noEmit` exits 0.

### Step 4: Add focused tests

Add tests in `tests/booking-create-ux.test.ts` for whichever helper owns the label or disabled-state decision.

Cover:
- item count present plus checking returns the checking label.
- warning counts still return `Review with warnings (...)` after checking is false.
- empty selection still returns `Select equipment`.

If no helper is used for disabled state, do not add a fragile component-render test unless an existing booking wizard test pattern already renders the wizard.

**Verify**: `npx vitest run tests/booking-create-ux.test.ts` exits 0.

### Step 5: Sync docs

Update the relevant change-log sections in:

- `docs/AREA_CHECKOUTS.md`
- `docs/AREA_RESERVATIONS.md`

Record that Step 2 and Step 3 now wait for active availability rechecks before review or create submission.

**Verify**: `rg -n "availability recheck|checking availability|Step 3|change log|Changelog" docs/AREA_CHECKOUTS.md docs/AREA_RESERVATIONS.md` shows the new documentation entry.

## Test plan

- Add or update helper tests in `tests/booking-create-ux.test.ts`.
- Run `npx vitest run tests/booking-create-ux.test.ts`.
- Run `npx tsc --noEmit`.
- Run `git diff --check`.

## Done criteria

- [ ] Step 2 does not advance to review while availability is actively checking.
- [ ] Step 2 communicates active checking through the primary action label or disabled state.
- [ ] Step 3 submit cannot start while availability is actively checking.
- [ ] Submit-time server recheck behavior is unchanged.
- [ ] `npx vitest run tests/booking-create-ux.test.ts` exits 0.
- [ ] `npx tsc --noEmit` exits 0.
- [ ] `git diff --check` exits 0.
- [ ] Relevant checkout and reservation docs are updated.
- [ ] `plans/README.md` status row for plan 048 is updated.

## STOP conditions

Stop and report back if:

- `checkingAvailability` no longer exists on `EquipmentPickerSelectionState`.
- Availability checks can remain stuck forever in normal network-failure paths. In that case the product needs a different recovery design before this gate ships.
- The implementation requires changing the server API or picker availability fetching.
- The code at the cited navigation or submit excerpts has materially changed.

## Maintenance notes

This is intentionally a client UX gate, not a correctness boundary. Server create routes must continue to validate availability. Reviewers should confirm that the gate clears when the existing availability check completes or fails, so staff are not trapped by a stale pending state.
