# Schedule Ownership Pass

Date: 2026-05-10

## Scope

Polish `/schedule` and the connected flows that shape or consume schedule state:

- `/schedule`
- `/schedule/assign`
- `/events/[id]`
- Dashboard Upcoming Events quick view
- `/settings/sports`
- `/settings/calendar-sources`

## Plan

- [x] Tighten Schedule summary, filters, list/week/calendar controls, and empty states.
- [x] Improve assignment matrix ergonomics, accessibility, and filtered-empty recovery.
- [x] Align event detail crew controls and event metadata with schedule semantics.
- [x] Polish schedule-feeding settings controls without changing generation rules.
- [x] Sync area docs and verify with focused checks plus browser smoke.

## Guardrails

- Keep `/schedule` as the management surface and dashboard Upcoming Events read-only.
- Do not change shift generation schema or booking contracts in this pass.
- Preserve student availability conflict warnings as warnings, not hard blocks.
- Keep existing dirty work intact and only touch files needed for this pass.

## Review

- Shipped: `/schedule` now has a clearer readiness snapshot, larger filter/view controls, stronger list/week/calendar empty states, stable hydrated view preferences, and corrected all-day event creation.
- Shipped: `/schedule/assign` now has larger navigation/filter controls, accessible assignment/remove targets, filtered-empty recovery, no-shift labels, and hydration-stable assignment data.
- Shipped: Event detail, shared shift controls, Dashboard Upcoming Events, and Settings Sports now align with Schedule semantics through away-event wording, stronger crew/travel controls, less duplicate open-slot copy, and shared Switch controls.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `npx vitest run tests/shift-assignments.test.ts tests/shift-trades.test.ts tests/calendar-events-query.test.ts tests/event-defaults.test.ts`, `npx next build`, and authenticated Chrome DevTools smoke on `/`, `/schedule`, `/schedule/assign`, `/events/cmmgnauku006rx10l0rkdv1cp`, and `/settings/sports`.
- Historical caveat: `npm run build` used to stop before Next compilation at Prisma `migrate deploy` with a blank schema-engine error. Follow-up 2026-05-12: full `npm run build` now passes through the shared Prisma/Neon migration wrapper.
