# Items Page Polish Hardening Plan

Date: 2026-06-10

Scope: restrained polish on the existing Items page. Preserve the accepted layout and visual grammar.

## Checklist
- [x] Keep the current Items page structure intact.
- [x] Harden toolbar search and advanced filter semantics.
- [x] Harden status summary and table selection semantics.
- [x] Add focused regression coverage.
- [x] Sync docs, archive this plan, and run verification.

## Review
- 2026-06-10: Preserved the existing Items page layout while tightening semantics around search, Filters, the inventory status summary, the table region, selected rows, and per-item selection checkboxes.
- 2026-06-10: Verification passed: `npx vitest run tests/items-page-polish-hardening.test.ts`, `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated in-app browser smoke on `http://127.0.0.1:3017/items`.
