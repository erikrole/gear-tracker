# Schedule title normalization ownership pass

## Scope

- [x] Reuse the booking title rule for scheduled events.
- [x] Cover manual event creation and editing.
- [x] Cover synced event creation and updates while preserving raw source summaries.
- [x] Cover restore-to-calendar title behavior.
- [x] Run focused tests, TypeScript, and focused lint.
- [x] Sync Events docs.
- [x] Run repository docs, migration, whitespace, and build gates.
- [x] Archive the completed plan.

## Peer patterns checked

- Booking title normalization at shared booking, draft, and kiosk write boundaries.
- Manual CalendarEvent create/edit validation and audit paths.
- Calendar sync `splitEventsForSync` normalization, lock preservation, and raw-source evidence.

## Verification

- Focused Vitest: 203 tests passed.
- Focused ESLint: passed.
- TypeScript: passed.
- Migration prefix check: 93 migrations valid.
- Codemap/docs verification: passed.
- `git diff --check`: passed.
- `npm run build:app`: passed.

## Correction — 2026-07-17

- Title normalization remains active for manual event records (`sourceId = null`) at creation and title edit.
- Imported events preserve casing through ICS sync, staff title edits, and Restore calendar title after existing source-prefix cleanup.
- This protects external acronyms such as `USC`, `UCLA`, and `TCU` from title-case corruption.
- Correction verification: 206 focused tests, TypeScript, focused ESLint, migration-prefix check, docs/codemap verification, scoped whitespace check, and `npm run build:app` passed.
