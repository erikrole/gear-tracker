# Shift Slot Role Integrity Plan

## Scope

Fix direct shift assignment so Staff users occupy Staff slots and Student users occupy Student slots. If the selected slot does not match the selected user role, assignment should create or reuse a matching same-area slot instead of filling the wrong planned slot.

## Checklist

- [x] Audit schedule docs, schema, assignment service, and schedule row UI.
- [x] Update direct assignment service to resolve the correct role-matched slot.
- [x] Remove mismatch exception labels from schedule list and shift detail slot cards.
- [x] Make the expanded Schedule row remove-assignment control persistently visible.
- [x] Align expanded Schedule row columns for area, add action, assignee, role, time, and row actions.
- [x] Update focused regression tests for the new slot-matching contract.
- [x] Verify with focused tests, typecheck, and browser refresh on `/schedule`.

## Review

- Implemented direct-assignment slot resolution in `src/lib/services/shift-assignments.ts`.
- Removed explicit cross-role exception copy from Schedule list rows and Shift Detail slot cards.
- Expanded Schedule assigned rows now expose the remove-assignment icon without requiring hover.
- Expanded Schedule assignment rows now use fixed desktop columns so assigned and open slot rows keep consistent alignment.
- Verified with `npx vitest run tests/shift-assignments.test.ts tests/shift-display.test.ts`, `npx tsc --noEmit`, `git diff --check`, and browser refresh of `/schedule`.
- Existing database cleanup is still pending explicit approval: read-only inspection found 27 active Staff/Admin assignments currently sitting in Student slots. Normalizing them would move those assignments to Staff slots, creating Staff slots as needed and leaving the original Student slots open.
