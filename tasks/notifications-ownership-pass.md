# Notifications Ownership Pass - 2026-07-10

## Goal
- Make Notifications a trustworthy action inbox where every role can identify new work, reach the owning workflow, control read state, and recover from loading or mutation failures without losing context.

## Peer patterns checked
- Kits: compact operational orientation, always-mounted controls, and named filtered-empty recovery.
- Users: explicit Previous/Next pagination, page clamping, and narrow-screen action layout.
- Items: cached-data resilience and retryable blocking failure states.

## Plan
- [x] Audit the complete page, API contract, role behavior, docs, tests, and peer patterns.
- [x] Clarify page hierarchy, preferences access, inbox metrics, filters, and staff-only operations.
- [x] Tighten row categories, destinations, read-state behavior, pagination, and responsive layout.
- [x] Fix stale/filtered count and optimistic mutation edge cases.
- [x] Add focused tests and synchronize area/task documentation.
- [x] Run repository gates and authenticated browser verification attempt.

## Contract boundaries
- Preserve the persistent in-app inbox, current notification producers, role permissions, route URLs, and additive delivery preferences.
- Keep manual processing STAFF/ADMIN-only and keep outbound channel preferences separate from inbox visibility.

## Propagation candidates
- None until the resulting inbox pattern is verified.

## Review
- Shipped a calmer action-inbox hierarchy, direct preferences access, All/Unread controls, complete generic destination actions, broader notification taxonomy, responsive row controls, named failure/filtered-empty recovery, and explicit refresh progress.
- Fixed nullable notification timestamps, stale unread-filter rows, cross-cache read state, stale app-shell badge counts, invalid page parameters, filtered-vs-whole inbox totals, deterministic API ordering, and missing manual-nudge timestamps.
- Verified 30 focused notification tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated browser proof remains blocked because Dia rejects `http://localhost:3000/notifications` with `ERR_BLOCKED_BY_CLIENT`. The browser path was stopped after the known boundary recurred; runtime interaction is not claimed.
