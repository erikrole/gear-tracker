# Users Area Scope (V1)

## Document Control
- Area: Users
- Owner: Wisconsin Athletics Creative Product
- Last Updated: 2026-03-02
- Status: Active
- Version: V1

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
1. Role inheritance is deterministic: `ADMIN > STAFF > STUDENT`.
2. Students can view all users/items/reservations/check-outs.
3. Students can modify only owned reservations/check-outs.
4. Staff can modify all users, items, reservations, and check-outs.
5. Staff can manage role changes and force location exceptions.
6. Unauthorized actions are blocked and audited.

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
