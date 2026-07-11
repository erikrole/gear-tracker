# Schedule Data Quality Queue Plan

Date: 2026-06-19

## Scope

- Add a read-only Schedule queue for event data issues that affect titles, venue handling, and shift confidence.
- Reuse the existing Schedule health and queue plumbing.
- Keep event correction workflows on existing Event detail, Settings > Locations, and Settings > Venue Mappings surfaces.

## Initial Checks

- `ScheduleHealthSnapshot.queues` already drives readiness cards and queue filtering.
- `src/lib/schedule-queues.ts` owns URL-backed queue names and queue filtering.
- Settings > Venue Mappings now owns mapping diagnostics; this slice should not duplicate that full admin table inside Schedule.

## Checklist

- [x] Add a pure event data-quality classifier.
- [x] Add `dataQuality` to Schedule health.
- [x] Add `data-quality` queue parsing, metadata, filtering, and source-contract coverage.
- [x] Add a Schedule readiness card for data quality.
- [x] Update docs and task ledger.
- [x] Run focused tests, typecheck, docs verification, build, diff check, and browser smoke.

## Review

- 2026-06-19: Schedule health now includes a read-only Data quality queue for visible events with missing sport context, missing opponents, missing venue/location mapping, future archived status, or shifts without sport metadata. `/schedule?queue=data-quality` filters the list to affected events.
- 2026-06-19: Verification passed with focused Schedule queue/health tests, `tsc --noEmit`, migration-prefix check, docs verification, `build:app`, `git diff --check`, and authenticated browser smoke on `/schedule` plus `/schedule?queue=data-quality`.
