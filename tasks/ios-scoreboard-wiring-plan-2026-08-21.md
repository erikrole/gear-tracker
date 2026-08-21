# iOS Scoreboard Wiring Plan - 2026-08-21

## Goal

- Make the existing read-only profile Scoreboard available as a native iOS workflow from the current user's profile and permitted teammate profiles.
- Keep the server-owned season, event-count, result, site, venue, and privacy semantics intact.

## Route

- Owner areas: Mobile and Users.
- Ledger: this active plan; no schema or migration work is expected.
- Existing reference: `tasks/archive/completed-2026-08-19/profile-scoreboard-plan-2026-08-19.md`.

## Source Checks

- `src/app/api/users/[id]/scoreboard/route.ts` returns `{ data: UserScoreboard }`, accepts `season`, `sportCode`, `result`, `limit`, and `offset`, and applies the existing profile visibility rules.
- `src/lib/services/scoreboard.ts` defines the season scope, separate `eventsWorked` and official record totals, result/site/venue breakdowns, and bounded resolved-event rows.
- `ios/Wisconsin/Views/ProfileView.swift` owns the current user's profile; `ios/Wisconsin/Views/UserDetailView.swift` owns permitted directory profiles and already excludes collaborator directory viewers from private profile activity.
- Native API calls use `APIClient` and the shared `DataWrapper` envelope; new native reads must fail independently so an unavailable Scoreboard cannot blank an otherwise usable profile.
- `ios/project.yml` sources the `Wisconsin` and `WisconsinTests` trees; generated Xcode project membership still needs to be checked after adding files.

## Stop Conditions

- Stop and reconcile the client model if the route response or envelope differs from the source contract.
- Do not add scoreboard reads for a collaborator viewing another profile; the server intentionally denies that path and the current native profile already has the matching privacy gate.
- Do not invent event timing or custody actions from the scoreboard event summary. Event rows remain read-only unless a complete, authorized event-detail contract is available.
- Do not add schema, migration, production backfill, or web behavior changes to this slice.

## Slices

- [x] Slice 1: Add tolerant native Scoreboard models, the authenticated API client read, and Codable/helper tests.
- [x] Slice 2: Add the native Scoreboard screen with summary, filters, breakdowns, resolved-event rows, pagination, refresh, loading, empty, and retry states.
- [x] Slice 3: Wire entry points from the current user's Profile and permitted User Detail surfaces without changing existing profile loading semantics.
- [x] Slice 4: Register generated project membership, sync Mobile/Users documentation, and close the plan with evidence.
- [x] Slice 5 (cleanup pass): Fix the collapsing sport filter, the stale "Show more" page, and the cursor/duplicate-id paging holes; say what a filtered view covers; restore the Profile entry to a standard list row; and give the record wording, area names, and blank-text fallbacks one owner.
- [x] Slice 6 (design pass): Rebuild the surface around the season -- record meter, recent form and streak, season highlights, one breakdown switcher with volume/split bars, month-grouped games, a visible sport chip strip, a layout-shaped skeleton, and motion/haptics that honour Reduce Motion.
- [x] Slice 7 (parity and closeout): Bring the web profile Scoreboard tab up to the native design over a shared digest module, count the Scoreboard as its own usage surface, add the missing Live Production shift-area option, and add a Profile fixture scenario so the entry row can finally be captured.

## Verification

- [x] `npx vitest run tests/scoreboard-route.test.ts tests/ios-scoreboard-wiring.test.ts`
- [x] `DEVELOPER_DIR=... xcrun swiftc -typecheck ios/Wisconsin/Models/ScoreboardModels.swift`
- [x] `npx eslint tests/ios-scoreboard-wiring.test.ts`
- [x] `npm run drift:ios`
- [x] `node scripts/check-ios-project.mjs`
- [x] `xcodebuild` DEBUG build for the `Wisconsin` target using the iPhone 16 Pro / iOS 26.5 Simulator destination; the current Scoreboard sources and DEBUG capture harness build successfully with the local Swift package cache.
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run build:app`
- [ ] `npm run verify:docs`
- [x] `git diff --check`
- [x] Simulator/runtime inspection of the Scoreboard surface using the DEBUG fixture scenario on the configured iPhone 16 Pro / iOS 26.5 runtime; captured the summary, breakdown, filter, and resolved-game history states inline.

## Review

- Shipped: Native Scoreboard models, authenticated API client method, read-only Scoreboard screen, current-user Profile entry, permitted teammate User Detail entry, Codable/source-contract tests, generated project membership, and a DEBUG-only fixture capture scenario.
- Verified: Focused Vitest coverage, model type-check, ESLint, TypeScript, iOS drift checks, checked-in Xcode project consistency, `npm run build:app`, `git diff --check`, the full DEBUG iPhone 16 Pro / iOS 26.5 build, and inline simulator captures of the Scoreboard states.
- Deferred: `npm run verify:docs` remains open because the repository has unrelated generated-codemap drift.
- Blocked: `npm run verify:docs` reports stale generated codemaps from unrelated repository changes; regeneration would overwrite parallel documentation work. No native build or runtime blocker remains for this slice.
- Proof artifacts: `tests/ios-scoreboard-wiring.test.ts`, `ios/WisconsinTests/ScoreboardModelsTests.swift`, `ios/Wisconsin.xcodeproj/project.pbxproj`, and the DEBUG `GT_PERFORMANCE_SCENARIO=scoreboard` fixture harness.
- Next slice or stop: Stop; the native Scoreboard slice is implemented and visually reviewed on the iPhone 16 Pro simulator.

## Cleanup Pass Review (2026-08-21)

- Shipped: Unfiltered sport-menu options, a request-key guard so a filter change discards the page it outran, offset-typed pagination with duplicate-id protection, a filtered-scope note reconciling the season-wide events-worked total, Clear filters in the filtered empty state, a neutral control tint, a standard Profile list row in place of the unpadded card label, shared record/rate formatting, blank-text fallbacks for opponent, sport, and venue, and a `LIVE_PRODUCTION` case in the shared `shiftAreaLabel` helper that every area-naming surface was missing.
- Capture scaffolding: the DEBUG scoreboard fixture now answers `sportCode`, `result`, `limit`, and `offset` the way the route does, and `WisconsinUITests/ScoreboardScreenshotUITests` captures the unfiltered, breakdown, games, sport-menu, filtered, and filtered-empty states for matched before/after review.
- Verified: `npx vitest run tests/ios-scoreboard-wiring.test.ts tests/scoreboard-route.test.ts tests/scoreboard.test.ts`, `xcodebuild test -only-testing:WisconsinTests/ScoreboardModelsTests` (5 passed) on the iPhone 16 Pro / iOS 26.5 Simulator, the full DEBUG `Wisconsin` build, `npm run drift:ios`, `node scripts/check-ios-project.mjs`, `npx tsc --noEmit`, `npx eslint tests/ios-scoreboard-wiring.test.ts`, and `git diff --check`.
- Review page: published before/after Artifact built from matched iPhone 16 Pro captures; the baseline column was the pre-edit working tree (these files are untracked, so `HEAD` has no version), restored verbatim and rebuilt.
- Deferred: `surface_viewed` telemetry for the Scoreboard. `PRODUCT_EVENT_SURFACES` is a strict server enum without a scoreboard member, and this slice does not change web behavior.
- Open, out of scope here: `src/app/(app)/users/[id]/UserScoreboardTab.tsx` derives its sport options from the filtered response the same way the native menu did, so the web Select collapses identically; and `ShiftAreaOption` in `AddShiftSheet.swift` still offers no Live Production choice.
- Next slice or stop: Stop.

## Design Pass Review (2026-08-21)

- Shipped: A season card with a win/loss proportion meter, last-five form, and streak; a totals sentence that reconciles events worked with resolved games and states filter scope from a season total held across filtered reads; a highlights row (most worked, best venue, top matchup); one breakdown card with a Sport/Opponent/Site/Venue switcher, a five-row cap with Show all, and per-row bars encoding volume and split; month-grouped game rows with a tinted result badge, day label, and site glyph; a visible sport chip strip; a layout-shaped loading skeleton; snappy transitions and selection haptics that honour Reduce Motion; and a 26-game, four-month fixture season that exercises all of it.
- Derived, not requested: recency, streaks, month grouping, and highlights all come from the game list the route already returns. No API, schema, privacy, or read-only behaviour changed.
- Verified: `xcodebuild test` for `WisconsinTests` (55 passing, including 10 Scoreboard model cases), `npx vitest run` over `ios-scoreboard-wiring` (9 source contracts), `scoreboard`, `scoreboard-route`, and `ios-api-contract`, the full DEBUG `Wisconsin` build, the `WisconsinPerformance` capture test in both columns, `npm run drift:ios`, `node scripts/check-ios-project.mjs`, `npx tsc --noEmit`, `npx eslint`, and `git diff --check`.
- Review page: republished with matched iPhone 16 Pro captures of both versions against the same fixture season; the pre-redesign column was rebuilt from restored sources and driven by a temporary capture test that has since been removed.
- Deliberate removal: game rows no longer show a start time; the day and the venue carry the row.
- Next slice or stop: Stop.

## Parity and Closeout Review (2026-08-21)

- Shipped: The web profile Scoreboard tab rebuilt to match the native surface (season meter, last-five form and streak, filter-aware totals sentence, highlights, one breakdown switcher with volume/split bars and a row cap, month-grouped games); `src/lib/scoreboard-digest.ts` as the shared owner of recency, streaks, month grouping, highlights, and the totals sentence for both platforms; a `scoreboard` member of `PRODUCT_EVENT_SURFACES` recorded by the native screen; the missing `LIVE_PRODUCTION` option in `ShiftAreaOption`; and a DEBUG `profile` fixture scenario plus `ProfileScreenshotUITests`, which captures the Scoreboard entry row beside its neighbours for the first time.
- Verified: `xcodebuild test` for `WisconsinTests`, `npx vitest run` over the scoreboard, digest, wiring, usage-analytics, and iOS API contract suites (70 passing), `npx tsc --noEmit`, `npx eslint` on every changed file, `npm run build:app`, `npm run drift:ios`, `node scripts/check-ios-project.mjs`, `git diff --check`, and the `WisconsinPerformance` capture tests for both the Scoreboard and Profile scenarios.
- Fixture bug found and fixed while capturing: `ProfileHarnessView` seeded `session.currentUser` in `onAppear`, which raced `ProfileView`'s own `.task` and left the screen with no identity to load; the seeding now gates rendering, and its placeholder is a real view because an empty `Group` never appears.
- Blocked: authenticated browser proof of the web tab. This checkout has no local database -- only `.env.preview.local` carries a `DATABASE_URL`, and it points at shared preview infrastructure that page views would write usage rows into. The web redesign therefore ships without captures or a review page.
- Next slice or stop: Stop, pending the environment decision for web capture.
