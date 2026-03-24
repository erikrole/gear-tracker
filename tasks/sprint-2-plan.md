# Sprint 2: Connected Experience (V2 Kick-off)

**Goal**: Reduce friction between pages — system remembers context, reduces manual work.
**Status**: Complete (2026-03-24)

## Slices

### Slice 1: Labels Cross-Linking (XS) ✅
- Added "Print label" action to item detail `ActionsMenu`
- Links to `/labels?items={assetId}` to pre-select the item
- Updated `/labels` page to read `items` query param and auto-select matching assets

### Slice 2: Inline Dashboard Actions (M) ✅
- Added quick-action buttons on dashboard booking rows (hidden until hover)
- **Checkouts (overdue/due-today)**: "Extend +1d" clock icon button
- **My Reservations**: "Convert to checkout" arrow icon button
- **Team checkouts**: Extend button visible for staff+ only
- Actions execute without opening the booking sheet (stopPropagation)
- Toast feedback on success/failure + auto-refresh dashboard
- Added `role` and `kind` to dashboard API response for permission-aware rendering

### Slice 3: Saved Filter Presets (S) ✅
- "Save view" button appears when filters are active
- Presets stored in localStorage, auto-named from filter values
- Saved presets row with bookmark icon, click to apply, × to delete
- Duplicate prevention (same combo can't be saved twice)
- Toggle behavior: clicking active preset clears filters

## Acceptance Criteria
- [x] Item detail "Print label" action opens labels page with item pre-selected
- [x] Dashboard shows inline action buttons on booking rows
- [x] Actions execute without opening the booking sheet
- [x] Optimistic refresh on inline actions
- [x] Filter presets persist across page reloads
- [x] Build passes with zero new warnings
