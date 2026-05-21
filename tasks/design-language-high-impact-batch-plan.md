# Design Language High-Impact Batch Plan

Last updated: 2026-05-20

## Goal
Continue the operational design-language cleanup with three narrow, independently verifiable slices.

## Slices
- [x] Slice 15: Move item detail tab empty states onto shared `EmptyState` where the surface is a card/table interior.
- [x] Slice 16: Tighten the Items bulk action bar so selected-state actions have clearer labels, target sizing, and accessible menu language.
- [x] Slice 17: Clean up schedule/event crew coverage empty rows so shift gaps use the shared inline empty-state language instead of one-off italic text.

## Verification
- [x] Run `npx tsc --noEmit`.
- [x] Run `npm run db:migrate:check`.
- [x] Run `git diff --check`.
- [x] Run `npx next build`.
- [x] Browser-smoke changed protected routes for clean redirects and console health.

## Review
- Item detail booking, schedule, insights, and attachments empty states now use shared inline `EmptyState` patterns.
- Items bulk selection actions now present as a selected-row toolbar with 40px controls and explicit `Bulk actions` language.
- Event detail crew coverage empty area rows now use shared inline empty-state copy, and the add-shift icon target follows the 40px baseline.
- Verification passed with TypeScript, migration-prefix check, whitespace check, production build, and protected-route browser smoke for `/items`, `/items/test-item-id`, and `/events/test-event-id`.
- Browser smoke still reports the existing login-page browser issue `A form field element should have an id or name attribute`; this appears after protected-route redirects and was not introduced by this slice.
