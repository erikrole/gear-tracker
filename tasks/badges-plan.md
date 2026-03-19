# Badge System Implementation Plan

> **Brief**: `docs/BRIEF_BADGES_V1.md`
> **Status**: In Progress
> **Created**: 2026-03-19

## Slice Overview

- [x] **Slice 1**: Schema + Migration
- [ ] **Slice 2**: Badge Evaluation Engine
- [ ] **Slice 3**: Student Profile UI (badge grid, stats, milestones)
- [ ] **Slice 4**: Staff Dashboard (leaderboard, milestone report, feed)
- [ ] **Slice 5**: Notifications (in-app toast on badge unlock)
- [ ] **Slice 6**: Equipment Issue Reporting (enables Steward badge)

---

## Slice 1: Schema + Migration

### Tasks
- [x] Add `COMPLETED` and `NO_SHOW` to `ShiftAssignmentStatus` enum
- [x] Create `BadgeDefinition` model
- [x] Create `StudentBadge` model (with unique constraint on userId + badgeId)
- [x] Create `BadgeStreak` model (with unique constraint on userId + streakType)
- [x] Create `BadgeCategory` enum
- [x] Add relations to `User` model
- [ ] Run `npx prisma migrate dev` (blocked — no DB in this environment, schema validates)
- [x] Create seed script to populate all 42 badge definitions
- [x] Validate schema with `prisma validate`
- [x] Run `npm run build` — passes clean

### Acceptance Criteria
- All 42 badges exist in `BadgeDefinition` table after seeding
- `StudentBadge` supports one-badge-per-student constraint
- `BadgeStreak` supports streak tracking per student per type
- Build passes

---

## Slice 2: Badge Evaluation Engine

### Tasks
- [ ] Create `src/lib/badges/` directory structure
- [ ] Define badge rule interface: `(studentId) => Promise<boolean>`
- [ ] Implement rules for all 42 badges grouped by category
- [ ] Implement streak increment/reset logic
- [ ] Create `evaluateBadgesForStudent(studentId, triggerEvent)` orchestrator
- [ ] Wire triggers into existing API routes (checkout complete, check-in, shift assignment, etc.)
- [ ] Create backfill script for existing students
- [ ] Write unit tests for each badge rule
- [ ] Run `npm run build`

### Acceptance Criteria
- Each badge rule is a pure function returning boolean
- Streak badges correctly reset on negative events
- Trigger hooks fire after relevant API actions
- Backfill script awards badges retroactively
- All tests pass

---

## Slice 3: Student Profile UI

### Tasks
- [ ] Create `/profile/[userId]` page
- [ ] Build accountability stats panel (Return Rate, Shift Attendance, Items Lost, Overdue Count, Current Streak)
- [ ] Build badge grid component (unlocked as icons, locked as silhouettes, secrets hidden)
- [ ] Build progress bar ("X of 33 badges" — secrets excluded from denominator)
- [ ] Build swag milestone tracker
- [ ] Build badge detail modal (icon, name, description, date earned)
- [ ] Add "NEW" indicator for recent unlocks
- [ ] Make profiles publicly accessible to all students
- [ ] Mobile-responsive layout
- [ ] Run `npm run build`

### Acceptance Criteria
- Any student can view any other student's profile
- Stats are color-coded (green/yellow/red)
- Secret badges are invisible until earned
- Milestone progress is clear and motivating
- Works on mobile

---

## Slice 4: Staff Dashboard

### Tasks
- [ ] Add badge leaderboard component (top students by badge count)
- [ ] Add milestone report (students at each swag threshold)
- [ ] Add badge unlock feed (recent unlocks across all students)
- [ ] Add accountability overview (sortable table of all student stats)
- [ ] Staff-only access control
- [ ] Run `npm run build`

### Acceptance Criteria
- Staff can quickly see who deserves swag
- Leaderboard creates visible competition
- Feed shows real-time badge activity

---

## Slice 5: Notifications

### Tasks
- [ ] In-app toast on badge unlock
- [ ] Badge unlock notification record in `Notification` model
- [ ] Optional: email for milestone reward thresholds
- [ ] Run `npm run build`

### Acceptance Criteria
- Students see a toast immediately when they earn a badge
- Milestone notifications are prominent

---

## Slice 6: Equipment Issue Reporting

### Tasks
- [ ] Create `EquipmentIssueReport` model (schema change)
- [ ] Add issue reporting form to check-in flow
- [ ] Create API endpoint for issue reports
- [ ] Wire Steward badge (A-03) trigger
- [ ] Run `npm run build`

### Acceptance Criteria
- Students can flag gear issues during check-in
- Reporting 5 issues earns Steward badge
- Staff can view issue reports

---

## Open Questions (Resolve Before Slice 1)

1. Rivalry list — which opponents? (Suggest: Minnesota, Iowa, Ohio State, Michigan, Nebraska)
2. March Madness detection — date range or postseason flag?
3. Semester boundaries for Ghost badge
4. Badge artwork — custom illustrations or emoji icons for V1?
5. Overdue grace period — any lateness, or 1-hour buffer?
6. Snow Day badge — weather API integration or manual staff award?
