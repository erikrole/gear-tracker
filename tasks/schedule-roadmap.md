# Schedule Page Roadmap

> Replaces `tasks/calendar-roadmap.md` (archived). Last updated 2026-04-02.

## Context

The Schedule page (`/schedule`) is the unified hub for "what's happening and who's working?"
It merges the old Events list + Shift Schedule into a single page with list and calendar views.
Staff use it to plan coverage and assign shifts. Students use it to see their shifts and request
premier events. The event detail page (`/events/[id]`) provides the deep-dive per-event view
with gear status and management actions.

**North Star alignment**: Operational speed over feature breadth. Every feature should reduce
clicks or surface the right info at the right time.

---

## V1 — Core (Shipped 2026-03-26)

> V1 merged the old Events + Schedule pages and shipped all core V2 enhancements.
> This section documents the shipped baseline.

### Features

**Schedule Page** (`src/app/(app)/schedule/page.tsx`):
- **View Toggle**: List | Calendar (persisted to localStorage)
- **List View**: Date-grouped expandable table (desktop) / card list (mobile)
  - Parent rows: event name, coverage badge (e.g. "2/4"), premier badge, user's shift status
  - Child rows: individual shifts with area badge, assigned person avatar, worker type, time
  - Clicking parent row → expand/collapse shifts
  - Clicking child row → opens ShiftDetailPanel
  - Clicking event name → navigates to `/events/[id]`
- **Calendar View**: Month grid with event dots
  - Coverage indicator dots (green = 100%, orange = partial, red = 0%)
  - Home/away color coding
  - Click event → opens ShiftDetailPanel (or link to detail if no shifts)
  - Month navigation (prev/next/today)
  - "+N more" expansion per day
- **Filters**: Sport, Area, Coverage (Needs staff / Fully staffed), Time (Include past)
- **My Shifts toggle**: Default ON for students, persisted to localStorage
- **Trade Board**: Sheet overlay via header button
  - Open trade count badge
  - Area and status filters
  - Claim, approve, decline, cancel workflows
  - Role-based actions (students claim, staff approve)
- **ShiftDetailPanel**: Side sheet for shift management
  - Per-event shift editing (add/remove shifts per area)
  - Universal user assignment with avatar picker and search
  - Premier toggle (staff only)
  - Approve/decline shift requests
  - `manuallyEdited` flag prevents auto-generation overwrite

**Event Detail Page** (`src/app/(app)/events/[id]/page.tsx`):
- Badge bar: status, sport, home/away, location
- Details card: Opponent, When, Venue
- Shift Coverage card (single card, role-aware):
  - Staff/admin: gear summary pills + 5-column table (Area, Type, Assigned, Shift, Gear) + missing gear with nudge/checkout actions
  - Students: basic 4-column table (Area, Type, Assigned, Status)
  - "Manage shifts" button opens ShiftDetailPanel
- Action CTAs: "Reserve gear for this event", "Checkout to this event"
- Raw ICS debug data (admin-only)

**Dashboard integration**:
- "My Shifts" card: upcoming assigned shifts with area, time, "Prep gear" button
- "Upcoming Events" card: events with assigned user avatars

### RBAC
| Feature | Admin | Staff | Student |
|---------|-------|-------|---------|
| View all events | Yes | Yes | Yes |
| Coverage badges | Yes | Yes | Yes |
| Open ShiftDetailPanel | Yes | Yes | No (view only on premier) |
| Assign/remove users | Yes | Yes | No |
| Add/remove shifts | Yes | Yes | No |
| Toggle premier | Yes | Yes | No |
| Request shift (premier) | No | No | Yes |
| Trade Board (claim) | No | No | Yes |
| Trade Board (approve) | Yes | Yes | No |
| Command Center (gear) | Yes | Yes | No |
| Raw ICS debug data | Yes | No | No |

### API Routes (all existing)
- `GET /api/calendar-events` — event listing with filters
- `GET /api/shift-groups` — shift groups with coverage
- `GET /api/shift-groups/[id]` — single group detail
- `POST /api/shift-groups/[id]/shifts` — add shift
- `DELETE /api/shift-groups/[groupId]/shifts/[shiftId]` — remove shift
- `POST /api/shift-assignments` — assign user to shift
- `DELETE /api/shift-assignments/[id]` — remove assignment
- `PATCH /api/shift-assignments/[id]/approve` — approve request
- `PATCH /api/shift-assignments/[id]/decline` — decline request
- `POST /api/shift-assignments/request` — student requests shift
- `GET /api/shift-trades` — trade board listing
- `POST /api/shift-trades` — post trade
- `PATCH /api/shift-trades/[id]/claim` — claim trade
- `PATCH /api/shift-trades/[id]/approve` — approve trade
- `PATCH /api/shift-trades/[id]/cancel` — cancel trade
- `GET /api/calendar-events/[id]` — single event detail
- `GET /api/calendar-events/[id]/command-center` — gear status for event
- `GET /api/me` — current user info

### Components Used
- shadcn: `Card`, `Table`, `Badge`, `Button`, `Sheet`, `Avatar`, `Skeleton`, `Switch`, `ToggleGroup`, `Tooltip`, `Popover`, `Alert`
- Custom: `FilterChip`, `PageHeader`, `DataList`, `EmptyState`, `SkeletonTable`
- Dynamic: `ShiftDetailPanel`, `TradeBoard`

### What V1 does NOT include
- Week view
- Gear readiness indicators on schedule views
- Conflict detection on assignment
- Smart assignment suggestions
- Batch operations
- Student availability
- Real-time updates
- Quick-assign from list view without opening panel

---

## V2 — Enhanced (faster planning for staff, clearer workflow for students)

> Goal: Reduce clicks for the two most common workflows — staff planning coverage
> across multiple events, and students managing their shift commitments. ~2-3 sessions.
>
> This page serves staff and students equally. Staff are planning and assigning.
> Students are viewing, requesting, and trading. V2 improves both workflows.

### Features

#### 2a. Week View (Staff + Student)
**What**: 7-day strip view showing events as time blocks, color-coded by coverage.
**Why**: Month view is too zoomed out for "what does this week look like?" — the most common staff question. Students also benefit from seeing their week at a glance.

**Staff perspective**: "I need to plan coverage for the next 7 days. Which events are understaffed? Where should I focus?"
**Student perspective**: "What am I working this week? When are my shifts?"

- Horizontal 7-day grid with time axis (8am–10pm)
- Events rendered as blocks spanning their time range
- Coverage dot on each block (same green/orange/red pattern)
- All-day events in a top row
- Click event → opens ShiftDetailPanel (staff) or event detail (students on non-premier)
- Navigation: prev/next week, "This week" button
- Add "Week" to the existing List | Calendar toggle → List | Week | Calendar
- "My Shifts" filter works on week view — highlights user's assigned shifts

**Files**:
- New: `src/app/(app)/schedule/_components/WeekView.tsx`
- Modified: `src/app/(app)/schedule/page.tsx` (add view mode option)
- Modified: `src/hooks/use-schedule-data.ts` (add `weekStart` state, fetch 7-day window)
- Modified: `src/app/(app)/schedule/_components/ScheduleFilters.tsx` (add Week toggle)

**API**: Existing `/api/calendar-events` + `/api/shift-groups` with adjusted date range params.

**shadcn**: `ToggleGroup` (extended), `Tooltip` (hover detail), `Button` (navigation)

**Mobile**: Week view renders as a scrollable 7-day column on mobile (vertical, one day at a time) rather than being hidden. More useful than month grid on a phone in the field.

**RBAC**: All roles see events. Staff/admin can open ShiftDetailPanel from any event. Students see their shifts highlighted.

#### 2b. Gear Readiness Indicators (Staff)
**What**: Small icon on list/week/calendar views showing whether assigned workers have their gear ready.
**Why**: Staff currently must click into each event's detail page to check gear status. When planning 10+ events for the week, this is the #1 time sink. Surfacing it saves dozens of clicks.

- Per-event gear readiness icon next to coverage badge:
  - Green checkmark: all assigned workers have gear reserved or checked out
  - Orange warning: some assigned workers missing gear
  - No icon: no shifts assigned (nothing to check)
- Tooltip on hover shows breakdown: "3/4 workers have gear"
- Click → navigates to `/events/[id]` (Shift Coverage card with gear details)

**Files**:
- Modified: `src/app/(app)/schedule/_components/ListView.tsx` (add gear icon to parent rows)
- Modified: `src/app/(app)/schedule/_components/CalendarView.tsx` (add gear icon to event buttons)
- New: `src/app/(app)/schedule/_components/WeekView.tsx` (include from start)
- Modified: `src/hooks/use-schedule-data.ts` (extend `CalendarEntry` type with `gearReadiness`)
- Modified: `src/app/(app)/schedule/_components/types.ts` (add `gearReadiness` field)

**API**: Extend `/api/shift-groups` response to include `gearReadiness: { total, ready, percentage }` per group. Computed from ShiftAssignment → Booking join (check if assignment has a linked booking in RESERVED or CHECKED_OUT status).

**New API route**: None — extend existing `/api/shift-groups` response.

**shadcn**: `Tooltip`, existing `Badge`

#### 2c. Conflict Warning on Assignment (Staff)
**What**: When assigning a user in ShiftDetailPanel, warn if they have an overlapping shift at another event.
**Why**: Staff frequently assign the same pool of reliable workers. Without feedback, double-booking happens silently and creates problems day-of.

- Before confirming assignment, check `/api/shift-assignments/check-conflict?userId=X&startsAt=Y&endsAt=Z`
- If conflict exists: show inline warning with the conflicting event name and time
- Staff can still proceed (override), but must acknowledge
- Warning shown in the user picker popover — flagged users get a warning icon

**Files**:
- New: `src/app/api/shift-assignments/check-conflict/route.ts`
- Modified: `src/components/ShiftDetailPanel.tsx` (add conflict check before assign)
- Modified: `src/components/shift-detail/ShiftSlotCard.tsx` (show conflict warning)
- Modified: `src/components/shift-detail/UserAvatarPicker.tsx` (flag conflicting users)

**API**: New `GET /api/shift-assignments/check-conflict?userId=...&startsAt=...&endsAt=...`
- Returns `{ hasConflict: boolean, conflicts: [{ eventSummary, startsAt, endsAt }] }`

**shadcn**: `Alert` (inline warning)

#### 2d. Shift Actions in Context (Staff + Student)
**What**: Surface common actions where users already are, instead of requiring navigation.
**Why**: Both roles have actions buried behind extra clicks.

**Staff**:
- In list view expanded child rows, add a quick "Assign" button on unassigned shifts that opens the user picker inline (via Popover) — no need to open the full ShiftDetailPanel for simple assignments
- On event detail, "Manage shifts" is already accessible — no change needed

**Students**:
- In list view, when "My Shifts" is active, add "Post to trade board" action per assigned shift
- Trade Board badge shows area-filtered count (trades in the student's primary area), not just global count
- Better empty state: when student has no shifts and there are premier events with open slots, hint "Browse upcoming events to request shifts"

**Files**:
- Modified: `src/app/(app)/schedule/_components/ListView.tsx` (quick-assign popover on child rows, trade action for students)
- Modified: `src/app/(app)/schedule/page.tsx` (area-filtered trade count for students)
- Modified: `src/hooks/use-schedule-data.ts` (extend trade count query with area filter)

**shadcn**: `Popover` (inline assignment), existing `Badge`

### What V2 does NOT include
- Drag-to-assign in week view (ShiftDetailPanel + quick-assign is sufficient)
- Batch operations across multiple events
- Smart assignment suggestions (V3)
- Student availability calendar (V3)
- Real-time updates / WebSocket (V3)
- Inline event editing

### Schema Changes
None. Gear readiness is computed from existing ShiftAssignment ↔ Booking join. Conflict check queries existing Shift + ShiftAssignment tables.

### Loading / Error / Empty States
- **Week view loading**: Skeleton blocks in 7-column grid
- **Week view empty**: "No events this week" with prev/next navigation
- **Gear readiness**: Graceful degradation — if data unavailable, omit icon (don't block schedule load)
- **Conflict check**: Non-blocking — if API fails, skip warning and allow assignment

### Build Order
1. Week view component + view toggle integration (biggest lift, most visible)
2. Gear readiness indicators (API extension + list/calendar/week UI)
3. Conflict warning on assignment (ShiftDetailPanel + UserAvatarPicker)
4. Shift actions in context (quick-assign for staff, trade actions for students)

---

## V3 — Advanced (predictive, automated)

> Goal: The page anticipates needs and automates routine decisions.
> Ship when V2 is stable and user feedback confirms direction.
> Staff and students both benefit — staff get faster planning, students get
> smarter scheduling.

### Features

#### 3a. Smart Assignment Suggestions (Staff)
**What**: When opening ShiftDetailPanel for an unfilled shift, suggest best-fit users based on area match, availability, and past history.
**Why**: Staff currently scroll through the full user list for every assignment. With 20+ active users, finding the right person is slow. Suggestions surface the right people first.

- Top 3 suggested users shown above the picker with explanation ("Primary area: Video, no conflicts")
- Suggestion criteria (heuristic, no ML):
  1. User's `primaryArea` matches shift area (from `StudentAreaAssignment.isPrimary`)
  2. User assigned to the sport (from `StudentSportAssignment`)
  3. No time conflict with existing shifts
  4. Recent history working this sport/area (from past ShiftAssignments)
- "Auto-fill" button: assign best-fit users to all open shifts for an event (staff only)

**API**: New `GET /api/shift-suggestions?shiftGroupId=...&shiftId=...`
**Schema**: None — uses existing StudentAreaAssignment, StudentSportAssignment, ShiftAssignment tables.

#### 3b. Student Availability (Student + Staff)
**What**: Students declare dates they're unavailable. Staff see availability when assigning.
**Why**: Staff currently ask students verbally about availability. This automates the information exchange and prevents assigning unavailable students.

**Student perspective**: "I can mark when I'm busy so staff don't assign me to events I can't work."
**Staff perspective**: "I can see who's actually available before I start assigning."

- Student profile section: "My Availability" — mark dates unavailable with optional reason
- Schedule calendar view: gray overlay on dates where user is unavailable (when "My Shifts" active)
- ShiftDetailPanel suggestions: exclude unavailable users
- Staff view in UserAvatarPicker: unavailable users shown with "Unavailable" tag (still assignable with override)

**Schema change**: New `StudentAvailability` model:
```prisma
model StudentAvailability {
  id        String   @id @default(cuid())
  userId    String   @map("user_id")
  date      DateTime @db.Date
  reason    String?
  createdAt DateTime @default(now()) @map("created_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, date])
  @@map("student_availability")
}
```

**API**:
- `GET /api/users/[id]/availability?start=...&end=...`
- `POST /api/users/[id]/availability` — declare unavailable dates
- `DELETE /api/users/[id]/availability/[id]` — remove unavailability

#### 3c. Batch Operations (Staff)
**What**: Select multiple events and apply bulk actions (regenerate shifts, bulk assign from template).
**Why**: At season start, staff need to set up shifts for 20+ events. One-by-one is tedious. This turns a 30-minute task into a 2-minute task.

- Checkbox column in list view (staff/admin only)
- Bulk actions toolbar: "Regenerate shifts" (re-run sport config template), "Clear all shifts"
- Confirmation dialog with event count and impact summary
- Skips events with `manuallyEdited = true` (with option to override)

**API**: New `POST /api/shift-groups/bulk-generate` — regenerate shifts for selected events
**Schema**: None.

#### 3d. Coverage Heatmap (Staff)
**What**: Month-level heatmap overlay showing coverage density across the month.
**Why**: At a glance, staff can see which days/weeks are understaffed without checking individual events.

- Toggle overlay on calendar view
- Cell background color intensity = coverage percentage (red gradient for understaffed)
- Uses existing shadcn `Heatmap` component

#### 3e. Real-Time Updates (All roles)
**What**: Live coverage updates so the page doesn't go stale when multiple people are working.
**Why**: When staff are assigning shifts in parallel, or students are claiming trades, the page data can become stale quickly.

- Polling strategy: re-fetch shift groups every 30s when page is visible (use `visibilitychange` API)
- Optimistic updates already exist in ShiftDetailPanel — extend to list/calendar/week views
- Visual indicator when data is being refreshed (subtle spinner)

**Schema**: None. Implementation via React Query `refetchInterval`.

### What V3 does NOT include
- Drag-to-assign (complex interaction, low ROI vs ShiftDetailPanel + quick-assign)
- AI-based scheduling optimization
- Cross-team resource sharing
- Historical analytics/trends dashboard (see Phase C)

### Build Order
1. Smart suggestions (highest impact for staff, no schema change)
2. Student availability (schema migration + student UI + staff picker integration)
3. Batch operations (staff workflow at scale)
4. Coverage heatmap (visual enhancement)
5. Real-time updates (polish)

---

## Dependencies Summary

| Version | Schema Changes | New API Routes | New Components | Sessions |
|---------|---------------|----------------|----------------|----------|
| V1 | None (shipped) | None (shipped) | None (shipped) | — |
| V2 | None | 1 (`check-conflict`) | 1 (`WeekView`) | 2-3 |
| V3 | 1 (`StudentAvailability`) | 4 new routes | Suggestions UI, availability UI, batch toolbar | 4-6 |

## Risks

| Risk | Mitigation |
|------|-----------|
| Week view scope creep (drag-to-assign) | Explicitly excluded — ShiftDetailPanel handles assignment |
| Gear readiness API performance | Batch query with single join, not N+1. Cache in React Query. |
| Conflict check false positives | Only warn on time overlap, not same-day. Staff can override. |
| V3 smart suggestions over-engineering | Heuristic only (area + sport + no conflict). No ML. |
| Student availability adoption | Make it optional — suggestions work without it, just less accurate |
| Batch operations safety | Confirmation dialog with impact summary. Skip `manuallyEdited` groups. |

## Key Files

### Schedule Page
- `src/app/(app)/schedule/page.tsx` — main page orchestrator
- `src/app/(app)/schedule/_components/ListView.tsx` — list view
- `src/app/(app)/schedule/_components/CalendarView.tsx` — calendar view
- `src/app/(app)/schedule/_components/ScheduleFilters.tsx` — filter bar
- `src/app/(app)/schedule/_components/types.ts` — shared types
- `src/hooks/use-schedule-data.ts` — data fetching hook

### Event Detail
- `src/app/(app)/events/[id]/page.tsx` — event detail page

### Shift Management
- `src/components/ShiftDetailPanel.tsx` — shift management side sheet
- `src/components/shift-detail/ShiftAreaSection.tsx` — per-area shift section
- `src/components/shift-detail/ShiftSlotCard.tsx` — individual shift slot
- `src/components/shift-detail/UserAvatarPicker.tsx` — user assignment picker
- `src/components/TradeBoard.tsx` — trade board component

### Dashboard
- `src/app/(app)/page.tsx` — dashboard with My Shifts + Upcoming Events
