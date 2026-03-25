# Users Ship-Readiness Audit
**Date**: 2026-03-25
**Overall Verdict**: Ship-ready (21/25)

## Scores

| Dimension | Score | Notes |
|---|---|---|
| Scope clarity | 5/5 | AREA_USERS.md is thorough: role hierarchy, permission matrix, ownership rules, edge cases, acceptance criteria. D-011 formalizes the tiered role model. All 6 acceptance criteria documented and marked met. |
| Hardening | 4/5 | 5-pass hardening completed for both Users page (2026-03-22) and Profile page (2026-03-23). AbortController race prevention, retry buttons, 401 redirects, high-fidelity skeletons all present. Minor: Profile PATCH does not validate `body` with zod before checking `body.action` (raw JSON parsed first, then branched). |
| Roadmap | 3/5 | No dedicated `tasks/users-roadmap.md` exists. Future/deferred features are mentioned only in AREA doc change log and GAPS_AND_RISKS.md. No formal "next steps" section in AREA_USERS.md. |
| Feature completeness | 5/5 | All V1 acceptance criteria met: role inheritance (ADMIN>STAFF>STUDENT), student view-all, student modify-own, staff modify-all, staff role management + location exceptions, unauthorized actions blocked + audited. Profile merged into user detail. Avatar upload/remove. Password change. |
| Doc sync | 4/5 | AREA_USERS.md change log reflects all shipped work through 2026-03-23. GAPS_AND_RISKS.md has no open gaps for Users area. Minor: AREA_USERS.md "Developer Brief" section still reads as TODO guidance rather than shipped-status summary. |

## Page-by-Page Status

| Page | Route | Hardening | Issues |
|---|---|---|---|
| Users List | `/users` | Hardened | AbortController, 401 redirect, retry on error, high-fidelity skeleton, refresh spinner, pagination, mobile card layout, filter chips. No issues. |
| User Detail | `/users/[id]` | Hardened | AbortController, 401 redirect, retry with stale-data clear, loading skeleton, breadcrumb shows "Profile" when isSelf, avatar upload/remove with optimistic rollback, tabs (Info/Activity). No issues. |
| UserInfoTab | `/users/[id]` | Hardened | SaveableField/useSaveField for inline editing. Self-edit permission separation. Students edit name/location via /api/profile; other fields require STAFF+. Password change with disabled-during-submit. |
| UserActivityTab | `/users/[id]` | Hardened | AbortController with cleanup, 401 redirect, retry button, loading skeletons, empty state, field-change diff display. |
| CreateUserCard | `/users` | Hardened | Zod-validated on server side, 401 redirect, toast feedback, disabled-during-submit, network error catch. |
| Profile Redirect | `/profile` | Hardened | Thin redirect to `/users/{currentUserId}` — no logic to harden. |

## API Route Status

| Route | Method | Auth | Validation | Audit Log | Issues |
|---|---|---|---|---|---|
| `/api/users` | GET | withAuth + requireRole | Pagination, role/location params | N/A (read) | None |
| `/api/users` | POST | withAuth + requireRole (ADMIN, STAFF) | Zod schema | Yes | Privilege escalation blocked: only ADMIN can create ADMIN users |
| `/api/users/[id]` | GET | withAuth + requireRole | Student can only view self | N/A (read) | None |
| `/api/users/[id]` | PATCH | withAuth + requireRole (ADMIN, STAFF) | Zod schema | Yes (before/after diff) | None |
| `/api/users/[id]/role` | PATCH | withAuth + requireRole (ADMIN, STAFF) | Zod | Yes (before/after role) | Self-role-change blocked. Only ADMIN can grant ADMIN. |
| `/api/profile` | PATCH | withAuth | Zod | Yes | Minor: raw `body.action` check before Zod parse |
| `/api/profile/avatar` | POST | withAuth | validateImage | **No audit log** | Missing per D-007 |
| `/api/profile/avatar` | DELETE | withAuth | Checks avatar exists | **No audit log** | Missing per D-007 |

## Feature Inventory

| Feature | Status | Source | Notes |
|---|---|---|---|
| Role hierarchy (ADMIN > STAFF > STUDENT) | Shipped | AREA_USERS, D-011 | Enforced in permissions.ts + all API routes |
| Student view-all users | Shipped | AREA_USERS AC-2 | GET /api/users allows all roles |
| Student modify own only | Shipped | AREA_USERS AC-3 | /api/profile for self-edits |
| Staff modify all users | Shipped | AREA_USERS AC-4 | PATCH /api/users/[id] |
| Staff role management | Shipped | AREA_USERS AC-5 | Dedicated role endpoint |
| Unauthorized actions blocked + audited | Shipped | AREA_USERS AC-6 | requireRole + createAuditEntry |
| User creation (ADMIN/STAFF) | Shipped | AREA_USERS | CreateUserCard + POST |
| User detail with Info + Activity tabs | Shipped | AREA_USERS changelog | Component-extracted |
| Search / filter / sort | Shipped | AREA_USERS changelog | Server-side pagination |
| Mobile card layout | Shipped | AREA_USERS changelog, D-015 | Separate UserMobileCard |
| Inline editing (detail page) | Shipped | AREA_USERS changelog | SaveableField pattern |
| Avatar upload/remove | Shipped | AREA_USERS changelog | Vercel Blob, optimistic removal |
| Password change (self) | Shipped | AREA_USERS changelog | Via /api/profile |
| Profile redirect to user detail | Shipped | AREA_USERS changelog | /profile -> /users/{id} |
| User deactivation/archival | Missing | AREA_USERS edge cases | No deactivation flow exists |
| Sport/area assignment CRUD | Missing | Schema exists | Display-only in V1, no add/remove UI |
| Authorization tests | Missing | AREA_USERS Dev Brief #5 | No test files found |
| Audit log for avatar operations | Missing | D-007 | POST/DELETE avatar lack createAuditEntry |

## Open Gaps & Blockers

1. **No user deactivation flow** — AREA_USERS edge case lists "Owner is deactivated with active reservations/check-outs" but no mechanism exists. Not a V1 blocker.
2. **Sport/area assignment management** — Assignments display but no CRUD UI. Only manageable via direct DB or import.
3. **No authorization tests** — Developer Brief #5 calls for role-resource-action tests. None exist.
4. **Avatar operations unaudited** — Per D-007, avatar upload and removal should emit audit entries.
5. **Activity endpoint unbounded** — `take: 100` is reasonable for V1 but no pagination for extensive histories.

## Recommended Actions (prioritized)

1. **Add audit logging to avatar upload/delete** — Low effort, high compliance. Add `createAuditEntry` to both handlers. Required by D-007.
2. **Add user deactivation brief** — Planning only. Write a brief for the documented edge case.
3. **Add sport/area assignment CRUD** — Medium effort. Schema and display exist, needs add/remove UI in UserInfoTab.
4. **Write authorization integration tests** — Medium effort. Cover all role-resource-action combinations per Dev Brief #5.
5. **Add pagination to activity endpoint** — Low effort. Accept `limit`/`offset` params.

## Roadmap Status

**Rating: Partially defined**

No dedicated roadmap file exists. Future work is only inferable from edge cases and developer brief items. NORTH_STAR lists users hardening as complete in Phase A with no Phase B/C items. Deferred capabilities (deactivation, assignment management, tests) are not tracked in any plan file.
