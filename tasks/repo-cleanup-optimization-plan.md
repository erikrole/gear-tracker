# Repo Cleanup Optimization Plan - 2026-06-19

## Goal

Reduce repo maintenance drag without changing product behavior.

## Scope

- Build and verification scripts.
- iOS XcodeGen project parity.
- Root task-folder cleanup.
- Lint warning backlog triage.
- Large-file refactor candidates.

## Plan

- [x] Add an app-only build command so local verification can run without deploy-time Prisma migration.
- [x] Add a read-only iOS project parity check that generates XcodeGen output in a temp copy and compares it to checked-in project files.
- [x] Continue archiving completed root task artifacts without moving active audits or plans with open verification/data-cleanup work.
- [x] Create a measured lint-warning cleanup plan from the current rule/file counts.
- [x] Record large-file refactor candidates as opportunistic follow-ups, not broad standalone rewrites.
- [x] Verify with script checks, docs check, typecheck, diff hygiene, and targeted build checks.

## Guardrails

- Do not rename app routes, API routes, or Swift types for aesthetics.
- Do not refactor large files unless a touched feature needs it.
- Do not move audit docs until audit skills know the new archive path.
- Do not run deploy-grade database migration commands unless explicitly required.

## Review

- Added `build:app` for app-only production builds that avoid deploy-time Prisma migration.
- Added `ios:project:check`, which verifies XcodeGen output against checked-in project files from a temp copy.
- Archived the next safe batch of completed task artifacts and updated stale references.
- Added `lint:summary` plus `tasks/lint-warning-cleanup-plan.md` to make lint cleanup measurable.
- Large-file refactors remain opportunistic only; no broad rename or split was started.
- Verified with `npm run ios:project:check`, `npm run build:app`, `npx tsc --noEmit --pretty false`, `npm run lint:summary`, stale-reference scans, `git diff --check`, and `npm run verify:docs`.
