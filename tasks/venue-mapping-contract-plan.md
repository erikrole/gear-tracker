# Venue Mapping Contract Cleanup Plan

Date: 2026-06-22

Backlog source: `DESLOPPIFY.md` C1.

## Goal

Bring the venue mapping implementation back in line with D-027:

- Venue mapping reads and writes are ADMIN-only.
- Mapping patterns are valid regular expressions before they are stored.
- Equal-priority mappings match by longest pattern first.
- Invalid legacy patterns do not silently fall back to substring matching.

## Slice

- [x] Audit D-027, Settings docs, gaps, schema, API routes, sync code, and current tests.
- [x] Add one shared venue-mapping contract helper for pattern validation, matching, and ordering.
- [x] Enforce ADMIN-only reads in `GET /api/location-mappings`.
- [x] Reject invalid mapping regexes in `POST /api/location-mappings`.
- [x] Apply deterministic priority plus longest-pattern ordering in list and calendar sync paths.
- [x] Remove invalid-regex substring fallback from audit and sync behavior.
- [x] Add focused route and sync regression tests.
- [x] Sync Settings, Events, gaps, and the desloppify backlog docs.
- [x] Run focused tests plus project verification gates.

## Verification Target

- `npx vitest run tests/location-mappings-route.test.ts tests/calendar-sync.test.ts tests/venue-mapping-audit-route.test.ts`
- `npx tsc --noEmit`
- `npm run verify:docs`
- `npm run db:migrate:check`
- `git diff --check`
- `npm run build:app`

## Review

- 2026-06-22: D-027 venue mapping contract cleanup shipped locally. Added shared venue mapping helpers for regex validation, matching, and priority plus longest-pattern ordering. `GET /api/location-mappings` now requires ADMIN, `POST /api/location-mappings` rejects invalid regex patterns, calendar sync uses deterministic matching, and audit/sync matching no longer silently falls back to substring matching on invalid regexes. Verification passed with focused route/sync/audit Vitest, TypeScript, codemap/docs check, migration prefix check, diff whitespace check, and `npm run build:app`.
