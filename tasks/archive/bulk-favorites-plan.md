# Bulk Actions + Favorite Items

## Feature 8: Bulk Actions on Items List

### Schema
- No schema changes needed — uses existing asset mutation endpoints

### API
- `POST /api/assets/bulk` — accepts `{ ids: string[], action: string, payload?: {} }`
  - Actions: `move_location` (payload: locationId), `change_category` (payload: categoryId), `retire`, `maintenance`
  - Auth: requirePermission("asset", "edit")
  - Batches all DB operations in single transaction (Worker subrequest budget)
  - Creates audit entries for each item

### UI (items/page.tsx)
- Add checkbox column (first column) — only visible to STAFF/ADMIN
- "Select all on page" checkbox in header
- Floating bulk action bar when selection > 0 showing count + action buttons
- Actions: Move location, Change category, Retire, Maintenance
- Move/Category use dropdown picker; Retire uses confirmation
- Clear selection after action completes

## Feature 15: Bookmark / Pin Favorite Items

### Schema
- New `FavoriteItem` join table: userId + assetId (unique constraint)

### API
- `POST /api/assets/[id]/favorite` — toggle favorite (create/delete)
- `GET /api/assets` — add `favorite=true` query param filter

### UI
- Star icon button in name column (items list)
- "Favorites" filter chip on items list
- Star shown to all authenticated users

## Slice Order
1. Schema migration (FavoriteItem)
2. Bulk actions API + UI
3. Favorites API + UI
4. Build verify + commit
