# Item Info Sidebar Hardening Plan

Date: 2026-06-10

## Goal

Make the item Info sidebar smarter, faster, and cleaner without changing the item data model.

## Scope

- [x] Tighten purchase price as a USD field with clear formatting and strict validation.
- [x] Normalize product links to usable `http` or `https` URLs and expose source context inline.
- [x] Keep the existing Identity, Product, Organization, Procurement, and Notes grouping compact.
- [x] Add focused source coverage for the field contracts.
- [x] Sync Items docs and task review notes.
- [x] Run focused tests, TypeScript, migration check, diff check, and a production-shaped build.

## Review

- 2026-06-10: Item Info purchase price now renders as a USD field with a dollar affordance, decimal keyboard hint, two-decimal display formatting, and strict parser-backed save normalization. Malformed values are rejected instead of partially parsed.
- 2026-06-10: Product links now normalize missing schemes to `https://`, reject non-http(s) protocols, open/copy the normalized URL, and show the source host inline when a valid stored URL exists.
- 2026-06-10: Authenticated browser smoke passed on `http://127.0.0.1:3017/items/cmmvmbdhe001hjx04hb39a7mk`: Identity, Firmware, Product, Organization, Procurement, USD purchase price, and Link rows rendered with no console warnings/errors. The firmware modal opened with installed/newest/checked/released/source context and no mutations.
- 2026-06-10: Verification passed: `npx vitest run tests/item-info-sidebar-hardening.test.ts tests/item-detail-firmware-display.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke.

## Sources Audited

- `docs/AREA_ITEMS.md`
- `docs/DECISIONS.md`
- `docs/GAPS_AND_RISKS.md`
- `prisma/schema.prisma`
- `src/app/(app)/items/[id]/ItemInfoTab.tsx`
- `src/app/(app)/items/[id]/BookingInfoTab.tsx`
