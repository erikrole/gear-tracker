# Settings Consistency Follow-Through Plan

## Objective

Finish the design-language Area 4 pass by checking Settings sub-pages against the shared operational baseline: `SettingsPageShell`, shared inline empty states, shared row actions, destructive confirmation copy, named controls, visible focus, and 40px operational action targets.

## Checklist

- [x] Read Settings area docs, design-language docs, decisions, and current route files.
- [x] Inventory Settings sub-pages for shell, empty-state, row-action, and control-target drift.
- [x] Patch high-confidence Settings drift without reopening a broader redesign.
- [x] Update Settings and design-language trackers.
- [x] Run static verification and browser smoke.

## Inventory Notes

- `src/app/(app)/settings/*`: current sub-pages consistently use `SettingsPageShell`.
- `src/app/(app)/settings/categories`, `locations`, `departments`, `calendar-sources`, `venue-mappings`, `sports`, `kiosk-devices`, and `allowed-emails`: row lifecycle/destructive commands already mostly use `OperationalRowActions`.
- `src/app/(app)/settings/bookings/page.tsx`: extend-preset remove controls were still 28px icon targets.
- `src/app/(app)/settings/kiosk-devices/page.tsx`: pending-pickup stat, activation-code copy, pending-pickup cancel, and empty pending-pickup dialog state drifted from the target/focus/empty-state baseline.
- `src/app/(app)/settings/database/page.tsx`: initial no-diagnostics state was a route-local text placeholder instead of shared `EmptyState`.
- `src/app/(app)/settings/allowed-emails/page.tsx`: add-mode controls were sub-40px custom segmented buttons without pressed state.

## Review

- 2026-05-21: Patched booking preset controls, kiosk pending-pickup controls, database initial empty state, and allowed-email add-mode controls to match the operational design language baseline.
- 2026-05-21: Verified with `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome smoke on `/settings/bookings`, `/settings/allowed-emails`, `/settings/database`, and `/settings/kiosk-devices`. Screenshot evidence: `tasks/design-language-proof-settings-bookings-area4.png`, `tasks/design-language-proof-settings-allowed-emails-area4.png`, `tasks/design-language-proof-settings-database-area4.png`, and `tasks/design-language-proof-settings-kiosk-area4.png`.
