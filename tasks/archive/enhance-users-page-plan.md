# Enhance Users Page — Plan

## Status: Complete

## Gap Analysis

Comparing `AREA_USERS.md` spec against current implementation:

| Feature | Spec says | Current state | Gap |
|---|---|---|---|
| **STAFF/STUDENT can view users** | STUDENT: view all; STAFF: view all | GET /api/users requires ADMIN only | API blocks non-admins |
| **STAFF can create users** | STAFF: create all users | POST /api/users requires ADMIN only | API blocks staff |
| **STAFF can edit users** | STAFF: edit all users | No edit API or UI exists | Missing entirely |
| **STAFF can manage roles** | STAFF: promote/demote | PATCH /api/users/[id]/role requires ADMIN only | API blocks staff |
| **Inline role editing** | Role changes from the list | No UI for role changes | Missing UI |
| **Edit user details** | Name, email, location editable | No PATCH /api/users/[id] route | Missing API + UI |
| **Role-based UI visibility** | Add form hidden for STUDENT | Form always shown (relies on 403) | No client-side gating |
| **Search/filter** | Implied by "view all users" at scale | No search or filter | Missing |
| **Audit logging** | All edits must include actor role/id | User creation has no audit log entry | Missing |

## Slices

### Slice 1: API — Widen access + add user edit endpoint
Backend changes only, independently testable via API calls.

- [ ] **1a.** `GET /api/users` — allow `["ADMIN", "STAFF", "STUDENT"]` (read access per spec)
- [ ] **1b.** `POST /api/users` — allow `["ADMIN", "STAFF"]`
- [ ] **1c.** `PATCH /api/users/[id]/role` — allow `["ADMIN", "STAFF"]`
- [ ] **1d.** New `PATCH /api/users/[id]` route — edit name, email, locationId (allow `["ADMIN", "STAFF"]`)
  - Validate email uniqueness on change
  - Cannot edit own email (safety guard)
- [ ] **1e.** Add audit log entries for user create, edit, and role change mutations

### Slice 2: UI — Role-aware page with inline editing
Frontend changes wired to existing + new API endpoints.

- [ ] **2a.** Fetch current user role via `/api/me` on page load
- [ ] **2b.** Conditionally show "Add user" form only for ADMIN/STAFF
- [ ] **2c.** Add inline role dropdown in table rows (ADMIN/STAFF only) — calls `PATCH /api/users/[id]/role`
- [ ] **2d.** Add inline location dropdown in table rows (ADMIN/STAFF only) — calls `PATCH /api/users/[id]`
- [ ] **2e.** Add edit button per row → opens edit form/modal for name, email, location (ADMIN/STAFF only)
- [ ] **2f.** Add client-side search/filter bar (filter by name, email, role)
- [ ] **2g.** Empty state component when no users match filter
- [ ] **2h.** Success/error toast or inline feedback for mutations

### Slice 3: Verification & docs
- [ ] **3a.** `npm run build` passes
- [ ] **3b.** Manual verification: STUDENT sees read-only table, STAFF sees full edit controls, ADMIN sees everything
- [ ] **3c.** Update `AREA_USERS.md` change log to reflect shipped features
- [ ] **3d.** Update `GAPS_AND_RISKS.md` if applicable

## Out of scope (V1)
- Hard delete users (spec says no hard delete in V1)
- User deactivation (not in spec)
- Password reset by admin (not in spec)
- Pagination (defer until user count warrants it)

## Risks
- **Worker subrequest limit**: User edit endpoint is a single DB call, no concern
- **Self-demotion guard**: Already exists for ADMIN; STAFF demoting themselves needs consideration → allow it (they're choosing to reduce their own access)

## Architecture notes
- Follow existing pattern: `fetch("/api/me")` for role, same as items/[id] page
- Inline editing preferred over modal to keep it simple (consistent with the table-centric design)
- All mutations server-side guarded; UI visibility is convenience only
