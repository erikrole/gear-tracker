# Checkout UX V2 — Thin Slice 2: Wire allowedActions into UI

## Goal
Wire the backend `allowedActions` contract into the checkout UI so actions reflect server-enforced rules by state, role, and ownership.

## Tasks
- [x] Thin Slice 1: Backend `checkout-rules.ts`, `event-defaults.ts`, `checkin-items` route
- [ ] Add `allowedActions` to `GET /api/checkouts/[id]` route
- [ ] Create client-side `getAllowedActionsClient()` helper for list-view gating
- [ ] BookingDetailsSheet: consume `allowedActions`, replace hardcoded booleans, add check-in action + partial progress
- [ ] Checkouts list: gate context menu with client-side rules, fetch currentUserId
- [ ] Add tests for client-side action gating helper
- [ ] Verify build, commit, push

## Out of Scope
- Dashboard action lanes (deferred to next slice)
- New backend mutations
- Event sync
- Broad styling cleanup
