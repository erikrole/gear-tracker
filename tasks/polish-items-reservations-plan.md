# Polish Items & Reservations Pages — Plan

## Status: Active (2026-03-14)

## Findings Summary

Both pages are functional but have inconsistent error handling, missing loading feedback, and some role-gating gaps. Prior plan partially completed (useCallback, debounced search done). This picks up the remaining work.

## Slice 1: Items List — role gating + error feedback
- [ ] Fetch `/api/me` for current user role
- [ ] Hide "New item" and "Import" buttons for STUDENT
- [ ] Add error feedback on form-options/categories fetch failure

## Slice 2: Items Detail — try/catch hardening
- [ ] EditableField `commit()` — wrap `onSave()` in try/catch to prevent stuck saving state
- [ ] CategoryField `handleCreateCategory` — add try/catch with error feedback
- [ ] Activity feed — add error state to distinguish network failure from empty
- [ ] Standardize Unicode: replace mixed HTML entities with actual characters

## Slice 3: Reservations — await reload, loading states, error consistency
- [ ] Await all `reload()` calls in convert/cancel handlers (page.tsx + BookingListPage)
- [ ] Add loading indicators during convert/cancel in context menu actions
- [ ] Replace silent catches with user-visible error feedback (BookingListPage reload, BookingDetailsSheet fetch)
- [ ] Fix asymmetric actionLoading cleanup in convert handler ([id]/page.tsx)
- [ ] Replace Unicode escapes with actual characters ([id]/page.tsx, BookingDetailsSheet)

## Slice 4: Verify
- [ ] TypeScript compiles cleanly
- [ ] Update tasks/todo.md to mark items complete

## Files Changed
1. `src/app/(app)/items/page.tsx`
2. `src/app/(app)/items/[id]/page.tsx`
3. `src/app/(app)/reservations/page.tsx`
4. `src/app/(app)/reservations/[id]/page.tsx`
5. `src/components/BookingListPage.tsx`
6. `src/components/BookingDetailsSheet.tsx`

## Risk Assessment
- **Low risk**: All changes are UI-layer polish — no schema, API, or business logic changes
- **Edge runtime safe**: No Node.js APIs introduced
