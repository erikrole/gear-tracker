# Calendar Page Roadmap — Merge Shifts + Events

## Context

Today there are **two separate pages** that both pivot on `CalendarEvent`:
- **Events** (`/events`, sidebar: "Calendar") — ICS source management, event listing, venue mappings
- **Schedule** (`/schedule`, sidebar: "Schedule") — Shift coverage, assignment, trade board

Both views answer the same question: "What's happening and who's working?" Splitting them forces staff to bounce between pages to see the full picture. The `CalendarEvent` model is already the shared backbone — the UI should reflect that.

### What stays separate
- **Event Detail** (`/events/{id}`) — keeps its own page with Command Center, shift coverage, gear status
- **Calendar Sources** — already duplicated in `/settings/calendar-sources`; remove from the merged page entirely (admin config ≠ daily ops)
- **Venue Mappings** — move to Settings (same reasoning)

---

## Current State Assessment

### What works well (keep in all versions)
- Month calendar grid with event dots (from both pages)
- List view with date grouping
- FilterChip pattern for sport/area filtering
- ShiftDetailPanel as a side sheet (don't reinvent)
- Coverage indicator dots (green/orange/red)
- Mobile cards pattern

### What's missing or friction-y
- **Two pages for one workflow** — staff check `/events` for what's coming, then `/schedule` for coverage
- **No unified "day view"** — calendar cells show dots but no detail without clicking through
- **Trade Board is buried** as a tab on `/schedule` — students may not discover it
- **Calendar Sources panel clutters** the events page for non-admin roles
- **No quick coverage summary** on the events list view

### Schema data available but not surfaced on one page
- Event list doesn't show shift coverage
- Schedule page doesn't show venue/location mapping status
- Neither page shows gear booking counts per event

---

## V1 — Unified Calendar (core merge, feels complete) ✅ Shipped 2026-03-23

> **Note**: Shipped as unified `/schedule` page (not `/calendar`). Events + Schedule merged. Old `/events` list removed. Detail page `/events/[id]` unchanged. Venue Mappings → `/settings/venue-mappings`. Calendar Sources → `/settings/calendar-sources`.

**Goal**: One page, one mental model. "What's happening and who's working?"

### Architecture
- **Route**: `/calendar` (new route, redirect `/events` and `/schedule` to it)
- **Sidebar**: Single "Calendar" entry (remove "Schedule")
- **Tabs**: None at top level — single unified view with toggle

### Features

**View Toggle**: List | Calendar (reuse existing ToggleGroup pattern)

**Calendar View** (month grid):
- Event dots with coverage indicator (merge both existing calendar views)
- Color: home/away/neutral (from events page)
- Coverage dot: green (100%), orange (partial), red (0%) (from schedule page)
- Click event → open ShiftDetailPanel (from schedule page)
- Click day → scroll list view to that day (new)
- Month navigation: prev/next/today

**List View** (default):
- Date-grouped events (from events page pattern)
- Per event row shows:
  - Sport badge, event name, opponent, time, venue
  - **Coverage badge** (e.g., "4/6 staffed" with color) — NEW addition from schedule data
  - Click → navigate to `/events/{id}` detail page
- Mobile: card layout with coverage badge

**Filters** (unified):
- Sport code (existing)
- Area: VIDEO/PHOTO/GRAPHICS/COMMS (from schedule)
- Coverage: "Needs staff" / "Fully staffed" (from schedule)
- Past events toggle (from events)
- URL-persisted via query params

**RBAC**:
- ADMIN/STAFF: See all events, coverage, can open ShiftDetailPanel
- STUDENT: See all events, own shift indicators, "Request shift" on premier events

**What's NOT included in V1**:
- Calendar Sources management (lives in `/settings/calendar-sources` only)
- Venue Mappings management (move to Settings)
- Trade Board (stays accessible via link/button, addressed in V2)
- Inline event editing
- Gear booking counts per event

### API Routes
- **Existing**: `GET /api/shift-groups` (already returns event + coverage data)
- **Existing**: `GET /api/calendar-events` (event listing)
- **New**: `GET /api/calendar` — combined endpoint returning events with coverage summary in one query (avoids two round-trips). Returns:
  ```
  { events: [{ ...event, coverage: { total, filled, percentage }, shiftGroupId }] }
  ```
- **Existing**: ShiftDetailPanel APIs unchanged

### Loading / Error / Empty States
- **Loading**: SkeletonTable (list) or skeleton calendar grid
- **Empty**: "No upcoming events. Check Settings → Calendar Sources to add an ICS feed." (with link for admins)
- **Error**: Toast on API failure, stale data shown with "Last updated X ago" badge

### Mobile
- Default to list view (calendar grid too small on phone)
- Cards with sport badge + coverage badge + time
- Tap card → event detail page
- FAB or sticky header for filters

### Schema Changes
- None. All data already exists.

### Components
- `Calendar` (shadcn), `ToggleGroup`, `Badge`, `Card`, `Button`
- `FilterChip` (existing custom), `ShiftDetailPanel` (existing)
- `SkeletonTable`, `EmptyState` (existing)

### Build Order (Thin Slices)
1. **New `/api/calendar` endpoint** — combined events + coverage query
2. **New `/calendar` page** — list view with coverage badges
3. **Calendar view** — month grid merging both existing views
4. **Filters** — sport, area, coverage, past events
5. **Redirects** — `/events` → `/calendar`, `/schedule` → `/calendar`; update sidebar
6. **Cleanup** — remove old pages, move Calendar Sources/Venue Mappings to Settings exclusively

---

## V2 — Enhanced (less friction, more context)

**Goal**: Reduce clicks. Surface the right info without navigating away.

### New Features

**Day Drawer / Expanded Day**:
- Click a calendar day → slide-out panel showing all events for that day
- Each event shows: name, time, coverage summary, quick-assign button
- Staff can open ShiftDetailPanel directly from here

**Trade Board Integration**:
- "Trades" pill/badge in header showing count of open trades (e.g., "3 open trades")
- Click → sheet/drawer with TradeBoard component (not a separate page)
- Students see trades badge prominently; staff see it as secondary

**Inline Coverage Expansion**:
- In list view, click coverage badge → expand row to show per-area breakdown
- VIDEO: 2/2, PHOTO: 1/2, GRAPHICS: 1/1, COMMS: 0/1
- Quick-assign button per unfilled area (opens ShiftDetailPanel filtered to that area)

**"My Shifts" Filter** (student-focused):
- Toggle: "My shifts only" — filters to events where current user has an assignment
- Shows shift status badge (Confirmed, Pending request)
- Prominent for STUDENT role, available for all

**Gear Status Indicators**:
- On list view, show gear readiness icon per event (from command-center data)
- Green checkmark = all assigned staff have gear reserved/checked out
- Orange warning = some staff missing gear
- Click → navigate to event detail Command Center

**Smarter Defaults**:
- Remember last view (list/calendar) in localStorage
- Remember last filter selections
- Default month = current month (already true)
- Auto-scroll list to today's date on load

### API Changes
- Extend `/api/calendar` to include `gearReadiness` summary per event
- No new endpoints needed — TradeBoard already has its own API

### RBAC Enhancements
- Students see "My Shifts" toggle ON by default
- Trade badge count scoped: students see trades they can claim, staff see all open

### Mobile
- Day drawer works as bottom sheet on mobile
- Trade badge in sticky header
- "My Shifts" toggle prominent in filter bar

### Components
- `Sheet` (for day drawer and trade board)
- `Collapsible` (for inline coverage expansion)
- Existing TradeBoard component (moved into sheet)

### Build Order
1. "My Shifts" filter + localStorage view persistence
2. Inline coverage expansion in list view
3. Day drawer in calendar view
4. Trade Board integration as sheet
5. Gear status indicators

---

## V3 — Advanced (predictive, automated)

**Goal**: The page anticipates needs and automates routine decisions.

### New Features

**Week View**:
- 7-day grid showing time blocks per event
- Shift slots visible as colored blocks per area
- Drag-to-assign (staff only) — drag user from roster onto empty slot
- Most useful for "this week's planning" workflow

**Coverage Heatmap**:
- Month-level heatmap overlay showing coverage density
- Red days = understaffed, green = fully staffed
- At-a-glance "where do I need to focus?" for staff/admin
- Uses existing `Heatmap` shadcn component

**Smart Suggestions**:
- When opening ShiftDetailPanel for an unfilled shift:
  - Suggest users based on: primary area match, availability (no conflicts), past event history
  - Sort suggestions by fit score
- "Auto-fill" button: assign best-fit users to all open shifts for an event

**Conflict Detection**:
- When assigning a user, warn if they have overlapping shifts
- Show conflicts inline in ShiftDetailPanel
- Block double-booking with override option for admin

**Batch Operations**:
- Select multiple events → "Bulk generate shifts" (regenerate shift groups)
- Select multiple events → "Bulk assign" (apply roster template)
- Multi-select in list view with checkbox column

**Student Availability Layer**:
- Students declare unavailable dates (Phase B deferred item)
- Calendar view shows availability overlay (gray out unavailable dates)
- Suggestions engine respects availability

**Real-Time Updates**:
- WebSocket or polling for live coverage updates
- "Someone just claimed a trade" → badge updates without refresh
- Collaborative awareness: "Erik is viewing this event's shifts"

### Schema Changes
- `StudentAvailability` model: `userId`, `date`, `reason` (optional)
- Index on `userId + date` for fast lookup

### API Changes
- `GET /api/calendar?view=week&start=...&end=...` — week view data
- `POST /api/shift-groups/bulk-generate` — batch shift generation
- `GET /api/users/{id}/availability` — student availability
- `POST /api/users/{id}/availability` — declare unavailable dates
- `GET /api/shift-suggestions?shiftId=...` — smart assignment suggestions

### Build Order
1. Student availability model + API
2. Week view
3. Coverage heatmap overlay
4. Smart suggestions in ShiftDetailPanel
5. Conflict detection
6. Batch operations
7. Real-time updates

---

## Dependencies Summary

| Version | Schema Changes | New API Routes | New Components | Prereqs |
|---------|---------------|----------------|----------------|---------|
| V1 | None | `/api/calendar` | Merged page | Calendar Sources already in Settings |
| V2 | None | Extend `/api/calendar` | Day drawer, trade sheet | V1 shipped |
| V3 | `StudentAvailability` | 4 new routes | Week view, heatmap overlay | V2 shipped |

## Risks

- **V1 scope creep**: Resist adding Trade Board or inline editing to V1. The merge itself is enough change.
- **V2 YAGNI**: Gear status indicators may be low-value if staff already use Command Center. Validate with users before building.
- **V3 "smart suggestions"**: ML-free heuristic is fine (area match + no conflict). Don't over-engineer.
- **Redirect breakage**: `/events/{id}` detail pages must NOT redirect — only the list page redirects.
- **Mobile regression**: Test both views (list + calendar) on mobile at each version.

## Files to Modify (V1)

### New
- `src/app/(app)/calendar/page.tsx` — merged page
- `src/app/api/calendar/route.ts` — combined endpoint

### Modified
- `src/components/Sidebar.tsx` — single "Calendar" entry → `/calendar`
- `src/app/(app)/events/page.tsx` — redirect to `/calendar`
- `src/app/(app)/schedule/page.tsx` — redirect to `/calendar`
- `src/app/(app)/settings/calendar-sources/page.tsx` — add Venue Mappings section (moved from events page)

### Reused (no changes)
- `src/components/ShiftDetailPanel.tsx`
- `src/components/TradeBoard.tsx`
- `src/components/FilterChip.tsx`

### Deleted (after redirects confirmed working)
- Events page Calendar Sources panel code
- Events page Venue Mappings panel code
- Schedule page (replaced by redirect)

## Verification (V1)

1. Navigate to `/calendar` — see unified list with coverage badges
2. Toggle to calendar view — see event dots with coverage indicators
3. Click event in calendar → ShiftDetailPanel opens
4. Click event in list → navigates to `/events/{id}`
5. `/events` redirects to `/calendar`
6. `/schedule` redirects to `/calendar`
7. Sidebar shows single "Calendar" entry
8. Calendar Sources only accessible via Settings
9. Filters work: sport, area, coverage, past events
10. Mobile: list view usable, cards show coverage
11. `npm run build` passes
12. All existing event detail + shift detail functionality unchanged
