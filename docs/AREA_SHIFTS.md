# AREA: Shift Calendar & Scheduling

> Status: **Planning** | Owner: TBD | Last Updated: 2026-03-16

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

- [ ] Sport configuration: per-area home/away shift counts configurable per sport
- [ ] Sport roster: students/staff assigned to sports, synced to user profiles
- [ ] Auto-generation: shifts created when calendar events sync from ICS
- [ ] Staff assignment: pick students from sport pool for each shift
- [ ] Student requests: students can request premier event shifts (staff approves)
- [ ] Trade board: students post shifts for trade, area-filtered visibility
- [ ] Trade claims: instant swap (non-premier) or staff-approved swap (premier)
- [ ] Calendar view: month grid with coverage indicators (green/orange/red)
- [ ] List view: grouped by event, filterable by sport/area/status
- [ ] User profiles: inline contact info, primary/secondary area, assigned sports
- [ ] Mobile: responsive card layout, full-screen detail panel

## Dependencies

- CalendarEvent model (existing — ICS sync)
- CalendarSource sync service (existing — `src/lib/services/calendar-sync.ts`)
- User model with RBAC roles (existing)
- Sports code mappings (existing — `src/lib/sports.ts`)

## Change Log

| Date | Change | Slice |
|------|--------|-------|
| 2026-03-16 | Plan created | — |
