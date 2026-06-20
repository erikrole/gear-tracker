# Settings Actions, Empty States, And Copy Plan - 2026-05-20

## Goal
- Finish the Settings cleanup batch by standardizing row actions, empty states, and destructive/admin copy across the admin-heavy Settings tabs.

## Peer patterns checked
- Categories: already uses `OperationalRowActions` for row menus and `EmptyState inline`.
- Departments: already uses `EmptyState inline`, but still has direct icon action buttons.
- Locations, Allowed Emails, Calendar Sources, Venue Mappings, Bookings, Kiosk Devices: still have local text-only empty states or inline destructive buttons.

## Plan
- [x] Move Settings table/list row actions onto shared `OperationalRowActions` where rows have multiple or destructive actions.
- [x] Replace remaining local text-only empty states with `EmptyState inline`.
- [x] Tighten destructive/admin confirmation language so the object and consequence are explicit.
- [x] Update Settings and design-language docs.
- [x] Verify TypeScript, whitespace, build, and browser smoke.

## Review
- Shipped: Departments, Locations, Allowed Emails, Calendar Sources, Venue Mappings, and Kiosk Devices moved lifecycle/destructive row commands into `OperationalRowActions`. Calendar Sources, Venue Mappings, Locations, Allowed Emails, Bookings, and Kiosk Devices moved local empty copy to shared inline empty states. Delete/deactivate confirmations now name the target and operational consequence.
- Verified: `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings/calendar-sources`, `/settings/locations`, and `/settings/kiosk-devices`.
- Deferred:
