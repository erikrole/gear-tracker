# Kiosk Bulk Turnaround Warning Fix Plan - 2026-07-21

## Goal
- Stop direct kiosk checkout from showing a misleading Tight turn warning for numbered bulk batteries when availability is governed by family quantity and exact units bind only at the kiosk.

## Route
- Owner area: Kiosk
- Secondary areas: Checkouts, Bulk Inventory
- Ledger: this plan
- Existing plan/archive references: `tasks/archive/turnaround-risk-guard-plan.md`

## Source Checks
- Direct kiosk checkout normalizes scanned numbered units into `{ bulkSkuId, quantity }` family demand before availability checks.
- Bulk shortages correctly compare requested family quantity with overlapping reservation commitments and on-hand stock.
- Bulk turnaround warnings currently flag any next family booking within 12 hours without considering whether family capacity is tight.
- Serialized conflicts and serialized turnaround rules remain asset-specific and must not change.
- The native kiosk already decodes absent or empty `bulkTurnaroundRisks` safely, so this can ship server-only.

## Stop Conditions
- Stop if suppressing bulk advisories would suppress a hard bulk shortage.
- Stop if checkout completion and preflight would use different hard-conflict inputs.
- Stop if a native response-model change becomes necessary.

## Slices
- [x] Slice 1: Add an availability option that skips bulk turnaround advisory work while retaining hard bulk shortages.
- [x] Slice 2: Apply that option to direct kiosk checkout preflight and transactional completion.
- [x] Slice 3: Add focused regression coverage and sync Kiosk/Checkout docs.

## Verification
- [x] Focused availability, kiosk preflight, and kiosk completion tests
- [x] Focused ESLint
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`
- [ ] Kiosk runtime proof, or record why unavailable

## Review
- Shipped: Direct kiosk checkout preflight and completion skip bulk-family turnaround advisories while retaining hard bulk shortages, exact-unit availability, serialized conflicts, and serialized turnaround rules.
- Verified: 46 focused tests, focused ESLint, TypeScript, codemap/docs verification, whitespace, and `build:app` pass. Vercel review confirms the change removes one advisory query without adding N+1 or unbounded work.
- Deferred: The shared bulk-shortage helper has a pre-existing sequential Neon read opportunity; it is unrelated to this correctness fix.
- Blocked: Managed-kiosk runtime proof was not available in this session. The response correction is server-only and existing native decoding accepts the empty risk list.
- Proof artifacts: `tests/availability.test.ts`, `tests/kiosk-checkout-availability-route.test.ts`, `tests/kiosk-checkout-complete-bulk-units.test.ts`.
- Next slice or stop: Stop. Verify one numbered-battery checkout after deployment; no kiosk build is required.
