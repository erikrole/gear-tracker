# Neon compute polling hardening

## Scope

Reduce database keep-awake traffic without weakening kiosk custody, visible recovery, or browser freshness.

## Plan

- [x] Establish the live workload evidence and identify the polling paths.
- [x] Slow idle kiosk dashboard and roster refreshes to five minutes, retain immediate entry refresh and add manual recovery.
- [x] Slow kiosk health heartbeats to five minutes while retaining the server's compatibility allowance for older clients.
- [x] Set normal visible-tab freshness to 30 seconds for bookings and 60 seconds for inventory.
- [x] Add source-contract coverage and update the kiosk area contract.
- [x] Run focused, TypeScript, iOS, docs, and build verification.

## Rollout proof

After deployment, compare Neon hourly compute usage across an unattended kiosk window. The expected result is idle periods that allow compute to scale down while manual refresh, immediate idle-entry loads, and local mutation invalidation retain operational recovery.

## Verification

- Focused Vitest: 18 passing tests across booking freshness, item freshness, and kiosk idle contracts.
- ESLint and `npx tsc --noEmit --pretty false` passed.
- `npm run drift:ios`, `npm run audit:ios:gaps`, `npm run codemap`, `npm run verify:docs`, and `npm run build:app` passed.
- `npm run ios:xcode:verify:kiosk` passed its project-drift, simulator, and generic-iOS builds.
- Remaining external proof: compare Neon hourly compute after this reaches the deployed kiosk and web clients.
