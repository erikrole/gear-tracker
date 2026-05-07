# Settings Ownership Pass - 2026-05-06

## Goal
- Make Settings feel like a real operations control center, not a collection of shipped tabs. Close obvious missing configuration surfaces and remove settings that say one thing but enforce another.

## Peer patterns checked
- Reports: simple tabbed admin hub with immediate redirect to a default section.
- Users: dense operator page with header actions, filters, tables, clear loading/error states, and direct navigation to adjacent admin workflows.
- Locations settings: strongest local pattern for small admin catalogs with add, inline rename, activation state, usage counts, and audit context.

## Missing or confusing settings
- Departments are missing from Settings even though `Department` exists in Prisma, `/api/departments` exists, item creation requires a department, and reports/items use departments as a first-class inventory dimension.
- Extend Presets says an empty list means users see only the custom option, but the API and save handler reject empty lists.
- Settings had no one-screen overview of what each group controls. The existing command palette helped search, but the `/settings` index was a redirect instead of a useful control map.
- SystemConfig has intentionally narrow UI. Keep it narrow for now because only extend presets and escalation config have clear operator meaning.

## Plan
- [x] Structure
- [x] UX
- [x] UI
- [x] Consistency
- [x] Hardening
- [x] Verification
- [x] Docs

## Propagation candidates
- [ ] Locations: department catalog should reuse the same usage-count and activation rhythm where possible.
- [ ] Categories: consider moving toward the same explicit Add/Edit/Deactivate catalog pattern for flat taxonomy operations, while preserving its tree workflow.

## Review
- Shipped: `/settings/departments` with add, inline rename, deactivate/reactivate, active/inactive sections, serialized/bulk usage counts, and last-edited audit context. Department create now handles Prisma unique conflicts directly so concurrent creates still return the right duplicate/reactivation behavior. Categories picked up the useful catalog hardening without schema churn: trimmed names, same-level duplicate checks, descendant-move protection, server-error toasts, and last-edited audit context. Extend Presets can now save an empty list for a custom-only workflow. `/settings` now renders a role-aware control map grouped by Personal, People, Inventory, Scheduling, Devices, and System, with a Resume action for the last visited tab.
- Verified: `npx vitest run tests/settings-routes.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, and `npx next build`. Slice 2 re-ran `npx tsc --noEmit`, `git diff --check`, and `npx next build`.
- Browser checked: after explicit user permission, logged into local dev as the seeded admin and confirmed `/settings/departments` renders with the Settings tab rail, the new Departments tab, six active departments, usage counts, and no console errors beyond expected dev/Fast Refresh logs. Network showed `/api/departments?includeInactive=1` returning 200; one aborted duplicate fetch was the expected React Query/dev remount pattern.
- Browser checked slice 2: `/settings` renders the new control map, visible role-filtered section groups, and Resume Departments action. Current console only showed expected Fast Refresh logs; network showed `/settings` and `/api/me` returning 200, with one expected aborted duplicate `/api/me` refresh.
- Deferred: SystemConfig stays narrow because only extend presets and escalation config have clear operator meaning.
