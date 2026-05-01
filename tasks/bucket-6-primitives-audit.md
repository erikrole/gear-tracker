# Bucket 6 — Identity & Action Primitives Improvement Audit
**Date**: 2026-05-01
**Target**: `src/components/ui/button.tsx`, `src/components/ui/avatar.tsx`, `src/components/ui/avatar-group.tsx`, `src/components/ui/motion.tsx`
**Type**: Component foundation pass (dependencies for every other UI bucket)

## What's Smart

- **`button.tsx:8` — auto-svg sizing baked into the base class.** `[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4` means lucide icons fall in at the right size automatically, while consumers can still override per-instance with `className="size-3.5"`. Replicate this pattern in any new icon-bearing primitive.
- **`button.tsx:25` — `has-[>svg]:px-3` reduces horizontal padding on icon-bearing buttons.** Tightens visual rhythm without a dedicated `iconLeft`/`iconRight` API. Mirrored across all sizes (line 26–28). Worth replicating in `Badge` and `Item`.
- **`button.tsx:8` — `aria-invalid:border-destructive aria-invalid:ring-destructive/20` baked in.** Form validation styling is a free side effect of setting `aria-invalid`; consumers don't have to remember a class.
- **`avatar.tsx:18–20 + 49` — `group/avatar` + `data-size` lets fallback text scale with parent.** `group-data-[size=sm]/avatar:text-xs` is the right shape for compound primitives. (Note: this elegance is undermined by `UserAvatar` overriding the size; see Lens 2.)
- **`motion.tsx` — single shared easing curve `[0.16, 1, 0.3, 1]` everywhere.** All four exports use the same easing — page motion feels coherent. Lock this constant into a named export so future motion adds can't drift.
- **`KebabMenu.tsx:33` — `aria-label="Category actions"` on a `⋮` button.** Correct pattern for icon-character buttons.

## What Doesn't Make Sense

- **`avatar.tsx` and `UserAvatar.tsx` define two parallel size scales.** `Avatar` exposes 3 sizes (`sm`/`default`/`lg`, lines 12–13, 20) via `data-size` attributes. `UserAvatar.tsx:8` exposes 6 (`xs`/`sm`/`default`/`md`/`lg`/`xl`) via `size-X` className overrides. **`UserAvatar` always passes a `size-X` className that wins over `Avatar`'s built-in sizing**, so `Avatar`'s `data-size="lg"` branch (`avatar.tsx:20`) is dead in practice — every user-facing avatar in the app routes through `UserAvatar`. Result: a clever data-size mechanism that nothing meaningful uses.
- **`avatar-group.tsx:23, 28` wraps every child in `ring-2 ring-background rounded-full`, but callers ALSO ring/border the avatars themselves.** `dashboard-avatars.tsx:18` does `<Avatar size="sm" className="ring-2 ring-background">`; `BookingCard.tsx:37` does `<Avatar size="sm" className="border-2 border-card bg-muted">`. Two layers of stacking offset, with two different conventions (`ring`/`border`, `background`/`card`). The AvatarGroup wrapper is doing redundant work that the children also do — and inconsistently.
- **`avatar-group.tsx:29` overflow `+N` Avatar has no size prop.** When children are `size="sm"` (which is the *only* size used in the codebase, see `dashboard-avatars.tsx:16,50` and `BookingCard.tsx:37,158`), the `+N` chip renders at the default `size-8` while siblings render at `size-6`. Visible misalignment in a primitive that's literally about visual symmetry.
- **`button.tsx:57–58` — `data-variant`/`data-size` attributes are written but never selected against.** Grep across `src/**/*.{tsx,css}` returns zero CSS or component selectors targeting these. The same pattern *is* used productively in `avatar.tsx:18` (the fallback text uses it). On Button it's pure noise.
- **`button.tsx:22` `brand` variant has one consumer (`BookingDetailsSheet.tsx:804`).** A "brand" variant should be the highest-importance CTA button across the app, not a one-off on the convert-reservation flow. Either the design system means it (and 5–10 places should use it for primary brand moments) or it's a hardcoded color leak that should use `default`.
- **`button.tsx:30` `icon-xs` size (`size-7`, ~28px) is below the 44px iOS touch target on mobile.** Used at `KebabMenu.tsx:32` (a touchable kebab) and `search/page.tsx:215` (clear-search). Fine on desktop; problematic on mobile-first surfaces.
- **`schedule/assign/page.tsx:94, 100` does `<Button size="icon" className="size-8">`** — this is exactly what `size="icon-sm"` exists for (`button.tsx:31`). One place reinvents the named variant inline.
- **`motion.tsx:132` re-exports `motion` and `AnimatePresence`** for "convenience" — but `LoginForm.tsx:7` is the one place that uses raw `motion`, and it imports directly from `motion/react`, bypassing the wrapper. The re-export has no consumers.

## What Can Be Simplified

- **`button.tsx:32` — `"icon-lg": "size-10"`.** Zero call sites. Delete.
- **`button.tsx:21` — `link` variant.** One call site (`bulk-action-bar.tsx:78`). Replace with a styled `<button className="text-primary underline-offset-4 hover:underline text-sm">` or accept the variant exists for that one place. Probably delete.
- **`button.tsx:22` — `brand` variant.** One call site (above). Either propagate to other primary brand moments or delete and inline the Wisconsin red.
- **`button.tsx:26` — `xs` size.** Two call sites (`BookingEquipmentTab.tsx:357`, `booking-details/BookingItems.tsx:97`). Re-evaluate — small surface area suggests this is rarely the right choice.
- **`button.tsx:57–58` — `data-variant`/`data-size`.** Dead attributes. Delete.
- **`avatar.tsx:13, 20` — `size="lg"` branch.** Zero direct call sites; everyone uses `UserAvatar` which overrides via className. Delete the `lg` size or delete the size prop entirely (let `className` own it, since that's what consumers do anyway).
- **`avatar-group.tsx:22–26` — child wrapper div.** Either AvatarGroup owns the ring (and callers stop adding it) or AvatarGroup stops adding it (and callers continue). Right now both happen. Pick one — the simpler version is for AvatarGroup to own it and callers to remove `ring-2 ring-background`/`border-2 border-card` from their inner Avatars.
- **`motion.tsx:132` — `export { motion, AnimatePresence }`.** Dead re-export. Delete.

## What Can Be Rethought

- **Avatar size ownership: collapse to one scale.** `Avatar` should either own size via a richer `data-size` enum that `UserAvatar` *uses* (not overrides), or surrender the size prop entirely. Current model — primitive has a 3-size scale that the wrapper silently shadows — is the worst of both: type system suggests `lg` works on `Avatar` directly, but no one tests that path. **Suggested**: extend `Avatar`'s `size` to match `UserAvatar`'s 6-value set, switch `UserAvatar` to set `size` via the prop instead of className, delete the SIZE_MAP wrapper class lookup. Tradeoff: one-time migration of 9 raw `<Avatar size="sm">` callers.
- **AvatarGroup composition vs hardcoded ring.** Right now AvatarGroup hardcodes its visual offset language (ring color, ring width) and callers fight it. Better model: AvatarGroup is layout-only (`-space-x-2`) and renders children verbatim; ring/border is a `<UserAvatar ring />` prop or a class consumers add intentionally. Tradeoff: more verbose at call sites but consistent across `dashboard-avatars` and `BookingCard`.
- **`motion.tsx` — wrap app in `<MotionConfig reducedMotion="user">`.** `globals.css:525` has a `prefers-reduced-motion` block that sets `transition-duration: 0.01ms`, but **Framer Motion drives `motion.div` animations via inline transforms that don't honor CSS `transition-duration`** — so users with reduced motion still get the FadeUp/ScaleIn/Stagger transforms. Add `<MotionConfig reducedMotion="user">` at the root layout or use `useReducedMotion()` inside each helper. This is a shipped a11y gap.
- **`Button` could grow a `loading` prop.** Lessons file (`tasks/lessons.md:51, 137, 185`) repeats "guard mutation buttons + show spinner" as a recurring pattern. Consumers handle it ad-hoc with `disabled={busy}` + a manually-spun icon (`page.tsx:208–215`, `dashboard/my-gear-column.tsx:91`). A `loading` prop that handles `disabled`, swaps the leading icon for a `Loader2 animate-spin`, and stamps `aria-busy` would collapse a lot of duplication. Tradeoff: adds API surface; risk of consumers grandfathering inconsistent local patterns.
- **`StaggerList`/`StaggerItem` is used exactly once** (`page.tsx:232–236` for the four KPI tiles). Either it's a not-yet-adopted system primitive (then propagate to other list landings) or it's overkill for one place (then delete and inline four FadeUp delays). Worth a product decision.

## Consistency & Fit

### Pattern Drift
- **`<Button size="icon" className="size-8">` reinvents `size="icon-sm"`** — `schedule/assign/page.tsx:94, 100`. Should use the named variant.
- **Avatar stacking ring inconsistency** — `dashboard-avatars.tsx:18` uses `ring-2 ring-background`; `BookingCard.tsx:37` uses `border-2 border-card bg-muted`; `BookingCard.tsx:158` uses `border border-border`. Three different conventions for the same visual concept (avatar over surface). Standardize.
- **`AvatarGroup max={99}`** at `dashboard-avatars.tsx:16, 50` — using a sentinel value to disable the overflow indicator. If overflow is never wanted in this surface, the API should support `max={false}` or `showOverflow={false}` rather than a magic number.

### Dead Code
- **`button.tsx:32`** — `size: "icon-lg"`. No call sites.
- **`button.tsx:57`** — `data-variant={variant}`. No selectors target it.
- **`button.tsx:58`** — `data-size={size}`. No selectors target it.
- **`avatar.tsx:13, 20`** — `size="lg"` union member and `data-[size=lg]:size-10` class. No direct call sites; UserAvatar overrides via className.
- **`motion.tsx:132`** — `export { motion, AnimatePresence }`. The one direct-motion consumer (`LoginForm.tsx:7`) imports from `motion/react` instead.

### Ripple Map
- **If `Button.brand` is removed** → 1 file needs updating: `src/components/BookingDetailsSheet.tsx:804`.
- **If `Button.link` is removed** → 1 file needs updating: `src/app/(app)/items/components/bulk-action-bar.tsx:78`.
- **If `Button.icon-lg` is removed** → 0 files (dead).
- **If `Button.icon-xs` is removed** → 4 files: `settings/bookings/page.tsx:158`, `settings/categories/KebabMenu.tsx:32`, `search/page.tsx:215`, `items/components/items-toolbar.tsx:95`.
- **If `Avatar.size` prop is removed** → 9+ files using `<Avatar size="sm">` directly: `dashboard-avatars.tsx` (×4), `BookingCard.tsx` (×2), and indirectly via `UserAvatar` in ~15 more files.
- **If `Button.data-variant`/`data-size` attributes are removed** → 0 consumers.
- **If `AvatarGroup` child ring wrapper is removed** → ~6 callers gain a possibly-cleaner appearance (their explicit `ring-2 ring-background` / `border-2 border-card` becomes load-bearing). Need visual check on `dashboard-avatars.tsx`, `BookingCard.tsx`, `ShiftCoverageCard.tsx`, `EventTravelCard.tsx`, `LicenseTable.tsx`, `AdminClaimSheet.tsx`.
- **If `MotionConfig reducedMotion="user"` is added at root** → 30+ files using `FadeUp`/`StaggerList`/`PageTransition`/`ScaleIn` automatically respect user preference. No call-site changes.

### Navigation Integrity
✅ N/A for primitives.

## Polish Checklist
| Check | Status | Notes |
|---|---|---|
| Empty states | ✅ | N/A for primitives |
| Skeleton fidelity | ✅ | N/A for primitives |
| Silent mutations | ✅ | N/A for primitives |
| Confirmation quality | ✅ | N/A for primitives |
| Mobile breakpoints | ⚠️ | `Button.xs` (`h-6`, 24px) and `icon-xs` (`size-7`, 28px) below 44px touch target. Acceptable on desktop-only surfaces (settings); flag if these creep into mobile flows. |
| Error message quality | ✅ | N/A for primitives |
| Button loading states | ⚠️ | No built-in `loading` prop. Each consumer rolls their own (`disabled={busy}` + manually-spun icon). See `page.tsx:208–215`, `dashboard/my-gear-column.tsx:91`. Lessons cites this as recurring pattern. |
| Role gating | ✅ | N/A for primitives |
| Performance (N+1, over-fetch) | ✅ | N/A — render only |
| Debug cleanup (console.log, TODOs) | ✅ | None present |
| Accessibility basics | ⚠️ | Icon-only `<Button size="icon*">` consumers must each provide `aria-label`. Many do (e.g. `KebabMenu.tsx:33`, `items-pagination.tsx:73` via `sr-only`). At least two appear to lack it: `schedule/assign/page.tsx:94, 100` (prev/next month chevrons — no `aria-label`, no `Tooltip`, no `sr-only`). Verify the rest individually. **Bigger gap**: `motion.tsx` exports do NOT honor `prefers-reduced-motion` because Framer drives transforms inline; the global CSS rule only catches CSS animations. |

## Raise the Bar
- **`Avatar`'s `data-size` + `group-data-[size=sm]/avatar:text-xs` pattern** (`avatar.tsx:18, 49`) is the cleanest compound-component sizing approach in the UI folder. If/when `Item`, `Card`, or `Sidebar` grow size variants, use this — `data-size` on the root + `group-data-[size=X]/name:` on children — instead of duplicating size logic into every subcomponent.
- **`button.tsx:8`'s auto-svg sizing** (`[&_svg:not([class*='size-'])]:size-4`) lets icons "just work" without an `iconLeft` prop. Mirror in any future primitive that bears icons (e.g., `Item`, `Empty`).

## Quick Wins
1. **`src/components/ui/button.tsx:32, 57–58`** — Delete dead `icon-lg` size variant and the unused `data-variant`/`data-size` attributes. Pure subtraction, zero risk.
2. **`src/components/ui/avatar-group.tsx:29`** — Pass `size` from a representative child (or accept a `size` prop on `AvatarGroup` itself) so the `+N` overflow chip matches sibling avatars. Without this, the chip is visibly bigger than children whenever children are `size="sm"`.
3. **`src/components/ui/motion.tsx:132`** — Delete `export { motion, AnimatePresence }`. No wrapper consumer uses them; `LoginForm.tsx` imports `motion/react` directly.
4. **`src/app/(app)/schedule/assign/page.tsx:94, 100`** — Replace `size="icon" className="size-8"` with `size="icon-sm"`, and add `aria-label="Previous month"` / `aria-label="Next month"`. Two-line fix that closes a real a11y hole.
5. **`src/components/ui/avatar.tsx:13, 20`** — Drop `size="lg"` from the union and the corresponding class. Currently dead; keeping it implies a path that doesn't actually work because `UserAvatar` shadows it.

## Bigger Bets
- **Add `<MotionConfig reducedMotion="user">` at app root and verify each motion helper.** ~5–10 lines of code, but closes a shipped accessibility gap that affects every page with `FadeUp`/`StaggerList`/`PageTransition`/`ScaleIn` — i.e., most of the app. Highest-leverage single change in this bucket.
- **Add a `loading` prop to `Button`** that handles `disabled`, swaps the leading icon for a spinner, and sets `aria-busy="true"`. Costs ~15 lines + a migration of high-value mutation buttons. Consolidates a pattern lessons.md repeats four separate times across 2026-04 hardening sessions.
- **Reconcile `Avatar` and `UserAvatar` size scales.** Decide which component owns size; the other should not duplicate it. `UserAvatar` is the de-facto standard (used in 15+ surfaces with name + initials + color hash). Suggest: keep `Avatar` size-agnostic (drop the `size` prop entirely; let `className` own dimensions), make `UserAvatar` the canonical sized API. Migrating 9 raw `<Avatar size="sm">` call sites is a one-afternoon job and removes a confusing dual API.
- **Decide the fate of `Button.brand`.** Either propagate to all primary-brand CTAs (login submit, primary "Create Booking" call-to-actions, "Check out" actions) so the variant *means* something, or delete it. Single-use brand variants are tech debt that confuses both designers and developers.
