# Battery Ops Hardening Pass - 2026-06-23

## Scope

Expose read-only integrity warnings on `/bulk-inventory/batteries` so staff can see when live numbered battery state was corrected in the Battery Ops read model.

## Peer Patterns Checked

- `/admin/fix-today`: compact operational warning cards for admin-facing exceptions.
- `/reports/bulk-losses`: battery audit tables link back to Battery Ops and keep deeper analysis outside the cockpit.

## Plan

- [x] Add an API `integrity` payload for stale `CHECKED_OUT` unit flags with no active checkout context.
- [x] Render a compact warning card above the checked-out units table with affected unit numbers and family/location context.
- [x] Add focused route regression coverage for the integrity payload.
- [x] Sync Bulk Inventory docs and run closeout checks.

## Review

- 2026-06-23: Battery Ops now returns `integrity.staleCheckedOutUnits` for stale unit status rows that are corrected to Available in the read model, and the page renders a compact warning card with affected unit numbers and stockroom links. Focused route coverage asserts both the corrected counts and the warning payload. Warned units do not expose the status-change menu because the raw stored status still needs a separate audited repair path.
- Verification passed: `npx vitest run tests/battery-ops-route.test.ts`, `npx tsc --noEmit`, `git diff --check`, `npm run db:migrate:check`, `npm run verify:docs`, and `npm run build:app`. Browser smoke was not run because this repo intentionally has no Playwright config or dependency and includes a contract test asserting that.
