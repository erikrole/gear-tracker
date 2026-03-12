# Polish Items & Reservations Pages — Plan

## Goal
Simplify, polish, and harden the items and reservations pages. Focus on: eliminating React warnings, adding proper error handling, improving UX feedback, and fixing known patterns from lessons.md.

## Slice 1: Items List Page (`src/app/(app)/items/page.tsx`)

### Simplify
- Consolidate repeated inline filter `style` objects into a single `filterStyle` const (used 4 times with identical values)
- Replace HTML entities (`&middot;`, `&rarr;`, `&rsaquo;`) with Unicode escapes per lesson #6

### Polish
- Add debounced search (300ms delay) to avoid API call on every keystroke — use a `useDeferredValue` or manual timeout pattern
- Show an error banner when the items fetch fails (currently silently swallowed)

### Harden
- Wrap `reload` in `useCallback` with proper dependency array to fix React exhaustive-deps warning
- Add `try/catch` around form-options and categories fetches with graceful fallback
- Reset page to 0 when filters change (already done, just verify)

## Slice 2: Items Detail Page (`src/app/(app)/items/[id]/page.tsx`)

### Simplify
- Replace HTML entities with Unicode throughout

### Polish
- Add actionLoading state to `handleAction` to prevent double-clicks and show feedback
- Show error feedback (not just `alert()`) when actions fail — use inline error banner

### Harden
- Wrap `loadAsset` and `loadCategories` in `useCallback` (React dependency warnings)
- Add `try/catch` to all `handleAction` branches (currently `duplicate` and `maintenance` have none)
- Handle response errors in retire/maintenance/duplicate paths

## Slice 3: Reservations List Page (`src/app/(app)/reservations/page.tsx`)

### Harden
- Replace empty `catch { /* network */ }` blocks with `alert()` or `reload()` fallback so the user knows something went wrong

## Slice 4: Reservations Detail Page (`src/app/(app)/reservations/[id]/page.tsx`)

### Simplify
- Replace `&middot;`, `&rsaquo;` with Unicode

### Polish
- Add `actionError` reset at the start of each action handler (currently only some do it)
- Show a brief loading overlay during data refetch after successful action

### Harden
- Wrap `handleCancel` body in try/catch (currently no try/catch — a network throw would leave actionLoading stuck)
- Ensure `setActionLoading(null)` is called in all code paths (currently `handleConvert` success path doesn't reset it)

## Slice 5: Build & Verify
- Run `npm run build` — must pass cleanly
- Commit with message: `feat: polish and harden items and reservations pages`
- Push to `claude/polish-items-reservations-VWYMP`

## Files Changed
1. `src/app/(app)/items/page.tsx`
2. `src/app/(app)/items/[id]/page.tsx`
3. `src/app/(app)/reservations/page.tsx`
4. `src/app/(app)/reservations/[id]/page.tsx`

## Risk Assessment
- **Low risk**: All changes are UI-layer polish — no schema, API, or business logic changes
- **No new dependencies**: Using only existing React patterns
- **Edge runtime safe**: No Node.js APIs introduced
