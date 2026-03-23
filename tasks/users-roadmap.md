# Users Page Roadmap — V1 / V2 / V3

## Context

The Users page has been through 5 hardening passes (design system, data flow, resilience, UX polish, profile merge). It now functions as a reliable admin tool: CRUD operations, inline editing, role management, search/filter/sort, activity timeline, and avatar management all work well.

This roadmap defines progressive enhancements that take it from a functional admin tool to an operational hub.

### What works well (keep in all versions)
- Server-side paginated list with search, role/location filters, and sorting
- Detail page with Info and Activity tabs, inline editing via SaveableField
- Role badges with RBAC-aware edit gating
- Profile merge (self-view shows avatar upload + password change)
- Mobile card layout for list, responsive detail page
- High-fidelity skeletons, retry buttons on all error states
- Full shadcn/ui component usage throughout

### What's missing or friction-y
- **No user status** — can't mark users active/inactive
- **Activity tab hard-capped** at 100 entries with no pagination
- **Create user** opens inline card that displaces the list
- **No cross-page links** — can't see a user's bookings, gear, or shifts
- **No bulk operations** — role changes or deactivation must be done one-by-one
- **No export** — admins manually copy user lists
- **Assignment editing** requires going elsewhere — display-only on detail page

### Schema data available but not surfaced
- `createdAt` exists on User but not shown on detail page
- `StudentSportAssignment` and `StudentAreaAssignment` exist but are read-only on detail page
- Booking relations exist (`requested`, `createdBookings`) but not linked from user detail

---

## V1 — Core (Polish What Exists, Fill Obvious Gaps)

**Goal**: Make the users page feel complete and trustworthy. Fix the activity tab's hard limit, add user status, improve the create flow, and surface metadata. No new cross-page wiring. Achievable in 1-2 sessions.

### Features

**1.1 User status field (active/inactive)**
- Add `active Boolean @default(true)` to User model in `prisma/schema.prisma`
- Display status indicator next to user name in list table and detail page
- Filter by status in `UserFilters.tsx` (add Select dropdown: All / Active / Inactive)
- ADMIN/STAFF can toggle status from detail page via SaveableField + switch component
- Default list to show active users only (with explicit "Show inactive" toggle)
- API: add `active` filter param to `GET /api/users`; add `active` to `PATCH /api/users/[id]` schema
- Audit: toggling status creates an audit entry with before/after

**1.2 Activity tab pagination** ✅ Shipped 2026-03-23
- Cursor-based pagination (50/page) with "Load more" button
- API accepts `cursor` and `limit` params; returns `nextCursor`

**1.3 Create user dialog refactor** ✅ Shipped 2026-03-23
- Replaced inline `CreateUserCard` with Dialog component
- Labeled form fields, DialogFooter with Cancel/Add buttons

**1.4 "Created at" display** ✅ Shipped 2026-03-23
- `createdAt` added to `UserDetail` type and API response
- "Member since {date}" shown in detail page header with calendar icon

**1.5 Admin-initiated password reset**
- New API route: `POST /api/users/[id]/reset-password`
- RBAC: ADMIN only (STAFF cannot reset passwords for other users)
- Generates temporary password, hashes it, updates user, returns plaintext once
- UI: Button on detail page (ADMIN only, not shown when viewing self) → `AlertDialog` confirming action → displays temporary password in copyable field
- Audit: creates entry with action `password_reset`

### Schema Changes

```prisma
// User model
active  Boolean  @default(true)
```

Single migration. No new models. No relation changes.

### API Routes

| Route | Method | Change |
|---|---|---|
| `GET /api/users` | existing | Add `active` filter param; include `active` in response |
| `POST /api/users` | existing | No change (new users default active) |
| `GET /api/users/[id]` | existing | Add `createdAt` and `active` to response |
| `PATCH /api/users/[id]` | existing | Add `active` to updateUserSchema |
| `GET /api/users/[id]/activity` | existing | Add cursor pagination (`cursor`, `limit`; return `nextCursor`) |
| `POST /api/users/[id]/reset-password` | **new** | ADMIN-only; returns temporary password |

### RBAC
- `active` toggle: ADMIN and STAFF (consistent with existing edit permissions)
- Password reset: ADMIN only (elevated action)
- Inactive users can still log in in V1 (see V2 for login enforcement)
- Students see list filtered to active-only by default; cannot see status toggle

### Mobile
- Create user: Sheet (bottom drawer) on small screens
- Status filter: stacks with existing filter dropdowns
- Activity "Load more": works identically on mobile
- Password reset button: full-width on mobile detail page

### Risks
- **Status without login enforcement**: Adding `active` without blocking login could confuse admins. Mitigate: tooltip "Inactive users can still log in. To revoke access, also reset their password." Defer enforcement to V2.
- **Password reset security**: Temporary password displayed in plaintext. Mitigate: show once in dialog, require ADMIN role, audit the action.

### Build Order
1. Schema migration (add `active` column)
2. API changes (filter, patch schema, activity pagination, password reset route)
3. Types update (add `active`, `createdAt` to types)
4. UI: Create user dialog refactor
5. UI: Status display + filter + toggle on detail page
6. UI: Activity tab pagination
7. UI: Created-at display on detail page
8. UI: Password reset button + dialog

---

## V2 — Enhanced (Reduce Friction, Cross-Page Connections)

**Goal**: Make the users page a hub for understanding each user's relationship with the system. Add bulk operations, cross-page links, assignment management, and export. Reduces admin friction for common multi-user operations.

### Features

**2.1 Bulk operations on user list**
- Row selection via checkbox in first column — follow pattern from items page (`use-bulk-actions.ts`)
- Bulk action bar (appears when 1+ rows selected): "Change role", "Set location", "Activate", "Deactivate"
- New API route: `POST /api/users/bulk` accepting `{ ids: string[], action: string, ...payload }`
- RBAC: ADMIN only for role changes; ADMIN/STAFF for location and status changes
- Confirmation via AlertDialog before executing

**2.2 User gear tab (cross-page connection)**
- New tab on user detail: "Gear" (alongside Info, Activity)
- Shows active bookings (checkouts + reservations) for this user
- New API route: `GET /api/users/[id]/bookings?status=OPEN,BOOKED`
- Each booking row links to `/checkouts/[id]` or `/reservations/[id]`
- Empty state: "No active gear" with link to create a checkout

**2.3 Sport and area assignment editing from user detail**
- Currently display-only in Assignments card on UserInfoTab
- Add "Edit" button on each section (Sports, Areas) opening a Dialog
- Sports: multi-select from available sports using Command (combobox pattern)
- Areas: multi-select from ShiftArea enum with isPrimary toggle
- New API routes: `PUT /api/users/[id]/sport-assignments`, `PUT /api/users/[id]/area-assignments`
- RBAC: ADMIN/STAFF only

**2.4 Login blocking for inactive users**
- When `active = false`, sessions are invalidated and login is blocked
- Modify `withAuth` in `src/lib/api.ts` to check `active` field on session lookup
- Modify login handler to reject inactive users with clear error message
- Completes the V1 status field with real enforcement

**2.5 Summary stats on list page**
- Stat bar above filters: "X total / Y active / Z students / W staff / V admins"
- Extend `GET /api/users` response with `stats` object containing role counts
- No new API route

**2.6 CSV export**
- "Export" button in list page header (next to "Add user")
- Exports current filtered view (respects all filters)
- New API route: `GET /api/users/export?format=csv`
- RBAC: ADMIN/STAFF only

**2.7 Area filter on list page**
- Add `primaryArea` filter to `UserFilters.tsx` using existing AREA_OPTIONS
- API: add `primaryArea` filter param to `GET /api/users`

### Schema Changes
None. V1's `active` field is the only schema change across V1+V2. Assignment models already exist.

### API Routes

| Route | Method | Status |
|---|---|---|
| `POST /api/users/bulk` | **new** | Bulk actions (role, location, status) |
| `GET /api/users/[id]/bookings` | **new** | User's active bookings |
| `PUT /api/users/[id]/sport-assignments` | **new** | Replace sport assignments |
| `PUT /api/users/[id]/area-assignments` | **new** | Replace area assignments |
| `GET /api/users/export` | **new** | CSV export |
| `GET /api/users` | modified | Add `primaryArea` filter; add `stats` to response |

### RBAC
- Bulk operations: ADMIN for role changes; ADMIN/STAFF for location/status
- Assignment management: ADMIN/STAFF only
- Export: ADMIN/STAFF only
- Gear tab: ADMIN/STAFF see any user's gear; students see only their own
- Login blocking: affects all roles; ADMIN cannot deactivate themselves

### Risks
- **Bulk role escalation**: STAFF bulk-changing users to ADMIN. Mitigate: enforce same RBAC as single role change.
- **Login blocking cascade**: Deactivating mid-session could cause data loss. Mitigate: invalidation on next request, not push.
- **Export performance**: Large user lists could timeout on Vercel's 10s hobby plan. Mitigate: stream CSV; or limit to 500 rows.
- **Assignment replace semantics**: PUT replaces all assignments. Mitigate: confirmation dialog showing removals.
- **Scope creep**: 7 features. If needed, prioritize: 2.1 (bulk), 2.2 (gear tab), 2.4 (login blocking).

### Dependencies
- V1 must ship first (active field, activity pagination)
- Items page bulk action pattern (`use-bulk-actions.ts`) is the template for 2.1
- Booking data model exists; just need a query endpoint
- Assignment models exist; just need CRUD endpoints

### Build Order
1. API: `POST /api/users/bulk` (following items bulk pattern)
2. API: `GET /api/users/[id]/bookings`
3. API: `PUT /api/users/[id]/sport-assignments` and area-assignments
4. API: `GET /api/users/export`
5. API: Extend `GET /api/users` with `primaryArea` filter and `stats`
6. Backend: `withAuth` login blocking for inactive users
7. UI: Bulk selection + action bar on list page
8. UI: Gear tab on detail page
9. UI: Assignment editing dialogs on detail page
10. UI: Summary stats bar, area filter, export button

---

## V3 — Advanced (Predictive, Automated, Intelligent)

**Goal**: Make the users page proactive rather than reactive. Surface engagement signals, automate routine admin tasks, and provide operational intelligence.

### Features

**3.1 Last-active tracking and engagement signals**
- Schema: add `lastActiveAt DateTime?` to User model
- Update `lastActiveAt` on every authenticated request (debounced — only if stale by 5+ minutes)
- Implementation: `withAuth` wrapper runs conditional `UPDATE ... WHERE last_active_at < now() - interval '5 minutes'`
- Display on list: "Last active" column (desktop only), relative time ("2h ago", "3d ago", "Never")
- Sortable column; new sort options: `lastActive`, `lastActive_desc`
- "Stale users" smart filter: users not active in 30+ days (separate from `active` boolean)

**3.2 User onboarding checklist**
- For newly created users (within last 7 days), show checklist on detail page:
  - Has logged in at least once (requires `lastActiveAt`)
  - Has avatar uploaded
  - Has location assigned
  - Has sport assignment (if STUDENT)
  - Has area assignment (if STUDENT)
  - Has completed at least one checkout (if STUDENT)
- Displayed as a Progress bar with expandable Collapsible checklist
- Computed client-side from existing data — no new API

**3.3 Automatic deactivation policy**
- Admin-configurable rule: "Deactivate users inactive for X days"
- Vercel Cron job: runs daily, deactivates users where `lastActiveAt < now() - X days`
- Creates audit entries for each auto-deactivation
- Notification to all ADMINs listing auto-deactivated users
- Admin UI: settings page for configuring threshold (or disabling)

**3.4 User activity heatmap**
- On detail page Activity tab, add heatmap showing activity density by day (past 6 months)
- New API route: `GET /api/users/[id]/activity-summary` returning `{ date, count }[]`
- Server-side aggregation: `GROUP BY date_trunc('day', created_at)`

**3.5 Smart assignment suggestions**
- When editing sport/area assignments (V2), suggest based on:
  - What sports the user has checked out gear for (booking history)
  - What areas the user has been assigned shifts in
- New API route: `GET /api/users/[id]/assignment-suggestions`
- Displayed as "Suggested" badges in assignment editing dialog

**3.6 User comparison view**
- Select 2-3 users from list and compare side-by-side
- Shows: role, location, assignments, active bookings, activity count
- Transposed table layout (users as columns, attributes as rows)
- No new API — aggregates existing detail endpoints client-side
- Desktop only; mobile shows "View on desktop" message

**3.7 Notification preferences on user profile**
- New tab on detail page: "Notifications" (alongside Info, Gear, Activity)
- Per-user toggles: email, in-app, overdue reminders, shift reminders
- Schema: add `notificationPrefs Json?` to User model
- API: `PATCH /api/users/[id]/preferences`
- Self-editable; ADMIN can override for any user

### Schema Changes

```prisma
// User model additions
lastActiveAt       DateTime?  @map("last_active_at")
notificationPrefs  Json?      @map("notification_prefs")

// New model (if not already present)
model SystemSetting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("system_settings")
}
```

### API Routes

| Route | Method | Status |
|---|---|---|
| `GET /api/users` | modified | Add `lastActive` sort; add `stale` filter |
| `GET /api/users/[id]` | modified | Add `lastActiveAt` to response |
| `GET /api/users/[id]/activity-summary` | **new** | Daily activity counts for heatmap |
| `GET /api/users/[id]/assignment-suggestions` | **new** | Suggestions from booking/shift history |
| `PATCH /api/users/[id]/preferences` | **new** | Notification preferences |
| `POST /api/cron/deactivate-stale-users` | **new** | Vercel Cron endpoint |

### RBAC
- `lastActiveAt` visible to ADMIN/STAFF on all users; students see only their own
- Auto-deactivation policy: ADMIN only to configure
- Notification preferences: self + ADMIN
- Assignment suggestions: ADMIN/STAFF only
- Comparison view: ADMIN/STAFF only
- Cron endpoint: secured by Vercel Cron secret header

### Risks
- **Write amplification from lastActiveAt**: Updating on every request. Mitigate: 5-minute debounce with conditional UPDATE.
- **Auto-deactivation false positives**: Seasonal workers or leave. Mitigate: admin notification before deactivation; configurable threshold; easy re-activation.
- **Over-engineering**: V3 features may not be needed at current team size. Mitigate: treat V3 as a menu, not a mandate.
- **Heatmap data volume**: 6 months of audit logs per user. Mitigate: server-side aggregation, not client-side.
- **Notification prefs JSON drift**: Mitigate: define TypeScript type and validate with zod on write.

### Dependencies
- V2 must ship first (gear tab, assignment editing, login blocking)
- Auto-deactivation requires Vercel Cron configuration in `vercel.json`
- Notification preferences depend on notification system (already shipped)

### Build Order
1. Schema migration (add `lastActiveAt`, `notificationPrefs`, `SystemSetting`)
2. Backend: `lastActiveAt` update logic in `withAuth`
3. API: activity-summary, assignment-suggestions, preferences, cron endpoint
4. API: Extend `GET /api/users` with lastActive sort and stale filter
5. UI: Last-active column + sort on list page
6. UI: Activity heatmap on detail page
7. UI: Onboarding checklist on detail page
8. UI: Notification preferences tab
9. UI: Assignment suggestions in editing dialogs
10. UI: Comparison view
11. Backend: Auto-deactivation cron job + admin settings UI

---

## Cross-Version Summary

| Capability | V1 | V2 | V3 |
|---|---|---|---|
| User status (active/inactive) | Field + display | Login enforcement | Auto-deactivation |
| Activity tab | Pagination | Gear tab added | Heatmap + timeline |
| Create user | Dialog refactor | — | — |
| Password management | Admin reset | — | — |
| Bulk operations | — | Select + bulk actions | — |
| Assignments | — | Edit from detail page | Smart suggestions |
| Cross-page links | — | Gear tab (bookings) | — |
| Export | — | CSV export | — |
| Engagement tracking | — | — | lastActiveAt + onboarding |
| Notification prefs | — | — | Per-user preferences |

## Critical Files for Implementation

- `prisma/schema.prisma` — Schema changes: `active` (V1), `lastActiveAt` + `notificationPrefs` (V3)
- `src/app/(app)/users/page.tsx` — List page: status filter (V1), bulk selection (V2), stats bar (V2), last-active column (V3)
- `src/app/(app)/users/[id]/page.tsx` — Detail page: tabs (V2 gear tab, V3 notifications tab)
- `src/app/(app)/users/[id]/UserInfoTab.tsx` — Status toggle (V1), assignment editing (V2), onboarding checklist (V3)
- `src/app/api/users/[id]/activity/route.ts` — Activity pagination (V1)
- `src/app/(app)/users/CreateUserCard.tsx` → dialog refactor (V1)
- `src/app/(app)/items/hooks/use-bulk-actions.ts` — Pattern template for V2 bulk operations
- `src/lib/api.ts` — `withAuth` modification for login blocking (V2), lastActiveAt tracking (V3)
