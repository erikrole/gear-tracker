# AREA: Shift Calendar & Scheduling

> Status: **Implemented** | Owner: TBD | Last Updated: 2026-03-16

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

## Dependencies

- CalendarEvent model (existing — ICS sync)
- CalendarSource sync service (existing — `src/lib/services/calendar-sync.ts`)
- User model with RBAC roles (existing)
- Sports code mappings (existing — `src/lib/sports.ts`)

## Change Log

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
