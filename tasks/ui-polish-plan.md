# UI Polish — Items 2, 3, 5

## Slice 1: Reusable Components (foundation)
- [x] `<ConfirmDialog>` — styled modal replacement for `confirm()`
- [x] `<Toast>` + `useToast()` — toast notifications replacement for `alert()`
- [x] `<LoadingButton>` — button with spinner + disabled state during async
- [x] CSS for all three components in globals.css

## Slice 2: Wire ConfirmDialog + Toast across codebase (23 replacements)
- [ ] reservations/page.tsx (4 usages)
- [ ] BookingDetailsSheet.tsx (4 usages)
- [ ] checkouts/page.tsx (3 usages)
- [ ] reservations/[id]/page.tsx (2 usages)
- [ ] checkouts/[id]/page.tsx (2 usages)
- [ ] BookingListPage.tsx (2 usages)
- [ ] settings/categories/page.tsx (1 usage)
- [ ] events/page.tsx (4 usages)
- [ ] items/[id]/page.tsx (4+ usages)

## Slice 3: Button loading states (~11 buttons)
- [ ] notifications/page.tsx — mark all read, mark read
- [ ] BookingListPage.tsx — extend from menu
- [ ] settings/categories/page.tsx — rename, create sub, delete, create root
- [ ] profile/page.tsx — update user role

## Slice 4: CSS class extraction (top files)
- [ ] Define utility classes for common patterns
- [ ] Extract status color classes
- [ ] Extract layout/spacing utilities
- [ ] Refactor top inline-style files

## Approach
- Build components first → wire up → extract styles
- Each slice independently testable + mergeable
