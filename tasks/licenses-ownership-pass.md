# Licenses Ownership Pass - 2026-05-07

## Goal
- Make the Photo Mechanic license pool scan like a current operational list page, with correct row affordances, clear hidden-retired state, and no dead click paths.

## Peer patterns checked
- Items: compact metric strip with tabular numbers and active filter tiles.
- Users: roster summary tiles above the table and explicit retry/empty states.
- Kits: keyboard-operable rows only where navigation actually works.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [ ] Kits: consider replacing the full-card wrapper around table/empty states with the lighter Items/Users bordered table pattern in a future pass.

## Review
- Shipped: compact license health summary, explicit hidden-retired empty state, corrected row affordances for student-held licenses, clearer claim/inspect aria labels, admin bulk renewal for expiring/expired or all visible active codes, and user-visible recent claim/return history.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed after user-history wiring.
- Deferred: admin claim history pagination and full admin per-user license usage reporting remain documented low-volume follow-ups.
