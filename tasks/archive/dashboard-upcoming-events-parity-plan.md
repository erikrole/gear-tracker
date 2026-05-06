# Dashboard Upcoming Events Parity Plan

## Goal
Bring the dashboard Upcoming Events quick view closer to the Schedule page's read-only event scan: event identity, venue/time, home-away state, staffing coverage, and assignment preview. Do not add Schedule management workflows to the dashboard card.

## Slice
- [x] Extend `/api/dashboard` upcoming event summaries with schedule-style coverage metadata.
- [x] Update dashboard event types to include coverage.
- [x] Replace quick-create controls in the Upcoming Events card with read-only schedule signals.
- [x] Keep the existing Schedule deep link for users who need full management.
- [x] Sync Dashboard and Events area docs.
- [x] Verify TypeScript, migration-prefix check, whitespace, and app build.

## Acceptance
- [x] Dashboard event rows show the same core read-only signals as Schedule rows: sport/opponent title, home/away/neutral, time/location, assigned avatars, and coverage count.
- [x] Under-covered events are visually scannable without turning the dashboard into a management page.
- [x] No booking creation action remains inside the Upcoming Events quick view.
- [x] `/schedule` remains the full-function destination.
