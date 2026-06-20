# Schedule Title Cleanup Plan

Last updated: 2026-06-19

## Scope

Clean imported Schedule event titles so UW source prefixes do not appear in the primary row title, while keeping existing subline behavior for event labels such as Exhibition and neutral-site venue/location context.

## Checklist

- [x] Confirm schedule/event docs, schema, and title formatter contract.
- [x] Update the shared Schedule title cleaner for UW Athletics prefixes.
- [x] Align future calendar sync title normalization with the display cleaner.
- [x] Add focused tests for the screenshot title patterns.
- [x] Sync area docs and task queue.
- [x] Verify with focused tests, typecheck, whitespace, docs, and app build.

## Peer Patterns Checked

- `/schedule` list/week/calendar views all use `scheduleEventTitleParts`.
- `/schedule/assign` uses `scheduleEventTitleParts` for event row identity.
- `TradeBoard` uses `scheduleEventTitleParts` for open-work and trade event labels.
- Dashboard has a separate `dashboardEventTitle` helper and already preserves manual titles when sport metadata lacks an opponent.

## Review

- 2026-06-19: Shared Schedule title formatting now strips `Wisconsin Athletics` and `Wisconsin Badgers` prefixes from fallback summaries, keeps structured sport/opponent titles clean, and uses mapped location as the secondary line for neutral structured games when no dash qualifier exists.
- 2026-06-19: Future calendar sync applies the same source-prefix cleanup before sport/opponent extraction, so imported titles like `Wisconsin Athletics Women's Soccer vs North Dakota State` normalize before reaching Schedule.
- 2026-06-19: Verification passed with `npx vitest run tests/schedule-event-title-parts.test.ts tests/calendar-sync.test.ts`, `./node_modules/.bin/tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npm run verify:docs`, and `npm run build:app`.
