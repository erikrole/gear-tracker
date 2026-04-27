# Task Queue

Last updated: 2026-04-27

**Current release**: Beta — CalVer versioning adopted.
**Release workflow**: `npm run release` creates CalVer tag + GitHub Release.

---

## Current State

Main branch is at `6d08c56` (polish: tighten UI micro-details across the app).
Badge system PR (#123) was merged then reverted — all badge-related code removed from main.
Cron jobs on main are Vercel Hobby-compatible (daily schedules only).

### What's Live
- Full checkout/reservation workflow with photo accountability
- Equipment scanning with numbered bulk unit tracking and loss detection
- Schedule & shift management with trade board and auto-generation
- Event sync (ICS ingest, venue mapping, shift auto-generation)
- Kiosk mode for self-serve scan stations (device-level auth)
- 6 report types with drill-down (checkout, overdue, utilization, scans, audit, bulk losses)
- Admin allowlist for registration access control
- Guides with BlockNote editor (CRUD, categories, publish/draft)
- Notifications (in-app center, email via Resend, escalation schedule)
- Settings IA (search palette, tab grouping, appearance, personal preferences)
- Mobile iOS student-first operations app

---

## Recently Shipped

### UI Polish Pass (2026-04-26)
- [x] Transition timing, button press scale, text wrapping fixes
- [x] Image outlines, tabular-nums on badges
- [x] Auto-apply Prisma migrations on Vercel build
- [x] Vercel plugin + Postgres/Vercel MCP + migration guards

### Settings IA (2026-04-24)
- [x] Search palette, tab grouping, density improvements, last-tab resume
- [x] Notifications preferences UI, text size controls, personal settings group
- [x] Inline "last edited by/when" on Locations + Allowed Emails

### Guides Feature (2026-04-14)
- [x] Guide model + migration, service layer, 5 API routes
- [x] List page, BlockNote reader, create/edit pages, publish toggle
- [x] `AREA_GUIDES.md` created, plan archived

### Kiosk Mode Verification (2026-04-14)
- [x] All 12 kiosk API routes verified with `withKiosk`
- [x] 5-min inactivity timer confirmed
- [x] `AREA_KIOSK.md` all ACs complete

### Scan Flow Hardening (2026-04-09)
- [x] 4 bugs found and fixed in stress test
- [x] Badge components, dark-mode, finally blocks, Page Visibility refresh, camera error UX

### Booking Flow Overhaul (2026-04-09)
- [x] Multi-step wizard replaces `CreateBookingSheet`
- [x] Equipment tab with unreturned badges, scan-to-return, thumbnails
- [x] Old components deleted, dashboard wired to wizard

---

## Rolled Back: Badge System (2026-04-27)

PR #123 was merged then reverted. The badge system (42 badges, evaluation engine,
streak tracking, staff dashboard, profile integration) caused merge conflicts and
deployment issues. Will be re-attempted later with a cleaner approach.

**What was built (for reference when revisiting):**
- Schema: BadgeDefinition, StudentBadge, BadgeStreak models
- Evaluation engine: 40 rules across 10 trigger types
- Trigger hooks: evaluateBadges, handleOnTimeReturn, handleOverdueReturn, handleShiftCompleted, handleSuccessfulScan, handleFailedScan
- UI: Badge grid on profile, staff dashboard with leaderboard + accountability feed
- Reports: /reports/badges tab
- Notifications: In-app alerts when badges earned

**Lessons for next attempt:**
- Badge hooks were injected into 6+ route handlers — too many touchpoints for a first slice
- Rebase across main's `withAuth` refactor caused extensive conflicts
- Start with schema + evaluation engine only, wire hooks in a separate slice
- Consider event-driven architecture (emit events, badge service subscribes) instead of direct hook injection

---

## Open Items

### Low Priority (from scan stress test)
- [ ] **Server-side rate limiting on scan endpoints** — Client-side 1s debounce is the only guard. Migrate to Upstash KV when user base grows (GAP-32).

---

## Phase B Backlog (needs briefs before implementation)

| Priority | Feature | Status | Notes |
|----------|---------|--------|-------|
| P1 | **Shift email notifications** | Needs brief | V1 = in-app only; email would reduce missed shifts |
| P1 | **Student availability tracking** | Needs brief | Declare unavailable dates for scheduling |
| P2 | **Date range grouping** | Needs brief | Connected From/To on booking detail (deferred Round 3) |
| P2 | **Game-Day Readiness Score** | Needs brief | Aggregate metric per event |
| P2 | **Scan telemetry / KPI tracking** | Brief exists (`BRIEF_SCAN_TELEMETRY_V1.md`) | Vercel Analytics recommended |
| P3 | **Enhanced escalation (SMS, sub-hourly)** | Brief exists (`BRIEF_ESCALATION_PHASE_B.md`) | Blocked: sub-hourly needs Vercel Pro |
| P3 | **Student badge system** | Plan ready (`tasks/badge-achievements-plan.md`) | Previous attempt rolled back — redesigned with event-driven architecture, 6 thin slices |

---

## Phase C Backlog (deferred)

- [ ] Database-configurable equipment guidance rules UI (D-016)
- [ ] Advanced analytics — charts, trends, forecasting
- [ ] Multi-source event ingestion (beyond UW Badgers ICS)
- [ ] Reservation/checkout templates
- [ ] Board/ops view for game-day coordinators

---

## Known Gaps (acceptable for current scale)

| ID | Gap | Mitigation |
|----|-----|------------|
| GAP-11 | No cross-page data cache — full re-fetch on navigation | V3 candidate: React Query |
| GAP-21 | SystemConfig model has zero UI | Low priority; internal key-value store |
| GAP-32 | Rate limiting is in-memory per serverless instance | Adequate for 4-user team; Upstash KV when needed |
| GAP-33 | PENDING_PICKUP bookings have no auto-expiry | Staff can cancel manually; 48h auto-expiry deferred |
| GAP-34 | iOS Bookings list lacks status filters and sorting | iOS uses `activeOnly: true`; power-user parity deferred |
| GAP-35 | iOS Booking detail missing per-item conflict badges | Server-side enforcement is authoritative |
| GAP-36 | iOS Item detail missing admin actions | By design for V1 (student-first) |

---

## Planned Upgrades (documented, not started)

- **Next 16 migration** — Plan in `tasks/next16-migration-plan.md`
- **iOS SwiftData** — Plan in `tasks/ios-swiftdata-plan.md`
- **iOS Swift 6.2 / Liquid Glass** — Plan in `tasks/ios-swift62-liquidglass-plan.md`

---

## Notes

- Write a `BRIEF_*.md` or Decision record before implementing any new feature
- Run `npm run build` before any commit
- Every mutation endpoint needs audit logging (D-007)
- Read `NORTH_STAR.md` first in any new Claude session
- When shipping, update the relevant `AREA_*.md` and `GAPS_AND_RISKS.md` (CLAUDE.md rule 12)
- Vercel Hobby plan: cron jobs must be daily only (no sub-daily schedules)
