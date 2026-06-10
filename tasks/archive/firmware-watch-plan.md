# Firmware Watch Daily Notifications Plan

Started: 2026-06-10

## Goal
Poll official manufacturer firmware sources once per day, record the latest known version and release date per watched product, and notify active admins when a newer release appears after the first successful baseline.

## Slice 1: Daily Watcher Foundation
- [x] Add a durable firmware watch model for official source URL, parser type, latest version/date, baseline state, last check status, and parse errors.
- [x] Add official-source parsing helpers for Sony and Canon pages with tests using captured HTML fixtures.
- [x] Add a firmware watch service that checks enabled targets, establishes first-run baselines without noisy notifications, detects later changes, and creates deduped admin notifications.
- [x] Run the watcher from the existing daily `morning-refresh` job and include a summary in the cron response.
- [x] Seed no vendor targets automatically in this slice; watched targets should be created intentionally once we choose the exact product/source list.
- [x] Sync `AREA_NOTIFICATIONS.md`, `AREA_ITEMS.md`, `DECISIONS.md`, and this plan with shipped behavior.
- [x] Verify with focused firmware tests, Prisma validation, migration checks, TypeScript, whitespace, and production build.

## Out of Scope
- Admin UI for adding/editing firmware watch targets.
- Per-asset installed firmware version entry.
- PDF parsing for DJI release notes.
- Sub-daily polling.
- Notifications to non-admin users.

## Review
- 2026-06-10: Shipped the firmware watch foundation. New `FirmwareWatchTarget` rows track official source URL, parser type, latest version/date, baseline status, last check time, and parse/fetch errors.
- 2026-06-10: `morning-refresh` now runs the firmware watcher as an independent daily maintenance step. Failures appear in the cron response without blocking calendar sync, stale trade expiry, or pending-pickup cleanup.
- 2026-06-10: Sony and Canon support-page parsers are covered by fixtures. The watcher validates HTTPS plus adapter-specific official hosts before fetching.
- 2026-06-10: First successful target checks baseline silently. Later version changes create deduped `firmware_update_released` rows for active admins and best-effort push fanout.
- 2026-06-10: Verification passed: firmware/morning-refresh focused tests, Prisma validation, TypeScript, migration-prefix check, live Neon migration deploy/health, whitespace check, and production build.
