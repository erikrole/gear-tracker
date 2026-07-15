# Booking title normalization ownership pass

## Scope

- [x] Preserve canonical UW sport codes in uppercase.
- [x] Normalize ordinary booking-title words to title case across creation and edit paths.
- [x] Keep common title connectors such as `at` and `vs` lowercase.
- [x] Cover reservations, drafts, shared booking edits, kiosk checkout creation, and kiosk checkout edits.
- [x] Run focused tests, TypeScript, and focused lint.
- [x] Sync checkout and reservation area docs.
- [x] Run repository docs, migration, whitespace, and build gates.
- [x] Archive the completed plan.

## Peer patterns checked

- Sport-code normalization and validation in `src/lib/sports.ts` and `src/lib/validation.ts`.
- Shared text sanitization at authenticated booking API boundaries.
- Canonical booking writes in `src/lib/services/bookings-lifecycle.ts` plus direct kiosk and draft write paths.

## Verification

- Focused Vitest: 75 tests passed.
- Focused ESLint: passed.
- TypeScript: passed.
- Migration prefix check: 93 migrations valid.
- Codemap/docs verification: passed.
- `git diff --check`: passed.
- `npm run build:app`: passed.
