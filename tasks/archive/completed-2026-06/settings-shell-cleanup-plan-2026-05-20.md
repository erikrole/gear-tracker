# Settings Shell Cleanup Plan - 2026-05-20

## Goal
- Make every Settings sub-page use one shared shell for the intro column and main content so the new rail has a stable, predictable page body.

## Peer patterns checked
- Settings navigation: layout owns the page title and grouped navigation, sub-pages own focused section context.
- Categories, Departments, Locations, Allowed Emails: strongest catalog pattern is a compact intro column plus action/table content.
- Notifications, Appearance, Sports, Escalation: same shell repeated across loading, error, and content states.

## Plan
- [x] Add a shared `SettingsPageShell` component.
- [x] Migrate sub-pages that already use the split shell.
- [x] Keep loading and error states inside the shared shell instead of repeating grid markup.
- [x] Update Settings docs and design-language rules.
- [x] Verify TypeScript, whitespace, build, and browser smoke.

## Review
- Shipped: Added `SettingsPageShell` and moved Appearance, Notifications, Categories, Departments, Locations, Allowed Emails, Sports, Escalation, Calendar Sources, Venue Mappings, Extend Presets, Kiosk Devices, and Database Health onto it.
- Verified: `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings/categories`, `/settings/notifications`, and `/settings/kiosk-devices` at desktop/tablet widths.
- Deferred: Table actions and page-local empty states still need the next Settings cleanup slice.
