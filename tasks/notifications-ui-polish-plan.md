# Notifications UI Polish Plan - 2026-05-09

## Goal

Make `/notifications` read like an action inbox: quick status at the top, clear filter/action hierarchy, and rows that show urgency, destination, and read state without extra parsing.

## Peer patterns checked

- Inventory Hygiene: compact metric strip and action-oriented rows.
- Licenses: header actions grouped by role and operational summary before the table.
- Settings: role-aware visibility should match server permissions.

## Plan

- [x] Structure: Add a compact notification summary and tighten the filter/action toolbar.
- [x] UX: Hide staff/admin-only processing action from users who cannot run it.
- [x] UI: Add notification type labels, clearer unread state, tabular counts, exact transitions, and stronger row focus/hover treatment.
- [x] Consistency: Keep existing API contracts, URL filters, pagination, and optimistic read updates.
- [x] Verification: Run TypeScript, migration-prefix, whitespace, build, and browser smoke.
- [x] Docs: Update Notifications area doc and task queue.

## Propagation candidates

- [ ] Other action inboxes: reuse compact summary + filter toolbar when a page mixes counts, filters, and row actions.

## Review

- Shipped: `/notifications` now has unread/read/total summary metrics, a clearer filter toolbar, a refresh action, role-gated overdue processing, stronger row hover/read-state treatment, notification type badges, and destination action buttons with explicit open labels.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build` passed. Authenticated Chrome DevTools smoke rendered `/notifications`, verified summary metrics, STAFF/ADMIN-only "Check overdue", unread rows, named destination actions, and clean console/network. The smoke caught reservation notifications falling back to "Open checkout"; the action now infers reservations from `reservation_*` notification types when `bookingKind` is absent.
- Deferred:
