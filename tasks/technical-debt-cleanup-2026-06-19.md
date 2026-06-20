# Technical Debt Cleanup - 2026-06-19

## Goal
- Reduce stale root-level task noise so new feature slices are easier to find.
- Archive completed plan files without changing product behavior.

## Plan
- [x] Reconcile admin helper and low-priority systemic backlog into focused follow-up files.
- [x] Archive completed battery/admin helper plans already reconciled in `tasks/todo.md`.
- [x] Archive unambiguous completed root `*-plan.md` files with shipped and verified review sections.
- [x] Update references from active docs/plans to archived paths.
- [x] Add `/tasks` folder index and root-folder contract.
- [x] Run `git diff --check` and `npm run verify:docs`.

## Review
- 2026-06-19: Archived completed root plans for avatar/shadcn cleanup, gap reliability, repo workflow plugin, attachments MVP hardening, design-language accessibility, design-language detail follow-ups, and booking row actions.
- 2026-06-19: Archived completed root plans for booking create UX, Trade Board active filters, Trade Board row actions, Settings control map polish, and Settings action/empty copy cleanup.
- 2026-06-19: Verification passed with `git diff --check`, `npm run verify:docs`, and stale root-path scans for moved plans.
- 2026-06-19: Added `tasks/INDEX.md` and updated `tasks/README.md` so `/tasks` has explicit root/archive rules. Root audit docs remain in place because audit skills read/write those paths directly.
- 2026-06-19: Archived completed design-language next-three, design-language foundation, shift staffing MVP, and schedule freshness signal root plans.
- 2026-06-19: Archived completed Settings navigation rail, Settings shell cleanup, and Labels UI polish root plans.
- 2026-06-19: Archived completed Resources rename MVP, repo map system, and Reports UI polish root plans. Left Reports charts active because it has no completion checklist or review evidence yet.
- 2026-06-19: Archived completed creation flow system, ESLint CLI migration, booking create hardening, damage report photos/avatar polish, and React Query cache follow-up root plans.
- 2026-06-19: Archived completed design-language follow-up, low-traffic controls, high-impact batch, metrics/targets, and auth/event/image batch root plans.
- 2026-06-19: Archived completed iOS schedule, items, create-booking, profile, booking-detail, tabs/buttons, notification token, notification tap-through, runtime warning, and notification category parity root plans.
- 2026-06-19: Archived completed no-temp-password onboarding, shift email notifications, project folder cleanup, bulk item families, cross-page state awareness, and custody confidence root plans.
- 2026-06-19: Stopped bulk archiving after scanning remaining root `*-plan.md` files. The remaining set is active, draft/planning, blocked, or carries unchecked verification/deferred work that should stay visible at root.
- 2026-06-19: Archived completed `tasks/todo.md` active sections for Plan 014, Plan 018, and Plans 020 through 023 into `tasks/archive/completed-2026-06/plan-014-018-020-023-reconciliation-2026-06-19.md`, leaving the active queue focused on open work.
- 2026-06-19: Archived completed booking creation, scan, reports, and Trade Board ownership-pass artifacts into `tasks/archive/completed-2026-06/`, updated stale booking ownership references, and refreshed the root task count in `tasks/INDEX.md`.
- 2026-06-19: Archived completed kit detail, kiosk gate, iOS schedule/trade clarity, web interface audit, web bug sweep, and April sprint plan artifacts; updated active and archived references to their dated archive paths.
