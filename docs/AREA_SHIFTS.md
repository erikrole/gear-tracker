# AREA: Shift Calendar & Scheduling

> Status: **Implemented** | Owner: TBD | Last Updated: 2026-05-21

## Purpose

Replace Asana-based shift scheduling with a native shift calendar in Gear Tracker. Auto-generate shifts from ICS-synced calendar events using sport-specific templates, support hybrid assignment (staff picks from pool + student self-request for premier events), and provide a trade board for student shift swaps.

## Key Concepts

- **ShiftArea**: VIDEO, PHOTO, GRAPHICS, COMMS
- **ShiftWorkerType**: Internal planned staffing kind; UI and notifications must display Staff or Student, never raw enum abbreviations
- **SportConfig**: Per-sport Staff and Student shift counts for home/away events per area
- **ShiftGroup**: 1:1 with CalendarEvent, container for all shifts at an event
- **Premier Events**: Events where students can request to work (requires staff approval)
- **Trade Board**: Area-filtered board where students post shifts they can't work; other students in the same area can claim them
- **StudentAvailabilityBlock**: Recurring weekly unavailability block, usually a class schedule conflict, used to warn during shift assignment

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
- [x] Home/away/neutral toggle: filterable with shared green, orange, and gray venue treatment
- [x] Hide events: staff can hide irrelevant events from schedule views
- [x] Schedule readiness snapshot: staff-needed count, covered events, my shifts, trade count, and next call displayed on schedule page
- [x] Student availability: profile Availability tab stores recurring weekly blocks and assignment flows show conflicts
- [x] Shift trade emails: claimed, completed, approved, and declined trade events send best-effort email companions
- [x] Staff/Student slot planning: sport templates generate separate Staff and Student slots and preserve the planned slot type after assignment
- [x] Call-time overrides: default sport call windows can be overridden per shift and per assignment, with personal overrides used for conflict checks

## Information Architecture

### Schedule Page (`/schedule`)
1. **Page Header** — title, "Trade Board" button (with open-trade count badge)
2. **Schedule readiness snapshot** — staff-needed count, covered events, viewer shift count, open trades, and next visible call time
3. **Filter Bar** (`ScheduleFilters`) — View, Venue, Needs staff, My Shifts, Past, Sport, Area, and Coverage controls
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
- 2026-05-28: **iOS student availability editor (Schedule slice S5)** — students can now manage their recurring class-conflict blocks on iOS, closing the web-only gap on AC-36. New "My Availability" link in Profile (STUDENT role) opens an editor that lists blocks grouped by weekday and supports add (day picker + start/end time → "HH:mm" + optional label like "CHEM 101") and swipe-to-delete, with loading/empty/error states. These are the same `StudentAvailabilityBlock` records that drive the assign-picker conflict warnings shipped in S3. New iOS client methods `availabilityBlocks` / `createAvailabilityBlock` / `deleteAvailabilityBlock` against the existing `/api/users/[id]/availability` routes (STUDENT restricted to self server-side). Views live in `AppTabView.swift` alongside `ProfileView` to avoid a new project file. Files: `ios/Wisconsin/Core/APIClient.swift`, `ios/Wisconsin/Models/ScheduleModels.swift`, `ios/Wisconsin/Views/AppTabView.swift`, `tasks/ios-first-class-upgrade-plan.md`. Build: BUILD SUCCEEDED. `drift:ios` ✓ 0 violations.
- 2026-05-28: **iOS Schedule sport filter (Schedule slice S4)** — the Schedule tab dropped a student or staffer into the full all-team event firehose with only a Home/Away filter. Added a sport filter chip row (built from the distinct sport codes present in the loaded events, shown only when 2+ sports appear) so a viewer can narrow to the team they actually work, without a my-shifts-only default that would hide open shifts they could pick up. Applies to both list and calendar views and resets on tab reselect. Extracted a shared `filterChip` so Home/Away and sport rows stay visually identical. Deferred: cross-launch persistence of the filter (low value — sports in view rotate weekly) and a "my sports" quick default (CurrentUser carries no sport data on iOS yet). Files: `ios/Wisconsin/Views/ScheduleView.swift`, `tasks/ios-first-class-upgrade-plan.md`. Build: BUILD SUCCEEDED. `drift:ios` ✓ 0 violations.
- 2026-05-28: **iOS assign-picker availability conflicts (Schedule slice S3)** — `AssignStudentSheet` now surfaces student availability conflicts, matching the web assign picker (`UserAvatarPicker` + `/api/shifts/[id]/conflicts`). On open it fetches the per-shift conflict map (userId → note like "Conflicts with class 14:00–15:00") in parallel with the user list, shows a "Checking availability…" indicator while loading, and renders an orange "Conflict" pill plus the note under any conflicted user. Assignment is **not blocked** — staff can still assign over a conflict, exactly as web does (warning, not a gate). New non-blocking `APIClient.shiftConflicts(shiftId:)` (empty on failure, broadcasts 401 per R3). **Scope note:** web's assign cell uses the full user list filtered by name/area, *not* a roster-only filter — so this slice intentionally adds the conflict warning (the real parity gap) and does NOT add sport-roster-only filtering, which would diverge from web and hide valid assignees. Files: `ios/Wisconsin/Core/APIClient.swift`, `ios/Wisconsin/Views/Schedule/AssignStudentSheet.swift`, `tasks/ios-first-class-upgrade-plan.md`. Build: BUILD SUCCEEDED. `drift:ios` ✓ 0 violations.
- 2026-05-28: **iOS shift-row action affordance (Schedule slice S1)** — the primary staffing actions in `EventDetailSheet` were already visible (not buried in the context menu, contrary to an initial read) but under-styled. Open-slot **Assign** (staff) and **Request** (student) moved from `.plain` accent-colored text to real tinted `.bordered` buttons so they read as tappable with a comfortable hit area; pending-request **Approve/Decline** moved from `.controlSize(.mini)` to `.small` with Approve as filled-green primary, Decline as outlined-red, and wider spacing so two consequential actions on a dense row aren't a mis-tap risk. The context menu still carries the secondary/destructive actions (Replace, Remove, Duplicate, Change call time, Delete). Applies to both staff and students. Note: list-level coverage badges (seeing crew fill from the Schedule list without drilling in) need a calendar-payload change and are tracked as a separate slice. Files: `ios/Wisconsin/Views/EventDetailSheet.swift`, `tasks/ios-first-class-upgrade-plan.md`. Build: BUILD SUCCEEDED. `drift:ios` ✓ 0 violations.
- 2026-05-25: Web bug sweep hardened Schedule, Assign shifts, Shift Detail, and Trade Board client paths. Schedule and assignment-grid data loaders now safe-parse calendar and shift group payloads, assignment picker user/conflict loads and inline schedule user loads use shared response/auth handling, Shift Detail group/user/auto-fill reads are malformed-response safe, and auto-fill/archive/attendance/post-trade/detail mutations now have ref-backed duplicate-action guards.
- 2026-05-21: Expanded Schedule assignment rows now use fixed desktop columns for area/add, assignee/remove, role, time, and row actions so dense staffing rows align consistently across filled and open slots.
- 2026-05-21: Expanded Schedule list assigned rows now show the remove-assignment control persistently instead of hiding it until hover, so staff can clean up bad or stale assignments directly from the row.
- 2026-05-21: Expanded Schedule list rows now expose Staff slot and Student slot creation directly from the inline area row, so list view can serve as the primary staffing surface without opening the side sheet.
- 2026-05-21: Manual slot creation now uses explicit Staff slot and Student slot choices in Shift Detail, Event Detail, and the Assign grid, replacing ambiguous add controls.
- 2026-05-21: Direct shift assignment now preserves Staff/Student slot integrity. If a selected worker's role does not match the selected slot, the assignment reuses an open matching same-area slot or creates a new matching slot, leaving the original planned slot open.
- 2026-05-21: Shift Staffing MVP shipped. Sport templates now store separate Staff and Student counts for each area/home-away row while keeping legacy totals in sync. Generated slots preserve their planned Staff or Student kind after assignment, shift-level and per-person call windows are available, and assignment conflict checks use the effective personal/shift/default call time.
- 2026-05-21: Trade Board cancellation confirmation now names the event, shift window, and posted owner so users know exactly which trade posting is being cancelled and that the assignment remains with the original worker. The Trade Board sheet also exposes an accessible description for browser dialog checks.
- 2026-05-21: Schedule filter view and venue segmented controls now use shadcn `ToggleGroup` while staying a documented schedule-specific command bar instead of a generic list toolbar.
- 2026-05-21: Design language Area 5 state/copy audit. Shift detail confirmations and failures now say whether an assignment is removed, a slot reopens, a staffed shift is deleted, a trade failed to post, or an archive/attendance/autofill action was not saved.
- 2026-05-21: Shift slot remove, attendance, approve/decline request, and student request controls now align with the 40px operational target baseline inside event staffing cards.
- 2026-05-21: Event detail travel roster controls now align with the 40px operational target baseline, and the empty travel roster uses shared inline `EmptyState` copy.
- 2026-05-20: Event detail missing-gear Nudge and Create checkout actions now use 40px operational targets and wrap cleanly in narrow rows.
- 2026-05-20: Event detail crew assignment, request-review, and remove controls now use visible keyboard-friendly 40px targets instead of hover-only or sub-40px controls.
- 2026-05-20: Event detail crew coverage empty area rows now use the shared inline `EmptyState` treatment, and the add-shift icon target is aligned to the 40px operational action baseline.
- 2026-05-20: Trade Board filter state now uses the shared `OperationalActiveFilterChips` row for Area, Status, and My trades so each active filter can be removed without reopening its selector.
- 2026-05-20: Trade Board secondary/destructive row commands now use the shared `OperationalRowActions` trigger. Claim and staff approval stay visible as primary row actions, while cancel and decline move into the shared accessible overflow menu.
- 2026-05-14: Trade Board stale-state closure. Trade posting, claiming, approval, listing, and the schedule header count now ignore or reject open/claimed trades whose shift has already started, while the Trade Board API includes event opponent/home-away fields so board titles match the rest of Schedule.
- 2026-05-14: Trade posting flow polish. The normal Schedule list shortcut now opens a shadcn dialog with optional notes and visible posting errors before creating a trade, matching the richer event-detail posting flow instead of one-click posting without context.
- 2026-05-14: Trade Board UX hardening. The schedule Trade Board sheet now uses compact card rows instead of a cramped side-sheet table, reuses schedule event-title cleanup, surfaces shift time, area, approval mode, poster/claimer, notes, and clearer action ownership, guards duplicate mutations with ref-backed state cleanup, and rejects invalid trade status/area filters with controlled 400 responses.
- 2026-05-14: Assign page hardening follow-up. `/schedule/assign` is now server-gated for staff/admin users before the client grid mounts, assignment mutations use ref-backed duplicate-submit guards with terse success feedback, and calendar/shift date inputs now return 400s for invalid or inverted ranges instead of leaking malformed dates to Prisma.
- 2026-05-14: Schedule peer hardening follow-up. The normal `/schedule` page now shares week-start date math, gives inline assignment success feedback, exposes trade-count refresh directly through the React Query refetch function, and removes stale schedule-local helpers while keeping the already-shipped hide-event and venue-tone fixes intact.
- 2026-05-14: Assign page current-event cleanup. `/schedule/assign` now mirrors the normal Schedule list default by showing only active events from today forward, keeps past events and archived shift groups out of assignment work, disables navigation into fully past months, and reduces repeated add/open controls into quieter row-style assignment affordances with compact overlapping assigned-avatar stacks.
- 2026-05-14: Assignment role cleanup. Direct assignment now syncs the underlying shift worker type from the assigned user's role, while Assign page avatar removal uses a small explicit X control instead of making the whole avatar destructive.
- 2026-05-14: Schedule assignment row pass. The normal `/schedule` page now uses Staff as the generic coverage label, derives expanded-row Staff/Student labels from the assigned user's role, and lets staff/admin add another same-area same-kind shift from the expanded row's area badge.
- 2026-05-14: Assign page polish. `/schedule/assign` now shares the normal schedule title cleaner and venue-tone logic, uses a tighter control bar, shows venue/coverage context in the sticky event column, and gives assignment avatars a hover remove overlay with quieter open-slot/no-slot cells.
- 2026-05-14: Assign page area-slot pass. `/schedule/assign` now drops Staff/Student sub-sections, groups slots directly under each area column, and lets staff/admin add area slots or remove empty slots without opening the event detail page.
- 2026-05-14: Schedule hide hardening. Hide-event mutations now require a strict boolean payload, update visibility and audit logs in one transaction, show per-row in-flight state, and offer an Undo action from the success toast.
- 2026-05-14: Schedule naming pass. The normal `/schedule` page hides assigned/confirmed row badges in favor of the signed-in user's row tint, keeps covered-event language for fully staffed events, and avoids student-specific wording in generic schedule controls.
- 2026-05-14: Venue tone standardization. Home uses green, Away uses orange, and Neutral uses gray across schedule filters, list/week/calendar event indicators, event detail badges, booking event picks, dashboard Upcoming Events, and sport shift settings.
- 2026-05-14: Schedule event titles now use one shared formatter across list, week, and calendar views. Structured sport events keep the matchup as the primary title and move dash-suffix context such as tournament names or Homecoming into secondary text.
- 2026-05-12: Creation flow standardization. Event staffing setup, manual shift add, and post-for-trade flows now surface form-level errors in the active panel/dialog, guard slow-network submit state, and give an explicit next-step handoff after a shift is added instead of relying only on toasts.
- 2026-05-13: GAP-54 closed. The unscheduled standalone `archive-shifts` cron route was deleted; scheduled shift-group archiving remains inside `morning-refresh`, the single daily scheduling maintenance job.
- 2026-05-10: Schedule ownership pass. `/schedule` readiness now counts actual active shift assignments instead of events, filtered empty states can recover by clearing filters, manual all-day event creation treats the selected end date as an inclusive all-day date, list/week/calendar navigation controls now use larger deliberate targets, and `/schedule/assign` has stronger empty states plus accessible assignment/remove controls.
- 2026-05-08: API hardening Wave 2 added audit coverage for shift attendance updates and enriched shift deletion audits with force-delete and active-assignment context.
- 2026-05-08: API hardening Wave 1 fixed permission-map drift. `shift.manage` is now an explicit ADMIN/STAFF permission, matching existing shift-group and event-travel mutation route calls and preventing those routes from failing on an undefined permission action. Regression coverage added in `tests/rbac.test.ts`.
- 2026-04-25: **iOS schedule authoring shipped** — STAFF/ADMIN can assign + unassign + add shifts directly from `EventDetailSheet`; STUDENTs can request open Student slots (premier flow shows "staff will review" copy). REQUESTED-state assignments render a Pending pill. Closes the iOS-side gap for "Staff assignment" and "Student requests" rows in this AC list. Trade board (post / claim / cancel) was already shipped 2026-04-24. ShiftDetailPanel-equivalent remains web-only — iOS uses the event sheet inline.


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
| 2026-04-27 | **Assignment Grid shipped (`/schedule/assign`):** Month-level shift assignment matrix for staff. Rows = events, columns = area×workerType pairs derived from the month's shift data. Click "+" to assign any user via UserAvatarPicker popover; click avatar to remove. Month nav + sport/area filters. Multi-slot events (same area+workerType > 1 shift) display stacked avatars per cell. Conflict indicator dot shown on assignments with `hasConflict=true`. Accessible via "Assign shifts" button on Schedule page header (staff/admin only). | Grid |
| 2026-04-27 | **Conflict indicators in assignment picker:** New `GET /api/shifts/[id]/conflicts` endpoint checks `StudentAvailabilityBlock` rows against shift time. `UserAvatarPicker` shows yellow dot + "⚠ conflict" label for conflicted users. `AssignmentCell` fetches conflict map on popover open. | Grid |
| 2026-05-05 | **Doc sync:** Student availability V1 recorded as shipped. Scope is recurring weekly unavailability blocks, not date-specific exceptions. See `docs/BRIEF_STUDENT_AVAILABILITY_V1.md`. | Docs |
| 2026-04-27 | **Trade board enhancements:** "My Trades" FilterChip in TradeBoard (filters to trades posted/claimed by current user). "Post for trade" button in ListView expanded shift rows — students can post directly from the schedule list without opening ShiftDetailPanel. | Trades |
| 2026-05-05 | **Shift trade emails shipped:** Existing trade lifecycle notifications now send best-effort email companions for claimed, completed, approved, and declined trades. Delivery uses the existing Resend helper and respects email notification preferences. | Email |
| 2026-05-05 | **Schedule polish and hardening:** New Event sheet now uses valid non-empty Select sentinels, aborts location fetches cleanly, handles auth redirects, and blocks duplicate submits. Desktop ListView row expansion now uses a real expand control instead of row-as-link semantics, while inline assignment and trade posting have ref-backed duplicate-submit guards. | Polish |
| 2026-05-05 | **Schedule command bar and coverage polish:** Schedule filters now group view, venue, coverage, and secondary filters with a promoted Needs staff control. ListView surfaces open-slot counts in the header and highlights under-covered events with explicit Needs badges. | Polish |
| 2026-05-05 | **Trade-board dev stability:** Shift trade listing now avoids parallel count/list Prisma reads, clearing the local dev `GET /api/shift-trades?status=OPEN` 500 seen during schedule reloads. | Polish |
| 2026-05-05 | **Schedule readiness snapshot:** `/schedule` now includes a compact operational summary for open slots, ready events, the viewer's shifts, open trades, and next visible call time. | Polish |
| 2026-05-05 | **Inline assignment matrix:** Expanded schedule events now render one assignment matrix with scannable area/worker slots. Staff can assign open slots from the matrix, students keep inline trade posting, and the full event manager remains one explicit action away. | Polish |
| 2026-05-05 | **Collapsed staffing preview:** Collapsed schedule rows now show a shadcn-style avatar group plus open-slot count, fading away when expanded. Expanded events use dense assignment rows again so fully staffed events stay compact while open slots remain assignable. | Polish |
| 2026-05-05 | **Schedule role language:** Schedule list rows now replace raw enum abbreviations with readable Staff/Student slot language, summarize open needs by role in the event metadata, and keep event start/all-day context in front of the event title. The right column is reserved for real home call times; away/neutral call-time placeholders are omitted because those events depend on travel logistics. The collapsed avatar preview only shows assignment state, while expanded rows keep role labels neutral so area remains the primary color signal. | Polish |
| 2026-05-07 | **Avatar and picker cleanup:** Collapsed schedule staffing previews now use the shared `UserAvatarGroup`, and `UserAvatarPicker` conflict indicators use tokenized `Badge`/status colors instead of raw yellow styling. Event-detail staffing controls moved obvious icon/assign/request actions onto shadcn `Button` variants. | Polish |
| 2026-05-08 | **API hardening Wave 10:** Public shift ICS feeds now reject malformed tokens, rate-limit by IP and token, only serve active users, and cap assignment reads to a 500-event rolling window. | Hardening |
| 2026-05-08 | **API hardening Wave 11:** Shift regenerate was re-verified as additive-only: it skips manually edited groups, does not wipe shifts, and already audits `shift_group_regenerated` with the added-shift count. | Hardening |
| 2026-05-08 | **API hardening Wave 13:** Manual shift creation now uses explicit Serializable isolation, auto-assign is rate-limited per actor, and ICS token rotation is capped to prevent churn. | Hardening |
