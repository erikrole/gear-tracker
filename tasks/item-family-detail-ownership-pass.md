# Item Family Detail Ownership Pass - 2026-07-15

## Goal
- Make item-family detail report active physical inventory truth, explain retired records without counting them as stock, and prioritize daily unit operations over low-frequency metadata editing.

## Peer patterns checked
- Serialized item detail: contained header, operational overview first, details second, URL-backed tabs.
- Kit detail: compact grouped metadata, clear equipment ownership, bounded actions.
- Battery Ops: explicit available, checked-out, missing, retired, and label state language.

## Plan
- [x] Structure: contain the header and put operational state before editable metadata.
- [x] UX: exclude retired records from active stock totals and make the retirement rule explicit.
- [x] UI: strengthen hierarchy, density, status scanning, hit areas, and responsive layout.
- [x] Consistency: reuse existing Card, Badge, Button, Tabs, and item-detail patterns.
- [x] Hardening: pin active inventory semantics with focused tests.
- [x] Verification: focused tests, TypeScript, lint, build, diff check, and documented browser-proof limitation.
- [x] Docs: sync the bulk inventory area contract and close this plan with evidence.

## Propagation candidates
- [x] `/items`: shared `/api/assets` item-family summaries consume the corrected `onHandQuantity`; focused API coverage passed.
- [x] Exports and pickers: both consume `summarizeItemFamilyState`; focused state and API tests passed without changing availability semantics.

## Review
- Shipped: active unit totals exclude retired records; item-family detail now leads with operational inventory, explains retired records, groups metadata, contains the header, and enlarges unit/editor controls.
- Verified: 27 focused tests passed; focused ESLint and TypeScript passed; migration-prefix check passed; docs/codemap verification passed; `git diff --check` passed; `npm run build:app` compiled all 197 static pages and the item-family routes successfully.
- Deferred: authenticated visual smoke. The local runtime redirected correctly to `/login`, but no dedicated local test identity is configured. Production still shows the old UI until these code changes are deployed.
