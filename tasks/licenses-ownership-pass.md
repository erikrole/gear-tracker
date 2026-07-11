# Licenses Ownership Pass - 2026-07-10

## Goal
- Make every Photo Mechanic license screen and flow clear, responsive, role-correct, and privacy-safe while preserving the existing two-slot and informational-expiry contracts.

## Peer patterns checked
- Users: shared page header, operational toolbar, explicit row actions, responsive list treatment.
- Items: calm operational hierarchy, status-first list scanning, shared feedback primitives.
- Kiosk devices: target-specific dialogs, stable pending labels, recoverable inline states.

## Plan
- [x] Audit route, overlays, API contracts, schema, docs, and peer patterns.
- [x] Simplify the page hierarchy and move secondary administration into a labeled toolbar.
- [x] Add explicit responsive claim/inspect actions and correct status color semantics.
- [x] Polish custody, create, bulk-create, renew, return, history, and admin-detail flows.
- [x] Redact other holders' personal details from student responses and add regression coverage.
- [x] Sync area docs and task ledger.
- [x] Run focused tests, TypeScript, migration guard, codemap/docs, build, and browser smoke.

## Contract boundaries
- Expiry remains informational. This pass does not change claim eligibility or timezone policy from blocked Plan 053.
- Two slots per code, one active claim per user, code masking, role permissions, and audit behavior remain unchanged.

## Review
- Shipped a calmer header and admin toolbar, blue active-use semantics, explicit Claim/Inspect actions, retired-record inspection, recoverable overlay failures, personal-history retry, editable labels, and server-side student holder redaction.
- Verified 11 focused license/iOS contract tests, focused ESLint, TypeScript, all 93 migration prefixes, codemap/docs, whitespace, and `npm run build:app`.
- Authenticated Chrome smoke verified the loaded admin route, Add license dialog, explicit row actions, and admin detail sheet with no console errors. The existing port-3001 preview stopped serving the route before the narrow-width reload, so narrow runtime proof is limited to the source/build contract and the table's horizontal overflow containment.
- Deferred policy remains Plan 053: expiry is informational and expired-code claim eligibility was not changed.
