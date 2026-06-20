# Schedule Staff/Student Display Cleanup Plan

Date: 2026-06-20

## Problem

Schedule UI can describe a filled row using the planned slot type instead of the assigned worker's actual role. That makes historical or edge-case data read as if staff are in "Student" rows, or students are in "Staff" rows. The UI also summarizes open coverage with role-specific "Needs n students" copy, which overstates what the count actually knows.

## Contract

- Filled rows and cards describe the assigned user role: `Staff` for `ADMIN`/`STAFF`, `Student` for `STUDENT`.
- Open rows can describe planned slot type: `Staff slot` or `Student slot`.
- Coverage/readiness summaries count open crew needs generically unless the view is explicitly about editing planned slot templates.
- Assignment controls stay generic when any active user can be assigned and the backend may reroute to or create a matching role slot.

## Slice

- [x] Add shared display helper coverage for user-role labels.
- [x] Patch Schedule list rows, assignment cells, readiness cards, and shift slot cards.
- [x] Add tests for assigned-role display and neutral open-need copy.
- [x] Update `docs/AREA_SHIFTS.md` and verification notes.

## Verification

- Focused Vitest coverage for display helpers and Schedule source-copy contracts.
- TypeScript check.
- Focused diff whitespace check.

## Result

- Filled rows/cards now derive person-facing Staff/Student labels from `User.role`.
- Open planned slots still use Staff slot/Student slot language where staff are editing coverage.
- Readiness and coverage filters now say crew/people for open coverage counts.
- Verification passed: `npx vitest run tests/shift-display.test.ts tests/schedule-role-display-source.test.ts`, `npx tsc --noEmit`, focused `git diff --check`, and `npm run build:app`.
