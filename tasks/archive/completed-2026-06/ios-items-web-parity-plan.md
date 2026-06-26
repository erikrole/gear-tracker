# iOS Items Web Parity Plan

Date: 2026-06-26

## Goal
Bring the native Wisconsin Items list up to the current web Items data contract without copying desktop-only table density.

## Scope
- Decode and preserve `/api/assets` mixed serialized plus item-family ordering.
- Show item-family rows in the native Items list with the same Units/Quantity naming used on web.
- Add a narrow native sort control for Asset tag and Most popular.
- Keep status labels calm and title-cased, and pair active-holder rows with an avatar cue.
- Update iOS/API contract coverage and area docs.

## Checklist
- [x] Audit current docs, web API route, iOS models, API client, and Items view.
- [x] Add mixed item row modeling and `itemOrder` decoding.
- [x] Render item-family rows in the native list.
- [x] Add native sort selection wired to `/api/assets?sort=...`.
- [x] Align active status display with holder avatar where applicable.
- [x] Add focused iOS API contract coverage.
- [x] Sync docs and task review.
- [x] Run iOS drift, gap, whitespace, and build verification.

## Review
- 2026-06-26: Implementation complete before verification. `AssetsResponse` now decodes optional `itemOrder` and exposes ordered mixed rows, native Items renders serialized and item-family rows, item-family rows use Unit-tracked/Quantity-tracked naming with web-style availability counts, the list offers Asset tag and Most popular sort, and active serialized status badges pair `Checked Out`/`Reserved`/`Awaiting Pickup`/`Overdue` with the holder avatar.
- 2026-06-26: Verification passed with focused iOS/API contract coverage, TypeScript, iOS drift, iOS audit-gap inventory, docs/codemap checks, whitespace check, Wisconsin simulator build, and `npm run build:app`. Full `npm run build` was attempted first but the sandboxed run could not reach Neon, and escalation was rejected because the script can apply remote Prisma migrations; `build:app` was the safer compile gate.
