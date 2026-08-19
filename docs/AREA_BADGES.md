# AREA: User Badge Achievements

## Document Control
- Area: Badges
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-05-09
- Last Updated: 2026-08-19
- Status: Active, reward celebrations and shift breadth badges implemented locally; migration and runtime rollout pending
- Plan: `tasks/badge-achievements-plan.md`
- Decision Refs: D-034

## Direction
Badges are lightweight recognition for every active user inside the existing ops app. Staff and admins earn badges on the same profile surface as students. Automatic badges come only from durable facts Gear Tracker already captures. Hidden easter eggs may come from a signed-in app foreground event only when the server evaluates the condition from trusted time.

## Core Rules
1. `BADGES_ENABLED !== "true"` returns before any badge evaluator work, database query, or side effect.
2. Operational badge events attach to service-level outcomes: kiosk checkout/pickup open, checkout return completion, trade completion, and a confirmed assigned shift ending. `onShiftsWorked` is evaluated nightly from `morning-refresh`; the cron is when the completed assignment is noticed, not the earning event. A narrow easter-egg exception accepts authenticated app foreground events, but the server's institution timezone decides whether a hidden rule matches.
3. Legacy app checkout scan stubs remain non-events. They stay kiosk-gated 403 routes and award nothing.
4. Badge definitions are seeded by immutable `key`. Typos are fixed by retiring a definition with `active=false` and creating a new key.
5. User awards are idempotent by `(userId, definitionId)`.
6. Request-scoped badge events claim a durable `BadgeEventReceipt` keyed by user, event type, and canonical source before changing any counter. Checkout and return use the booking ID, trade uses the trade ID, and app open uses the date plus eligible hour in the configured institution timezone.
7. Migration and profile reconciliation repair objectively completed automatic thresholds. A returned badge profile never shows completed progress without an award row.
8. Deactivated users keep historical badges.
9. Admins are treated as staff for recognition. They can earn badges and compare profiles like everyone else.
10. Checkout-open credit is immutable across ownership transfer. A pre-open transfer moves future credit; a post-open transfer preserves checkout count, category breadth, gear-family, and single-checkout challenge credit for the original opener while the new custodian owns the return outcome.

## Source-of-Truth Event Flow

| Badge event | Source of truth | Slice |
|---|---|---|
| `onCheckoutOpened` | `src/app/api/kiosk/checkout/complete/route.ts` after an `OPEN` checkout is created | Complete |
| `onCheckoutOpened` | `src/app/api/kiosk/pickup/[id]/confirm/route.ts` after `PENDING_PICKUP -> OPEN` | Complete |
| `onCheckoutReturned` | `src/lib/services/bookings-checkin.ts:markCheckoutCompleted` and `maybeAutoComplete` only when status flips into `COMPLETED` | Complete |
| `onTradeCompleted` | `src/lib/services/shift-trades.ts:claimTrade` immediate-complete branch and `approveTrade`, through one transition helper | Complete |
| `onShiftsWorked` | `src/app/api/cron/morning-refresh/route.ts`, nightly, for anyone whose assignment sat on an event that ended in the last two days | Complete |
| `onAppOpened` | `POST /api/badges/events/app-open`, called when the signed-in web or iOS app becomes active; server time evaluates every matching hidden rule, each claiming its own receipt | Complete |

## Data Model
- `BadgeDefinition`: seeded catalog. Uses immutable `key`, display copy, icon name, category, kind, trigger, threshold, rule key, active flag, and sort order. The canonical launch catalog is seeded by migration `0064_seed_badge_definitions`, and `prisma/seed.mjs` mirrors the current post-`0100_badge_catalog_rebalance` catalog so reseeding cannot regress automatic definitions.
- Custom manual badges are also `BadgeDefinition` rows. Admin-created custom badges use a generated `custom_` key, `trigger="manual"`, `kind=RULE`, `category=MILESTONE`, and no evaluator wiring.
- `StudentBadge`: legacy-named earned badge row for any user. Unique on `(userId, definitionId)`, supports `AUTO` and `MANUAL`, optional `awardedById`, and optional staff note.
- `BadgeStreak`: per-user streak state. `ON_TIME_RETURN` remains active. Historical `SCAN_SUCCESS_COUNT` and `SCAN_CLEAN` rows are retained but are no longer mutated or returned to clients.
- `BadgeEventReceipt`: durable request-event and immutable credit ledger. Unique on `(userId, eventType, sourceKey)` and claimed inside the same Serializable evaluator transaction as streak and award writes. Checkout-open receipts use the opened checkout ID, so later `Booking.requesterUserId` changes cannot move credit.
- `Booking.completedAt`: durable checkout completion timestamp. On-time badge counts use this field with a legacy `updatedAt` fallback for pre-field rows, so later booking edits do not change return eligibility.
- Automatic fun rules share one derivation module for evaluator writes and profile progress. Return rules read completed custody rows (`startsAt`, `endsAt`, `completedAt` with an `updatedAt` fallback, and whether any check-in report exists) and are evaluated above the on-time early return, because a long custody and a same-day turnaround are true whether or not the gear came back on time. Trade rules read completed trade rows rather than a count, and credit short-notice cover to the claimer. Checkout rules use credited booking contents, canonical top-level category families, actual bulk `checkedOutQuantity`, serialized item rows, `Booking.kitId`, and `Booking.startsAt`. Weeks are Monday-anchored in institution time so a Sunday-evening checkout is not filed under the following week, and an all-battery run requires a non-empty family set containing only batteries. Shift rules use confirmed ended assignments, `CalendarEvent.isHome`, `CalendarEvent.sportCode`, `Shift.area`, and effective call window (`ShiftAssignment.callStartsAt`/`callEndsAt`, then `Shift.callStartsAt`/`callEndsAt`, then `Shift.startsAt`/`endsAt`) in the institution timezone. Sport codes are compared case-insensitively, doubleheader days are grouped by institution-local date rather than UTC, and a shift that crossed local midnight counts as having run past 10 p.m.
- `SystemConfig["badges.peerVisible"]`: default `true`; controls peer visibility for another user's badge tab.
- Badge evaluator transactions run with Serializable isolation and retry once on Prisma write conflicts so duplicate source-key retries re-read streak state before mutating.

## UI Direction
- Primary user experience is a `Badges` tab on `/users/{id}` for students, staff, and admins. `/profile` already redirects to user detail.
- No top-level nav item.
- No badge count, chip row, or recognition chrome in the profile hero.
- The badge tab uses shadcn primitives as a flat, medallion-first trophy shelf: one summary band, then five shelf sections with no drill-in level. Completion includes only visible automatic goals, so manual recognition, hidden surprises, and retired history cannot lower a user's percentage.
- Shelves group badges into Gear Flow, Reliability, Legacy Scan Awards, Teamwork, and Staff Picks. Goal shelves show earned/total; legacy and staff recognition shelves show earned count only.
- Badge tiles lead with the artifact medallion (locked keeps its own icon dimmed rather than a padlock, rarity = rim tone) over the name and one quiet meta line (earned date, progress x/y, requirement, or unlock hint); status/rarity/manual chips live only in the detail dialog. Recent awards keep the one-week glow and a New chip.
- iOS shares the vocabulary but not the medallion shapes: one ringed disc for every badge, tinted by rarity. The per-category coin/hex/shield/stack silhouettes were removed on 2026-07-22 -- `stack` rendered as a notched square behind an offset second square, which read as a clipping fault rather than a medal. The badge card is a horizontal earned shelf plus live streak rows and a closest-to-earned progress row; the gallery sheet keeps the same five collection sections.
- A few surprise badges stay hidden from the locked grid until earned; the available section shows how many surprise badges remain hidden.
- The badge profile API loads active definitions plus historical earned inactive definitions in one Prisma call that includes the user's award row.
- The badge profile API adds progress only when it can derive it from real counters or streak state. Manual and unsupported rule badges remain rule-based with no fake progress bar.
- With `BADGES_ENABLED` off, badge APIs return disabled/empty payloads before any badge table query. This keeps un-migrated local or preview databases from failing on badge UI routes.
- `/reports/badges` is staff analytics only and follows existing report layout patterns. It shows aggregate award metrics, manual award rate, user leaderboard, badge distribution, underused active definitions, recent manual recognition, and recent awards.
- Manual awards launch from the existing user admin actions menu, not from permanent hero chrome.
- Manual award selection remains available for the two general recognition badges and admin-created custom badges. The ten new fun badges are automatic and never appear as staff-awarded definitions.
- Award notifications are persistent inbox entries that link to `/users/{userId}?tab=badges`.
- Manual awards are admin-only through the existing user admin actions menu. They can target any active user, persist `source=MANUAL`, `awardedById`, and an optional note, and create a persistent inbox notification unless `User.notificationPrefs.badges === false`.
- Web and the signed-in iOS app show a queued, rarity-tinted reward popup for awards earned after that device establishes its cursor. The initial read establishes a server cursor and intentionally returns no history, so sign-in or migration cannot replay the full catalog as celebrations.
- Kiosk checkout, pickup, and return completion responses include newly earned awards for the selected user. Individual scan responses no longer award badges. The native kiosk collects completion awards across the flow and extends the success screen into the reward moment without interrupting custody work or requiring a user session on the shared device.
- Reward presentation is additive and failure-isolated. A failed reward read must never change a committed checkout, pickup, or return result. Reduced Motion removes decorative movement while preserving the award content and accessibility announcement.

## Rarity
Rarity is computed from how many people hold a badge, not from a hardcoded list. `getBadgeRarity` in `src/lib/badges/display.ts` buckets holder share among active users: >=50% Common, >=20% Uncommon, >=5% Rare, below that Legendary. Two guards keep scarcity honest -- a badge with zero holders, or a definition younger than 30 days, has not had a chance to be earned, so it falls back to the difficulty-based rating. The API serves `rarity` and `holders` on every badge row; web and iOS render the served value rather than keeping their own tables.

## Streaks
The badge profile payload exposes `ON_TIME_RETURN` as `streaks[]`, and native Home renders it on the badge card. Historical scan counter and streak rows remain stored but stay out of profile payloads.

## Starting Badge Set
- Checkout: `first_checkout`, `checkout_5`, `checkout_10`, `checkout_25`, `checkout_100`
- On-time return: `on_time_1`, `on_time_5`, `on_time_10`, `on_time_25`, `on_time_50`, `damage_free_10`, `damage_free_50`
- Shift: `first_shift`, `shift_10`, `shift_25`, `shift_50`
- Trade: `first_trade`, `trade_5`, `trade_10`
- Streak: `streak_on_time_5`, `streak_on_time_10`
- Automatic milestone: `category_collector`
- Automatic fun: `power_player` (10 battery checkouts), `glass_class` (10 lens checkouts), `sound_check` (5 audio checkouts), `rock_solid` (3 tripod or gimbal checkouts), `bright_spark` (2 lighting checkouts), `kitchen_sink` (5 gear families in one checkout), `three_piece_suit` (camera, lens, and audio together 3 times), `heavy_lifter` (15 actual pieces in one checkout), `road_tested` (3 completed away assignments), `before_sunrise` (2 completed assignments before 7 a.m.)
- Manual recognition: `event_hero`, `above_and_beyond`, plus custom manual definitions created by admins
- Automatic shift breadth: `season_pass` (4 different sports), `utility_crew` (5 different crew areas), `doubleheader` (a day holding 2 or more assignments), `under_the_lights` (8 shifts that ran to 10 p.m. or later)
- Automatic checkout breadth: `deep_inventory` (25 different serialized items), `regular_rotation` (checkouts in 6 different weeks), `kit_complete` (5 checkouts built from a saved kit)
- Automatic return moment: `long_haul` (5 week-long clean custodies), `round_trip` (25 same-day turnarounds)
- Automatic trade cover: `short_notice` (3 trades claimed inside the last day before the shift)
- Hidden easter egg: `go_to_bed`, awarded once when the authenticated app opens during the 2 a.m. hour in the institution timezone; `old_faithful` (the same item checked out 25 times) and `battery_run` (5 checkouts containing nothing but batteries), both automatic from credited checkout contents; `buzzer_beater` (3 returns inside the last five minutes before due); `take_thirteen` (app opened on a Friday the 13th) and `holiday_hours` (app opened on December 25 or January 1)
- Retired history: `first_scan`, `scan_10`, `scan_25`, `scan_50`, `scan_100`, `zero_errors`

## Acceptance Criteria
- [x] `BADGES_ENABLED=false` causes zero evaluator work, badge queries, and side effects.
- [x] Kiosk checkout completion awards checkout count badges exactly once per booking.
- [x] Kiosk pickup confirmation awards checkout count badges exactly once for reservations moving into active checkout.
- [x] Checkout return badges award exactly once when a checkout transitions to `COMPLETED`.
- [x] On-time computation uses `Booking.completedAt` plus a 15-minute UTC grace window after `booking.endsAt`.
- [x] Kiosk scans remain operational evidence but do not emit badge events or mutate scan counters.
- [x] Legacy app scan stub remains 403 and awards nothing.
- [x] Trade badges award once per completed trade status flip.
- [x] Shift badges do not award from request approval.
- [x] Manual awards persist staff attribution, optional notes, and profile-linked inbox notifications that respect badge notification prefs.
- [x] Admins can create a custom manual badge during award, save it to the active catalog, and reuse it for later staff or student awards.
- [x] User profile badge grid uses shadcn primitives and does not crowd the hero.
- [x] User profile badge cards expose manual notes, recent-award state, rarity-aware medallions, surprise-badge count, and real progress where supported.
- [x] Peer visibility respects `SystemConfig["badges.peerVisible"]`.
- [x] `/reports/badges` follows existing report layout patterns.
- [x] Replaying an older request-scoped source key cannot increment a counter after newer events have arrived.
- [x] Web and signed-in iOS establish a per-user cursor, queue new awards, and never replay award history on first load.
- [x] Kiosk checkout, pickup, and return keep custody success authoritative while displaying newly earned awards on the success screen.
- [x] Ownership transfer preserves original checkout-open credit while assigning the eventual return outcome to the current custodian.
- [x] Completed automatic progress self-heals to a durable award before a profile is returned.
- [x] The ten fun badges derive from captured checkout or completed-shift data, backfill historical qualifiers, and never require a staff award.
- [x] App-open easter eggs use authenticated identity and server-authoritative institution time, with no client clock input.
- [x] The four shift breadth badges derive from confirmed ended assignments, backfill historical qualifiers, and report progress from the same derivation the evaluator awards from.
- [x] The five checkout breadth badges derive from credited checkout receipts, backfill historical qualifiers, and keep the two surprises hidden until earned.
- [x] The three return-moment badges evaluate above the on-time early return and credit the current custodian.
- [x] The two app-open surprises evaluate every matching rule per open, keep `local_hour_2`'s original receipt prefix, and seed no invented history.
- [x] Short-notice cover credits the claimer and ignores claims recorded at or after the shift start.
- [ ] `kit_complete` and `short_notice` depend on features with no usage at all: no checkout has ever been built from a saved kit, and the `shift_trades` table is empty, which also leaves the pre-existing `first_trade`, `trade_5`, and `trade_10` at zero. Both are wired correctly and become earnable as soon as those features are used.
- [x] v7 thresholds are set against measured history rather than guesswork, deliberately split between four badges that award on day one (`season_pass`, `doubleheader`, `deep_inventory`, `regular_rotation`) and nine long-run goals set above the current leader.
- [x] No threshold exceeds its structural ceiling. Only 10 sports and 5 crew areas are ever staffed, so `season_pass` sits at 4 of 10 and `utility_crew` at 5 of 5.

## Rollout
1. Slice 1 ships schema, seed, service skeleton, feature flag, and docs with the flag off.
2. Later slices wire one domain event family at a time and add focused tests.
3. Preview verification flips `BADGES_ENABLED=true`, exercises kiosk/trade/manual flows, then flips it back off to prove rollback.
4. Production enablement happens only after preview verification.
5. Migration `0110_badge_rewards` must deploy before the updated evaluators are enabled. It creates receipts, freezes historical checkout-open ownership from audit history, repairs completed automatic awards, retires scan goals, and seeds the new catalog. Optional reward response fields preserve client compatibility during rollout.

## Change Log
| Date | Change |
|---|---|
| 2026-08-19 | Reset the v7 thresholds as a deliberate mix after calibration. Four award immediately so the shelf is not dead at launch (`season_pass` 4, `doubleheader` 1, `deep_inventory` 25, `regular_rotation` 6); the other nine sit above the current leader as long-run goals (`utility_crew` 5, `under_the_lights` 8, `kit_complete` 5, `old_faithful` 25, `battery_run` 5, `long_haul` 5, `round_trip` 25, `buzzer_beater` 3, `short_notice` 3). Every goal stays under its structural ceiling, measured from 10 staffed sports, 5 staffed crew areas, 23 weeks of checkout history, and 78 distinct assets ever handled. |
| 2026-08-19 | Calibrated the v7 thresholds against real history rather than design intent. Eight of the thirteen counted rules would have shipped unreachable. `season_pass` 8 to 4, `utility_crew` 4 to 3, `doubleheader` 5 to 1, `under_the_lights` 5 to 3, `regular_rotation` 8 to 6, `kit_complete` 10 to 3, `old_faithful` 25 to 10, `battery_run` 5 to 3, `round_trip` 20 to 12, `buzzer_beater` 3 to 1, and `short_notice` 3 to 2; `deep_inventory` and `long_haul` were already correct. Each calibrated rule now puts 1 to 3 of 30 active users at or above its threshold. `kit_complete` and `short_notice` remain at zero for lack of kit checkouts and trades, not for lack of calibration. |
| 2026-08-19 | Completed the v7 badge set. `0119_badge_return_moment` added `long_haul`, `round_trip`, and hidden `buzzer_beater`, moving the completed-checkout read above the on-time early return. `0120_badge_app_open_eggs` added hidden `take_thirteen` and `holiday_hours` and restructured `onAppOpened` from a single 2 a.m. guard into a matcher list where every match claims its own receipt. `0122_badge_short_notice` added `short_notice`, and `onTradeCompleted` now reads trade rows instead of counting them. Thresholds remain uncalibrated against production history. |
| 2026-08-19 | Added five automatic checkout badges in migration `0118_badge_checkout_breadth`: `deep_inventory`, `regular_rotation`, and `kit_complete` as visible challenges, plus hidden `old_faithful` and `battery_run`. `checkoutAutomaticRuleCounts` now takes the institution timezone and reads `Booking.startsAt`, `Booking.kitId`, and serialized `assetId` from the same credited rows. Thresholds remain uncalibrated against production history. |
| 2026-08-19 | Added four automatic shift breadth badges -- `season_pass`, `utility_crew`, `doubleheader`, and `under_the_lights` -- in migration `0117_badge_shift_breadth`. The nightly `onShiftsWorked` pass and the profile progress query now select sport code, crew area, and the effective call/shift end so one derivation serves both. Thresholds remain uncalibrated against production history. |
| 2026-08-10 | Ownership, completion, and automatic-fun pass: checkout-open counts and category breadth now read immutable event receipts, with migration backfill reconstructing original holders from transfer audits; return outcomes stay with the current custodian. A read-only production audit found eight completed-but-unawarded goals: six `first_shift`, one `shift_10`, and one `category_collector`. The migration repairs those rows, and profile reads self-heal any future automatic threshold reached without an award. Six scan goals were retired because production has 406 successful and zero failed recorded scans. Ten fun badges now derive from credited checkout contents, actual item quantity, completed away assignments, or early call times; none is staff-awarded. Their thresholds were calibrated against production history so every challenge is already achievable but only one to three current users qualify for each. Shift copy says assigned rather than implying attendance, completion excludes manual/hidden/retired awards, and Legacy Scan Awards preserves history. `Go To Bed` establishes the server-authoritative authenticated app-open easter-egg path for web and iOS. |
| 2026-08-10 | Reward and reliability pass: added durable request-event receipts so delayed duplicate scans cannot inflate streak counters; added `on_time_5`, `scan_10`, `shift_25`, and `trade_5` bridge milestones; corrected scan badge ordering; added a no-history-replay recent-awards cursor for web and signed-in iOS; and carried newly earned awards through kiosk scan/completion responses into an extended, accessible success celebration. Source contracts and both native targets compile locally; migration deployment, authenticated browser proof, and managed-iPad visual proof remain release gates. |
| 2026-07-31 | Badge hardening: synchronized `prisma/seed.mjs` with the rebalance migration, included bulk inventory in category breadth, awarded damage-free badges for late clean returns, preserved trusted sidebar counts when dashboard count data is partial, and surfaced badge revoke failures with auth-aware error feedback. |
| 2026-07-22 | Badge system rethought against live award data (33 definitions, 67 awards, 14 users). **Icons:** every badge on iOS rendered `seal.fill` -- `BadgeDefinition.icon` holds Lucide names and the iOS `sfSymbolName` map knew twelve unrelated ones, overlapping on `Trophy` alone, so 31 of 33 badges collapsed to one glyph. The map now covers the whole catalog, guarded by `tests/ios-badge-icon-coverage.test.ts`; locked badges show their own icon dimmed instead of `lock.fill`; the badge card gained the closest-to-earned progress row and the streak rows. **Rarity:** replaced four hardcoded key lists that had drifted into falsehood (`zero_errors` labelled Uncommon while held by 10 of 14 users; `checkout_25` labelled Common while held by nobody) with holder-share computation served from the API. **Catalog** (`0100_badge_catalog_rebalance`): added `checkout_10`, `on_time_25`, `scan_50`, `damage_free_10`, `damage_free_50`; converted `category_collector` from manual to automatic on distinct checked-out categories; revived `first_shift`/`shift_10`/`shift_50` from assignments to ended events; retired seven manual badges with zero awards since launch (`perfect_handoff`, `clean_loop`, `full_kit_no_misses`, `semester_streak`, `rookie_run`, `reliable_regular`, `clutch_cover`), keeping `above_and_beyond` and `event_hero` as catch-alls. Nothing deleted -- retirement is `active=false` and awarded rows still render. Core rule 2 narrowed to admit the nightly shift evaluation. |
| 2026-07-02 | Badges awards and sections redesigned on web and iOS around a flat "trophy shelf" model. Web: the two-level collection-card → drill-in navigation was removed; the tab now shows one summary band (completion + progress bar + earned/remaining/hidden) and five always-visible shelf sections of compact medallion-first tiles (each badge on exactly one shelf; staff recognition wins over thematic hints). Tile chip rows were dropped — locked reads as grayscale medallion, rarity as rim tone, chips live in the unchanged detail dialog. iOS: web's coin/hex/shield/stack medallion silhouettes were ported as SwiftUI Shapes with rarity fill/stroke; the profile badge card became a horizontal earned-medallion shelf; the gallery sheet groups into the same five collections with compact tiles (descriptions moved to the detail sheet). Verified with mock-data scratch-route screenshots (light/dark, filters, dialog), `npm run build:app`, vitest, and Wisconsin simulator build. |
| 2026-05-14 | Award badge dialog redesigned with a live preview header (rarity-aware gradient, centered hex medallion, badge name updates as you configure), custom icon grid picker replacing the Select dropdown, and a cleaner form layout with explicit note label + updated placeholder. No logic changes. |
| 2026-05-13 | Product scope cleanup retired attendance-based shift badges. `first_shift`, `shift_10`, `shift_50`, `streak_shifts_5`, and `streak_shifts_10` are no longer active catalog goals because attendance tracking is not a planned badge source. Shift request approval remains a non-event for badge awards. |
| 2026-05-12 | Badge on-time counts now use durable `Booking.completedAt` instead of mutable `updatedAt`. Checkout completion paths set the booking and scan-session completion timestamps from the same transaction timestamp, while badge progress falls back to `updatedAt` only for old completed rows. |
| 2026-05-12 | Badge MVP closeout fixed stale `RETURN` category handling to match the shipped `ON_TIME` schema category on web and iOS, and verified shift request approval remains a non-event for badge awards. |
| 2026-05-12 | Web badge gallery moved to an award-collection model inspired by Apple Fitness. The profile tab now opens with collection shelves for Gear Flow, Reliability, Scans, Teamwork, and Staff Picks; each shelf features a larger artifact medallion, preview stack, earned/visible counts, and a category drill-in gallery with the existing filters and detail modal. Shared badge medallions now render clean CSS/SVG artifact rims, rarity finish, locked grayscale state, and category shape variants without busy patterning behind the icon. |
| 2026-05-12 | Badge detail modal chrome upgraded. The profile badge gallery still stays out of the hero, but expanded badge details now use a larger rarity-aware medallion stage, animated shine/floating accents with reduced-motion support, richer status copy, icon-backed metadata cards, and a stronger manual-award note treatment. |
| 2026-05-12 | Badge definition production seeding moved into migration `0064_seed_badge_definitions`. This fixes production environments where Vercel ran `prisma migrate deploy` but not `prisma/seed.mjs`, leaving the award dialog and gallery with no active definitions. The award dialog also now reopens directly on Custom when the existing catalog is cached empty. |
| 2026-05-12 | Web profile badge UI upgraded from split earned/available lists into a full gallery. Users can filter all visible badges by earned, locked, manual, and rare; click any tile to open a detail dialog with title, description, earned date, source, note, rarity, category, trigger metadata, and progress where available. Recent awards get a restrained rarity glow instead of profile hero clutter. |
| 2026-05-12 | Native iOS badge profiles now include a full badge gallery. The profile card stays compact with earned badges and a See all action; the gallery sheet shows all visible badges with earned, locked, manual, and rare filters, hidden-surprise copy, medallion styling, haptics, and native detail sheets for title, description, earned date, source, note, rarity, category, trigger, and progress. |
| 2026-05-12 | Native iOS profiles now fetch the badge profile API and show earned badges in a compact profile section without crowding the header. iOS notification taps for `badge_awarded` now route to the awarded user's profile when the notification payload includes `userId`. |
| 2026-05-12 | Custom manual badge awarding shipped. The existing Award badge dialog now has an Existing/Custom mode; custom badges create active `custom_` keyed manual `BadgeDefinition` rows, award the target user immediately, write the same audit and notification records as standard manual awards, and remain reusable in the normal active catalog for follow-up staff awards such as "Guinea Pig." |
| 2026-05-09 | Front-end badge polish added rarity-aware medallions, profile-grid motion, manual note display, recent-award state, surprise-badge count, real progress for supported threshold badges, and staff report insight sections for manual rate, underused definitions, and recent manual recognition. The legacy `StudentBadge` model name remains a deferred migration cleanup. |
| 2026-05-09 | Badge display polish added schema-free rarity labels, surprise badges hidden until earned, and admin award guidance in the manual award dialog. |
| 2026-05-09 | Badge scope expanded from student-only to every active user, including staff and admins. Staff/admin profiles now keep the Badges tab, admins can manually award badges to any active user, and the catalog includes ten fun manual-recognition badges for clean workflows, clutch coverage, event help, reliability, and above-and-beyond moments. |
| 2026-05-09 | Slice 7 hardening added Serializable badge evaluator transactions with one Prisma conflict retry, Sentry-backed `captureBadgeError` when `SENTRY_DSN` is configured, and focused tests for flag-off zero transaction work plus duplicate source-key retry behavior. |
| 2026-05-09 | Slice 7 staff analytics shipped. `/reports/badges` was added to the Reports tab set after Audit, with total award metrics, 30-day award volume, active definition count, manual award count, user leaderboard, badge distribution, recent awards, and CSV export. |
| 2026-05-09 | Slice 5 shipped trade completion badges, admin manual awards, and badge award inbox notifications. `claimTrade` immediate completion and `approveTrade` queue `onTradeCompleted` only when the trade flips to `COMPLETED`; admins can award active badges from the existing user admin actions menu; manual awards persist `awardedById` and optional notes; award notifications link to the profile badges tab and respect `notificationPrefs.badges`. |
| 2026-05-09 | Slice 4 shipped the badge catalog API, user badge profile API with self/staff/peer-visibility checks, and a restrained `Badges` tab on student `/users/{id}` pages. Badge APIs now short-circuit to disabled/empty payloads while `BADGES_ENABLED` is off, `/profile` remains a redirect to user detail, and the profile hero remains badge-free. |
| 2026-05-09 | Slice 3 shipped kiosk scan badge events. Kiosk direct checkout, pickup, and check-in scans now emit feature-flagged scan success/failure events; successful scans count toward scan badges, failed scans reset the clean-scan streak, and legacy app scan stubs remain non-events. |
| 2026-05-09 | Slice 2 shipped checkout-opened and checkout-returned badge evaluation. Kiosk direct checkout and kiosk pickup now emit opened events after audit success; checkout completion emits returned events from `markCheckoutCompleted`, partial serialized auto-complete, bulk auto-complete, and kiosk check-in auto-complete. |
| 2026-05-09 | Slice 1 shipped with schema, migration artifact, seed definitions, feature-flagged service skeleton, observability stub, and flag-off contract test. Route wiring remains deferred. |
