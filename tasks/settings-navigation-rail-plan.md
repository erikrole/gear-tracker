# Settings Navigation Rail Plan - 2026-05-20

## Goal
- Clean up Settings navigation so the many sections are easier to scan without creating a marketing-style redesign or breaking role-gated access.

## Findings
- Settings has 13 possible sections plus Overview. The current horizontal tab strip is dense and scroll-heavy.
- `SETTINGS_SECTIONS` already has role, group, description, and keywords, so the IA is sound; presentation is the weak part.
- Sub-pages already use their own settings-split intro column, so a wide labeled rail beside children would over-compress content on laptop screens.
- A responsive grouped rail is the safe first slice: desktop users get scan-friendly grouped navigation, mobile/tablet keeps the existing horizontal pattern.

## Slice 1: Grouped Settings Rail
- [x] Add a grouped desktop rail in `settings/layout.tsx` using existing `SETTINGS_SECTIONS` and role visibility.
- [x] Keep the horizontal section scroller for smaller screens.
- [x] Preserve `settings:last-tab`, `SettingsCommand`, role filtering, and `/settings` Overview behavior.
- [x] Update `AREA_SETTINGS.md`, `DESIGN_LANGUAGE.md`, and `tasks/todo.md`.
- [x] Verify TypeScript, whitespace, build, and browser smoke.

## Deferred
- Do not refactor every settings sub-page in this slice.
- Do not remove the settings-split intro columns yet.
- Follow-up can tighten individual Settings pages after the nav rail proves usable.

## Review
- Shipped a grouped Settings rail for `xl` and wider screens while retaining the existing horizontal section scroller below `xl`.
- Preserved role-gated visibility, `/settings` Overview, `SettingsCommand`, and `settings:last-tab` behavior.
- Verified with `npx tsc --noEmit`, `git diff --check`, `npx next build`, and protected-route browser smoke for `/settings` plus `/settings/categories`.
