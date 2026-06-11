# Plan 032: Add a firmware watch settings surface

## Metadata

- Priority: P1
- Effort: M/L
- Risk: MED
- Type: direction
- Depends on: 031
- Planned at: 8d445512
- Status: TODO

## Problem

Firmware watch targets are currently managed by a seed script and cron polling. That is acceptable for the first shipped slice, but it leaves target management invisible in the app. Admins cannot review enabled targets, see last errors, disable noisy targets, or test a source URL without asking an engineer to run scripts.

Current evidence:

- `FirmwareWatchTarget` already has the fields needed for an admin list and edit surface.
- Navigation has no firmware watch settings entry.
- Permissions have no firmware-watch resource.
- Calendar Sources already provides a strong settings page and API pattern for external source configuration.

## Goal

Add an admin settings surface for firmware watch targets that lets authorized users view, create, edit, disable, delete, and test official-source firmware targets.

## Scope

- Add firmware watch RBAC permissions.
- Add an Inventory settings navigation entry.
- Add API routes for target list/create/update/delete.
- Add a test-source route that validates and probes a target source URL without saving it.
- Add a settings page using shadcn Table and existing settings patterns.
- Add source-contract and route tests.
- Update docs.

## Out Of Scope

- Adding new parser source types.
- Running the full daily poll manually from the UI.
- Bulk importing live inventory into target rows.
- Showing firmware watch controls on every item card.
- Changing notification behavior.

## Implementation Steps

1. Add permissions.
   - Add a `firmware_watch` permission resource.
   - Allow admins to view, create, edit, delete, and test targets.
   - Consider staff read-only view only if existing settings conventions support it cleanly.
   - Add RBAC tests.

2. Add navigation.
   - Add `/settings/firmware-watch` under the Inventory settings group in `src/lib/nav-sections.ts`.
   - Keep it admin-visible unless RBAC makes staff read-only access deliberate.
   - Update search/nav source-contract tests.

3. Add API routes.
   - `GET /api/firmware-watch-targets`: list targets ordered by brand and model.
   - `POST /api/firmware-watch-targets`: create target after canonicalizing brand/model and validating source URL.
   - `PATCH /api/firmware-watch-targets/[id]`: update editable target fields.
   - `DELETE /api/firmware-watch-targets/[id]`: delete or disable. Prefer disable if historical polling state should remain visible.
   - Use `withAuth`, `requirePermission`, Zod validation, mutation rate limits, and audit entries, following calendar-source route patterns.
   - Reject unsupported source types even when the enum contains them.

4. Add a source test endpoint.
   - Add `POST /api/firmware-watch-targets/test`.
   - Validate URL, source type, and host.
   - Probe the source through the same parser path used by the poller.
   - Return parsed version, release date, and warnings without mutating the target.
   - If needed, extract a small `probeFirmwareSource` helper from `src/lib/services/firmware-watch.ts`.

5. Add the settings UI.
   - Create `src/app/(app)/settings/firmware-watch/page.tsx`.
   - Model structure on `src/app/(app)/settings/calendar-sources/page.tsx`.
   - Use `SettingsPageShell`, `useFetch`, `useConfirm`, `OperationalRowActions`, shadcn `Table`, shadcn form controls, and existing error helpers.
   - Show brand, model, product name, source type, support mode, enabled state, latest version, last checked, last changed, and last error.
   - Add actions for edit, enable/disable, test source, and delete or disable.

6. Add tests.
   - API route tests for auth, permissions, validation, duplicate source URL, unsupported source type, and mutation audit calls.
   - UI source-contract tests confirming the page uses shadcn Table and the shared settings shell.
   - Existing firmware watch tests should remain green.

7. Update docs.
   - Update `docs/AREA_ITEMS.md` with the target-management behavior.
   - Update `docs/GAPS_AND_RISKS.md` if this closes the operational target-management part of GAP-59.
   - Add a change-log row to the relevant area docs.
   - Mark this plan `DONE` in `plans/README.md` after verification.

## Acceptance Criteria

- Admins can review all firmware watch targets in Settings.
- Admins can add and edit a target only when the source type and host are supported.
- Admins can test a source URL and see parsed firmware metadata before saving.
- Disabled or failing targets are visible with clear last-error state.
- RBAC prevents non-admin mutations.
- The page follows existing settings UI conventions and uses shadcn Table.

## Verification

Run:

```bash
npx vitest run tests/firmware-watch.test.ts tests/rbac.test.ts tests/search-pages.test.ts
npx tsc --noEmit
npm run db:migrate:check
npm run build:app
git diff --check
```

Add any new route/UI tests to the command above once named.

## STOP Conditions

- If target delete would lose useful operational history, stop and choose disable-first behavior.
- If a test-source endpoint would duplicate poller parser code, stop and extract a shared helper.
- If adding permissions changes broader settings access behavior, stop and re-check all settings RBAC contracts.

