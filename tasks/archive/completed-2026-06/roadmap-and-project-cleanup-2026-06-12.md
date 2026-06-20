# Completed Roadmap and Project Cleanup - 2026-06-12

Archived from `tasks/todo.md` on 2026-06-18.

## Completed: Roadmap ideas intake (2026-06-12)

Plan: `tasks/roadmap-ideas-2026-06-12.md`

- [x] Flesh out direct user custody for daily-use gear.
- [x] Flesh out MacBook and laptop lifecycle inventory.
- [x] Flesh out Brand Communications schedule-first access.
- [x] Flesh out stronger badge gamification with accountability.
- [x] Add guest gear request intake for external partners.
- [x] Add football-owned gear warning and alternative suggestions.
- [x] Add smart student graduation dates and graduated archive state.
- [x] Add Athletic Calendar Wrapped product/data plan.
- [x] Add iOS shift widgets, Apple Calendar hardening, and Gotham greeting plan.
- [x] Add smarter notifications, missing alert families, and notification orchestration plan.
- [x] Add return exception reporting for damaged/lost gear, evidence requirements, and urgent admin notifications.
- [x] Add adjacent roadmap ideas and recommended slice order.

### Review
- 2026-06-12: Logged roadmap intake as a doc-only plan. Recommended first bet is direct user custody because it supports daily-use gear truth, MacBook lifecycle planning, offboarding, and custody reporting without weakening kiosk-owned checkout/return flows.
- 2026-06-12: Added external partner guest gear requests and football-owned gear warnings. Guest requests should start staff-only before any public form, while football-owned gear should begin as non-blocking picker guidance with available Creative/shared alternatives.
- 2026-06-12: Added Student Lifecycle planning: smart graduation-date defaults from existing grad-year data, explicit graduated/archive state distinct from generic deactivation, and offboarding gates for gear, shifts, licenses, sessions, and custody.
- 2026-06-12: Added Athletic Calendar Wrapped planning. The first slice should lock the season boundary and data dictionary, then collect durable missing facts like scan method/session telemetry and future acknowledgement events before building the recap player.
- 2026-06-12: Added Shift Glance planning: WidgetKit shift snapshots, hardened Apple Calendar metadata/reconciliation, and a Gotham Home/AFM greeting summary driven by the same upcoming-shift contract.
- 2026-06-12: Added Smart Alerts planning. Existing notification triggers already cover checkout escalation, shift changes, trade lifecycle, reservations, badges, licenses, firmware, damage/lost reports, and low stock, so the next slice should define taxonomy, digesting, preferences, quiet hours, and deep-link contracts before adding more one-off nudges.
- 2026-06-12: Added Return Exception Reporting planning. The current backend can store damaged/lost reports and notify supervisors, but the retired booking-mode scan UI leaves a product gap; next slice should harden damaged photo/description requirements, add return-flow reporting, add active-checkout lost reporting, and make admin notification urgency explicit.

---

## Completed: Project folder cleanup (2026-06-12)

Plan: `tasks/archive/completed-2026-06/project-folder-cleanup-plan-2026-06-12.md`

- [x] Snapshot current repo status and identify pre-existing dirty files.
- [x] Archive completed plan files from the active todo queue.
- [x] Move proof PNGs to `tasks/archive/proofs/`.
- [x] Reconcile duplicate active/archive audit files.
- [x] Update `tasks/todo.md` with a cleanup review.
- [x] Verify status, archive locations, and whitespace.
- [x] Move root import, report, prompt, and smoke-proof artifacts into archive locations.
- [x] Update references and ignore rules for the new artifact locations.
- [x] Add generated codemaps and a check command so repo mapping stays current.
- [x] Replace deprecated `next lint` with a working ESLint CLI baseline.

### Review
- 2026-06-12: Cleanup pass preserved pre-existing dirty product changes in `ios/project.yml`, the roadmap intake update in this file, and the untracked roadmap plans. Completed iOS plan files moved to `tasks/archive/completed-2026-06/`; proof images moved to `tasks/archive/proofs/`. Duplicate root/archive audit filenames were left in place because their contents differ.
- 2026-06-12: Verification passed: no root `tasks/*.png` files remain, the completed iOS plan archive contains both moved plans, stale root plan-path references are gone, and `git diff --check` is clean.
- 2026-06-12: Second cleanup pass moved root import/report/prompt artifacts into `docs/archive/`, moved tracked `.tmp` smoke images into `tasks/archive/proofs/browser-smoke/`, removed the empty root folders, updated path references, and added ignore rules to prevent root temp/report/proof clutter from returning.
- 2026-06-12: Repo map pass added generated codemaps for architecture, backend, frontend, data, dependencies, routes, schema, and area ownership. Added `npm run codemap`, `npm run codemap:check`, and `npm run verify:docs`; verification passed for generator syntax, codemap check mode, and whitespace.
- 2026-06-12: Lint pass replaced deprecated `next lint` with ESLint CLI, pinned the Next 15 ESLint config, added `eslint.config.mjs`, fixed the first hard source errors, and got `npm run lint` passing with 0 errors and the existing warning backlog visible.

---
