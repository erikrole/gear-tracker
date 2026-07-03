# AREA: Student Badge Achievements

## Document Control
- Area: Badges
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-05-09
- Last Updated: 2026-05-12
- Status: Active, Badge Achievements MVP verified with feature flag off-safe behavior
- Plan: `tasks/badge-achievements-plan.md`
- Decision Refs: D-034

## Direction
Badges are lightweight recognition for every active user inside the existing ops app. Staff and admins earn badges on the same profile surface as students. Badges are earned from real domain outcomes, not from route visits, timers, or cron jobs.

## Core Rules
1. `BADGES_ENABLED !== "true"` returns before any badge evaluator work, database query, or side effect.
2. Badge events attach to service-level outcomes: kiosk checkout/pickup open, checkout return completion, kiosk scan result, and trade completion.
3. Legacy app checkout scan stubs remain non-events. They stay kiosk-gated 403 routes and award nothing.
4. Badge definitions are seeded by immutable `key`. Typos are fixed by retiring a definition with `active=false` and creating a new key.
5. User awards are idempotent by `(userId, definitionId)`.
6. Streak updates are idempotent by `sourceKey`; repeated handling of the same domain event is a no-op.
7. Launch has no retroactive backfill. Existing history does not award badges until events happen after enablement.
8. Deactivated users keep historical badges.
9. Admins are treated as staff for recognition. They can earn badges and compare profiles like everyone else.

## Source-of-Truth Event Flow

| Badge event | Source of truth | Slice |
|---|---|---|
| `onCheckoutOpened` | `src/app/api/kiosk/checkout/complete/route.ts` after an `OPEN` checkout is created | Complete |
| `onCheckoutOpened` | `src/app/api/kiosk/pickup/[id]/confirm/route.ts` after `PENDING_PICKUP -> OPEN` | Complete |
| `onCheckoutReturned` | `src/lib/services/bookings-checkin.ts:markCheckoutCompleted` and `maybeAutoComplete` only when status flips into `COMPLETED` | Complete |
| `onScanResult` | `src/app/api/kiosk/checkout/scan`, `src/app/api/kiosk/pickup/[id]/scan`, `src/app/api/kiosk/checkin/[id]/scan` | Complete |
| `onTradeCompleted` | `src/lib/services/shift-trades.ts:claimTrade` immediate-complete branch and `approveTrade`, through one transition helper | Complete |

## Data Model
- `BadgeDefinition`: seeded catalog. Uses immutable `key`, display copy, icon name, category, kind, trigger, threshold, rule key, active flag, and sort order. The canonical launch catalog is seeded by migration `0064_seed_badge_definitions` so production deploys do not depend on `prisma/seed.mjs`.
- Custom manual badges are also `BadgeDefinition` rows. Admin-created custom badges use a generated `custom_` key, `trigger="manual"`, `kind=RULE`, `category=MILESTONE`, and no evaluator wiring.
- `StudentBadge`: legacy-named earned badge row for any user. Unique on `(userId, definitionId)`, supports `AUTO` and `MANUAL`, optional `awardedById`, and optional staff note.
- `BadgeStreak`: per-user streak state. Unique on `(userId, streakType)` and deduped by `lastSourceKey`. `SCAN_SUCCESS_COUNT` is the durable scan success counter; `SCAN_CLEAN` is the clean-scan streak that resets on failed scans.
- `Booking.completedAt`: durable checkout completion timestamp. On-time badge counts use this field with a legacy `updatedAt` fallback for pre-field rows, so later booking edits do not change return eligibility.
- `SystemConfig["badges.peerVisible"]`: default `true`; controls peer visibility for another user's badge tab.
- Badge evaluator transactions run with Serializable isolation and retry once on Prisma write conflicts so duplicate source-key retries re-read streak state before mutating.

## UI Direction
- Primary user experience is a `Badges` tab on `/users/{id}` for students, staff, and admins. `/profile` already redirects to user detail.
- No top-level nav item.
- No badge count, chip row, or recognition chrome in the profile hero.
- The badge tab uses shadcn primitives as a flat, medallion-first trophy shelf: one summary band (completion percent, progress bar, earned/remaining/hidden counts), then five always-visible shelf sections — no drill-in level. Each badge lives on exactly one shelf.
- Shelves group badges into Gear Flow, Reliability, Scans, Teamwork, and Staff Picks (manual/milestone recognition wins over thematic key hints). Each shelf shows a compact header with icon, description, and earned/total tabular count over a responsive grid of tiles.
- Badge tiles lead with the artifact medallion (locked = grayscale, rarity = rim tone) over the name and one quiet meta line (earned date, progress x/y, requirement, or unlock hint); status/rarity/manual chips live only in the detail dialog. Recent awards keep the one-week glow and a New chip.
- iOS mirrors the same vocabulary: shaped SwiftUI medallions (coin/hex/shield/stack silhouettes matching the web SVG paths), the same five collection sections in the gallery sheet, compact medallion-first tiles, and a horizontal earned-badge shelf on the profile card.
- A few surprise badges stay hidden from the locked grid until earned; the available section shows how many surprise badges remain hidden.
- The badge profile API loads active definitions plus historical earned inactive definitions in one Prisma call that includes the user's award row.
- The badge profile API adds progress only when it can derive it from real counters or streak state. Manual and unsupported rule badges remain rule-based with no fake progress bar.
- With `BADGES_ENABLED` off, badge APIs return disabled/empty payloads before any badge table query. This keeps un-migrated local or preview databases from failing on badge UI routes.
- `/reports/badges` is staff analytics only and follows existing report layout patterns. It shows aggregate award metrics, manual award rate, user leaderboard, badge distribution, underused active definitions, recent manual recognition, and recent awards.
- Manual awards launch from the existing user admin actions menu, not from permanent hero chrome.
- Manual award selection shows staff guidance for fun/manual badges so admins award them consistently. Admins can also create a custom badge from the same dialog, award it immediately, and reuse that custom definition from the existing badge selector for later users.
- Award notifications are persistent inbox entries that link to `/users/{userId}?tab=badges`.
- Manual awards are admin-only through the existing user admin actions menu. They can target any active user, persist `source=MANUAL`, `awardedById`, and an optional note, and create a persistent inbox notification unless `User.notificationPrefs.badges === false`.

## Starting Badge Set
- Checkout: `first_checkout`, `checkout_5`, `checkout_25`, `checkout_100`
- On-time return: `on_time_1`, `on_time_10`, `on_time_50`
- Scan: `first_scan`, `scan_25`, `scan_100`, `zero_errors`
- Trade: `first_trade`, `trade_10`
- Streak: `streak_on_time_5`, `streak_on_time_10`
- Fun/manual: `perfect_handoff`, `clean_loop`, `clutch_cover`, `full_kit_no_misses`, `semester_streak`, `category_collector`, `event_hero`, `rookie_run`, `reliable_regular`, `above_and_beyond`

## Acceptance Criteria
- [x] `BADGES_ENABLED=false` causes zero evaluator work, badge queries, and side effects.
- [x] Kiosk checkout completion awards checkout count badges exactly once per booking.
- [x] Kiosk pickup confirmation awards checkout count badges exactly once for reservations moving into active checkout.
- [x] Checkout return badges award exactly once when a checkout transitions to `COMPLETED`.
- [x] On-time computation uses `Booking.completedAt` plus a 15-minute UTC grace window after `booking.endsAt`.
- [x] Kiosk scan successes count toward scan badges and retries do not double-bump streaks.
- [x] Kiosk scan failures reset the clean-scan streak state.
- [x] Legacy app scan stub remains 403 and awards nothing.
- [x] Trade badges award once per completed trade status flip.
- [x] Shift badges do not award from request approval.
- [x] Manual awards persist staff attribution, optional notes, and profile-linked inbox notifications that respect badge notification prefs.
- [x] Admins can create a custom manual badge during award, save it to the active catalog, and reuse it for later staff or student awards.
- [x] User profile badge grid uses shadcn primitives and does not crowd the hero.
- [x] User profile badge cards expose manual notes, recent-award state, rarity-aware medallions, surprise-badge count, and real progress where supported.
- [x] Peer visibility respects `SystemConfig["badges.peerVisible"]`.
- [x] `/reports/badges` follows existing report layout patterns.

## Rollout
1. Slice 1 ships schema, seed, service skeleton, feature flag, and docs with the flag off.
2. Later slices wire one domain event family at a time and add focused tests.
3. Preview verification flips `BADGES_ENABLED=true`, exercises kiosk/trade/manual flows, then flips it back off to prove rollback.
4. Production enablement happens only after preview verification.

## Change Log
| Date | Change |
|---|---|
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
