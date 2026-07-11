# Settings Sweeping Ownership Pass - 2026-07-10

## Goal
- Make Settings feel like one coherent product area across all roles and routes, with faster discovery, more working space, trustworthy load/save states, and consistent operator language.

## Peer patterns checked
- Settings current shell: preserve central role matrix and fail-closed direct routes.
- Items and Audit: use named retry states and keep dense working surfaces full-width.
- Users and Resources: concise page identity, command discovery, and intent-first labels.

## Plan
- [x] Audit all Settings routes, dialogs, contracts, docs, tests, and peer patterns.
- [x] Simplify the shared shell, mobile discovery, taxonomy, and overview.
- [x] Fix high-risk load/save feedback in Booking extensions and Notifications.
- [x] Correct Appearance and Database diagnostics trust copy.
- [x] Add focused tests, sync docs, and run repository/browser verification.

## Contract boundaries
- Preserve every route URL, API contract, and the canonical `SETTINGS_SECTIONS` role matrix.
- Personal settings remain available to every authenticated role.
- Venue mappings, policy pages, diagnostics, audit, exports, and kiosks remain admin-only.

## Review
- Shipped a full-width shared page shell, grouped mobile destination picker, intent-first labels, a quieter overview, honest Booking extensions load failures, persistence-aware notification pause/resume feedback, and corrected Appearance/Database trust copy.
- Verified 40 focused Settings tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated visual proof remains blocked by the local browser boundary: Dia blocks `localhost`, while `127.0.0.1` cannot reuse the localhost authentication cookie and redirects to login. The fresh server successfully compiled and served `/settings` before that redirect.
