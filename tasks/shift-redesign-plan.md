# Shift Scheduling Redesign V2 — Task Plan

**Brief:** `docs/BRIEF_SHIFT_REDESIGN_V2.md`
**Branch:** TBD (separate from UX improvements batch)
**Status:** Planning

---

## Slice 1: Per-Event Shift Editing

- [ ] Create `POST /api/shift-groups/[id]/shifts` route (add shift to event)
- [ ] Create `DELETE /api/shift-groups/[groupId]/shifts/[shiftId]` route (remove shift)
- [ ] Add `manuallyEdited` guard in `shift-generation.ts` → `generateShiftsForEvent()`
- [ ] Add audit logging to both new endpoints
- [ ] SERIALIZABLE transaction wrapping on both endpoints
- [ ] Test: add shift → verify DB state, coverage count updates
- [ ] Test: delete shift with assignment → verify cascade + trade cancellation
- [ ] Test: ICS resync does not overwrite manually-edited ShiftGroup
- [ ] `npm run build` passes

## Slice 2: Universal User Assignment

- [ ] Relax sport roster constraint in `POST /api/shift-assignments`
- [ ] Add/verify user search endpoint returns avatar-friendly projections
- [ ] Test: assign non-roster user → verify success
- [ ] Test: time conflict still blocks double-booking
- [ ] Test: existing premier request flow unchanged
- [ ] `npm run build` passes

## Slice 3: Avatar-Based Assignment UI

- [ ] Extract ShiftDetailPanel (577 lines) into subcomponents:
  - [ ] `ShiftAreaRow` — one area's shift slots + add button
  - [ ] `ShiftSlot` — empty (picker trigger) or filled (avatar + actions)
  - [ ] `AvatarPicker` — search + avatar grid (Popover desktop, Sheet mobile)
- [ ] Wire AvatarPicker to POST /api/shift-assignments
- [ ] Wire ShiftSlot remove action to assignment delete
- [ ] Wire "+Shift" button to POST /api/shift-groups/[id]/shifts
- [ ] Wire "×" delete button to DELETE /api/shift-groups/[groupId]/shifts/[shiftId]
- [ ] Add "Post to trade board" action in avatar context menu
- [ ] Add "Reset to template" button (clears manuallyEdited, regenerates from config)
- [ ] Mobile: avatar picker as bottom Sheet at <768px
- [ ] Test: staff assigns 4 users in <30 seconds
- [ ] Test: student cannot see add/remove controls
- [ ] `npm run build` passes

## Slice 4: Hardening

- [ ] AbortController on all new fetch calls in ShiftDetailPanel
- [ ] Optimistic UI for assignment (appear immediately, rollback on error)
- [ ] Error differentiation (network vs server vs 401)
- [ ] Mobile testing at 375px viewport
- [ ] ShiftDetailPanel.tsx < 200 lines after extraction
- [ ] Doc sync: update `docs/AREA_SHIFTS.md` changelog
- [ ] Doc sync: update `docs/GAPS_AND_RISKS.md` with closed items
- [ ] `npm run build` passes
- [ ] Move this file to `tasks/archive/` when all slices ship

---

## Review Checklist

- [ ] All 13 acceptance criteria pass (AC-1 through AC-13)
- [ ] Existing auto-generation works for non-edited ShiftGroups
- [ ] Existing trade board unchanged
- [ ] Existing premier request flow unchanged
- [ ] Time conflict validation blocks double-booking
- [ ] Mobile usable at 375px
- [ ] No regressions on schedule page
