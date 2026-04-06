# Users Ship-Readiness Audit
**Date**: 2026-04-06
**Auditor**: Claude (automated)
**Area**: Users
**Overall Verdict**: Ship-ready (22/25)

## Scores
| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_USERS.md is comprehensive with clear role hierarchy, permission matrix, and all 6 ACs checked. IA matches code exactly. |
| Hardening | 5/5 | Multiple 5-pass audits documented (list, detail, profile, avatar). Two stress tests found and fixed 9 issues total. Every page has AbortController, error differentiation, retry buttons, skeletons. |
| Roadmap | 5/5 | `tasks/users-roadmap.md` defines V1/V2/V3 with features, schema changes, API routes, RBAC, risks, dependencies, and build order per version. |
| Feature completeness | 4/5 | All V1 features shipped. Session-level active check (withAuth) deferred to V2 — login blocking is partial (new logins blocked, existing sessions not). |
| Doc sync | 3/5 | BRIEF_USER_DEACTIVATION_V1.md has all 6 ACs still unchecked despite feature being shipped. todo.md has stale assignment CRUD item. Roadmap V1 items 1.1/1.5 not checked off. |

## Page-by-Page Status
| Page | Route | Hardening | Issues |
|---|---|---|---|
| Users list | `/users` | Hardened | None. 5-pass audit ×2 documented. shadcn Table, high-fidelity skeletons, network/server error differentiation, mobile cards. |
| User detail | `/users/[id]` | Hardened | None. 5-pass audit documented. SaveableField inline editing, avatar upload/remove, active toggle, password reset dialog, activity pagination. |
| Profile redirect | `/profile` | Hardened | Simple redirect to `/users/{id}`. AbortController on fetch. |

## API Route Status
| Route | Method | Auth | Validation | Audit | Notes |
|---|---|---|---|---|---|
| `/api/users` | GET | All roles | Query params | N/A | Pagination, search, role/location/active filters, sorting |
| `/api/users` | POST | ADMIN/STAFF | Zod schema | Yes | P2002 handling, ADMIN role escalation guard |
| `/api/users/[id]` | GET | All (student self-only) | N/A | N/A | Includes sportAssignments, areaAssignments |
| `/api/users/[id]` | PATCH | ADMIN/STAFF | Zod schema | Yes (before/after diff) | STAFF blocked from editing non-student profiles. Deactivation guards: blocks if OPEN checkouts, auto-cancels BOOKED/DRAFT |
| `/api/users/[id]/role` | PATCH | ADMIN/STAFF | Zod | Yes | Self-change blocked, ADMIN-only for admin roles (both grant AND revoke) |
| `/api/users/[id]/activity` | GET | All (student self-only) | Cursor/limit | N/A | Cursor-based pagination, limit+1 hasMore pattern |
| `/api/users/[id]/reset-password` | POST | ADMIN only | N/A | Yes | Self-reset blocked, session invalidation, secure random password |

## Component Inventory
| Component | File | shadcn | Notes |
|---|---|---|---|
| UsersPage | `src/app/(app)/users/page.tsx` | Yes | 309 lines. useFetch, useDebounce, pagination, sort headers. |
| UserDetailPage | `src/app/(app)/users/[id]/page.tsx` | Yes | 411 lines. Tabs, avatar upload, active toggle, password reset dialog. |
| UserInfoTab | `src/app/(app)/users/[id]/UserInfoTab.tsx` | Yes | 613 lines. SaveableField inline editing, sport/area CRUD via Popover+Command multi-select. |
| UserActivityTab | `src/app/(app)/users/[id]/UserActivityTab.tsx` | Yes | 281 lines. Cursor pagination, field-level change display, color-coded entity types. |
| UserRow | `src/app/(app)/users/UserRow.tsx` | Yes | Desktop table row + mobile card variants. |
| UserFilters | `src/app/(app)/users/UserFilters.tsx` | Yes | Search, role, location, show-inactive filters. |
| CreateUserCard | `src/app/(app)/users/CreateUserCard.tsx` | Yes | Dialog-based create form (replaced inline card). |
| RoleBadge | `src/app/(app)/users/RoleBadge.tsx` | Yes | Color-coded: ADMIN=purple, STAFF=blue, STUDENT=gray. |
| ProfileRedirect | `src/app/(app)/profile/page.tsx` | Minimal | AbortController redirect to `/users/{id}`. |

## Feature Inventory
| Feature | Status | Source | Notes |
|---|---|---|---|
| User CRUD (create, read, update) | Shipped | AREA_USERS AC-1 through AC-5 | Full inline editing via SaveableField |
| Role management (promote/demote) | Shipped | AREA_USERS AC-5, D-011 | ADMIN-only for admin roles; BRK-003/004 fixed |
| Permission model (ADMIN > STAFF > STUDENT) | Shipped | D-011, AREA_USERS | Centralized `requireRole` + `requirePermission` |
| Search/filter/sort on list | Shipped | AREA_USERS changelog | Server-side pagination, debounced search, role/location/active filters |
| Activity timeline with cursor pagination | Shipped | Roadmap V1.2 | 50/page with "Load more" button |
| Avatar management (upload/remove) | Shipped | AREA_USERS changelog | Optimistic removal with rollback. Profile merged into detail page. |
| User deactivation (active toggle) | Shipped | BRIEF_USER_DEACTIVATION_V1, GAP-31 | Admin toggle, OPEN checkout block, auto-cancel BOOKED/DRAFT, inactive badge |
| Login blocking for inactive users | Shipped (partial) | GAP-31 | New logins blocked (`auth/login/route.ts:22`). **Existing sessions NOT terminated** — `requireAuth()` does not check `user.active`. Roadmap V2.4 plans full enforcement. |
| Admin password reset | Shipped | Roadmap V1.5 | ADMIN-only, session invalidation, temp password shown once |
| Profile merged into user detail | Shipped | AREA_USERS changelog | `/profile` redirects to `/users/{id}`. Self-view shows avatar upload + password change. |
| Sport/area assignment CRUD | Shipped | GAP-23 | Popover multi-select in UserInfoTab. Sport roster + area assignment APIs. |
| Registration gating (email allowlist) | Shipped | D-029 | AllowedEmail model, admin UI at Settings > Allowed Emails |
| Create user dialog | Shipped | Roadmap V1.3 | Replaced inline CreateUserCard with Dialog component |
| Member since date | Shipped | Roadmap V1.4 | `createdAt` shown in detail header |
| Bulk user operations | Not started | Roadmap V2.1 | Row selection, bulk role/location/status changes |
| User gear tab | Not started | Roadmap V2.2 | Cross-page link showing active bookings |
| CSV export | Not started | Roadmap V2.6 | Export current filtered view |
| Area filter on list | Not started | Roadmap V2.7 | `primaryArea` filter param |
| Summary stats bar | Not started | Roadmap V2.5 | Role counts above filters |
| Last-active tracking | Not started | Roadmap V3.1 | `lastActiveAt` field, stale user detection |
| Auto-deactivation | Not started | Roadmap V3.3 | Cron job + admin-configurable threshold |
| Notification preferences | Not started | Roadmap V3.7 | Per-user toggles for email/in-app |

## Open Gaps & Blockers

### Session-level active check missing
- **Severity**: Medium
- **Description**: `requireAuth()` in `src/lib/auth.ts:79-104` does not check `user.active`. A deactivated user with an active session can continue making API calls until the session expires naturally. Login blocking only prevents NEW sessions (`src/app/api/auth/login/route.ts:22`).
- **Mitigation**: The deactivation endpoint doesn't delete sessions either (`src/app/api/users/[id]/route.ts`). Admin can work around by resetting the user's password (which DOES delete sessions at line 31 of `reset-password/route.ts`).
- **Roadmap status**: Planned as V2.4. GAP-31 claims "login blocking shipped" which is technically true but potentially misleading — it's login-time blocking only, not session-level enforcement.

### BRIEF_USER_DEACTIVATION_V1.md acceptance criteria not checked
- **Severity**: Low (doc drift only)
- **Description**: All 6 acceptance criteria in `docs/BRIEF_USER_DEACTIVATION_V1.md` are marked `[ ]` unchecked, but the feature has shipped and GAP-31 is closed. ACs 1-6 should all be checked based on implemented behavior.

### tasks/todo.md stale entry
- **Severity**: Low (doc drift only)
- **Description**: `tasks/todo.md` line 16 lists "Add sport/area assignment CRUD" as open, but GAP-23 was closed 2026-03-28 and the feature is shipped in `UserInfoTab.tsx`.

### Roadmap V1 items not checked off
- **Severity**: Low (doc drift only)
- **Description**: `tasks/users-roadmap.md` items 1.1 (user status field) and 1.5 (admin password reset) are not marked as shipped, but both features exist in the codebase.

## Recommended Actions (prioritized)

1. ~~**[Medium] Add `user.active` check to `requireAuth()`**~~ — **DONE 2026-04-06.** Session-level enforcement + session deletion on deactivation.

2. ~~**[Low] Check off BRIEF_USER_DEACTIVATION_V1.md ACs**~~ — **DONE 2026-04-06.** All 6 ACs checked, status changed to "Shipped".

3. ~~**[Low] Remove stale todo.md entry**~~ — **DONE 2026-04-06.** Assignment CRUD marked shipped.

4. ~~**[Low] Update users-roadmap.md V1 checkmarks**~~ — **DONE 2026-04-06.** V1 marked complete in roadmap refresh.

5. **[Optional] Consider V2 prioritization** — The gear tab (2.3) and summary stats (2.4) would add significant operational value. Bulk operations (2.2) and CSV export (2.5) are common admin requests.

## Roadmap Status

| Version | Status | Notes |
|---|---|---|
| V1 — Core | **Complete** | All 5 features shipped: status field, activity pagination, create dialog, member-since, password reset. |
| V2 — Enhanced | Not started | 7 features planned: bulk ops, gear tab, assignment editing (already shipped separately), login blocking enforcement, stats bar, CSV export, area filter. Note: 2.3 (assignment editing) was shipped ahead of V2 via GAP-23. |
| V3 — Advanced | Not started | 7 features planned: lastActiveAt, onboarding checklist, auto-deactivation, activity heatmap, smart suggestions, comparison view, notification prefs. |

**Summary**: The Users area is in excellent shape. All V1 features shipped, extensively hardened through multiple audit passes, well-documented with a clear evolution roadmap. The single meaningful gap is session-level enforcement for deactivated users — a targeted fix that could ship in minutes. Doc drift is cosmetic and does not affect functionality.
