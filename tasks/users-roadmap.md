# Users Page Roadmap — V1 / V2 / V3

> Revised 2026-04-06 (post-audit refresh). V1 complete. V2 re-scoped.

## Context

The Users page has been through multiple 5-pass hardening audits, two stress tests (9 bugs fixed), a profile merge, and a deactivation feature. It functions as a reliable operational tool: CRUD, inline editing, role management, search/filter/sort, activity timeline, avatar management, deactivation with booking migration, password reset, and full sport/area assignment CRUD.

Ship-readiness audit score: **22/25** (see `tasks/users-audit.md`).

### What works well (keep in all versions)
- Server-side paginated list with search, role/location/active filters, and sorting
- Detail page with Info and Activity tabs, inline editing via SaveableField
- Role badges with RBAC-aware edit gating (STAFF cannot edit ADMIN)
- Profile merge (self-view shows avatar upload + password change)
- Mobile card layout for list, responsive detail page
- High-fidelity skeletons, retry buttons on all error states
- Full shadcn/ui component usage throughout
- Deactivation with OPEN checkout guard + auto-cancel BOOKED/DRAFT
- Admin password reset with session invalidation
- Sport/area assignment CRUD via popover multi-select
- Registration gating via admin-managed email allowlist (D-029)

### What's missing or friction-y
- **No session-level active check** — `requireAuth()` doesn't check `user.active`; deactivated users with existing sessions can keep making API calls
- **No cross-page links** — can't see a user's bookings, gear, or shifts from user detail
- **No bulk operations** — role changes or deactivation must be done one-by-one
- **No export** — admins manually copy user lists
- **No summary stats** — no at-a-glance counts by role
- **No area filter** — `primaryArea` not filterable on list page

### Schema data available but not surfaced
- `requested` (Booking[]) — user's bookings not linked from detail page
- `createdBookings` (Booking[]) — bookings created by this user
- `shiftAssignments` (ShiftAssignment[]) — shift assignments not linked
- `tradesPosted` / `tradesClaimed` (ShiftTrade[]) — trade activity
- `scanEvents` (ScanEvent[]) — scan history
- `favorites` (FavoriteItem[]) — favorited items
- `notifications` (Notification[]) — notification history

---

## V1 — Core (Polish What Exists, Fill Obvious Gaps) ✅ COMPLETE

**Goal**: Make the users page feel complete and trustworthy. Fix the activity tab's hard limit, add user status, improve the create flow, and surface metadata.

**Status**: All 5 features shipped.

### Features

**1.1 User status field (active/inactive)** ✅ Shipped 2026-04-03
- `active Boolean @default(true)` on User model
- Deactivation toggle on detail page (ADMIN only, via dropdown menu)
- Inactive badge display on list and detail
- Default active-only filter with "Show inactive" toggle
- Deactivation guards: blocks if OPEN checkouts, auto-cancels BOOKED/DRAFT
- Login blocking at login route (`src/app/api/auth/login/route.ts:22`)
- Full audit trail for deactivation + cascade booking cancellations

**1.2 Activity tab pagination** ✅ Shipped 2026-03-23
- Cursor-based pagination (50/page) with "Load more" button
- API accepts `cursor` and `limit` params; returns `nextCursor`

**1.3 Create user dialog refactor** ✅ Shipped 2026-03-23
- Replaced inline `CreateUserCard` with Dialog component
- Labeled form fields, DialogFooter with Cancel/Add buttons

**1.4 "Created at" display** ✅ Shipped 2026-03-23
- `createdAt` returned by GET/PATCH `/api/users/[id]`
- "Member since {date}" shown in detail page header with CalendarDays icon

**1.5 Admin-initiated password reset** ✅ Shipped 2026-03-23
- `POST /api/users/[id]/reset-password` — ADMIN only
- Generates secure temp password via `crypto.randomBytes(6).toString("base64url")`
- Invalidates all existing sessions for the target user
- UI: Admin dropdown → AlertDialog → copyable temp password field
- Audit entry with action `password_reset`

---

## V2 — Enhanced (Reduce Friction, Cross-Page Connections)

**Goal**: Make the users page a hub for understanding each user's relationship with the system. Add session-level enforcement, bulk operations, cross-page links, and export. Reduces admin friction for common multi-user operations.

### Features

**2.1 Session-level active enforcement** (HIGH PRIORITY)
- Add `user.active` check to `requireAuth()` in `src/lib/auth.ts` after line 95
- If `!session.user.active`, throw `HttpError(401, "Account deactivated")`
- Add `await db.session.deleteMany({ where: { userId: id } })` to deactivation path in PATCH `/api/users/[id]`
- Completes deactivation story: login blocked + existing sessions terminated + API calls rejected
- **Why V2**: V1 login blocking is sufficient for initial use but leaves a session-expiry gap

**2.2 Bulk operations on user list**
- Row selection via Checkbox in first column — follow items page pattern (`src/app/(app)/items/page.tsx` + `use-bulk-actions.ts`)
- Bulk action bar (appears when 1+ selected): "Change role", "Set location", "Activate", "Deactivate"
- New API route: `POST /api/users/bulk` accepting `{ ids: string[], action: string, ...payload }`
- RBAC: ADMIN only for role changes; ADMIN/STAFF for location and status
- Confirmation via AlertDialog before executing
- Audit entry per user affected (use `createAuditEntries` batch pattern)
- shadcn: Checkbox, AlertDialog, DropdownMenu for bulk action picker

**2.3 User gear tab (cross-page connection)**
- New tab on user detail: "Gear" (alongside Info, Activity)
- Shows user's active bookings (status OPEN or BOOKED) with ref number, title, status badge, due date
- New API route: `GET /api/users/[id]/bookings?status=OPEN,BOOKED`
- Each row links to `/checkouts/[id]` or `/reservations/[id]`
- Show item count per booking, kit name if applicable
- Empty state: "No active gear" with link to create a checkout for this user
- RBAC: ADMIN/STAFF see any user's gear; STUDENT sees only own (via self-view)
- shadcn: Tabs (already used), Table, Badge, Button

**2.4 Summary stats bar on list page**
- Stat bar above filters: "X total · Y active · Z students · W staff · V admins"
- Extend `GET /api/users` response with `stats: { total, active, byRole: { ADMIN, STAFF, STUDENT } }`
- Single additional `groupBy` query (no new endpoint)
- Desktop: horizontal stat chips. Mobile: scrollable row
- shadcn: Badge (for chips)

**2.5 CSV export**
- "Export" button in list page header (next to "Add user")
- Exports current filtered view (respects search, role, location, active filters)
- New API route: `GET /api/users/export?format=csv` with same filter params as list endpoint
- Returns CSV with headers: Name, Email, Role, Location, Primary Area, Active, Member Since
- RBAC: ADMIN/STAFF only
- Warn if filtered count > 500 (X-Truncated header, same pattern as items export)
- shadcn: Button, DropdownMenuItem (if adding to existing dropdown)

**2.6 Area filter on list page**
- Add `primaryArea` filter to `UserFilters.tsx` using existing `AREA_OPTIONS` from `types.ts`
- API: add `primaryArea` filter param to `GET /api/users`
- Stacks with existing role/location/active filters
- shadcn: Select (same pattern as role filter)

### Schema Changes
None. All V2 features use existing schema models and relations.

### API Routes

| Route | Method | Status |
|---|---|---|
| `POST /api/users/bulk` | **new** | Bulk actions (role, location, status) |
| `GET /api/users/[id]/bookings` | **new** | User's active bookings for Gear tab |
| `GET /api/users/export` | **new** | CSV export with filters |
| `GET /api/users` | modified | Add `primaryArea` filter; add `stats` to response |

### RBAC
- Session enforcement: all roles (deactivated = rejected)
- Bulk operations: ADMIN for role changes; ADMIN/STAFF for location/status
- Export: ADMIN/STAFF only
- Gear tab: ADMIN/STAFF see any user; STUDENT sees only self
- Area filter: all roles (read-only filter)

### Mobile
- Bulk selection: long-press to enter selection mode (follow items pattern)
- Gear tab: card layout for bookings (same as mobile booking cards elsewhere)
- Stats bar: horizontally scrollable chips
- Export: full-width button in mobile layout
- Area filter: stacks with existing filter dropdowns

### Risks
- **Bulk role escalation**: STAFF bulk-changing users to ADMIN. Mitigate: enforce same RBAC as single role change endpoint per `lessons.md` pattern.
- **Export performance**: Large user lists on Vercel 10s hobby plan. Mitigate: stream CSV; limit to 500 rows with truncation warning.
- **Scope creep**: 6 features. If needed, prioritize: 2.1 (session enforcement), 2.3 (gear tab), 2.2 (bulk).

### Dependencies
- Items page bulk action pattern (`use-bulk-actions.ts`) is the template for 2.2
- Booking data model exists; just need a filtered query endpoint for 2.3
- No schema migrations needed

### Build Order
1. Backend: `requireAuth` active check + session deletion on deactivation (2.1)
2. API: `POST /api/users/bulk` following items bulk pattern (2.2)
3. API: `GET /api/users/[id]/bookings` (2.3)
4. API: `GET /api/users/export` (2.5)
5. API: Extend `GET /api/users` with `primaryArea` filter and `stats` (2.4, 2.6)
6. UI: Bulk selection + action bar on list page (2.2)
7. UI: Gear tab on detail page (2.3)
8. UI: Stats bar, area filter, export button (2.4, 2.5, 2.6)

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
- shadcn: TableHead (sortable), Badge (for "stale" indicator)

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
- shadcn: Progress, Collapsible, Checkbox

**3.3 Automatic deactivation policy**
- Admin-configurable rule: "Deactivate users inactive for X days"
- Vercel Cron job: runs daily at 5 AM UTC, deactivates users where `lastActiveAt < now() - X days`
- Creates audit entries for each auto-deactivation
- Notification to all ADMINs listing auto-deactivated users
- Admin UI: settings page for configuring threshold (or disabling)
- Cron route: `POST /api/cron/deactivate-stale-users` secured by `CRON_SECRET`
- Uses existing `SystemConfig` model (GAP-21) for storing threshold
- shadcn: Input (threshold days), Switch (enable/disable), Card

**3.4 User activity heatmap**
- On detail page Activity tab, add heatmap showing activity density by day (past 6 months)
- New API route: `GET /api/users/[id]/activity-summary` returning `{ date: string, count: number }[]`
- Server-side aggregation: `GROUP BY date_trunc('day', created_at)` on AuditLog
- Uses existing `src/components/ui/heatmap.tsx` component
- shadcn: Heatmap (already available in `src/components/ui/`)

**3.5 Smart assignment suggestions**
- When editing sport/area assignments on user detail, suggest based on:
  - What sports the user has checked out gear for (booking history → calendarEvent.sportCode)
  - What areas the user has been assigned shifts in (shiftAssignment → shift → area)
- New API route: `GET /api/users/[id]/assignment-suggestions`
- Displayed as "Suggested" Badge pills in the existing popover multi-select
- RBAC: ADMIN/STAFF only (same as assignment editing)

**3.6 User comparison view**
- Select 2-3 users from list and compare side-by-side
- Shows: role, location, assignments, active bookings count, activity count, last active
- Transposed table layout (users as columns, attributes as rows)
- No new API — aggregates existing detail endpoints client-side
- Desktop only; mobile shows "View on desktop" message
- shadcn: Table, Avatar, Badge, Sheet (for mobile fallback)

**3.7 Notification preferences on user profile**
- New tab on detail page: "Notifications" (alongside Info, Gear, Activity)
- Per-user toggles: email, in-app, overdue reminders, shift reminders
- Schema: add `notificationPrefs Json?` to User model
- Zod schema for validation: `z.object({ email: z.boolean(), inApp: z.boolean(), overdue: z.boolean(), shifts: z.boolean() })`
- API: `PATCH /api/users/[id]/preferences`
- Self-editable; ADMIN can override for any user
- shadcn: Switch (per toggle), Card, Label, Tabs

### Schema Changes

```prisma
// User model additions
lastActiveAt       DateTime?  @map("last_active_at")
notificationPrefs  Json?      @map("notification_prefs")
```

Single migration. `SystemConfig` model already exists for auto-deactivation threshold.

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

### Mobile
- Last active: hidden column on mobile (card layout shows as subtitle text)
- Onboarding checklist: Collapsible card, works on all screens
- Heatmap: horizontally scrollable, reduced to 3-month view on mobile
- Comparison view: desktop only (Sheet with "View on desktop" on mobile)
- Notification prefs: full-width Switch toggles, works well on mobile

### Risks
- **Write amplification from lastActiveAt**: Updating on every request. Mitigate: 5-minute debounce with conditional UPDATE.
- **Auto-deactivation false positives**: Seasonal workers or leave. Mitigate: admin notification before deactivation; configurable threshold; easy re-activation.
- **Over-engineering**: V3 features may not be needed at current 4-user team size. Mitigate: treat V3 as a menu, not a mandate. Only implement when team grows.
- **Heatmap data volume**: 6 months of audit logs per user. Mitigate: server-side aggregation, not client-side.
- **Notification prefs JSON drift**: Mitigate: define TypeScript type and validate with Zod on write.

### Dependencies
- V2 must ship first (gear tab for onboarding checklist, session enforcement for deactivation safety)
- Auto-deactivation requires Vercel Cron configuration in `vercel.json`
- Notification preferences depend on notification system (already shipped)
- Heatmap component already available (`src/components/ui/heatmap.tsx`)

### Build Order
1. Schema migration (add `lastActiveAt`, `notificationPrefs`)
2. Backend: `lastActiveAt` update logic in `withAuth` (debounced)
3. API: activity-summary, assignment-suggestions, preferences, cron endpoint
4. API: Extend `GET /api/users` with lastActive sort and stale filter
5. UI: Last-active column + sort on list page
6. UI: Activity heatmap on detail page
7. UI: Onboarding checklist on detail page
8. UI: Notification preferences tab
9. UI: Assignment suggestions in editing popovers
10. UI: Comparison view
11. Backend: Auto-deactivation cron job + admin settings UI

---

## Cross-Version Summary

| Capability | V1 ✅ | V2 | V3 |
|---|---|---|---|
| User status (active/inactive) | Field + display + login blocking | Session enforcement | Auto-deactivation |
| Activity tab | Cursor pagination | Gear tab added | Heatmap + timeline |
| Create user | Dialog with validation | — | — |
| Password management | Admin reset + session invalidation | — | — |
| Sport/area assignments | Full CRUD (popover multi-select) | — | Smart suggestions |
| Bulk operations | — | Select + bulk actions | — |
| Cross-page links | — | Gear tab (bookings) | — |
| Export | — | CSV export | — |
| Stats & filters | Role/location/active | Stats bar + area filter | Last-active + stale filter |
| Engagement tracking | — | — | lastActiveAt + onboarding |
| Notification prefs | — | — | Per-user preferences |
| Registration gating | D-029 (allowlist) | — | — |

## Critical Files for Implementation

| File | V2 Changes | V3 Changes |
|---|---|---|
| `src/lib/auth.ts` | Active check in `requireAuth()` | `lastActiveAt` debounced update |
| `src/app/api/users/[id]/route.ts` | Session deletion on deactivation | Add `lastActiveAt` to response |
| `src/app/(app)/users/page.tsx` | Bulk selection, stats bar, area filter, export | Last-active column, stale filter |
| `src/app/(app)/users/[id]/page.tsx` | Gear tab | Notifications tab, onboarding checklist |
| `src/app/(app)/users/[id]/UserInfoTab.tsx` | — | Assignment suggestions |
| `src/app/(app)/users/[id]/UserActivityTab.tsx` | — | Activity heatmap |
| `src/app/(app)/items/hooks/use-bulk-actions.ts` | Pattern template for bulk ops | — |
| `prisma/schema.prisma` | No changes | `lastActiveAt`, `notificationPrefs` |

## Change Log
- 2026-03-23: Initial roadmap created. V1 scope: status field, activity pagination, dialog create, password reset.
- 2026-04-06: Major refresh post-audit. V1 marked complete (all 5 features shipped). V2 re-scoped: removed assignment editing (shipped early via GAP-23), added session-level enforcement as 2.1 (HIGH PRIORITY), moved login blocking from V2.4 to V2.1. V3 unchanged except added heatmap component reference and SystemConfig model note.
