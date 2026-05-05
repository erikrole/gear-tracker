# Derived Bulk Unit QR Plan

Date: 2026-05-05

## Scope

Allow numbered bulk unit QR codes generated as `{binQrCodeValue}-{unitNumber}` to scan directly as one numbered bulk unit.

## Checklist

- [x] Add a shared parser for derived numbered bulk unit QR values.
- [x] Resolve derived unit QR scans in the server scan service.
- [x] Include bulk bin QR metadata in scan status and auto-submit derived unit scans from the scan hook.
- [x] Add focused tests for parser and service behavior.
- [x] Sync bulk inventory, scan, and decision docs.
- [x] Run focused tests, TypeScript, migration-prefix check, local Next build, and whitespace verification.

## Review

- Shipped derived numbered bulk unit QR parsing via `src/lib/bulk-unit-qr.ts`.
- Server scan handling now resolves `binQrCodeValue-unitNumber` values to the parent bulk SKU and validates the unit through the existing numbered bulk flow.
- Scan status exposes the bin QR value, and the scan hook auto-submits derived unit QR scans without opening the picker.
- Verification passed: focused Vitest tests, TypeScript, migration-prefix check, local Next build, and `git diff --check`.
