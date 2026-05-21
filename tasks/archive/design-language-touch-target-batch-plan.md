# Design Language Touch Target Batch Plan

## Scope

Tighten remaining dense operational controls that still drift from the design language baseline: 40px action targets, visible focus, no hover-only affordances, and shared empty-state language.

## Peer Patterns Checked

- `src/components/OperationalRowActions.tsx` for the 40px row-action trigger baseline.
- `src/components/ui/button.tsx` for shadcn button sizing, focus, disabled, and loading behavior.
- `src/components/EmptyState.tsx` and recent item/event empty-state usage for compact inline states.
- `docs/DESIGN_LANGUAGE.md` for the target-size, row-action, and empty-state rules.

## Slices

- [x] Slice 24: Event travel roster controls
  - Make default-traveler, add, and remove controls hit the 40px action target baseline.
  - Replace the bare empty paragraph with shared inline `EmptyState`.

- [x] Slice 25: Image search result controls
  - Give image result selection buttons visible keyboard focus.
  - Move source-link buttons from 24px to 40px targets without changing the result grid shape.

- [x] Slice 26: Item scan-identity controls
  - Make QR/serial copy affordances explicit 40px icon buttons.
  - Add visible focus to the QR preview button.

## Verification

- [x] `npx tsc --noEmit`
- [x] `npm run db:migrate:check`
- [x] `git diff --check`
- [x] `npx next build`
- [x] Browser smoke changed routes or protected-route redirects without console errors.

## Review

- Implemented event travel roster, image-search result, and item scan-identity touch-target cleanup.
- Verification passed: TypeScript, migration-prefix check, diff whitespace check, production Next build, and Chrome DevTools smoke on `http://localhost:3013/events/test-event-id`, `http://localhost:3013/items/test-item-id`, and `http://localhost:3013/login`. Protected event/item URLs redirected to login cleanly with no console errors.
