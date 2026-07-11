# Schedule Role-Slot Hardening Plan

Date: 2026-06-20

## Goal

Make staff/student semantics true across Schedule detection, repair, assignment feedback, exports, Open Work, and copy. Filled assignments should be described by assigned `User.role`; open slots and template planning should be described by planned `Shift.workerType`.

## Source Checks

- `Shift.workerType` stores planned slot kind; `ShiftAssignment.user.role` stores assigned person truth.
- Direct assignment already reroutes mismatched user roles to an open or newly created matching same-area slot.
- Schedule health already owns the data-quality queue, so role-slot mismatch diagnostics can extend that surface.
- Student Open Work already queries `workerType: "ST"` and claim rejects non-student or non-ST slot pickup.
- Schedule exports still have role columns that can conflate planned slot type with assigned person role.

## Slices

- [x] Slice 1: Add role-slot mismatch detection to shared Schedule data quality and health.
- [x] Slice 2: Add explicit staff/admin repair route for historical role-slot mismatches.
- [x] Slice 3: Return assignment reroute metadata and surface honest assignment toast copy.
- [x] Slice 4: Split export columns into assigned role and planned slot context.
- [x] Slice 5: Add picker/copy-forward/Open Work hardening coverage and docs.

## Verification

- [x] Focused Vitest for data quality, repair service/route, exports, and Open Work.
- [x] Source-contract tests for UI copy and picker/outcome surfaces.
- [x] `npx tsc --noEmit`
- [x] `git diff --check`
- [x] `npm run build:app`

## Review

- Shipped: role-slot mismatch detection, audited repair route, assignment outcome metadata/toasts, picker warnings, export split columns, auto-fill preview role/slot copy, and Open Work Staff-slot pickup guard.
- Verified: `npx vitest run tests/schedule-data-quality.test.ts tests/shift-assignments.test.ts tests/schedule-exports.test.ts tests/schedule-open-work.test.ts tests/shift-display.test.ts tests/schedule-role-display-source.test.ts`; `npx tsc --noEmit`; focused `git diff --check`; `npm run build:app`.
- Deferred: no schema migration and no bulk repair UI; repair is an explicit staff/admin API path surfaced through data-quality diagnostics.

## Stop Conditions

- Stop if repair requires a schema migration. Current model should be sufficient.
- Stop if route contracts would require breaking existing Schedule assignment clients.
