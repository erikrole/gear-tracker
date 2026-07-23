# Schedule Auto-Assign Audit Hardening Plan - 2026-07-23

## Goal
- Make every assignment created by schedule auto-assign visible in event change history without weakening preview-first behavior, concurrency safeguards, or batch efficiency.

## Contract
- Owner area: Shifts and Scheduling.
- Ledger: `tasks/audit-trail-audit.md` finding 1.
- Keep the existing preview outside the transaction and the assignment recheck inside a `SERIALIZABLE` transaction.
- Keep `shift_assigned` and `shift_assignment` so auto-assigned rows use the same event-history vocabulary and lookup path as manual assignment.
- Audit rows must use the real created assignment ids and commit atomically with those assignments.

## Stop Conditions
- Stop if recording real assignment ids requires per-row assignment inserts or an N+1 lookup.
- Stop if the active schema tranche changes `ShiftAssignment` or `AuditLog`.
- Do not add fairness, workload, notification, or preview-scoring behavior in this slice.

## Slices
- [x] Replace the batch insert with one returning batch insert and write matching batch audit entries inside the existing transaction.
- [x] Pass the authenticated actor role from the route without adding a database lookup.
- [x] Extend focused tests for real assignment ids, audit metadata, zero-write skips, and Serializable isolation.
- [x] Sync Shifts, audit, gaps, and task lifecycle documentation.

## Verification
- [x] `npx vitest run tests/auto-assign-preview-commit.test.ts`
- [x] `npx eslint src/lib/services/auto-assign.ts 'src/app/api/shift-groups/[id]/auto-assign/route.ts' tests/auto-assign-preview-commit.test.ts`
- [x] `npx tsc --noEmit --pretty false`
- [x] `npm run db:migrate:check`
- [x] `npm run codemap`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [x] `npm run build:app`

## Review
- Shipped: Previewed auto-fill proposals now produce real assignment ids and matching actor-stamped `shift_assigned` audit rows through two batch statements in the existing Serializable transaction.
- Verified: Focused tests, focused ESLint, TypeScript, migration-chain check, codemap generation/check, diff check, and the 207-page production app build all pass.
- Deferred: Fairness, workload, notifications, and scoring behavior remain unchanged and outside this audit slice.
- Blocked: None.
- Next slice or stop: Continue with calendar-sync and shift-generation system audit summaries. Keep the retention policy as a separate decision slice.
