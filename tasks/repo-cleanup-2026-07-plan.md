# Repo Cleanup - 2026-07-04

## Goal

Reduce repo drag without changing product behavior: remove dead code, archive
completed task plans, drop a stray one-off script, and confirm the lint backlog
stays at zero.

## Scope

- Dead code: remove source modules with zero production and test references.
- Task folder: archive fully-complete root `*-plan.md` files into a dated bucket.
- Root/scripts: remove the one-off `_tmp-apply-0086.mjs` migration-repair script.
- Lint: verify `npm run lint` still reports 0 warnings (no regression since June).

## Plan

- [x] Confirm lint baseline is 0 warnings (`npm run lint:summary`).
- [x] Remove 5 confirmed-orphaned source modules (no `src`/test/script references):
      `accordion.tsx`, `form.tsx`, `DataList.tsx`, `use-mutate.ts`, `SummaryCard.tsx`.
- [x] Remove `scripts/_tmp-apply-0086.mjs` (one-off migration checksum repair, unreferenced).
- [x] Archive 47 fully-complete root `*-plan.md` files to `tasks/archive/completed-2026-07/`.
- [x] Update `tasks/INDEX.md` (archive bucket, root counts, recently-archived list).
- [x] Regenerate codemaps to drop the removed modules (`npm run codemap`).
- [x] Verify: `tsc --noEmit` (0), `npm run lint` (0), `npm test`
      (4 pre-existing iOS Swift drift failures only, unrelated), `npm run build:app` (ok),
      `npm run codemap:check` (current), `git diff --check`.

## Review

- Removed 5 orphaned web modules and 1 stray script; typecheck and build stayed green.
- Archived 47 completed plan files; root `*-plan.md` count dropped from 92 to 45 (all
  remaining plans have open work).
- Lint backlog confirmed still at 0 warnings.
- The 4 failing tests are iOS Swift structural checks (`ios-*-page`, `ios-tabbar-stability`)
  that read `ios/**/*.swift`; they reference nothing removed here and predate this pass.

## Deferred (needs owner decision, NOT deleted)

Three modules are built + unit-tested but not yet wired into any UI, and are
documented in `docs/AREA_EVENTS.md` / `docs/GAPS_AND_RISKS.md`. These look like
pending thin-slice integrations, not dead code, so they are left in place:

- `src/lib/services/event-defaults.ts` (`resolveEventDefaults`) — tested by `tests/event-defaults.test.ts`.
- `src/lib/guide-freshness.ts` (`getGuideFreshness`) — tested by `tests/guide-freshness.test.ts`.
- `src/components/booking-details/audit-history.ts` — tested by `tests/booking-audit-history-recovery.test.ts`.

## Guardrails

- Do not delete modules that have any production, test, or script reference.
- Do not move audit docs (audit skills read `tasks/audit-*.md` at root).
- Do not move plans with any unchecked implementation/rollout/verification item.
- Do not touch the multi-package-manager release-age gate configs (intentional).
