# Shift Staffing MVP Plan - 2026-05-21

## Goal
- Make Staff and Student planned shift requirements, spell those labels out everywhere, and support default, shift-level, and per-person call times.

## Source Checks
- `docs/AREA_SHIFTS.md`: shifts already expose `ShiftWorkerType` as an internal Staff/Student concept and schedule surfaces are area-first.
- `docs/AREA_SETTINGS.md`: Sports settings owns shift coverage and call-time configuration.
- `docs/AREA_NOTIFICATIONS.md`: shift trade and gear-up notification patterns already exist and should be reused.
- `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`: availability is warning-only and recurring blocks remain the existing conflict source.
- `prisma/schema.prisma`: `SportShiftConfig`, `Shift`, and `ShiftAssignment` own the affected data.

## Slices
- [x] Slice 1: Schema and migration for planned Staff/Student counts plus call-time overrides.
- [x] Slice 2: Service/API updates for generation, assignment preservation, call-time display data, and notifications.
- [x] Slice 3: Settings, Schedule, Assign, Shift Detail, Dashboard, My Shifts, and email copy use spelled-out labels only.
- [x] Slice 4: Focused tests, doc sync, and verification.

## Verification
- [x] `npx prisma validate`
- [x] `npm run db:migrate:check`
- [x] `npx vitest run tests/shift-display.test.ts tests/sport-configs.test.ts tests/shift-generation.test.ts tests/shift-assignments.test.ts`
- [x] `npx vitest run tests/sport-configs.test.ts tests/shift-assignments.test.ts tests/schedule-date-validation.test.ts`
- [x] `npx tsc --noEmit`
- [x] `git diff --check`
- [ ] `npm run build`
- [x] `npx next build`

## Review
- Shipped: schema fields for Staff/Student planned counts, shift call overrides, personal call overrides, shared Staff/Student display helpers, generation/assignment preservation, settings UI, schedule/event UI copy, dashboard/my-shifts payloads, and shift schedule notifications.
- Verified: Prisma schema validation, migration prefix check, focused role/config/generation/assignment tests, requested sport-config/assignment/date-validation tests, TypeScript, diff whitespace check, and local Next production build all pass.
- Deferred: `npm run build` could not be completed because the script runs the Prisma deploy wrapper first and the escalation reviewer blocked remote Neon migration mutation without explicit approval. `npx next build` passed as the safer local build equivalent.
