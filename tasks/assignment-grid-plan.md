# Plan: Assignment Grid (Month View)

> Status: **In Progress** | P1 | Owner: TBD

## Goal

A full-page month matrix at `/schedule/assign` where staff can see and manage all shift assignments across events in a month without opening ShiftDetailPanel per event. "Direct assign is 70% of what we do."

## Multi-Slot Finding

3 of 140 groups have >1 shift of the same area+workerType (e.g. VIDEO-ST × 2). Grid cells will display **all assignments stacked** for a given area+workerType rather than numbered per-slot columns. This handles multi-slot naturally.

## Page Design

- URL: `/schedule/assign?month=YYYY-MM&sport=&area=`  
- Route: `src/app/(app)/schedule/assign/page.tsx`
- Access: staff/admin only (redirect students back to `/schedule`)
- Month navigation: ← prev / current month label / next →
- Sport + Area filter dropdowns in page header
- Table: rows = calendar events, columns = area×workerType combos present in the month

### Column logic
Columns derived from shifts that exist in the loaded month. Typically: VIDEO-FT, VIDEO-ST, PHOTO-FT, PHOTO-ST, GRAPHICS-FT, GRAPHICS-ST, COMMS-FT, COMMS-ST. Only show columns where at least one shift exists.

### Cell states
- **No shift group**: grey/disabled (event has no shift group yet)
- **Open**: empty slot count shown, "+" to assign
- **Partial**: some avatars + "+" to add
- **Full**: all avatars, green ring, still clickable to manage

### Assignment flow
1. Click any cell → Popover opens (reuses UserAvatarPicker)
2. Pick user → `POST /api/shift-assignments` with shiftId + userId
3. Cell refreshes inline (React Query invalidation)
4. Click existing avatar in cell → confirm → `DELETE /api/shift-assignments/[id]`

## Slices

### Slice 1 — Data hook + page shell ✅
- [x] `src/hooks/use-assignment-grid.ts` — fetches month events + shift-groups, merges, returns column defs + row data
- [x] `src/app/(app)/schedule/assign/page.tsx` — page shell with month nav, sport/area filters, renders grid
- [x] "Assign shifts" button on Schedule page header (staff only) → links to `/schedule/assign`

### Slice 2 — Grid + Cell components ✅  
- [x] `src/app/(app)/schedule/assign/_components/AssignmentGrid.tsx` — renders table from hook data
- [x] `src/app/(app)/schedule/assign/_components/AssignmentCell.tsx` — avatar stack, "+" popover, remove on click
- [x] Reuse `UserAvatarPicker` from `@/components/shift-detail/UserAvatarPicker`

### Slice 3 — Conflict indicators ✅
- [ ] Enrich `UserAvatarPicker` with `hasConflict` field on `PickerUser`
- [ ] Show warning icon on conflicted users in picker and in assigned cells
- [ ] Source: call availability-check API or derive from existing `hasConflict` on assignment

### Slice 4 — Trade board enhancements (separate PR)
- [ ] "Post trade" directly from List view (without opening ShiftDetailPanel)
- [ ] "My Trades" filter chip in TradeBoard
- [ ] Email notification on trade claim/approve

## API Reuse

All existing APIs are sufficient:
- `GET /api/calendar-events?startDate=&endDate=&limit=200`
- `GET /api/shift-groups?startDate=&endDate=&limit=200`
- `POST /api/shift-assignments` — direct assign
- `DELETE /api/shift-assignments/[id]` — remove
- `GET /api/users?role=STUDENT&role=STAFF&limit=200` — picker user list

No new API routes needed for Slice 1+2.

## Doc Sync

On ship: update `docs/AREA_SHIFTS.md` change log.
