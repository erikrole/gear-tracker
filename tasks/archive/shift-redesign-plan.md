# Shift Scheduling Redesign V2 — Task Plan

**Brief:** `docs/BRIEF_SHIFT_REDESIGN_V2.md`
**Branch:** `claude/structure-product-tasks-f2hTh`
**Status:** Complete (all 4 slices shipped 2026-03-26)

---

## Slice 1: Per-Event Shift Editing

- [x] Create `POST /api/shift-groups/[id]/shifts` route (add shift to event)
- [x] Create `DELETE /api/shift-groups/[groupId]/shifts/[shiftId]` route (remove shift)
- [x] Add `manuallyEdited` guard in `shift-generation.ts` → `generateShiftsForEvent()`
- [x] Add audit logging to both new endpoints
- [x] SERIALIZABLE transaction wrapping on both endpoints
- [x] Test: add shift → verify DB state, coverage count updates
- [x] Test: delete shift with assignment → verify cascade + trade cancellation
- [x] Test: ICS resync does not overwrite manually-edited ShiftGroup
- [x] `npm run build` passes

## Slice 2: Universal User Assignment

- [x] Relax sport roster constraint in `POST /api/shift-assignments`
- [x] Add/verify user search endpoint returns avatar-friendly projections
- [x] Test: assign non-roster user → verify success
- [x] Test: time conflict still blocks double-booking
- [x] Test: existing premier request flow unchanged
- [x] `npm run build` passes

## Slice 3: Avatar-Based Assignment UI

- [x] Extract ShiftDetailPanel (577 lines) into subcomponents:
  - [x] `ShiftAreaRow` — one area's shift slots + add button
  - [x] `ShiftSlot` — empty (picker trigger) or filled (avatar + actions)
  - [x] `AvatarPicker` — search + avatar grid (Popover desktop, Sheet mobile)
- [x] Wire AvatarPicker to POST /api/shift-assignments
- [x] Wire ShiftSlot remove action to assignment delete
- [x] Wire "+Shift" button to POST /api/shift-groups/[id]/shifts
- [x] Wire "×" delete button to DELETE /api/shift-groups/[groupId]/shifts/[shiftId]
- [x] Add "Post to trade board" action in avatar context menu
- [x] Add "Reset to template" button (clears manuallyEdited, regenerates from config)
- [x] Mobile: avatar picker as bottom Sheet at <768px
- [x] Test: staff assigns 4 users in <30 seconds
- [x] Test: student cannot see add/remove controls
- [x] `npm run build` passes

## Slice 4: Hardening

- [x] AbortController on all new fetch calls in ShiftDetailPanel
- [x] Optimistic UI for assignment (appear immediately, rollback on error)
- [x] Error differentiation (network vs server vs 401)
- [x] Mobile testing at 375px viewport
- [x] ShiftDetailPanel.tsx < 200 lines after extraction
- [x] Doc sync: update `docs/AREA_SHIFTS.md` changelog
- [x] Doc sync: update `docs/GAPS_AND_RISKS.md` with closed items
- [x] `npm run build` passes
- [x] Move this file to `tasks/archive/` when all slices ship

---

## Review Checklist

- [x] All 13 acceptance criteria pass (AC-1 through AC-13)
- [x] Existing auto-generation works for non-edited ShiftGroups
- [x] Existing trade board unchanged
- [x] Existing premier request flow unchanged
- [x] Time conflict validation blocks double-booking
- [x] Mobile usable at 375px
- [x] No regressions on schedule page
