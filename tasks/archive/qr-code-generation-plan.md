# QR Code Generation Simplification Plan

## Scope
Make newly generated item tracking codes shorter and remove the `QR-` prefix while keeping existing stored codes and scan fallbacks compatible.

## Checklist
- [x] Confirm current generation and scan lookup behavior.
- [x] Centralize the generated asset QR code format.
- [x] Update existing-item generation, duplicate-item generation, and Add item sheet generation.
- [x] Add focused coverage for the generated format and legacy scan compatibility.
- [x] Sync Items docs and task review notes.

## Review
- 2026-06-10: Newly generated asset QR codes now use 8 uppercase hex characters with no `QR-` prefix. Existing `QR-...` stored labels are not migrated, and scan lookup keeps prefix fallback compatibility.
- 2026-06-10: Verification passed with focused QR format tests, TypeScript, migration-prefix check, whitespace check, and the production build. The first sandboxed build failed on blocked Neon DNS, then the approved network rerun succeeded.
