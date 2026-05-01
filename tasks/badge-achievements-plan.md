# Student Badge Achievements — Redesign Plan (v2)

Created: 2026-04-27
Revised: 2026-04-30
Status: Planning (not started)

---

## Background

### What happened
PR #123 implemented a full badge system (42 badges, evaluation engine, streak tracking,
staff dashboard, profile integration). Merged to main and reverted because:

1. **Too many touchpoints in one slice** — badge hooks were injected into 6+ existing
   route handlers. Created merge conflicts when main refactored those routes to use
   the `withAuth` wrapper.
2. **Cron conflict** — `*/15 * * * *` evaluation cron exceeds Vercel Hobby's daily-only limit.
3. **Tight coupling** — badge logic was directly imported and called inside booking/scan/shift
   handlers. Any change to those handlers required awareness of badge side-effects.

The original code is not recoverable from git history.

---

## Design Principles (informed by failure)

1. **Decouple from host routes via a single service entry point** — host routes call
   one well-named function (`badges.onBookingCompleted(...)`) per relevant event.
   No badge logic, no state, no rules in the route handlers.
2. **No hidden async on serverless** — `await` the service inline. Each call is a few
   indexed Prisma queries; finishes in tens of ms. If we ever need to extend it, switch
   to Vercel `after()` from `next/server` (the platform-supported post-response primitive).
   Do **not** use a Node `EventEmitter` — it does not survive function termination on
   Vercel and listener registration is not deterministic across cold starts.
3. **Thin slices with independent value** — each slice mergeable and testable on its own.
   No slice touches more than 2–3 existing files.
4. **No sub-daily cron dependency** — evaluate inline. Vercel Hobby allows daily crons only.
5. **Progressive complexity** — ship 20 simple count-based badges first; streaks and
   special rules in later slices.
6. **Behind a feature flag from day one** — `BADGES_ENABLED` env var. The service short-circuits
   when off, so we can ship slices and dark-launch with no UI risk.
7. **Doc sync from slice 1** — `docs/AREA_BADGES.md` lands in the same commit as the
   schema migration. CLAUDE.md rule #12 is non-negotiable.

---

## Architecture: Direct Service Calls (no event bus)

```
Route handler (e.g. complete-checkin)
  → does its work (booking update, audit log, etc.)
  → await badges.onBookingCompleted({ userId, bookingId, wasOnTime, wasOverdue })
  → returns response
```

The service handles its own errors and never throws back to the caller. A wrapper
catches and logs internal failures so a badge bug never breaks a checkout:

```ts
// src/lib/badges/index.ts
export const badges = {
  onBookingCompleted: safeCall(_onBookingCompleted),
  onCheckoutCompleted: safeCall(_onCheckoutCompleted),
  onScanResult:        safeCall(_onScanResult),
  onShiftApproved:     safeCall(_onShiftApproved),
  onTradeCompleted:    safeCall(_onTradeCompleted),
};

function safeCall<F extends (...a: any[]) => Promise<void>>(fn: F): F {
  return (async (...args) => {
    if (process.env.BADGES_ENABLED !== "true") return;
    try { await fn(...args); }
    catch (e) { logger.error("badges.evaluator", { fn: fn.name, err: e }); }
  }) as F;
}
```

**Why not EventEmitter / queues / cron?** EventEmitter doesn't survive Vercel's stateless
function model. A queue (Inngest / BullMQ) is correct at scale but overkill for a 4-user
team — and the upgrade path stays trivial: replace `await badges.x(...)` with
`await inngest.send(...)` if we ever need durability or retries. The interface signatures
do not change.

### Service entry points

| Function | Source Route | Payload |
|---|---|---|
| `onBookingCompleted` | complete-checkin | `{ userId, bookingId, wasOnTime, wasOverdue }` |
| `onCheckoutCompleted` | complete-checkout | `{ userId, bookingId }` |
| `onScanResult` | scan | `{ userId, checkoutId, ok, errorType? }` |
| `onShiftApproved` | shift-assignments/approve | `{ userId, shiftId, area }` |
| `onTradeCompleted` | shift-trades/{approve,claim} | `{ userId, tradeId }` |

Each is one `await badges.xxx({...})` line in the host route.

---

## Schema

```prisma
model BadgeDefinition {
  id          String   @id @default(cuid())
  key         String   @unique           // machine key, e.g. "first_checkout"
  name        String                     // display name
  description String
  icon        String                     // emoji or lucide icon name
  category    BadgeCategory              // enum, see below
  kind        BadgeKind                  // count | streak | rule
  trigger     String                     // service entry consumed (e.g. "booking:completed")
  threshold   Int?                       // for kind=count or kind=streak
  ruleKey     String?                    // for kind=rule (maps to evaluator function)
  active      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  awards      StudentBadge[]
  @@map("badge_definitions")
}

enum BadgeCategory { CHECKOUT ON_TIME SCAN SHIFT TRADE STREAK MILESTONE }
enum BadgeKind     { COUNT STREAK RULE }
enum BadgeSource   { AUTO MANUAL }

model StudentBadge {
  id            String          @id @default(cuid())
  userId        String          @map("user_id")
  definitionId  String          @map("definition_id")
  awardedAt     DateTime        @default(now()) @map("awarded_at")
  source        BadgeSource     @default(AUTO)
  awardedById   String?         @map("awarded_by_id")  // nullable; set for MANUAL
  user          User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  definition    BadgeDefinition @relation(fields: [definitionId], references: [id], onDelete: Restrict)
  awardedBy     User?           @relation("BadgeAwardedBy", fields: [awardedById], references: [id], onDelete: SetNull)
  @@unique([userId, definitionId])
  @@index([userId])
  @@index([awardedAt])  // for "recent awards" feed
  @@map("student_badges")
}

model BadgeStreak {
  id          String    @id @default(cuid())
  userId      String    @map("user_id")
  streakType  String    @map("streak_type")    // "on_time_return" | "shift_attendance" | ...
  current     Int       @default(0)
  longest     Int       @default(0)
  lastEventAt DateTime? @map("last_event_at")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, streakType])
  @@index([userId])
  @@map("badge_streaks")
}
```

### Decisions baked into the schema

- `onDelete: Restrict` on the definition relation — deleting a badge definition is
  not allowed while awards exist. Use `active = false` to retire a badge without
  destroying user history.
- `kind` discriminator + nullable `threshold` and `ruleKey` — count/streak badges use
  `threshold`, rule badges (`zero_errors`) point at a named evaluator. No magic strings.
- `source` + `awardedById` shipped on day one — manual awards are a Slice 5 follow-up,
  not a future migration.
- `awardedAt` indexed for the staff "recent awards" feed.
- `category` is a Prisma enum — typos won't fragment UI grouping.

### User model additions
```prisma
model User {
  // ... existing fields ...
  badges            StudentBadge[]
  badgesAwardedByMe StudentBadge[] @relation("BadgeAwardedBy")
  badgeStreaks      BadgeStreak[]
}
```

---

## Idempotency, concurrency, backfill

### Awarding is upsert-style
`awardBadge(userId, definitionId)` uses `prisma.studentBadge.upsert` keyed on
`(userId, definitionId)`. P2002 on the unique constraint is treated as a no-op,
not an error. Two parallel checkouts both crossing the same threshold cannot
create duplicate rows.

### Threshold counting under concurrency
Counts are derived from existing tables (`Checkout`, `ShiftAssignment`, etc.) at
evaluation time, not from a counter we maintain. The unique constraint prevents
duplicate awards even when two evaluators race past the threshold simultaneously.
We accept the rare double-evaluation cost; we don't pay for serializable transactions.

### Streak math (explicit state machine)
On `onBookingCompleted`:
- `wasOnTime === true`  → `streak.current++; streak.longest = max(longest, current); lastEventAt = now`
- `wasOverdue === true` → `streak.current = 0; lastEventAt = now`
- neither flag → no streak change

On `onShiftApproved` (with `area` indicating completed):
- increment `shift_attendance` streak; reset on `shift:no_show` if/when that signal exists.

Streaks are recomputed inside a Prisma transaction with the badge award lookup so
the streak state and the badge row commit together.

### Replay safety
Each entry point dedupes by checking the source row's terminal state — e.g. a
booking marked `COMPLETED_RETURNED` only generates badge work the first time it
transitions. The route handler passes a flag (`firstTransition: boolean`) the
service trusts. The handler already has this fact; no new state needed.

### Backfill decision (recorded in DECISIONS.md)
**No retroactive backfill.** Badges count from launch only. Documented explicitly
so users with prior history aren't confused by missing "First Checkout." A one-shot
backfill script can be a future opt-in; not blocking launch.

---

## Badge Definitions (Starting Set — 20 badges)

### Checkout (kind: COUNT, trigger: booking:completed)
| Key | Name | Threshold | Description |
|---|---|---|---|
| first_checkout | First Checkout | 1 | Complete your first gear checkout |
| checkout_5 | Gear Regular | 5 | Complete 5 checkouts |
| checkout_25 | Gear Veteran | 25 | Complete 25 checkouts |
| checkout_100 | Gear Master | 100 | Complete 100 checkouts |

### On-Time Return (kind: COUNT, trigger: booking:completed, filter: wasOnTime)
| Key | Name | Threshold | Description |
|---|---|---|---|
| on_time_1 | Punctual | 1 | Return gear on time |
| on_time_10 | Reliable | 10 | Return gear on time 10 times |
| on_time_50 | Clockwork | 50 | Return gear on time 50 times |

### Scan (kind: COUNT, trigger: scan:success)
| Key | Name | Threshold | Description |
|---|---|---|---|
| first_scan | Scanner | 1 | Complete your first QR scan |
| scan_25 | Scan Pro | 25 | Complete 25 successful scans |
| scan_100 | Scan Master | 100 | Complete 100 successful scans |

### Scan (kind: RULE, ruleKey: zero_errors)
| Key | Name | Description |
|---|---|---|
| zero_errors | Clean Scanner | 10 consecutive scans with no errors |

### Shift (kind: COUNT, trigger: shift:approved)
| Key | Name | Threshold | Description |
|---|---|---|---|
| first_shift | On Duty | 1 | Complete your first shift |
| shift_10 | Shift Regular | 10 | Complete 10 shifts |
| shift_50 | Shift Veteran | 50 | Complete 50 shifts |

### Trade (kind: COUNT, trigger: trade:completed)
| Key | Name | Threshold | Description |
|---|---|---|---|
| first_trade | Team Player | 1 | Complete your first shift trade |
| trade_10 | Trade Expert | 10 | Complete 10 shift trades |

### Streak (kind: STREAK)
| Key | Name | Threshold | Description |
|---|---|---|---|
| streak_on_time_5 | On a Roll | 5 | Return gear on time 5 times in a row |
| streak_on_time_10 | Locked In | 10 | Return gear on time 10 times in a row |
| streak_shifts_5 | Showing Up | 5 | Complete 5 shifts in a row |
| streak_shifts_10 | Iron Schedule | 10 | Complete 10 shifts in a row |

(Streak names changed from v1 to avoid colliding with count-based "Reliable.")

---

## Slices

### Slice 1 — Schema + service skeleton + flag + AREA doc
**Files touched**: prisma/schema.prisma (+ migration), new `src/lib/badges/*`,
new `prisma/seed-badges.ts`, new `docs/AREA_BADGES.md`.
**Existing files changed**: 0 (besides schema).

Deliverables:
- [ ] Prisma migration: `BadgeDefinition`, `StudentBadge`, `BadgeStreak`, three enums
- [ ] `src/lib/badges/index.ts` — public service (5 entry points), all wrapped in `safeCall`
- [ ] `src/lib/badges/evaluator.ts` — count/streak/rule evaluators (private)
- [ ] `src/lib/badges/queries.ts` — typed query helpers (`countCompletedBookings`, etc.)
- [ ] Feature flag `BADGES_ENABLED` (env), defaults off; documented in `.env.example`
- [ ] `prisma/seed-badges.ts` populates the 20 starter definitions; idempotent (upsert by `key`)
- [ ] Unit tests: given N completions and current streak X, expected awards = ?
- [ ] `docs/AREA_BADGES.md` skeleton with ACs, scope, decisions
- [ ] `npm run build` passes

### Slice 2 — Wire host routes (count + on-time + scan)
**Files touched**: 4 existing route files, 1 line each.
**Existing files changed**: 4.

Deliverables:
- [ ] `complete-checkin/route.ts`: `await badges.onBookingCompleted({...})`
- [ ] `complete-checkout/route.ts`: `await badges.onCheckoutCompleted({...})`
- [ ] `scan/route.ts`: `await badges.onScanResult({ ok: true | false, ... })`
- [ ] Integration test: completing a checkin awards `first_checkout` and (if applicable) `on_time_1`
- [ ] Performance check: p95 added latency under 100ms (logged via existing metrics)
- [ ] Update `AREA_BADGES.md` change log

### Slice 3 — Wire shift + trade routes
**Files touched**: 3 existing route files, 1 line each.

Deliverables:
- [ ] `shift-assignments/[id]/approve/route.ts`: `await badges.onShiftApproved({...})`
- [ ] `shift-trades/[id]/approve/route.ts`: `await badges.onTradeCompleted({...})`
- [ ] `shift-trades/[id]/claim/route.ts`: `await badges.onTradeCompleted({...})`
- [ ] Integration tests for each
- [ ] Update `AREA_BADGES.md`

### Slice 4 — API + Profile UI
**Scope**: Read-only display. Flag still off by default.

Deliverables:
- [ ] `GET /api/badges` — list active definitions (sorted by `sortOrder`, then `name`)
- [ ] `GET /api/badges/user/[userId]` — earned badges + summary stats
- [ ] Profile page: shadcn-based badge grid with empty state
- [ ] Visibility decision recorded: **profile badges are visible to all signed-in users**
  (consistent with existing requester-name visibility memory)
- [ ] N+1 check: profile load runs ≤ 2 queries (definitions cached, awards by userId)
- [ ] Update `AREA_BADGES.md`

### Slice 5 — Staff dashboard + manual awards + notifications + streaks
**Scope**: Staff features and the streak/rule evaluators.

Deliverables:
- [ ] `/reports/badges` page:
  - Leaderboard query: single `GROUP BY user_id` over `student_badges`, `LIMIT 50`
  - Recent awards feed (uses `awardedAt` index)
  - Distribution chart (count per definition)
- [ ] Manual award: `POST /api/badges/award` (admin only) → writes `source: MANUAL, awardedById`
- [ ] User detail page: "Award badge" action surfacing the manual flow
- [ ] In-app notification on award (uses existing notifications service; no APNs scope this slice)
- [ ] Streak evaluators (`streak_on_time_*`, `streak_shifts_*`)
- [ ] Rule evaluator: `zero_errors` (10 consecutive scan successes)
- [ ] Update `AREA_BADGES.md` and `docs/AREA_NOTIFICATIONS.md` cross-reference

### Slice 6 — Telemetry, hardening, GA
**Scope**: Observability and the flag flip.

Deliverables:
- [ ] Counter: `badges.awarded` (per badge key, per day)
- [ ] Histogram: `badges.evaluator.latency_ms` (per entry point)
- [ ] Counter: `badges.evaluator.error` (per entry point)
- [ ] Verify each entry point added ≤ 100ms p95 in production logs
- [ ] Edge cases:
  - Same badge awarded twice → upsert no-op (test)
  - Deactivated user keeps badges (no cleanup) (test)
  - Definition `active=false` is hidden from UI but historical awards still display
- [ ] Decision in `docs/DECISIONS.md`: no retroactive backfill at launch
- [ ] Set `BADGES_ENABLED=true` in Vercel for production
- [ ] Update `docs/GAPS_AND_RISKS.md` (closes the gamification gap)
- [ ] Move this plan to `tasks/archive/`

---

## Files Map

### New
```
src/lib/badges/index.ts                     — Service entry points + safeCall + flag
src/lib/badges/evaluator.ts                 — count / streak / rule evaluators
src/lib/badges/queries.ts                   — Prisma helpers
src/lib/badges/types.ts                     — Payload types
src/app/api/badges/route.ts                 — GET definitions
src/app/api/badges/user/[userId]/route.ts   — GET user awards + stats
src/app/api/badges/award/route.ts           — POST manual award (admin)
src/app/(app)/reports/badges/page.tsx       — Staff dashboard
prisma/migrations/XXXX_add_badges/          — Migration
prisma/seed-badges.ts                       — Idempotent seed
docs/AREA_BADGES.md                         — Area doc (slice 1)
```

### Modified (minimal)
```
prisma/schema.prisma                                          — 3 models + 3 enums + User relations
src/app/api/checkouts/[id]/complete-checkin/route.ts          — +1 line
src/app/api/checkouts/[id]/complete-checkout/route.ts         — +1 line
src/app/api/checkouts/[id]/scan/route.ts                      — +1 line
src/app/api/shift-assignments/[id]/approve/route.ts           — +1 line
src/app/api/shift-trades/[id]/approve/route.ts                — +1 line
src/app/api/shift-trades/[id]/claim/route.ts                  — +1 line
src/app/(app)/profile/page.tsx                                — Badge grid section
src/app/(app)/users/[id]/page.tsx                             — "Award badge" admin action (slice 5)
src/app/(app)/reports/layout.tsx                              — Add Badges tab
.env.example                                                  — `BADGES_ENABLED`
docs/DECISIONS.md                                             — No retroactive backfill
docs/GAPS_AND_RISKS.md                                        — Close gamification gap
```

---

## Key Differences from First Attempt

| Aspect | First Attempt | This Plan |
|---|---|---|
| Coupling | Direct calls in 6+ routes | One `await badges.xxx(...)` per route, all logic behind a typed service |
| Async model | n/a (direct) | Inline `await` (serverless-safe); `after()` available if ever needed |
| Slice size | 42 badges + hooks + UI in one go | 6 slices, dark-launchable |
| Badge count | 42 | 20 to start |
| Cron | `*/15` (Hobby-incompatible) | None |
| Definition delete | Cascade (destroyed history) | Restrict + soft `active=false` |
| Manual awards | Future migration | Schema supports day one |
| Backfill | Implicit | Explicit "no backfill" decision |
| Concurrency | Implicit | Documented: upsert + unique key |
| Streak rules | Implicit | Explicit state machine |
| Doc sync | Slice 6 | Slice 1, every slice updates AREA doc |
| Rollout | Big-bang | `BADGES_ENABLED` flag |
| Telemetry | None | Counters + latency histogram in Slice 6 |

---

## Open Questions

1. **Should staff manage badge definitions via UI?** Schema supports it. Not in scope —
   defer to a future slice once the team wants custom badges.
2. **APNs push for badge awards?** In-app only this round. APNs is wired (memory) but
   adds noise; revisit after a month of usage data.
3. **Are badges visible to other students?** Slice 4 records the decision: yes, all signed-in
   users can see another user's badge grid. Reverse easily by gating in the API.

---

## Verification Checklist (per slice)

- [ ] `npm run build` passes
- [ ] Existing tests pass; new tests added at the slice boundary
- [ ] Schema-touching slice: `prisma validate` + `prisma migrate dev` clean
- [ ] Each route addition is exactly one line
- [ ] Evaluator throws are caught — checkout/scan/shift never fails because of badges
- [ ] No sub-daily cron added
- [ ] AREA_BADGES.md change log updated this slice
- [ ] `BADGES_ENABLED=false` path: zero queries, zero side-effects
