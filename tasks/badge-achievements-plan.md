# Student Badge Achievements — Redesign Plan

Created: 2026-04-27
Status: Planning (not started)

---

## Background

### What happened
PR #123 implemented a full badge system (42 badges, evaluation engine, streak tracking,
staff dashboard, profile integration). It was merged to main and then reverted because:

1. **Too many touchpoints in one slice** — badge hooks were injected into 6+ existing
   route handlers (complete-checkin, complete-checkout, scan, shift approve, shift-trade
   approve, shift-trade claim). This created merge conflicts when main refactored those
   routes to use the `withAuth` wrapper pattern.
2. **Cron conflict** — badge evaluation used a `*/15 * * * *` cron, which exceeds the
   Vercel Hobby plan limit (daily crons only).
3. **Tight coupling** — badge logic was directly imported and called inside booking/scan/shift
   handlers. Any change to those handlers required awareness of badge side-effects.

### What was built (no longer in codebase)
- **Schema**: BadgeDefinition, StudentBadge, BadgeStreak models
- **Engine**: 40 rules across 10 trigger types
- **Hooks**: evaluateBadges, handleOnTimeReturn, handleOverdueReturn, handleShiftCompleted,
  handleSuccessfulScan, handleFailedScan
- **UI**: Badge grid on profile, staff dashboard (leaderboard + accountability feed),
  /reports/badges tab
- **Notifications**: In-app alerts when badges earned

The original code is not recoverable from git history.

---

## Design Principles (informed by failure)

1. **Decouple from host routes** — badge evaluation must not be injected directly into
   checkout/scan/shift handlers. Use an event-based pattern: host routes emit events,
   badge service subscribes.
2. **Thin slices with independent value** — each slice must be mergeable and testable
   on its own. No slice should touch more than 2-3 existing files.
3. **No cron dependency** — evaluate badges inline when the triggering action happens.
   Vercel Hobby only allows daily crons; badge evaluation needs to be real-time anyway
   for good UX (earn a badge, see it immediately).
4. **Progressive complexity** — start with simple count-based badges, add streaks later.
   Don't ship 42 badges on day one.

---

## Architecture: Event Emitter Pattern

Instead of calling badge functions directly in route handlers, create a lightweight
application event bus.

```
Route handler (e.g. complete-checkin)
  → does its work (booking update, audit log, etc.)
  → emits: appEvents.emit('booking:completed', { userId, bookingId, wasOnTime, ... })
  → returns response (does NOT await badge evaluation)

Badge subscriber (registered at app startup)
  → listens: appEvents.on('booking:completed', async (data) => { ... })
  → evaluates relevant badge rules
  → awards badges if earned
  → creates notifications for new badges
```

**Implementation**: Simple Node.js `EventEmitter` singleton in `src/lib/events.ts`.
No external dependencies. Fire-and-forget — handler errors are caught and logged,
never propagated to the caller.

**Why not a queue/job system?** Overkill for this scale. A simple in-process EventEmitter
is sufficient for a 4-user team. If the app scales, upgrade to a proper job queue
(BullMQ, Inngest) later. The subscriber interface stays the same.

### Events to emit (from existing routes)

| Event | Source Route | Payload |
|-------|-------------|---------|
| `booking:completed` | complete-checkin | userId, bookingId, wasOnTime, wasOverdue |
| `checkout:completed` | complete-checkout | userId, bookingId |
| `scan:success` | scan | userId, checkoutId |
| `scan:failure` | scan | userId, checkoutId, errorType |
| `shift:approved` | shift-assignments/approve | userId, shiftId |
| `shift:completed` | shift-assignments/approve | userId, shiftId, area |
| `trade:completed` | shift-trades/approve, claim | userId, tradeId |

Each event emission is a single line added to the existing route — minimal touchpoint.

---

## Schema

```prisma
model BadgeDefinition {
  id          String   @id @default(cuid())
  key         String   @unique       // machine key, e.g. "first_checkout"
  name        String                 // display name, e.g. "First Checkout"
  description String                 // "Complete your first gear checkout"
  icon        String                 // emoji or lucide icon name
  category    String                 // "checkout", "scan", "shift", "streak", "milestone"
  trigger     String                 // event name this badge listens for
  threshold   Int      @default(1)   // count needed to earn (e.g. 10 for "10 checkouts")
  active      Boolean  @default(true)
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  awards      StudentBadge[]
  @@map("badge_definitions")
}

model StudentBadge {
  id           String          @id @default(cuid())
  userId       String          @map("user_id")
  definitionId String          @map("definition_id")
  awardedAt    DateTime        @default(now()) @map("awarded_at")
  user         User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  definition   BadgeDefinition @relation(fields: [definitionId], references: [id], onDelete: Cascade)
  @@unique([userId, definitionId])
  @@index([userId])
  @@map("student_badges")
}

model BadgeStreak {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  streakType  String   @map("streak_type")  // "on_time_return", "shift_attendance", etc.
  current     Int      @default(0)
  longest     Int      @default(0)
  lastEventAt DateTime? @map("last_event_at")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, streakType])
  @@index([userId])
  @@map("badge_streaks")
}
```

User model additions:
```prisma
model User {
  // ... existing fields ...
  badges       StudentBadge[]
  badgeStreaks  BadgeStreak[]
}
```

---

## Badge Definitions (Starting Set — 20 badges)

Start with 20 badges instead of 42. Ship simple count-based badges first;
add streak-based and complex badges in later slices.

### Checkout Badges (trigger: booking:completed)
| Key | Name | Threshold | Description |
|-----|------|-----------|-------------|
| first_checkout | First Checkout | 1 | Complete your first gear checkout |
| checkout_5 | Gear Regular | 5 | Complete 5 checkouts |
| checkout_25 | Gear Veteran | 25 | Complete 25 checkouts |
| checkout_100 | Gear Master | 100 | Complete 100 checkouts |

### On-Time Return Badges (trigger: booking:completed, wasOnTime=true)
| Key | Name | Threshold | Description |
|-----|------|-----------|-------------|
| on_time_1 | Punctual | 1 | Return gear on time |
| on_time_10 | Reliable | 10 | Return gear on time 10 times |
| on_time_50 | Clockwork | 50 | Return gear on time 50 times |

### Scan Badges (trigger: scan:success)
| Key | Name | Threshold | Description |
|-----|------|-----------|-------------|
| first_scan | Scanner | 1 | Complete your first QR scan |
| scan_25 | Scan Pro | 25 | Complete 25 successful scans |
| scan_100 | Scan Master | 100 | Complete 100 successful scans |
| zero_errors | Clean Scanner | special | 10 consecutive scans with no errors |

### Shift Badges (trigger: shift:approved / shift:completed)
| Key | Name | Threshold | Description |
|-----|------|-----------|-------------|
| first_shift | On Duty | 1 | Complete your first shift |
| shift_10 | Shift Regular | 10 | Complete 10 shifts |
| shift_50 | Shift Veteran | 50 | Complete 50 shifts |

### Trade Badges (trigger: trade:completed)
| Key | Name | Threshold | Description |
|-----|------|-----------|-------------|
| first_trade | Team Player | 1 | Complete your first shift trade |
| trade_10 | Trade Expert | 10 | Complete 10 shift trades |

### Streak Badges (evaluated from BadgeStreak records)
| Key | Name | Condition | Description |
|-----|------|-----------|-------------|
| streak_on_time_5 | Streak: Reliable | 5 consecutive on-time returns | Return gear on time 5 times in a row |
| streak_on_time_10 | Streak: Dependable | 10 consecutive on-time returns | Return gear on time 10 times in a row |
| streak_shifts_5 | Streak: Committed | 5 consecutive shifts completed | Complete 5 shifts in a row |
| streak_shifts_10 | Streak: Dedicated | 10 consecutive shifts completed | Complete 10 shifts in a row |

---

## Slices

### Slice 1: Schema + Event Bus + Seed Data
**Scope**: Database models, event emitter, badge definition seed
**Files touched**: prisma/schema.prisma, new prisma migration, new src/lib/events.ts,
new src/lib/badges.ts (service layer only), new prisma/seed-badges.ts
**Existing files changed**: 0

Deliverables:
- [ ] Prisma migration with BadgeDefinition, StudentBadge, BadgeStreak
- [ ] `src/lib/events.ts` — singleton EventEmitter with typed events
- [ ] `src/lib/badges.ts` — service: evaluateForEvent(event, payload), awardBadge(), getUserBadges()
- [ ] Seed script to populate 20 badge definitions
- [ ] Unit tests for evaluation logic (given N completions, should badge X be awarded?)
- [ ] `prisma validate` + `npm run build` pass

### Slice 2: Event Emissions (wire existing routes)
**Scope**: Add event emissions to existing route handlers
**Files touched**: 6 existing route files (1 line each)
**Existing files changed**: 6 (minimal diff per file)

Deliverables:
- [ ] complete-checkin/route.ts: emit `booking:completed`
- [ ] complete-checkout/route.ts: emit `checkout:completed`
- [ ] scan/route.ts: emit `scan:success` / `scan:failure`
- [ ] shift-assignments/approve/route.ts: emit `shift:approved`
- [ ] shift-trades/approve/route.ts: emit `trade:completed`
- [ ] shift-trades/claim/route.ts: emit `trade:completed`
- [ ] Register badge subscriber in app initialization
- [ ] Integration test: emit event → badge awarded

### Slice 3: API + Profile UI
**Scope**: Badge display on profile page
**Files touched**: new src/app/api/badges/ routes, edit profile page
**Existing files changed**: 1 (profile page)

Deliverables:
- [ ] `GET /api/badges` — list all badge definitions
- [ ] `GET /api/badges/user/[userId]` — user's earned badges + stats
- [ ] Profile page: badge grid section showing earned badges with icons
- [ ] Profile page: simple stats (total earned, most recent, longest streak)
- [ ] Empty state for users with no badges

### Slice 4: Staff Dashboard
**Scope**: Staff-facing badge overview page
**Files touched**: new pages only
**Existing files changed**: 1 (reports layout to add tab)

Deliverables:
- [ ] `/reports/badges` page with:
  - Leaderboard (top students by badge count)
  - Recent awards feed (who earned what, when)
  - Badge distribution chart (which badges are most/least earned)
- [ ] Add "Badges" tab to reports layout

### Slice 5: Notifications + Streak Tracking
**Scope**: In-app notifications when badges are earned, streak logic
**Files touched**: badge service, notification service
**Existing files changed**: 1-2 (notification creation utility)

Deliverables:
- [ ] Badge award triggers in-app notification ("You earned: First Checkout!")
- [ ] Streak tracking: increment/reset streaks on relevant events
- [ ] Streak-based badge evaluation (consecutive on-time returns, consecutive shifts)
- [ ] Streak milestone notifications

### Slice 6: Hardening + Doc Sync
**Scope**: Edge cases, tests, documentation
**Files touched**: various

Deliverables:
- [ ] Handle: user earns same badge twice (unique constraint, no-op)
- [ ] Handle: badge definition deleted (CASCADE cleans up awards)
- [ ] Handle: deactivated user still keeps badges (no cleanup)
- [ ] Performance: badge evaluation is async, never blocks route response
- [ ] Create `docs/AREA_BADGES.md`
- [ ] Update `docs/GAPS_AND_RISKS.md`
- [ ] Update `tasks/todo.md`
- [ ] Archive this plan to `tasks/archive/`

---

## Files Map

### New files
```
src/lib/events.ts                          — Application event bus (EventEmitter singleton)
src/lib/badges.ts                          — Badge service (evaluate, award, query)
src/app/api/badges/route.ts                — GET all definitions
src/app/api/badges/user/[userId]/route.ts  — GET user's badges
src/app/(app)/reports/badges/page.tsx       — Staff badge dashboard
prisma/migrations/XXXX_add_badges/         — Schema migration
prisma/seed-badges.ts                      — Badge definition seed data
docs/AREA_BADGES.md                        — Area documentation
```

### Modified files (minimal changes)
```
prisma/schema.prisma                                    — Add 3 models + User relations
src/app/api/checkouts/[id]/complete-checkin/route.ts    — +1 line: emit event
src/app/api/checkouts/[id]/complete-checkout/route.ts   — +1 line: emit event
src/app/api/checkouts/[id]/scan/route.ts                — +2 lines: emit success/failure
src/app/api/shift-assignments/[id]/approve/route.ts     — +1 line: emit event
src/app/api/shift-trades/[id]/approve/route.ts          — +1 line: emit event
src/app/api/shift-trades/[id]/claim/route.ts            — +1 line: emit event
src/app/(app)/profile/page.tsx                          — Add badge grid section
src/app/(app)/reports/layout.tsx                        — Add Badges tab
```

---

## Key Differences from First Attempt

| Aspect | First Attempt | This Plan |
|--------|--------------|-----------|
| Coupling | Direct function calls in 6+ routes | Event emitter — 1 line per route |
| Slice size | All 42 badges + hooks + UI in one go | 6 slices, independently testable |
| Badge count | 42 badges | 20 to start, expand later |
| Cron dependency | */15 cron for evaluation | Inline evaluation, no cron |
| Merge risk | Touched route handler internals | Only adds event emission lines |
| Streak tracking | Shipped with everything else | Separate slice (5) |

---

## Open Questions

1. **Should badge definitions live in the database or in code?** This plan uses the
   database (BadgeDefinition model) so staff can eventually manage badges via UI.
   Alternative: define badges in a TypeScript config file (simpler, no migration for
   new badges, but no admin UI). Recommendation: database — it's already designed,
   and the admin UI can come later.

2. **Should there be a "badge categories" page in settings?** Deferred. The starting
   set of 20 badges doesn't need admin management. Add a `/settings/badges` page when
   the team wants to create custom badges.

3. **Manual badge awards?** The phase-c-roadmap describes a simple manual-award flow
   (admin picks a user, picks a badge, awards it). This plan focuses on auto-evaluated
   badges. Manual awards can be added as a small follow-up slice (POST endpoint +
   award button on user detail page).

---

## Verification Checklist (before marking complete)

- [ ] `npm run build` passes
- [ ] All existing tests pass
- [ ] New badge evaluation tests pass
- [ ] Badge evaluation is fire-and-forget (never blocks route response)
- [ ] Emitting an event in a route adds exactly 1 line of code
- [ ] Profile page shows badges correctly for users with 0, 1, and many badges
- [ ] Staff dashboard loads without N+1 queries
- [ ] No Vercel Hobby cron issues (no sub-daily cron added)
- [ ] AREA_BADGES.md documents all ACs
- [ ] GAPS_AND_RISKS.md updated
