# Users Page Redesign Plan

## Goal
Bring the Users page up to architectural and visual parity with the mature patterns in the codebase (Items, Bookings). Replace the monolithic 423-line single file with extracted components, add a dedicated detail page, improve the list UX with pagination/sorting/filtering, and expose all user data fields.

## Current State
- `src/app/(app)/users/page.tsx` — single monolithic file
- Inline table editing (clunky, no room for all fields)
- No pagination (loads all users at once)
- No detail view (no `/users/[id]` route)
- No mobile card layout
- Create form always visible
- Missing: phone, primaryArea, sportAssignments, areaAssignments display
- Only role filter, no sorting, no location filter

## Target State
- Component-extracted list page with types file
- Dedicated `/users/[id]` detail page with tabs (Info, Activity)
- Server-side search, sort, pagination on `GET /api/users`
- Mobile card layout for user rows
- Toggleable create form
- Role badges with color coding
- Multiple filters (role, location)
- Sortable columns (name, role, location)
- Full user editing in detail page (name, email, phone, primaryArea, location, role)

---

## Slice 1: API Pagination + List Page Restructure

Independently mergeable. Backend + frontend list improvements.

### 1a. API: Add pagination, search, sort, filters to `GET /api/users`
- [ ] Add `parsePagination` to `GET /api/users` route
- [ ] Add `q` search param (name/email ILIKE)
- [ ] Add `role` filter param
- [ ] Add `location` filter param
- [ ] Add `sort` param (name, role, location — asc/desc)
- [ ] Return `{ data, total, limit, offset }` shape (matches assets pattern)

### 1b. Extract types file: `src/app/(app)/users/types.ts`
- [ ] `UserRow` type (id, name, email, role, locationId, location, phone, primaryArea)
- [ ] `UserDetail` type (extends UserRow with sportAssignments, areaAssignments)
- [ ] `Location` type
- [ ] `Role` type
- [ ] Re-export from page

### 1c. Extract components
- [ ] `src/app/(app)/users/UserRow.tsx` — table row + mobile card
- [ ] `src/app/(app)/users/UserFilters.tsx` — search + filter chips (role, location)
- [ ] `src/app/(app)/users/CreateUserCard.tsx` — toggleable create form
- [ ] `src/app/(app)/users/RoleBadge.tsx` — color-coded role badges

### 1d. Rewrite `users/page.tsx` (list page)
- [ ] Server-side pagination (limit=50, offset-based, page controls)
- [ ] Sortable columns via SortHeader pattern (name, role, location)
- [ ] FilterChip for role + location
- [ ] Toggleable "Add user" card (button in header, not always visible)
- [ ] Role badges: ADMIN=purple, STAFF=blue, STUDENT=gray
- [ ] Mobile card layout (`.hide-mobile` on email/location columns)
- [ ] Click row → navigate to `/users/[id]`
- [ ] Remove inline editing entirely (moves to detail page)
- [ ] Loading skeleton, empty state, error state

---

## Slice 2: User Detail Page

### 2a. Create `src/app/(app)/users/[id]/page.tsx`
- [ ] Fetch user detail via `GET /api/users/[id]`
- [ ] Back link to `/users`
- [ ] Header: name, role badge, location
- [ ] Tab navigation: Info | Activity

### 2b. Create `src/app/(app)/users/[id]/UserInfoTab.tsx`
- [ ] Display all fields: name, email, phone, role, primaryArea, location
- [ ] Sport assignments list
- [ ] Area assignments list
- [ ] Edit mode (ADMIN/STAFF only): inline form for name, email, phone, primaryArea, location
- [ ] Role change dropdown (separate API call to `/api/users/[id]/role`)
- [ ] Save/cancel with optimistic feedback via toast

### 2c. Create `src/app/(app)/users/[id]/UserActivityTab.tsx`
- [ ] Fetch audit logs for user entity via `GET /api/reports?type=audit&entityId={id}`
- [ ] Display timeline of changes (role changes, profile updates, etc.)

### 2d. Create `src/app/(app)/users/[id]/types.ts`
- [ ] Import/re-export shared types from parent

---

## Slice 3: Polish + Docs

### 3a. Visual polish
- [ ] Ensure dark mode works for all new components
- [ ] Verify mobile responsiveness
- [ ] Confirm keyboard navigation / accessibility (focus management on tab switch)

### 3b. Build verification
- [ ] `npm run build` passes cleanly

### 3c. Doc sync
- [ ] Update `docs/AREA_USERS.md` change log
- [ ] Update `docs/GAPS_AND_RISKS.md` if applicable
- [ ] Move plan to `tasks/archive/` when complete

---

## Files Modified/Created

### Modified
- `src/app/api/users/route.ts` — add pagination/search/sort/filter
- `src/app/(app)/users/page.tsx` — complete rewrite

### Created
- `src/app/(app)/users/types.ts`
- `src/app/(app)/users/UserRow.tsx`
- `src/app/(app)/users/UserFilters.tsx`
- `src/app/(app)/users/CreateUserCard.tsx`
- `src/app/(app)/users/RoleBadge.tsx`
- `src/app/(app)/users/[id]/page.tsx`
- `src/app/(app)/users/[id]/UserInfoTab.tsx`
- `src/app/(app)/users/[id]/UserActivityTab.tsx`
- `src/app/(app)/users/[id]/types.ts`

## Risk Notes
- Server-side search on users is low-volume (likely <500 users) so Prisma `contains` is fine, no full-text index needed
- No schema migrations required — all fields already exist
- Audit log query for activity tab uses existing report API
