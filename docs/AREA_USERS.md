# Users Area Scope (V1)

## Document Control
- Area: Users
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-25
- Status: Active
- Version: V1.1

## Direction
Use a simple tiered permission model with inheritance so behavior is predictable in UI and backend authorization.

## Role Hierarchy
1. `ADMIN`
   - Inherits all `STAFF` and `STUDENT` permissions.
   - Can do everything.
2. `STAFF`
   - Inherits all `STUDENT` permissions.
   - Can add and edit all users.
   - Can add and edit all reservations and check-outs.
   - Can add and edit all items.
   - Can promote or demote users between roles.
   - Can force location exceptions.
3. `STUDENT`
   - Can add and edit their own reservations and check-outs.
   - Can view all users, items, reservations, and check-outs.

## Ownership Rule
- `Owner` means the user who created the reservation/checkout or the user explicitly assigned as booking owner.
- Ownership checks apply to `STUDENT` users for edit rights.

## Permission Matrix (V1)

### Users
- `ADMIN`: create, view, edit all users; manage role changes.
- `STAFF`: create, view, edit all users; manage role changes.
- `STUDENT`: view all users; no edit rights.

### Items
- `ADMIN`: create, view, edit all items.
- `STAFF`: create, view, edit all items.
- `STUDENT`: view all items; no item edit rights.

### Reservations
- `ADMIN`: create, view, edit, cancel, archive all reservations.
- `STAFF`: create, view, edit, cancel, archive all reservations.
- `STUDENT`: view all reservations; create, edit, cancel own reservations only.

### Check-outs
- `ADMIN`: create, view, edit, extend, check in, archive all check-outs.
- `STAFF`: create, view, edit, extend, check in, archive all check-outs.
- `STUDENT`: view all check-outs; create, edit, extend, check in own check-outs only.

### Location Exceptions
- `ADMIN`: allow and override location exceptions.
- `STAFF`: allow and override location exceptions.
- `STUDENT`: no location override rights.

### Drafts
- `ADMIN`: view, edit, discard all drafts.
- `STAFF`: view, edit, discard all drafts.
- `STUDENT`: view, edit, discard own drafts only.

## Dashboard Action Visibility Mapping
1. Dashboard actions are role-filtered per row.
2. `STUDENT` can view rows broadly but never sees edit actions for non-owned reservations/check-outs.
3. `STAFF` and `ADMIN` can act on any reservation/check-out row.
4. Hidden actions must not be reachable by direct URL or API calls.
5. Same role and ownership visibility rules apply to mobile action sheets and quick actions.

## Finalized Policy Decisions
1. Delete policy:
   - No hard delete in V1.
   - Use cancel and archive patterns.
2. Role management scope:
   - `STAFF` can promote and demote users between roles.
3. Cross-location overrides:
   - `STAFF` can force location exceptions.

## Authorization Guardrails
1. Enforce permissions server-side for every mutation endpoint.
2. UI visibility must mirror backend authorization but never replace it.
3. Every denied action should return a consistent authorization error.
4. Audit logs must include actor role and actor id for all edits.

## Edge Cases
- Student attempts to edit a booking that was reassigned.
- Staff account is demoted while editing a record.
- Owner is deactivated with active reservations/check-outs.
- Draft created by one user but accessed by another user.
- API request bypasses UI and attempts unauthorized edit.

## Acceptance Criteria
- [x] AC-1: Role inheritance is deterministic: `ADMIN > STAFF > STUDENT`.
- [x] AC-2: Students can view all users/items/reservations/check-outs.
- [x] AC-3: Students can modify only owned reservations/check-outs.
- [x] AC-4: Staff can modify all users, items, reservations, and check-outs.
- [x] AC-5: Staff can manage role changes and force location exceptions.
- [x] AC-6: Unauthorized actions are blocked and audited.

## Developer Brief (No Code)
1. Define a centralized permission policy map keyed by role and resource.
2. Add ownership checks for student reservation and check-out mutations.
3. Add read-scope rules that allow student visibility across users/items/reservations/check-outs.
4. Add role-management and location-exception permissions for staff.
5. Add authorization tests for all role-resource-action combinations.
6. Ensure audit logs include actor role, target owner, and exception metadata.

## Change Log
- 2026-03-01: Initial file created as access-control scope.
- 2026-03-01: Renamed area to Users and expanded student read visibility.
- 2026-03-01: Finalized delete policy, role management scope, and location exception policy.
- 2026-03-02: Added explicit mobile action-sheet alignment for role-based visibility.
- 2026-03-14: Shipped enhanced Users page — API access widened per spec (GET: all roles, POST/PATCH: ADMIN+STAFF), inline role/location editing, user detail editing, search/filter, audit logging for all user mutations, role-aware UI gating. Acceptance criteria 1-5 now met.
- 2026-03-14: RBAC hardening — centralized permission policy map (src/lib/permissions.ts), requirePermission added to all mutation endpoints app-wide, audit logs now include actor role via createAuditEntry helper. Acceptance criterion 6 now met.
- 2026-03-17: Users page architectural redesign — component extraction (RoleBadge, UserRow, UserFilters, CreateUserCard), server-side pagination/search/sort/filter on GET /api/users, dedicated /users/[id] detail page with Info and Activity tabs, mobile card layout, role badges (ADMIN=purple, STAFF=blue, STUDENT=gray), inline editing in detail page (name, email, phone, primaryArea, location, role), sport/area assignment display, user activity timeline via new GET /api/users/[id]/activity endpoint, toggleable create form, location filter.
- 2026-03-22: Users page hardening (5-pass audit):
  - **Design system**: Migrated to shadcn/ui tokens (text-muted-foreground, Tailwind grid/flex). Fixed broken spacing (p-16→px-6 pb-6, gap-12→gap-3, mb-8→mb-2). Removed 50 lines dead CSS. Removed dead ROLE_BADGE export.
  - **Data flow**: AbortController on all fetches (race condition prevention + unmount cleanup). Form-options/me fetch failure no longer blocks page. Stale response overwrite prevention.
  - **Resilience**: Retry buttons on all error states (list, detail, activity). 401 redirect to /login on all fetches and mutations (list, detail, create, patch, role change, activity).
  - **UX polish**: High-fidelity skeletons matching real row layout (avatar circle, name/email lines, badge pill). Refresh shows spinner instead of replacing data with skeletons. Result count always visible below list.
- 2026-03-23: Profile page hardening (5-pass audit):
  - **Design system**: Merged profile page into user detail page. `/profile` now redirects to `/users/{currentUserId}`. Avatar upload, password change integrated into user detail page when viewing self. Sidebar and topbar links point directly to `/users/{id}`. Removed 50 lines dead profile CSS (`.profile-avatar-section`, `.profile-form`, `.roles-table`).
  - **Data flow**: Fixed student self-edit permissions — students can edit name/location via `/api/profile`, other fields require ADMIN/STAFF via `/api/users/:id`. Added null-safe guards on `sportAssignments`/`areaAssignments` arrays. Separated `isSelf` from `canEdit` for field-level permission control.
  - **Resilience**: Retry now clears stale user data to prevent briefly showing wrong user. Null-safe avatar upload response.
  - **UX polish**: Optimistic avatar removal with rollback on failure. Breadcrumb shows "Profile" when viewing self. High-fidelity loading skeletons matching actual field rows and assignment badges.
- 2026-03-23: Created Users page versioned roadmap (`tasks/users-roadmap.md`). Defines V1 (status field, activity pagination, dialog create, password reset), V2 (bulk operations, gear tab, assignment editing, login blocking, export), V3 (last-active tracking, auto-deactivation, heatmap, smart suggestions, notification prefs). Each version includes schema changes, API routes, RBAC, risks, and build order.
- 2026-03-23: Users page improvements — 3 enhancements shipped:
  - **Create user dialog**: Replaced inline CreateUserCard with Dialog component. Eliminates list displacement when creating users. Form uses labeled fields in structured layout with DialogFooter.
  - **Activity tab pagination**: Replaced hard `take: 100` cap with cursor-based pagination (50 per page). API returns `nextCursor`; UI shows "Load more" button when more entries exist.
  - **Member since date**: `createdAt` now returned by GET/PATCH `/api/users/[id]` and displayed as "Member since {date}" in user detail header.
- 2026-03-23: Users page hardening (5-pass audit):
  - **Design system**: Removed 34 lines dead profile CSS (`.profile-grid`, `.profile-field-*`, `.form-success`). Fixed users page CSS comment.
  - **Data flow**: List refresh failure now preserves existing data (hasDataRef pattern). Activity loadMore shows toast on failure instead of silent swallow.
  - **Resilience**: Create user dialog resets form on reopen (Radix Dialog retains DOM state). Network vs server error differentiation.
  - **UX polish**: Manual refresh button with "Updated Xm ago" tooltip. Wifi-off icon + distinct copy for offline errors. `wifi-off` icon added to shared EmptyState.
- 2026-03-23: Users stress test — 5 issues found and fixed:
  - **BRK-003 (CRITICAL)**: STAFF could demote ADMIN users via role endpoint. Guard now blocks STAFF from changing ADMIN roles in either direction.
  - **BRK-004 (CRITICAL)**: STAFF could edit ADMIN user profiles via PATCH. Guard now rejects STAFF modifications to ADMIN users.
  - **BRK-001/002 (HIGH)**: Email uniqueness TOCTOU on create/update. Removed manual findUnique pre-checks, catch P2002 from DB unique constraint instead.
  - **BRK-005 (MEDIUM)**: Profile self-update `/api/profile` missing before-snapshot in audit. Now fetches current state and records field-level diffs.
- 2026-03-25: Doc sync — standardized ACs to checkbox format, all 6 checked.
- 2026-03-26: Avatar system roadmap created — see `tasks/avatars-roadmap.md`. V1: centralized initials utility, color-coded fallbacks, avatar photos in shift picker/schedule rows. V2: admin avatar upload, bulk import, image resize. V3: role badges, quick actions, team roster view.
- 2026-03-26: **Avatar hardened (5-pass):** UserAvatar API cleaned — `name` is now required prop (derives initials + color). All inline `charAt(0)` avatar usages migrated to `getInitials()` + `getAvatarColor()`. Zero remaining inline initials across 14 consumers.
- 2026-04-03: **Registration gating (D-029):** Self-registration now requires email to be on admin-managed allowlist (`AllowedEmail` table). Role pre-assigned at invite time. Admin UI at Settings > Allowed Emails. See D-029 for full constraints.
- 2026-04-03: **Auth stress test (4 issues fixed):** BRK-001 (HIGH) bulk endpoint STAFF role bypass; BRK-002 (MEDIUM) register not atomic; BRK-003 (MEDIUM) delete race with concurrent claim; BRK-004 (LOW) whitespace-only names.
