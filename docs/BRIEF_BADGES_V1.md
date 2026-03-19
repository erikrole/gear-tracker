# Student Badge System — Design Spec (V1)

> **Status**: Design approved, pending implementation
> **Author**: Claude + Erik
> **Date**: 2026-03-19

## Context

Wisconsin Athletics Creative students check out gear, work shifts, cover events, and return equipment daily. There's no recognition system for reliability, versatility, or commitment. A badge system creates a fun, gamified layer that rewards great behavior with swag/merch and builds friendly competition via public profiles.

**This is also an accountability tool.** Streak resets and visible stats ensure the badge system has real teeth — students who take care of gear and show up reliably are recognized; those who don't can see exactly where they stand.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Badge model | **Flat collection** — one-time unlock, no tiers | Simple to understand, no tier confusion |
| Reward type | **Swag / merch** — milestone thresholds unlock branded gear | Tangible motivation |
| Visibility | **Public profiles** — all students see each other's badges + stats | Friendly competition + peer accountability |
| Accountability | **Streak resets + visible stats** | Bad behavior has real consequences in the system |
| Secret badges | **Hidden until unlocked** | Organic discovery, water-cooler moments |

---

## Accountability System

The badge system doubles as an **accountability layer**. Two mechanisms work together:

### 1. Streak Resets (Competitive Badges)

Certain badges require sustained good behavior. Breaking the streak resets progress to zero — you have to earn it back.

| Badge | Streak Reset Trigger |
|-------|---------------------|
| Clean Slate (G-04) | Any overdue return resets consecutive on-time counter to 0 |
| Ghost (X-02) | Any overdue item during the semester disqualifies the badge |
| Perfectionist (X-01) | Any failed scan resets accuracy streak to 0 |
| Ironclad (A-01) | Any shift no-show resets consecutive attendance to 0 |
| Trusted Hands (A-02) | Any overdue return resets the qualifying window |
| Unbreakable (A-04) | Any overdue return resets consecutive counter to 0 |
| The Vault (A-06) | Any overdue item or lost item resets the academic year clock |

### 2. Visible Profile Stats

Every student profile displays accountability metrics publicly. Transparency creates social motivation.

| Stat | Calculation | Display |
|------|------------|---------|
| **Return Rate** | On-time returns / total returns × 100 | % with color (green ≥ 95%, yellow ≥ 85%, red < 85%) |
| **Shift Attendance** | Shifts completed / shifts assigned × 100 | % with color coding |
| **Items Lost** | Total bulk items not returned | Count (green = 0, red > 0) |
| **Overdue Count** | Lifetime overdue incidents | Count (green = 0, yellow = 1-2, red ≥ 3) |
| **Current Streak** | Consecutive on-time returns | "12 in a row" style display |

Staff can sort/filter by these stats when making travel crew or priority gear decisions.

---

## Badge Catalog

### Category: Accountability (6 badges)

| # | Badge Name | Trigger | Streak Reset? | Data Source |
|---|-----------|---------|---------------|-------------|
| A-01 | **Ironclad** | 20 consecutive assigned shifts with no no-shows | Yes — no-show resets to 0 | `ShiftAssignment` status |
| A-02 | **Trusted Hands** | 100% on-time return rate over 25+ checkouts | Yes — overdue resets window | `Booking` return timing |
| A-03 | **Steward** | Report 5 equipment issues during check-in | No | Check-in notes/flags |
| A-04 | **Unbreakable** | 30 consecutive on-time returns | Yes — overdue resets to 0 | `Booking` return timing |
| A-05 | **Full Accountability** | Earn Clean Slate + Ironclad + Trusted Hands | N/A — combo badge | Composite check |
| A-06 | **The Vault** | Zero overdue items AND zero items lost for an entire academic year | Yes — any overdue or loss resets the year clock | `Booking` overdue check + `BulkStockMovement` loss check over ~9 months (Sept–May) |

> **Schema requirement**: `ShiftAssignment` needs `COMPLETED` and `NO_SHOW` status values added to `ShiftAssignmentStatus` enum. Steward badge needs a damage/issue reporting mechanism added to check-in flow (could be a notes field or flag on `BookingSerializedItem`).

### Category: Gear & Checkout (9 badges)

| # | Badge Name | Trigger | Data Source |
|---|-----------|---------|-------------|
| G-01 | **First Checkout** | Complete your first gear checkout | `Booking` status = COMPLETED, count ≥ 1 |
| G-02 | **Gear Head** | Complete 50 checkouts | `Booking` COMPLETED count ≥ 50 |
| G-03 | **Century Club** | Complete 100 checkouts | `Booking` COMPLETED count ≥ 100 |
| G-04 | **Clean Slate** | 10 consecutive on-time returns | `Booking` return time vs. `endsAt` (derived overdue) |
| G-05 | **Speed Scan** | Complete a checkout scan session in under 60s | `ScanSession.completedAt - ScanSession.startedAt` where phase = CHECKOUT |
| G-06 | **Full Send** | Check out 10+ items in a single booking | `BookingSerializedItem` + `BookingBulkItem` count on one `Booking` |
| G-07 | **Zero Loss** | Return 50 bulk items with no missing units | `BulkStockMovement` kind = CHECKIN, quantity matching checkout |
| G-08 | **Lens Hog** | Check out 5+ lenses in a single booking | `BookingSerializedItem` joined to `Asset` where category = Lenses, count ≥ 5 on one booking |
| G-09 | **Battery Pack** | Check out 10+ batteries in a single booking | `BookingBulkItem` joined to `BulkSku` where category = Batteries, count ≥ 10 on one booking |

> **Removed from original draft**: Kit Collector. Kits have no direct Booking link — assets are checked out individually even when part of a kit. Cut for V1.

### Category: Shift & Scheduling (8 badges)

| # | Badge Name | Trigger | Data Source |
|---|-----------|---------|-------------|
| S-01 | **Shift Starter** | Work your first shift | `ShiftAssignment` APPROVED/COMPLETED count ≥ 1 |
| S-02 | **Iron Worker** | Work 50 shifts | `ShiftAssignment` APPROVED/COMPLETED count ≥ 50 |
| S-03 | **Centurion** | Work 100 shifts | `ShiftAssignment` APPROVED/COMPLETED count ≥ 100 |
| S-04 | **Trade Hero** | Claim and complete 5 shift trades | `ShiftTrade` COMPLETED where `claimedByUserId` = student |
| S-05 | **Four Corners** | Work at least one shift in each area (VIDEO, PHOTO, GRAPHICS, COMMS) | `ShiftAssignment` joined to `Shift.area` across all 4 `ShiftArea` values |
| S-06 | **Weekend Warrior** | Work 10 weekend shifts (Sat/Sun) | `Shift` start date falls on Sat/Sun, with `ShiftAssignment` |
| S-07 | **Double Header** | Work two shifts in the same calendar day | Two `ShiftAssignment` records with same-day `Shift.startsAt` |
| S-08 | **Swiss Army Knife** | Work shifts covering 3+ different sports in one calendar month | `ShiftAssignment` → `Shift` → `ShiftGroup` → `CalendarEvent.sportCode`, 3+ distinct in 30 days |

### Category: Event & Sports Coverage (10 badges)

| # | Badge Name | Trigger | Data Source |
|---|-----------|---------|-------------|
| E-01 | **Game Day Ready** | Cover your first event (checkout linked to a CalendarEvent) | `Booking.eventId` not null, count ≥ 1 |
| E-02 | **All-Sport Athlete** | Cover events across 5+ different sports | Distinct `CalendarEvent.sportCode` via `Booking.eventId` ≥ 5 |
| E-03 | **Road Warrior** | Cover 5 away events | `CalendarEvent.isHome` = false, linked via `Booking.eventId` |
| E-04 | **Rivalry Week** | Cover a rivalry game | `CalendarEvent.opponent` in configurable rivalry list |
| E-05 | **March Madness** | Cover a basketball postseason game | `CalendarEvent.sportCode` = basketball + March date range |
| E-06 | **Camp Randall Regular** | Cover 10 events at Camp Randall | `CalendarEvent.locationId` → Location matching Camp Randall |
| E-07 | **Season Ticket** | Cover every home game for one sport in a full season | All `CalendarEvent` where `isHome` = true for one `sportCode` in a season |
| E-08 | **Bucky's Favorite** | Cover 25 events total across any sport | `Booking` with `eventId` not null, count ≥ 25 |
| E-09 | **Hat Trick** | Cover 3 events in a single week (Mon–Sun) | `Booking` with `eventId`, 3 distinct events within a 7-day window |
| E-10 | **Back-to-Back** | Cover events on consecutive calendar days | `Booking` with `eventId` on day N and day N+1 |

> **Note**: E-04 (Rivalry Week) and E-05 (March Madness) require a configurable rivalry list and postseason detection. For V1, rivalry list can be hardcoded (Minnesota, Iowa, Ohio State, etc.) and March Madness detected by date range + sport code.

### Category: Secret / Easter Egg (9 badges)

These badges are **not shown in the catalog** until unlocked. Students discover them organically.

| # | Badge Name | Trigger | Data Source |
|---|-----------|---------|-------------|
| X-01 | **Perfectionist** | 100% scan accuracy over 50+ scans (streak-resettable) | `ScanEvent.success` = true, count ≥ 50 consecutive |
| X-02 | **Ghost** | Zero overdue items across an entire semester | No overdue bookings (derived: completed after `endsAt`) in ~4-month window |
| X-03 | **The Closer** | Last person to check in gear at 20 events | Latest check-in `ScanSession` per event, count ≥ 20 |
| X-04 | **OG** | One of the first 10 students on the platform | `User` role = STUDENT, ordered by `createdAt`, top 10 |
| X-05 | **Night Owl** | Complete 5 check-ins after 9 PM | `ScanSession` phase = CHECKIN, `completedAt` after 21:00 |
| X-06 | **Early Bird** | Complete 5 checkouts before 7 AM | `ScanSession` phase = CHECKOUT, `startedAt` before 07:00 |
| X-07 | **Snow Day** | Cover an outdoor event when temperature is below 20°F | `CalendarEvent` outdoor venue + weather API check at event time |
| X-08 | **Jump Around** | Cover a football game at Camp Randall | `CalendarEvent` sportCode = football + location = Camp Randall |
| X-09 | **Freshman Year** | Earn 5 badges within your first 60 days on the platform | `StudentBadge.earnedAt` within 60 days of `User.createdAt`, count ≥ 5 |

> **Corrected**: Night Owl and Early Bird now reference `ScanSession` timestamps (not non-existent Booking check-in timestamps). The Closer uses `ScanSession` phase = CHECKIN for the same reason.

> **Note on Snow Day (X-07)**: Requires external weather API integration (e.g., OpenWeatherMap historical data). If too complex for V1, can use a manual "weather badge" award by staff instead. Jump Around (X-08) is a fun Camp Randall-specific badge that will resonate with anyone who's been to a Badger football game.

**Total: 42 badges** (6 Accountability + 9 Gear + 8 Shift + 10 Event + 9 Secret)

---

## Schema Changes Required

Before implementation, these schema additions are needed:

### 1. ShiftAssignment status expansion (REQUIRED for Accountability badges)
```prisma
enum ShiftAssignmentStatus {
  DIRECT_ASSIGNED
  REQUESTED
  APPROVED
  DECLINED
  SWAPPED
  COMPLETED    // NEW — shift was worked
  NO_SHOW      // NEW — student didn't show up
}
```

### 2. Badge + StudentBadge models (NEW)
```prisma
model BadgeDefinition {
  id          String         @id @default(cuid())
  slug        String         @unique          // e.g. "first-checkout", "ironclad"
  name        String                          // Display name
  description String                          // How to earn it
  category    BadgeCategory                   // ACCOUNTABILITY, GEAR, SHIFT, EVENT, SECRET
  iconUrl     String?                         // Badge artwork URL (Vercel Blob)
  isSecret    Boolean        @default(false)  // Hidden until unlocked
  sortOrder   Int            @default(0)      // Display ordering
  createdAt   DateTime       @default(now())
  students    StudentBadge[]
}

model StudentBadge {
  id        String          @id @default(cuid())
  userId    String          @map("user_id")
  badgeId   String          @map("badge_id")
  earnedAt  DateTime        @default(now()) @map("earned_at")
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge     BadgeDefinition @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])  // One badge per student
  @@map("student_badges")
}

enum BadgeCategory {
  ACCOUNTABILITY
  GEAR
  SHIFT
  EVENT
  SECRET
}
```

### 3. Streak tracking (REQUIRED for resettable badges)
```prisma
model BadgeStreak {
  id             String   @id @default(cuid())
  userId         String   @map("user_id")
  streakType     String   // e.g. "on-time-returns", "shift-attendance", "scan-accuracy"
  currentCount   Int      @default(0) @map("current_count")
  bestCount      Int      @default(0) @map("best_count")
  lastResetAt    DateTime? @map("last_reset_at")
  lastIncrementAt DateTime? @map("last_increment_at")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, streakType])
  @@map("badge_streaks")
}
```

### 4. Equipment issue reporting (OPTIONAL — enables Steward badge)
```prisma
// Add to BookingSerializedItem or create standalone:
model EquipmentIssueReport {
  id          String   @id @default(cuid())
  userId      String   @map("user_id")
  assetId     String   @map("asset_id")
  bookingId   String?  @map("booking_id")
  description String
  reportedAt  DateTime @default(now()) @map("reported_at")
  user        User     @relation(fields: [userId], references: [id])
  asset       Asset    @relation(fields: [assetId], references: [id])
  booking     Booking? @relation(fields: [bookingId], references: [id])

  @@map("equipment_issue_reports")
}
```

---

## Reward Framework (Swag / Merch)

| Milestone | Badge Count | Reward |
|-----------|------------|--------|
| **Bronze Crew** | 5 badges | Branded sticker pack |
| **Silver Crew** | 12 badges | Branded t-shirt |
| **Gold Crew** | 22 badges | Branded hoodie |
| **Platinum Crew** | 35 badges | Premium item (jacket, backpack, travel gear) + priority for away game travel crew |

> Secret badges count toward milestones once unlocked, but aren't visible in the denominator until earned. Progress bar shows "X of 33" (non-secret count) until secrets are discovered.

Staff/admins manage reward redemption offline — the system tracks milestone eligibility and surfaces it on profiles and staff reports.

---

## UI Concept

### Student Profile Page (`/profile/[userId]`)
- **Accountability Stats Panel**: Return Rate, Shift Attendance, Items Lost, Overdue Count, Current Streak (always visible, color-coded)
- **Badge Grid**: Unlocked badges as icons with names, organized by category
- **Locked Badges**: Silhouettes with hints (secret badges fully hidden until earned)
- **Progress Bar**: "X of 33 badges unlocked" (secrets excluded from denominator)
- **Swag Milestone Tracker**: Visual progress toward next reward tier
- **Recent Unlocks**: Highlighted with a "NEW" indicator

### Badge Detail Modal
- Badge icon (large)
- Name + description + how it was earned
- Date unlocked
- Category tag
- For streak badges: current streak progress

### Staff Dashboard Additions
- **Badge Leaderboard**: Top students by badge count
- **Milestone Report**: Students who've hit swag thresholds (for merch fulfillment)
- **Badge Unlock Feed**: Recent unlocks across all students
- **Accountability Overview**: Sortable table of all student stats

### Notifications
- In-app toast when a badge is unlocked
- Optional: email for milestone rewards

---

## Badge Evaluation Engine

### Trigger Points
| System Event | Badges Evaluated |
|-------------|-----------------|
| Booking → COMPLETED | G-01 through G-04, G-06 through G-09, A-02, A-04, A-06, X-02, X-05, X-06 |
| ScanSession → COMPLETED | G-05, X-01, X-03 |
| ShiftAssignment → COMPLETED | S-01 through S-03, S-05 through S-08, A-01 |
| ShiftAssignment → NO_SHOW | A-01 (streak reset) |
| ShiftTrade → COMPLETED | S-04 |
| Booking linked to CalendarEvent | E-01 through E-10, X-07, X-08 |
| EquipmentIssueReport created | A-03 |
| On any badge unlock | A-05 (composite check), X-09 (freshman year check) |

### Engine Design
1. **Event-driven**: After trigger events, evaluate relevant badge rules for that student
2. **Pure functions**: Each badge = `(studentId) => Promise<boolean>` querying relevant data
3. **Idempotent**: Re-evaluating an earned badge is a no-op
4. **Streak management**: Increment/reset `BadgeStreak` records alongside badge evaluation
5. **Batch backfill**: One-time script to evaluate all badges against historical data

---

## Implementation Slices (Thin Slice Protocol)

| Slice | Scope | Independently Testable? |
|-------|-------|------------------------|
| 1 | Schema: `BadgeDefinition`, `StudentBadge`, `BadgeStreak`, `ShiftAssignmentStatus` expansion + migration | Yes — migration runs, seed script populates badge definitions |
| 2 | Badge evaluation engine: rule definitions + trigger hooks wired into existing API routes | Yes — unit tests per badge rule, integration test for trigger flow |
| 3 | Student profile UI: badge grid, stats panel, progress bar, milestone tracker | Yes — visual QA on profile page |
| 4 | Staff dashboard: leaderboard, milestone report, unlock feed | Yes — staff-only page with data |
| 5 | Notifications: in-app toast on badge unlock | Yes — toast appears after earning badge |
| 6 | Equipment issue reporting (enables Steward badge) | Yes — form + API + badge trigger |

---

## Open Questions (Resolve Before Slice 1)

1. **Rivalry list**: Which opponents count? Suggest: Minnesota, Iowa, Ohio State, Michigan, Nebraska
2. **March Madness detection**: Use date range (mid-March to early April) + basketball sport code, or add a `postseason` flag to CalendarEvent?
3. **Semester boundaries**: How to define "semester" for Ghost badge? Academic calendar dates or rolling 4-month window?
4. **Badge artwork**: Custom illustrations or emoji-style icons for V1?
5. **Overdue threshold**: Is any amount of lateness "overdue", or is there a grace period (e.g., 1 hour)?

---

## Change Log

| Date | Change |
|------|--------|
| 2026-03-19 | Initial design spec created |
| 2026-03-19 | Added Accountability category (5 badges), streak resets, visible profile stats |
| 2026-03-19 | Schema validation pass — corrected field names (`eventId` not `calendarEventId`, `isHome` not `home`), removed Kit Collector (no schema support), fixed timestamp sources to use `ScanSession` |
| 2026-03-19 | Added schema change requirements, trigger mapping, open questions |
| 2026-03-19 | Added 10 fun badges: Lens Hog, Battery Pack, Swiss Army Knife, Bucky's Favorite, Hat Trick, Back-to-Back, Snow Day, Jump Around, Freshman Year, The Vault. Total now 42 badges |
