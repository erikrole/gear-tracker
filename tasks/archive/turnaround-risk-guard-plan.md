# Turnaround Risk Guard Plan

## Goal
Surface advisory risk when a booking is technically available but operationally tight to turn around before the next commitment.

## Scope
- [x] Add availability response metadata for serialized turnaround risks.
- [x] Add availability response metadata for bulk turnaround risks.
- [x] Render compact advisory context in the shared EquipmentPicker.
- [x] Render compact advisory context in booking detail Equipment rows.
- [x] Sync checkout/reservation/gaps docs and task notes.
- [x] Verify with focused tests, TypeScript, full Vitest, migration check, whitespace, and Next build.

## Guardrails
- Do not change hard conflict semantics.
- Keep `endsAt === next.startsAt` allowed unless actual overlap exists.
- Keep warnings advisory and row-scoped.
- Avoid schema changes in this slice.
