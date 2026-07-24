# Dashboard Pending Pickup Web Parity Plan - 2026-07-23

## Goal

- Show a due booked reservation as Pending Pickup across the web dashboard,
  including the team lane, active-booking summary, and missed-pickup wording.

## Route

- Owner area: Dashboard
- Secondary area: Reservations
- Ledger: `tasks/dashboard-pending-pickup-web-parity-plan.md`
- Existing reference:
  `tasks/archive/completed-2026-07/pending-pickup-reservation-consolidation-plan.md`

## Source Checks

- The current branch dashboard API already selects due `RESERVATION/BOOKED`
  rows into `pendingPickups`, and Team Activity already owns a conditional
  Pending Pickup card.
- `origin/main` does not contain that consolidated query, which matches the
  missing card in the reported live web screenshot.
- The current dashboard status rail still computes Active bookings from only
  checked-out plus future-reserved rows, omitting Pending Pickup.
- The shared dashboard row renders a late pickup as elapsed lateness rather
  than the accepted `Pickup was due today at 2:30 PM` wording.

## Stop Conditions

- Stop if the live dashboard response still omits the due reservation after the
  branch containing the consolidated query is deployed.
- Stop before merging or deploying the current dirty branch without explicit
  user authorization.
- Stop if Pending Pickup would be counted as checkout custody.

## Slices

- [x] Include Pending Pickup in the active-booking rail and breakdown.
- [x] Use the accepted missed-pickup wording in the web dashboard row.
- [x] Add focused source coverage and sync Dashboard documentation.
- [x] Verify the deployment path and record the exact authenticated-browser
  authentication/deployment blocker.

## Verification

- [x] Focused dashboard Vitest coverage.
- [x] `npx tsc --noEmit --pretty false`
- [x] Focused ESLint.
- [x] `npm run build:app`
- [x] `npm run verify:docs`
- [x] `git diff --check`
- [ ] Authenticated browser smoke for the web dashboard.

## Review

- Shipped: Local web Dashboard now counts Pending Pickup as active work,
  exposes it in the status rail and breakdown, renders the due-reservation lane,
  and uses `Pickup was due ...` for the missed handoff.
- Verified: 16 focused dashboard tests, focused ESLint, TypeScript, production
  app build, docs verification, and diff check.
- Deployed: PR #377 merged as `87449f94`; Vercel reported the production
  deployment successful.
- Blocked: Authenticated browser proof remains unavailable because the reusable
  browser session redirects to sign-in.
- Proof artifacts: The user-provided production screenshot shows Active
  bookings 5 with no Pending Pickup lane before deployment.
- Next slice or stop: Verify Trey in the authenticated production dashboard.
