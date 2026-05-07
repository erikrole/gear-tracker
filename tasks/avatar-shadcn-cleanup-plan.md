# Avatar + shadcn Cleanup Plan - 2026-05-07

## Goal
- Tighten the component system where avatars, thumbnail stacks, and shadcn controls had started to drift across bookings, dashboard, schedule, and event staffing surfaces.

## Plan
- [x] Audit current avatar and shadcn usage.
- [x] Add shared people avatar stack and item thumbnail stack primitives.
- [x] Migrate dashboard, bookings, schedule, and event staffing call sites.
- [x] Replace obvious raw button/color drift in touched surfaces.
- [x] Sync docs and lessons.
- [x] Verify TypeScript, focused tests, migration check, whitespace, build, and browser smoke.

## Review
- Shipped: `UserAvatarGroup`; `ItemThumbnailStack`; dashboard assigned-user and gear stacks; booking card gear thumbnails; booking filter clear buttons; schedule collapsed assignment previews; picker conflict badge cleanup; event staffing remove/assign/request/delete controls moved to shadcn buttons.
- Verified: `npx tsc --noEmit`; `npx vitest run tests/checkout-actions-client.test.ts tests/checkout-rules.test.ts`; `npm run db:migrate:check`; `git diff --check`; `npx next build`; authenticated Chrome DevTools smoke on `/bookings?tab=all`, `/`, `/schedule`, and `/events/cmmgnauku006qx10lf8cg5fjk` with clean console after dev-server restart.
- Deferred: Wider raw-button sweep across all schedule/calendar surfaces remains a follow-up because this slice stayed scoped to the audited avatar/shadcn drift.
