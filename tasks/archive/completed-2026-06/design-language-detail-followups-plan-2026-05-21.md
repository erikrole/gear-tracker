# Design Language Detail Follow-ups

Last updated: 2026-05-21

## Scope

Continue the design-language cleanup on visible detail and workflow surfaces without changing product behavior.

## Peer Patterns Checked

- `src/components/PageHeader.tsx` for shared route headers.
- `src/components/OperationalRowActions.tsx` for repeated secondary/destructive row actions.
- `src/app/(app)/items/[id]/_components/ItemHeader.tsx` for detail-page action grouping.
- `src/app/(app)/bulk-inventory/[id]/_components/BulkSkuHeader.tsx` for compact detail header behavior.

## Slices

- [x] Slice 25: Move `/kits/[id]` header toward shared page-header structure and align local add-member clear control.
- [x] Slice 26: Make Trade Board cancel confirmation name the event, shift window, and posted owner.
- [x] Slice 27: Move editable user area-assignment actions off tiny inline buttons and onto `OperationalRowActions`.
- [x] Update docs and route conformance notes.
- [x] Run TypeScript, migration check, whitespace check, production build, and browser smoke.

## Review

- `/kits/[id]` now uses `PageHeader`, keeps route actions at the operational target baseline, and gives local search clear a named shadcn icon control.
- Trade Board cancel copy now names the event, shift window, and owner before cancelling the posting.
- User detail editable area assignments now render as stable rows with `OperationalRowActions` for primary/remove commands, and the touched profile-photo/size inputs expose stable id/name metadata for browser checks.
- Shared `SaveableField` now avoids untargeted `<label>` elements for display-only rows, removing browser form-label issues from detail pages that mix editable and read-only fields.
- Verification passed: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated browser smoke for `/kits/cmn5857mr0001l104x2fhm3eu`, `/schedule` Trade Board, and `/users/cmp2xmqhv0001jp04r34hr3za` with no console errors, warnings, or browser issues.
