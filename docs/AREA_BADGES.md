# AREA: Student Badge Achievements

## Document Control
- Area: Badges
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-05-09
- Last Updated: 2026-05-09
- Status: Active planning, Slice 1 shipped with feature flag off
- Plan: `tasks/badge-achievements-plan.md`
- Decision Refs: D-034

## Direction
Badges are lightweight student recognition inside the existing ops app. They are earned from real domain outcomes, not from route visits, timers, or cron jobs.

## Core Rules
1. `BADGES_ENABLED !== "true"` returns before any badge evaluator work, database query, or side effect.
2. Badge events attach to service-level outcomes: kiosk checkout/pickup open, checkout return completion, kiosk scan result, trade completion, and future shift attendance completion.
3. Legacy app checkout scan stubs remain non-events. They stay kiosk-gated 403 routes and award nothing.
4. Badge definitions are seeded by immutable `key`. Typos are fixed by retiring a definition with `active=false` and creating a new key.
5. Student awards are idempotent by `(userId, definitionId)`.
6. Streak updates are idempotent by `sourceKey`; repeated handling of the same domain event is a no-op.
7. Launch has no retroactive backfill. Existing history does not award badges until events happen after enablement.
8. Deactivated users keep historical badges.

## Source-of-Truth Event Flow

| Badge event | Source of truth | Slice |
|---|---|---|
| `onCheckoutOpened` | `src/app/api/kiosk/checkout/complete/route.ts` after an `OPEN` checkout is created | 2 |
| `onCheckoutOpened` | `src/app/api/kiosk/pickup/[id]/confirm/route.ts` after `PENDING_PICKUP -> OPEN` | 2 |
| `onCheckoutReturned` | `src/lib/services/bookings-checkin.ts:markCheckoutCompleted` and `maybeAutoComplete` only when status flips into `COMPLETED` | 2 |
| `onScanResult` | `src/app/api/kiosk/checkout/scan`, `src/app/api/kiosk/pickup/[id]/scan`, `src/app/api/kiosk/checkin/[id]/scan` | 3 |
| `onTradeCompleted` | `src/lib/services/shift-trades.ts:claimTrade` immediate-complete branch and `approveTrade`, through one transition helper | 5 |
| `onShiftCompleted` | Deferred until attendance/no-show has a real completion signal | 6 |

## Data Model
- `BadgeDefinition`: seeded catalog. Uses immutable `key`, display copy, icon name, category, kind, trigger, threshold, rule key, active flag, and sort order.
- `StudentBadge`: earned badge row. Unique on `(userId, definitionId)`, supports `AUTO` and `MANUAL`, optional `awardedById`, and optional staff note.
- `BadgeStreak`: per-user streak state. Unique on `(userId, streakType)` and deduped by `lastSourceKey`.
- `SystemConfig["badges.peerVisible"]`: default `true`; controls student peer visibility for another student's badge tab.

## UI Direction
- Primary student experience is a `Badges` tab on `/users/{id}`. `/profile` already redirects to user detail.
- No top-level nav item.
- No badge count, chip row, or recognition chrome in the profile hero.
- The badge tab uses shadcn primitives and keeps earned/locked badges in a compact grid.
- `/reports/badges` is staff analytics only and follows existing report layout patterns.
- Manual awards launch from the existing user admin actions menu, not from permanent hero chrome.
- Award notifications are persistent inbox entries that link to `/users/{userId}?tab=badges`.

## Starting Badge Set
- Checkout: `first_checkout`, `checkout_5`, `checkout_25`, `checkout_100`
- On-time return: `on_time_1`, `on_time_10`, `on_time_50`
- Scan: `first_scan`, `scan_25`, `scan_100`, `zero_errors`
- Shift, deferred until attendance completion: `first_shift`, `shift_10`, `shift_50`
- Trade: `first_trade`, `trade_10`
- Streak: `streak_on_time_5`, `streak_on_time_10`, `streak_shifts_5`, `streak_shifts_10`

## Acceptance Criteria
- [ ] `BADGES_ENABLED=false` causes zero evaluator work, badge queries, and side effects.
- [ ] Kiosk checkout completion awards checkout count badges exactly once per booking.
- [ ] Kiosk pickup confirmation awards checkout count badges exactly once for reservations moving into active checkout.
- [ ] Checkout return badges award exactly once when a checkout transitions to `COMPLETED`.
- [ ] On-time computation uses a 15-minute UTC grace window after `booking.endsAt`.
- [ ] Kiosk scan successes count toward scan badges and retries do not double-bump streaks.
- [ ] Kiosk scan failures reset the clean-scan streak state.
- [ ] Legacy app scan stub remains 403 and awards nothing.
- [ ] Trade badges award once per completed trade status flip.
- [ ] Shift badges do not award from request approval.
- [ ] Student profile badge grid uses shadcn primitives and does not crowd the hero.
- [ ] Peer visibility respects `SystemConfig["badges.peerVisible"]`.
- [ ] `/reports/badges` follows existing report layout patterns.

## Rollout
1. Slice 1 ships schema, seed, service skeleton, feature flag, and docs with the flag off.
2. Later slices wire one domain event family at a time and add focused tests.
3. Preview verification flips `BADGES_ENABLED=true`, exercises kiosk/trade/manual flows, then flips it back off to prove rollback.
4. Production enablement happens only after preview verification.

## Change Log
| Date | Change |
|---|---|
| 2026-05-09 | Slice 1 shipped with schema, migration artifact, seed definitions, feature-flagged service skeleton, observability stub, and flag-off contract test. Route wiring remains deferred. |
