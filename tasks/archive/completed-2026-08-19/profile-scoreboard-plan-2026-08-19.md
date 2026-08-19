# Profile Scoreboard Plan - 2026-08-19

## Goal

- Add a read-only `Scoreboard` tab to `/users/[id]` so a profile explains the user's win-loss record across events they worked.
- Make the record useful beyond one headline by breaking it down by sport, opponent/team, game site, and calendar venue.
- Keep the record trustworthy: count each official event once, use the existing active-assignment contract, exclude pre-July testing data and non-official exhibitions, and make missing outcome or location data visible rather than inventing values.
- Expose a separate `Events worked` total for the 2026–27 season so recap and recognition features can count all completed Schedule events without treating exhibitions or non-games as official games.

## Route

- Owner area: Users profile, with CalendarEvent and shift-assignment data from Events and Shifts.
- Ledger: this active plan; `tasks/profile-game-record-cutoff-plan-2026-08-19.md` owns only the July 1 cutoff already added to the shared tally.
- User-facing surface: `/users/{id}?tab=scoreboard`.
- Proposed read endpoint: `GET /api/users/{id}/scoreboard`, loaded when the tab is opened so the profile payload stays small and the event log can paginate.

## Source Checks

- `/users/[id]` already uses URL-backed tabs with `Info`, `Activity`, conditional `Availability`, and `Badges`; the active tab is serialized as `?tab=`.
- `getGameRecordForUser` already counts one event once through `CalendarEvent.groupBy`, using `CalendarEvent.result`, `startsAt >= GAME_RECORD_START_DATE`, non-cancelled/visible/non-archived events, and `ACTIVE_ASSIGNMENT_STATUSES` (`DIRECT_ASSIGNED` and `APPROVED`).
- A no-show still has an active assignment and therefore counts; requested, declined, and swapped-away assignments do not.
- `CalendarEvent` currently provides `sportCode`, `opponent`, `site`, `rawLocationText`, `startsAt`, `result`, and the shift-group relation.
- `sportLabel` is the existing display mapping for sport codes. There is no structured team/opponent model yet.
- `rawLocationText` is the calendar-source venue evidence used by Scoreboard; display projections use the shared Schedule venue-component cleaner.
- The reusable event-level work count is sourced from `CalendarEvent` with the same active-assignment contract, while official W–L reads keep their resolved-result and non-official-event exclusions.
- The existing badge engine counts completed assignment rows for `shift:completed`; it is a separate recognition metric and should not be silently changed to event-level counting.
- Current Users-area collaborator responses intentionally omit assignment, activity, badge, and game-record data; Scoreboard should follow that existing privacy boundary unless a separate collaborator policy is accepted.

## Preview Data Backfill

- The post-July preview schedule already contains the worker source of truth: active `ShiftAssignment` rows attached to each event's shifts. No user links were inferred or created for events without assignment evidence.
- `scripts/backfill-profile-scoreboard.ts` reuses `classifySourceEvent`, the same source classifier used by calendar sync. It repairs missing `CalendarEvent.site` values from stored schedule evidence and missing outcomes from explicit synced `[W]`/`[L]` markers, starting at the July 1 app-timezone boundary. It is dry-run by default, idempotent, respects locked event classification, and writes a reversible `.tmp` snapshot when applied in bounded chunks.
- Applied to the local preview database on 2026-08-19: 256 canonical site values and 3 event outcomes, with the outcomes covering 11 existing active worker links (2 losses and 1 win). The official-record query excludes exhibition, scrimmage, and Alumni Match source titles; Nolan Kromke now reads `0–1` across one official game because Alumni Match and Butler Exhibition are schedule history, not official record games.
- Events with no source outcome remain outside the W–L record until calendar sync supplies an outcome; future or unsourced events are not assigned to users by this backfill.

## Product Shape

### Tab placement and entry

- Add `Scoreboard` after `Info` and before `Activity`.
- Keep the compact hero `W–L on official games` line and separate `Events worked` line as glanceable summaries; the tab becomes the detailed source of truth.
- Keep the tab visible even when the record is empty so every profile has a predictable destination. The empty state should explain that only resolved games from the selected scope appear.
- Preserve deep links and invalid-tab fallback behavior through the existing `useUrlState` contract.

### First screen

1. **Scope line**
   - Default scope: `2026–27 season`.
   - Keep the scope label compact; the API owns the exact date/timezone boundary. Resolved results drive the official record, while `Events worked` counts completed Schedule events in the same season.
   - Start with one fixed scope in the UI; do not expose an `All time` option while pre-July test data is outside the record contract.
   - Design the API around a season key so future seasons can be added without another page redesign.

2. **Record summary**
   - Large `W–L` record.
   - `Events worked` count for all completed Schedule events.
   - `Record games` count for resolved official games.
   - `Win rate`, calculated as wins divided by resolved games and shown as `—` when there are no resolved games.
   - Keep implementation/counting notes out of the primary card; the event-level result remains count-once by contract.

3. **Breakdowns**
   - `By sport`: sport label, record, games, win rate.
   - `By opponent`: canonical stored opponent label, record, games, win rate, and most recent worked date.
   - `By site`: Home, Away, Neutral, and Unknown, using the structured `site` field rather than the legacy nullable `isHome` field.
   - `By venue`: cleaned venue component from `rawLocationText`, with an `Unknown venue` bucket for null values. Preserve raw source text in the event record, while the shared Schedule cleaner removes city/state qualifiers and merges equivalent imported spellings intentionally.
   - Desktop can show sport/opponent as the primary two-column read and put site/venue behind compact sections. Mobile should stack the same sections without horizontal scrolling.

4. **Season event total**
   - Show `Events worked` as the all-event 2026–27 total, separate from the resolved official-game record.
   - Count each completed Schedule event once even when a person held multiple active shifts on it.
   - Include result-less events, exhibitions, scrimmages, Alumni Matches, and non-game events in this total.

5. **Resolved games log**
   - One row per resolved official game, newest first.
   - Columns/fields: date, sport, matchup (`vs`/`at`/`neutral` + opponent), result, venue, site, and the user's active shift area(s).
   - Each row links to `/events/{id}` for source and assignment detail.
   - Include lightweight filters for `All / Wins / Losses` and sport; add site only if the first data set makes it useful without crowding the tab.
   - Use the existing event title/sport formatting helpers and semantic result/venue tones rather than creating a second vocabulary.

### Required states

- Loading: summary and grouped-row skeletons that preserve the eventual layout.
- Error: retryable alert that distinguishes an unavailable Scoreboard from an empty record.
- Empty scope: `No resolved games on record` plus the scope and counting rules.
- Filtered empty: `No games match these filters` with a clear-filters action.
   - Partial metadata: show `Unknown opponent` or `Venue not recorded` only where the corresponding source field is actually null; never infer from the title.
- Slow or stale response: retain the last successful scoreboard while showing the existing refresh/loading treatment.

## Data Contract

Recommended response shape for `GET /api/users/{id}/scoreboard`:

```ts
type ScoreboardBucket = {
  key: string | null;
  label: string;
  wins: number;
  losses: number;
  games: number;
  winRate: number | null;
};

type ScoreboardEvent = {
  id: string;
  startsAt: string;
  allDay: boolean;
  result: "WIN" | "LOSS";
  sportCode: string | null;
  sportLabel: string | null;
  opponent: string | null;
  site: "HOME" | "AWAY" | "NEUTRAL" | null;
  venue: string | null;
  shiftAreas: string[];
};

type UserScoreboard = {
  scope: {
    key: string;
    label: string;
    startsAt: string;
    endsAt: string;
    timeZone: string;
  };
  summary: {
    eventsWorked: number;
    wins: number;
    losses: number;
    games: number;
    winRate: number | null;
  };
  bySport: ScoreboardBucket[];
  byOpponent: ScoreboardBucket[];
  bySite: ScoreboardBucket[];
  byVenue: ScoreboardBucket[];
  events: ScoreboardEvent[];
  nextCursor: string | null;
};
```

The route should accept a season key and bounded filters/cursor. It should use the same profile-read authorization as the current detail route and remain read-only.

## Counting Contract

An event contributes exactly once when all conditions hold:

- `CalendarEvent.result` is `WIN` or `LOSS`.
- `CalendarEvent.startsAt` is on or after the July 1, 2026 app-timezone boundary for the current scope.
- `status` is not `CANCELLED`, `isHidden` is false, and `archivedAt` is null.
- The source title does not mark the event as an exhibition, scrimmage, or Alumni Match. Those outcomes remain on the schedule row as source history but do not contribute to the official record.
- The event has at least one assignment for the target user with status `DIRECT_ASSIGNED` or `APPROVED`.
- Multiple active shifts for the same user on one event still count as one game.

Events with no recorded result remain outside the W–L record. The first implementation should include a clear `resolved results only` note; a later data-quality slice can add `workedEventsWithoutResult` if operators need a reconciliation count.

## Season Event Total Contract

An event contributes once to `summary.eventsWorked` when all conditions hold:

- `CalendarEvent.startsAt` is on or after the July 1, 2026 app-timezone boundary and before the July 1, 2027 season end.
- `CalendarEvent.endsAt` is before the current time, so future assignments are not presented as work already completed.
- `status` is `CONFIRMED` and `isHidden` is false. Archived events remain eligible so history does not disappear from recap or recognition totals.
- The event has at least one `DIRECT_ASSIGNED` or `APPROVED` assignment for the target user.
- `result`, opponent, sport, and event type do not affect eligibility; exhibitions and non-games are intentionally included.

The count is sourced from `CalendarEvent` rather than assignment rows, so multiple active shifts on one event still count once. The service is reusable by future Spotify Wrapped-style recap and event-count badge work; existing assignment-based `shift:completed` badges remain unchanged in this slice.

## Dimension Decisions

- **Team:** use `opponent` as the first release's team breakdown and label it `Opponent` or `Opponent/team`. There is no team entity or canonical team ID in the current schema, so do not claim this is a full team registry.
- **Sport:** group by `sportCode`, render with `sportLabel`, and retain an unknown bucket for null or legacy codes.
- **Site:** group by `site` (`HOME`, `AWAY`, `NEUTRAL`, null). Do not reconstruct site from `isHome` in the Scoreboard service.
- **Venue:** group by the shared Schedule venue-component projection of `rawLocationText`. This removes city/state qualifiers while preserving raw calendar evidence; structured venue entities remain a separate future data-model decision.
- **Worked area:** include active shift area labels on event rows; defer a separate `By area` aggregate until the first event log proves that operators need it.

## Slices

- [x] Slice 1: Extracted a season-aware scoreboard service that returns summary, dimensions, and a bounded event log without a schema migration.
- [x] Slice 2: Added the authenticated `GET /api/users/{id}/scoreboard` route, route tests, and the profile-facing type contract.
- [x] Slice 3: Added the URL-backed Scoreboard tab with summary, venue/team/sport/site breakdowns, filters, event links, and loading/error/empty states.
- [x] Slice 4: Add authenticated desktop and narrow-width browser proof locally; production rollout remains a separate release step.
- [x] Slice 5: Repaired source-backed post-July outcomes in the preview database without inventing worker assignments, then verified populated profiles through the Scoreboard service and authenticated browser.
- [x] Slice 6: Reused the Schedule venue-component cleaner for Scoreboard buckets and worked-event rows so imported city/state qualifiers no longer appear as part of venue names.
- [x] Slice 7: Added the season-wide event-level work total to the shared profile record and Scoreboard response, with `Events worked` presentation and reuse documentation for recap/badge consumers.

## Deferred Decisions

- Structured team records or opponent IDs.
- Canonical venue entities and cross-source venue identity beyond the shared display cleanup.
- Full Spotify Wrapped recap generation and new event-count badge definitions remain a follow-up after the reusable total is available.
- A configurable season table or historical season picker beyond the current 2026–27 scope.
- A separate `worked events without result` reconciliation count.
- Exporting or sharing a Scoreboard.
- Native iOS profile parity; this plan is web profile-only.

## Stop Conditions

- Stop if the current profile authorization contract cannot safely expose assignment-derived records to the target role.
- Stop before schema work if a new season/team/venue identity requirement appears; reconcile it as a separate data-model slice.
- Do not include pre-July 1, 2026 testing events in any default scope.

## Verification

- [x] Focused scoreboard service, route, and Schedule identity tests for count-once behavior, cutoff, assignment statuses, dimensions, pagination, official-record exclusions, venue cleanup, and authorization (`24` tests passing in the current event-total/scoreboard run; the earlier venue/scoreboard run covered `33`).
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run lint` (one pre-existing warning in `scripts/backfill-signature-artifacts.ts`)
- [x] `npm run codemap` and `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [x] Authenticated browser smoke for `/users/{id}?tab=scoreboard` at desktop and narrow widths. The empty scope, filters, layout, and clean console/network path were verified locally; the event-link row was not exercised because the preview profile has no post-cutoff resolved events.
- [x] `scripts/backfill-profile-scoreboard.ts` dry run, bounded apply, and repeat dry run; 256 site values plus 3 outcomes applied, then 0 remaining candidates.
- [x] Authenticated browser proof for populated Nolan Kromke Scoreboard: `0–1`, 1 official game, `7` Events worked, Home `0–1`, venue `McClimon Track/Soccer Complex`, and no exhibition event rows; a read-only preview-data check confirms the seven counted Schedule events include five exhibition-like rows and four result-less rows. Venue cleanup is covered by the service tests for `UW Field House` and `McClimon Track/Soccer Complex`.

## Review

- Shipped: Local web implementation of the profile Scoreboard tab and `GET /api/users/{id}/scoreboard`. It counts resolved official worked events once from July 1, 2026, groups by sport, opponent, site, and calendar venue, and keeps event rows linked to source detail. The shared profile and Scoreboard payloads also expose a separate event-level `Events worked` total for completed 2026–27 Schedule events, including exhibitions and non-games. Schedule and Scoreboard now share the canonical `CalendarEvent.site` classification, including manual edits, sync, and the preview repair path.
- Verified: Focused tests, TypeScript, lint, codemap/docs checks, diff hygiene, `npm run build:app`, backfill idempotency, and authenticated populated-profile browser proof. Nolan's seven completed assigned events include exhibitions and result-less work in the all-event total while his official record remains `0–1` across one game. The service uses raw calendar venue evidence through the shared display cleaner; the event query does not load the internal location relation.
- Deferred: Deployment and post-deployment authenticated smoke against production.
- Blocked: No implementation blocker remains. Production is still on the pre-Scoreboard build; the local preview is now populated for profiles with source-backed post-July outcomes.
- Proof artifacts: Authenticated local dev preview at `http://127.0.0.1:3000/users/cmrcf5lji0000ic04z7vkocy0?tab=scoreboard` verified with Nolan's corrected `0–1` official record, `7` Events worked, `1` Record game, `Home 0–1` site bucket, and only the TCU event row; a read-only preview query identified five exhibition-like and four result-less counted events; the empty state remains verified at desktop and 390×844 on the Erik profile.
- Next slice or stop: Full Spotify Wrapped recap generation and event-count badge definitions remain deferred; deploy through the normal release lane when requested, then verify the same local contract in production.
