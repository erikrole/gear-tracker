# Light/Dark Mode Animation Plan

## Goal

Add a restrained, robust animation when users switch between light, dark, and system theme modes. The animation should feel intentional in both the Settings Appearance page and the Sidebar theme control, without introducing first-paint flashes, route transition artifacts, or motion for users who prefer reduced motion.

## Source Checks

- `docs/AREA_SETTINGS.md` owns Appearance as a personal settings surface. Theme and text-size preferences are per-device localStorage preferences, and the root layout script applies them before first paint.
- `src/app/layout.tsx` already applies `data-theme` and `--text-scale` before hydration. The animation must not run from this cold-load script.
- `src/app/(app)/settings/appearance/page.tsx` owns the full Appearance page theme picker. It directly mutates `document.documentElement.dataset` and stores localStorage.
- `src/components/Sidebar.tsx` owns the compact footer theme toggle. It duplicates theme application logic and currently persists `"system"` instead of removing the localStorage override, which differs from Appearance.
- `src/app/globals.css` defines light and dark CSS tokens through `:root` and `[data-theme="dark"]`, plus a global `prefers-reduced-motion` escape hatch.
- `src/components/ui/motion.tsx` provides component entrance animation primitives, but theme switching should be a root-level transition, not per-component motion.
- No matching `docs/BRIEF_*` file covers this theme-animation behavior.
- No Prisma schema, API route, RBAC, or lifecycle mutation is expected for this slice.

## Implementation Standard

Use a shared theme controller instead of adding another copy of theme logic. The same helper should serve Appearance, Sidebar, and any future theme-aware UI.

Recommended file shape:

- `src/lib/theme.ts` or `src/hooks/use-theme-preference.ts`
- `src/app/(app)/settings/appearance/page.tsx`
- `src/components/Sidebar.tsx`
- `src/app/globals.css`
- `docs/AREA_SETTINGS.md`

## Slice 1: Shared Theme Preference Logic

- Add a shared theme helper with:
  - `ThemeChoice = "system" | "light" | "dark"`
  - stored preference read/write
  - system preference resolution
  - `applyThemeChoice(choice, options)`
  - matchMedia subscription support for `"system"`
- Normalize storage behavior:
  - `"light"` and `"dark"` write `localStorage.theme`
  - `"system"` removes `localStorage.theme`
- Update Appearance and Sidebar to use the helper.
- Keep the existing `layout.tsx` cold-load script in place for first paint.

Acceptance:

- Appearance and Sidebar show the same active state after reload.
- Choosing System removes the override and follows OS preference.
- No visual animation runs during first page load.

## Slice 2: Theme Switch Animation

- Add a user-action-only animation path to the shared helper.
- Prefer the View Transitions API when available:
  - call `document.startViewTransition(() => apply data-theme)`
  - keep duration short, roughly 160-220ms
  - animate root old/new snapshots as a soft crossfade
- Add fallback CSS for browsers without View Transitions:
  - temporarily apply a root class such as `theme-transitioning`
  - transition `background-color`, `color`, `border-color`, `box-shadow`, `fill`, and `stroke`
  - remove the class after the short transition window
- Respect `prefers-reduced-motion: reduce` by skipping both View Transition and fallback animation.
- Do not animate passive OS theme changes while in System mode unless it proves clean in browser verification.

Acceptance:

- Clicking Light, Dark, or System from Appearance animates once and lands on the correct theme.
- Clicking Sidebar icons uses the same animation.
- Reduced-motion users get an immediate switch.
- Rapid repeated toggles do not leave stale transition classes on `<html>`.

## Slice 3: Documentation And Verification

- Update `docs/AREA_SETTINGS.md` to document the shared theme controller, animation behavior, and System storage semantics.
- Add a short changelog entry with verification evidence.
- Run focused checks:
  - `npx tsc --noEmit`
  - `git diff --check`
  - `npx next build`
- Browser verification:
  - open `/settings/appearance`
  - switch Light, Dark, System
  - use Sidebar theme toggle from another authenticated page
  - confirm no console errors
  - confirm reload starts in the chosen theme with no flash
  - emulate reduced motion and confirm animation is skipped

## Stop Conditions

Stop and re-plan if:

- View Transitions create route-level artifacts, stale snapshots, or unreadable intermediate frames.
- The fallback transition causes noticeable layout jank on dense pages.
- Theme state diverges between Appearance and Sidebar.
- Third-party or editor content fails to react to `data-theme` changes.
- The current dirty worktree makes it unsafe to isolate the slice.

## Done Definition

- One shared theme path drives all existing web theme controls.
- Light/dark/system switching feels polished but restrained.
- First paint remains controlled by `layout.tsx`.
- Reduced-motion behavior is honored.
- `docs/AREA_SETTINGS.md` reflects shipped behavior.
- Typecheck, build, diff hygiene, and browser verification pass.

## Review

- Shipped: Shared web theme controller in `src/lib/theme.ts`; Appearance and Sidebar both use it for Light/Dark/System persistence and root theme application. User-triggered theme switches animate through View Transitions where available, with a reduced-motion-safe CSS fallback.
- Verified: `npx tsc --noEmit`, `npm run db:migrate:check`, `git diff --check`, `npx next build`, and authenticated Chrome DevTools smoke on `/settings/appearance`. The smoke logged in with the local admin, clicked Appearance Light/Dark/System and Sidebar Light/System, confirmed `data-theme`, `localStorage.theme`, active Appearance cards, and active Sidebar radios stay in sync, confirmed System clears `localStorage.theme`, confirmed reduced-motion skips transition classes, and confirmed no console warnings/errors.
- Deferred: No new preference toggle for animation. The app uses `prefers-reduced-motion` instead.
