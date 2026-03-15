# UI Polish — Items 2, 3, 5

## Slice 1: Reusable Components (foundation)
- [x] `<ConfirmDialog>` — styled modal replacement for `confirm()`
- [x] `<Toast>` + `useToast()` — toast notifications replacement for `alert()`
- [x] `<LoadingButton>` — button with spinner + disabled state during async
- [x] CSS for all three components in globals.css

## Slice 2: Wire ConfirmDialog + Toast across codebase (23 replacements)
- [x] All 16 files now use useConfirm/useToast (verified 2026-03-15, no raw confirm/alert calls remain)

## Slice 3: Button loading states
- [x] notifications/page.tsx — mark all read, mark read (already had loading states)
- [x] BookingListPage.tsx — extend +1 day/+1 week now disabled during operation
- [x] settings/categories/page.tsx — rename, create sub, delete, create root (already had loading states)
- [x] profile/page.tsx — save profile, update password (already had loading states)
- [x] events/page.tsx — enable/disable, delete source, add source, add mapping, delete mapping (added 2026-03-15)
- [x] bulk-inventory/page.tsx — convert, add units (already had loading states)

## Slice 4: CSS class extraction (top files)
- [ ] Define utility classes for common patterns
- [ ] Extract status color classes
- [ ] Extract layout/spacing utilities
- [ ] Refactor top inline-style files

## Approach
- Build components first → wire up → extract styles
- Each slice independently testable + mergeable
