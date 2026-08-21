# Dashboard Upcoming Event Rails and Titles Plan - 2026-08-20

## Goal

- Make every Dashboard activity/event row preserve its semantic left rail, and keep Upcoming Events titles to the primary matchup name without imported dash qualifiers such as `Camper Reunion/Youth Sports Day`.

## Route

- Owner area: Dashboard
- Secondary areas: Events and Mobile design contract
- Ledger: `tasks/dashboard-upcoming-event-rail-title-plan.md`
- Existing references: `docs/AREA_DASHBOARD.md`, `docs/AREA_EVENTS.md`, `docs/AREA_MOBILE.md`, `docs/DECISIONS.md` D-010/D-031, `tasks/dashboard-ownership-pass.md`

## Source Checks

- `src/app/(app)/dashboard/booking-row.tsx` gives each booking row a semantic `border-l-[3px]` plus an accent color, but its adjacent-sibling `border-border/40` rule resets the entire border color on every row after the first.
- `src/app/(app)/dashboard/team-activity-column.tsx` repeats the same separator pattern for Upcoming Events, so later home/away/neutral rails are also reset.
- `src/app/(app)/schedule/_components/types.ts` already exposes `scheduleEventTitleParts`, which turns `opponent: "Marquette - Camper Reunion/Youth Sports Day"` into primary title `Marquette` and qualifier detail. Dashboard should reuse the primary-title rule and intentionally omit the detail line.
- The Dashboard API already exposes the source summary and structured sport/opponent fields; no schema, API, event-sync, booking, permission, or lifecycle change is needed.

## Stop Conditions

- Stop if the requested title change requires rewriting stored event summaries, imported opponent data, or event subtitles.
- Stop if the rail fix changes venue/status semantics, booking actions, filters, or row destinations.
- Stop if the shared Schedule title helper cannot accept the Dashboard event shape without broadening its input contract safely.

## Slices

- [x] Slice 1: Preserve left-rail colors on every Dashboard booking and Upcoming Event row; render the primary event title through the shared Schedule title rule.
- [x] Slice 2: Add focused regression/source coverage and sync Dashboard and Mobile documentation. No Events-area changelog entry is needed because stored event identity, summaries, and API contracts are unchanged.
- [ ] Slice 3: Verify source/build gates plus authenticated desktop and tablet browser proof and a matched UI review artifact.

## Verification

- [x] Focused Dashboard/event title tests: 3 files, 11 tests passed.
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint and `npm run lint` (one pre-existing warning in `scripts/backfill-signature-artifacts.ts:533`).
- [x] `npm run build:app`
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [ ] Authenticated browser smoke at the supplied Dashboard surface, including computed rail colors, the shortened title, console logs, and a narrow responsive width.
- [ ] `gt-ui-review` matched before/after captures with only the rail/title change.

## Review

- Implemented locally: Dashboard booking and Upcoming Event row separators now color only the top border, preserving each row's semantic left rail. Dashboard event titles now reuse the Schedule primary-title formatter, so imported dash qualifiers remain out of the primary title.
- Verified: Focused tests, TypeScript, focused and full ESLint, production app build, generated codemaps/docs verification, and whitespace checks. The authenticated production tab reproduced the pre-fix full-border rule and the long Marquette title with no console errors or warnings.
- Deferred: Changed-bundle authenticated desktop/tablet smoke and matched before/after UI captures.
- Blocked: The supplied authenticated tab is production and still serves the old bundle; the local preview route has no matching authenticated session and redirects to `/login`. No deploy or production mutation was requested, so claiming changed-bundle runtime proof would be inaccurate.
- Proof artifacts: `tests/dashboard-event-title.test.ts`, `tests/dashboard-ui-polish.test.ts`, and the computed-style baseline captured from the supplied Dashboard tab.
- Next slice or stop: Stop source work here. Re-run the deferred browser and UI-review gates against an authenticated preview/deployment before release.
