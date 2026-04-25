# AREA: Shift Calendar & Scheduling

> Status: **Implemented** | Owner: TBD | Last Updated: 2026-04-07

## Purpose

Replace Asana-based shift scheduling with a native shift calendar in Gear Tracker. Auto-generate shifts from ICS-synced calendar events using sport-specific templates, support hybrid assignment (staff picks from pool + student self-request for premier events), and provide a trade board for student shift swaps.

## Key Concepts

- **ShiftArea**: VIDEO, PHOTO, GRAPHICS, COMMS
- **ShiftWorkerType**: FT (full-time staff), ST (student)
- **SportConfig**: Per-sport shift counts for home/away events per area
- **ShiftGroup**: 1:1 with CalendarEvent, container for all shifts at an event
- **Premier Events**: Events where students can request to work (requires staff approval)
- **Trade Board**: Area-filtered board where students post shifts they can't work; other students in the same area can claim them

## Acceptance Criteria

- [x] Sport configuration: per-area home/away shift counts configurable per sport
- [x] Sport roster: students/staff assigned to sports, synced to user profiles
- [x] Auto-generation: shifts created when calendar events sync from ICS
- [x] Staff assignment: pick students from sport pool for each shift
- [x] Student requests: students can request premier event shifts (staff approves)
- [x] Trade board: students post shifts for trade, area-filtered visibility
- [x] Trade claims: instant swap (non-premier) or staff-approved swap (premier)
- [x] Calendar view: month grid with coverage indicators (green/orange/red)
- [x] List view: grouped by event, filterable by sport/area/status
- [x] User profiles: inline contact info, primary/secondary area, assigned sports
- [x] Mobile: responsive card layout, full-screen detail panel
- [x] Week view: 7-day time-block view with coverage dots, navigation, My Shifts highlight
- [x] Home/away toggle: filterable, neutral-as-away default
- [x] Hide events: staff can hide irrelevant events from schedule views
- [x] My Hours stat strip: week/month hours + shift counts displayed on schedule page

## Information Architecture

### Schedule Page (`/schedule`)
1. **Page Header** — title, "Trade Board" button (with open-trade count badge)
2. **My Hours stat strip** — week/month hours + shift counts (from `GET /api/shifts/my-hours`)
3. **Filter Bar** (`ScheduleFilters`) — Sport, Area, Coverage, Time (Include past), My Shifts toggle
3. **View Toggle** — List | Week | Calendar (persisted to localStorage)
4. **List View** (`ListView`) — date-grouped expandable table; parent rows = events, child rows = shifts
5. **Week View** (`WeekView`) — 7-day strip with time-block events, coverage dots, navigation (prev/next/this week)
6. **Calendar View** (`CalendarView`) — month grid with coverage indicator dots (green/orange/red)
7. **ShiftDetailPanel** — side sheet for per-event shift management (add/remove shifts, assign users, premier toggle)
8. **Trade Board** — sheet overlay with area/status filters, claim/approve/cancel workflows

### Event Detail Page (`/events/[id]`)
1. Badge bar — status, sport, home/away, location
2. Details card — Opponent, When, Venue
3. Shift Coverage card — merged with Command Center (staff: gear summary + 5-col table; students: 4-col table)
4. Action CTAs — "Reserve gear", "Checkout to this event"

### Dashboard Integration
1. **My Shifts card** — upcoming assigned shifts with area, time, "Prep gear" button
2. **Upcoming Events card** — events with assigned user avatars
3. **Stat strip** (staff/admin only) — Overdue, Due today, Active checkouts, Reserved (clickable, links to filtered views)

### Cross-Area: Scan Feedback
- Haptic vibration feedback on scan success/error (shipped in `useScanSubmission` hook, documented in `AREA_CHECKOUTS.md`). Audio feedback not yet implemented — schedule-adjacent for shift-linked scan flows.

## Dependencies

- CalendarEvent model (existing — ICS sync)
- CalendarSource sync service (existing — `src/lib/services/calendar-sync.ts`)
- User model with RBAC roles (existing)
- Sports code mappings (existing — `src/lib/sports.ts`)

## Change Log
- 2026-04-25: **iOS schedule authoring shipped** — STAFF/ADMIN can assign + unassign + add shifts directly from `EventDetailSheet`; STUDENTs can request open ST slots (premier flow shows "staff will review" copy). REQUESTED-state assignments render a Pending pill. Closes the iOS-side gap for "Staff assignment" and "Student requests" rows in this AC list. Trade board (post / claim / cancel) was already shipped 2026-04-24. ShiftDetailPanel-equivalent remains web-only — iOS uses the event sheet inline.


| Date | Change | Slice |
|------|--------|-------|
| 2026-03-16 | Plan created | — |
| 2026-03-16 | Schema: enums, models, relations, User.phone/primaryArea | 1 |
| 2026-03-16 | Sport config API + settings UI (per-area home/away counts) | 2 |
| 2026-03-16 | Sport roster + user profile enhancements (contact, areas, sports) | 3 |
| 2026-03-16 | Shift auto-generation from ICS sync + backfill API | 4 |
| 2026-03-16 | Assignment API: direct assign, request, approve, decline, swap, remove | 5 |
| 2026-03-16 | Schedule page: calendar + list views with coverage indicators | 6 |
| 2026-03-16 | ShiftDetailPanel: staff assignment, student requests, premier toggle | 7–8 |
| 2026-03-16 | Trade board service + API: post, claim, approve, decline, cancel | 9 |
| 2026-03-16 | Trade board UI with area filters, claim/approve/cancel workflows | 10 |
| 2026-03-16 | Event detail: shift coverage table, manage shifts button | 11 |
| 2026-03-16 | Hardening: doc sync, permissions verified, audit logging complete | 12 |
| 2026-03-17 | Gear integration: "Gear Up" notification on shift assign/approve; shift context banner in checkout form | — |
| 2026-03-18 | Event Command Center: staff view with shift + gear status, missing gear list, nudge notifications | Slice 4 |
| 2026-03-18 | Shift-checkout linking: shiftAssignmentId FK on Booking, wired through checkout/reservation creation, command center shows linked status | Slice 6 |
| 2026-03-23 | Roadmap: merge Events + Shifts into unified page — see `tasks/calendar-roadmap.md` | — |
| 2026-03-23 | Shipped: unified `/schedule` page (V1). Old events list page removed. Combined view with coverage badges, calendar grid, Trade Board tab. Sidebar shows single "Schedule" entry. | V1 |
| 2026-03-23 | V2 enhancements: "My Shifts" filter (default ON for students, localStorage-persisted), inline coverage expansion (click badge → per-area breakdown with avatars + assign button), Trade Board as Sheet overlay with open-trade count badge, localStorage view mode persistence, auto-scroll to today's date on list load. | V2 |
| 2026-03-23 | Hardening (4-pass): design system (inline styles → Tailwind), data flow (AbortController, 401 redirect, trade count refresh on sheet close), resilience (network vs server error messages, refresh preserves data), UX polish (filtered "N of M" count, skeleton column fix). | — |
| 2026-03-23 | Stress test: 401 handling on all ShiftDetailPanel + TradeBoard mutations (8+5 handlers). Concurrent mutation guard upgraded from per-item to global (`acting !== null`). | — |
| 2026-03-25 | Decomposed schedule page from 1,012→117 lines: `useScheduleData` hook + `ScheduleFilters`, `CalendarView`, `ListView` components + shared types (GAP-15 closed) | — |
| 2026-03-25 | UX polish: removed auto-scroll-to-today on list load, full sport names replace code badges, List/Calendar toggle upgraded to shadcn ToggleGroup with icons, My Shifts filter replaced with shadcn Switch toggle | — |
| 2026-03-26 | **Shift Redesign V2 (Slices 1-3):** Per-event shift editing (POST/DELETE `/api/shift-groups/[id]/shifts`), `manuallyEdited` guard on auto-generation + regeneration, universal user assignment (not roster-locked), avatar-based Popover picker replacing text list, +Shift/×Delete buttons per area/shift. All areas optional. ShiftDetailPanel migrated from inline styles to Tailwind. See `docs/BRIEF_SHIFT_REDESIGN_V2.md`. | V2 |
| 2026-03-26 | **ShiftDetailPanel hardened (5-pass):** Extracted 3 subcomponents (`ShiftAreaSection`, `ShiftSlotCard`, `UserAvatarPicker`) — parent reduced from 749→376 lines. Consolidated 8 mutation handlers into single `mutate()` helper. AbortController on user list fetch. Color-coded avatar fallbacks via `getAvatarColor()`. Zero inline styles. | — |
| 2026-04-02 | **UX audit:** Removed redundant data from event detail (source, description, duplicate sport/home-away). Merged Shift Coverage + Command Center into single card. Simplified list view child rows. See `tasks/schedule-roadmap.md` for V2/V3 roadmap. | — |
| 2026-04-02 | **Week View shipped (V2 2a):** 7-day time-block view with coverage dots, all-day row, prev/next/this-week navigation, My Shifts highlight. Added to List \| Week \| Calendar toggle. Mobile: scrollable vertical column. | V2 |
| 2026-04-03 | **My Hours stat strip:** `GET /api/shifts/my-hours` endpoint returns week/month hours + shift counts. Displayed on schedule page between header and filters. | — |
| 2026-04-03 | **Schedule hardening:** Home/away toggle filter, hide events from schedule views (staff), neutral-as-away default. UI polish pass across schedule components. | — |
| 2026-04-03 | **Schedule page hardening (6-pass audit):** Removed 20 lines dead CSS (unused cal-booking-neutral, week-event-neutral, cal-mobile-notice). Fixed broken mobile calendar notice (Tailwind `hidden` overrode CSS media query). Added 401 redirect + error toasts + double-click guard to handleHideEvent. Added mobile loading skeleton to WeekView. Replaced raw CSS variables with Tailwind theme classes in ListView mobile cards. | — |
| 2026-04-03 | **Stress test (5 issues found, 5 fixed):** BRK-001: ShiftGroup PATCH wrapped in SERIALIZABLE transaction (was read-then-write without tx). BRK-002: `approveRequest` now re-checks time conflicts + active assignment at approval time (was missing since initial impl). BRK-003: `directAssignShift` now declines orphaned REQUESTED assignments when filling slot. BRK-004: `removeAssignment` now guards against removing terminal-status assignments. BRK-005: Global ZodError handling in `fail()` returns 400 instead of 500 for invalid payloads. | — |
| 2026-04-04 | **Doc sync:** Added Information Architecture section (WeekView, stat strip, scan feedback cross-reference). Updated acceptance criteria for V1.5 shipped features. Updated last-updated date. | — |
| 2026-04-04 | **Event detail hardened (6-pass):** hasLoadedRef pattern (refresh keeps visible data), global `acting` spam-click guard on nudge, `finally` on all mutations, refresh failure toasts instead of clobbering data, EventSkeleton updated to include shift coverage card section, `setBreadcrumbLabel` added to useCallback deps. | — |
| 2026-04-07 | **Event detail migrated to useFetch:** Replaced 9 useState + 4 raw fetch calls with `useFetch` hook (React Query-backed). Adds cross-page caching, stale-while-revalidate, visibility refresh. Nudge mutation now uses `classifyError` for network vs server error toasts. `handleHideEvent` on schedule page also upgraded with `classifyError` + `parseErrorMessage`. |
| 2026-04-09 | **Schedule page rebuild:** Migrated all custom CSS (`cal-*`, `week-*`, `event-date-*`) to Tailwind. Fixed CalendarView filter bug (was receiving unfiltered entries — home/away, area, coverage filters had no effect). Added missing neutral event color for both CalendarView and WeekView. Fixed `handleHideEvent` stale closure (dep was full data object). Fixed silent failures in ListView `loadUsers` and `handleInlineAssign`. Removed `tableLayout: fixed` + `<colgroup>`. Removed dead `myHours` fetch. Deleted 239 lines of dead CSS from globals.css. | — |
