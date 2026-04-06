# BRIEF: User Deactivation V1

## Document Control
- Feature: User Deactivation
- Owner: Wisconsin Athletics Creative Product
- Created: 2026-03-25
- Status: Shipped (2026-04-03 feature, 2026-04-06 session enforcement)

## Problem
No way to deactivate users who leave the team. `User.active` field exists in schema but is not exposed in UI. Deactivated users can still log in and hold active bookings/reservations.

## V1 Scope

### Must Have
1. **Active/Inactive toggle on user detail page** — Admin-only action via PATCH `/api/users/[id]`
2. **Login blocking** — Deactivated users cannot log in. Auth middleware checks `active` field.
3. **Booking migration** — When deactivating a user with active checkouts:
   - Block deactivation if user has OPEN checkouts (must return gear first)
   - Cancel BOOKED reservations automatically with audit trail
   - Cancel DRAFT bookings automatically
4. **Visual indicator** — Deactivated users show "Inactive" badge on users list and detail pages
5. **Filter** — Users list defaults to showing only active users. Toggle to show all.

### Out of Scope (V2)
- Bulk deactivation
- Auto-deactivation after inactivity period
- Reactivation workflow with booking restoration
- Last-active tracking / heatmap

## Acceptance Criteria
- [x] AC-1: Admin can toggle user active/inactive on detail page
- [x] AC-2: Deactivated user cannot log in (redirected with message). Session-level enforcement added 2026-04-06.
- [x] AC-3: Deactivation blocked if user has OPEN checkouts
- [x] AC-4: BOOKED reservations auto-cancelled on deactivation
- [x] AC-5: Users list defaults to active-only filter
- [x] AC-6: All deactivation actions create audit log entries

## Technical Notes
- Schema: `User.active` field already exists (`Boolean @default(true)`)
- Auth: `active` checked in login endpoint (2026-04-03) AND `requireAuth()` (2026-04-06)
- Migration: None needed (field exists)
- API: Extend existing PATCH `/api/users/[id]` with `active` field

## Dependencies
- D-007: All mutations need audit logging (already implemented pattern)
