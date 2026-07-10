# Tasks Index

Last updated: 2026-06-22

## Start Here

- Use `DESLOPPIFY.md` for the current cleanup backlog and next recommended desloppify task.
- Use `tasks/todo.md` for active execution notes and recent closeout reviews.
- Use this index for the task-root contract, archive buckets, and active follow-up ledgers.
- Treat `plans/README.md` as historical improve-plan context unless a current task explicitly references it.

## Root Folder Contract

Keep root `tasks/` for current work and durable reference ledgers only:

- `todo.md` - current queue and recent archive summaries.
- `orchestrator.md` - manual Codex cleanup/triage ledger.
- `lessons.md` - project lessons and correction patterns.
- `technical-debt-cleanup-2026-06-19.md` - current task-folder cleanup ledger.
- Active `*-plan.md` files that still have unchecked implementation, rollout, verification, or follow-up work.
- Current audit docs used by audit skills, especially `audit-*-ios.md` and route/page audit files.
- Current roadmap/reference docs that intentionally guide future work.

Move completed plan files to `tasks/archive/completed-2026-06/` instead of leaving them at root.

## Current Root Shape

As of this cleanup pass, root `tasks/` contains:

- 160 root files.
- 42 root `*-plan.md` files.
- 79 root audit files.
- 14 roadmap files.
- 5 follow-up files.

Audit files intentionally remain at root for now because the repo audit skills read and write `tasks/audit-*.md` paths directly.

## Active Follow-up Ledgers

- `admin-helper-followups.md` - remaining admin helper and low-priority systemic follow-ups.
- `bulk-battery-followups.md` - remaining battery-adjacent future slices.
- `internal-public-beta-release-cut-followup.md` - release cut work that requires a clean worktree and explicit shipping approval.

## Archive Buckets

- `tasks/archive/completed-2026-06/` - completed plans and queue cleanup summaries from the June cleanup run.
- `tasks/archive/proofs/` - browser-smoke and screenshot proof artifacts.
- `tasks/archive/` root - older archived plans that predate the dated completed bucket.

## Cleanup Rules

- Do not move active audit docs until the audit skills are updated to look in an archive/history path.
- Do not delete completed plans; archive them.
- Do not move plans with unchecked implementation, rollout, or verification items unless a new follow-up ledger preserves the remaining work.
- Keep references updated when moving a root plan into archive.

## Recently Archived

- `items-status-rail-plan.md` - completed Items adoption of the shared operational status rail with pressed status facets under Details.
- `public-showroom-plan.md` - completed public stakeholder showroom plus the 2026-07-10 visual simplification pass.
- `hidden-smoke-users-plan.md` - completed hidden smoke/test user visibility, owner opt-in, cleanup endpoint, operational sweep, and rollout check.
- `booking-creation-ownership-pass-2026-05-07.md` - completed booking creation ownership pass.
- `scan-ownership-pass-2026-06-19.md` - completed lookup-only scan ownership pass.
- `reports-ownership-pass-2026-06-19.md` - completed reports ownership pass.
- `trade-board-ownership-pass-2026-05-14.md` - completed Trade Board ownership pass.
- `kit-detail-design-language-pass-2026-05-21.md` - completed kit detail design-language pass.
- `kiosk-gate-pending-pickup-plan-2026-05-10.md` - completed kiosk-gated pickup plan.
- `ios-schedule-detail-trade-control-clarity-plan-2026-06-03.md` - completed iOS schedule/trade control clarity plan.
- `web-interface-audit-plan-2026-06-05.md` - completed web interface audit execution plan.
- `web-bug-sweep-plan-2026-05-24.md` - completed web bug sweep ledger.
- `sprint-april-plan-2026-04-17.md` - completed April sprint plan.
