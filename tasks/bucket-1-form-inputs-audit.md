# Bucket 1 — Form Inputs Audit

**Components:** `input`, `textarea`, `select`, `native-select`, `checkbox`, `radio-group`, `switch`, `label`
**Date:** 2026-05-01

## 2026-05-10 Closeout

- `Input` already had `shadow-xs`, matching transitions, disabled cursor parity, and `aria-invalid` styling before this closeout pass.
- `NativeSelect` already had `aria-invalid` styling; this pass aligned its default mobile type size with `Input`, `Textarea`, and `SelectTrigger` (`text-base md:text-sm`) while preserving dense overrides at call sites.
- `SelectTrigger size="sm"` now owns the small text size, so compact selects no longer need page-level `text-sm` overrides.
- Removed redundant small-select typography overrides from the fully-read call sites in Schedule assignment, Settings Sports call-time controls, and User Availability add-block form.
- Left the broad `Label` layout question and full FormField adoption as follow-up bets; the installed `form.tsx` and `combobox.tsx` primitives now exist, so the original bigger-bet notes are partially stale and should be re-audited before a migration.

---

## What's Smart

- All controls share the same focus-ring system: `focus-visible:border-ring` + `focus-visible:ring-ring/50` + `ring-[3px]`. Consistent and accessible.
- All Radix-based controls (Checkbox, Radio, Switch, Select) use `radix-ui` consistently — no mixed primitives.
- `aria-invalid` styles are wired on Input, Textarea, Checkbox, Radio, SelectTrigger — error state is just an attribute, no extra props.
- `NativeSelect` exists alongside `Select` — correct call: native pickers are better on mobile and inside dense edit-rows (used in date-time-picker, InlineDateField, ItemInfoTab).
- `Label` honors `peer-disabled` and `group-data-[disabled=true]` — clean disabled propagation without prop drilling.

## Doesn't Make Sense

1. **`Input` is missing `shadow-xs`.** Textarea, NativeSelect, and SelectTrigger all have it. Side-by-side inputs and selects in a form look visually inconsistent (selects float, inputs sit flat).
2. **`Input` transitions different properties than its siblings.**
   - Input: `transition-[border-color,box-shadow,background-color] duration-150`
   - Textarea/NativeSelect/SelectTrigger: `transition-[color,box-shadow]` (no explicit duration)
   - Result: hover/focus animations don't match between an Input and the Select next to it.
3. **`NativeSelect` is missing `aria-invalid` styles entirely.** Siblings render destructive border + ring on `aria-invalid`; NativeSelect ignores the attribute. Validation error UI silently breaks for native pickers.
4. **`SelectTrigger` `size` prop is effectively dead.** 0 call sites use `size="sm"`. Instead, 14+ call sites hand-roll `className="h-8 text-sm"` to fake the small variant. The variant exists but nobody knows.
   - Files: `users/UserFilters.tsx` (5×), `schedule/assign/page.tsx` (2×), `settings/sports/ShiftConfigTable.tsx` (2×), `users/[id]/UserAvailabilityTab.tsx`, `users/[id]/UserInfoTab.tsx`, `items/components/items-pagination.tsx`, `settings/allowed-emails/page.tsx` (3× hand-rolling `h-9` which is the default — pure noise).
5. **`disabled:` patterns diverge:** Input/Textarea/NativeSelect use `disabled:pointer-events-none`; Checkbox/Radio/Switch use `disabled:cursor-not-allowed`. SelectTrigger uses `disabled:cursor-not-allowed`. Behaviorally similar, but inconsistent — a disabled Input shows no cursor change, a disabled SelectTrigger shows not-allowed.
6. **`Label` bakes in `flex items-center gap-2`.** Most form patterns want labels on their own line above an input. Consumers fight the flex with `<Label className="block">`. The shadcn default is no layout opinions on Label.

## Can Be Simplified

- **Extract a shared `inputBase` constant** for the duplicated `border-input rounded-md border bg-transparent px-3 ... focus-visible:* aria-invalid:*` string across Input, Textarea, NativeSelect, SelectTrigger. Today the same chain appears 4 times with subtle drift (see #1, #2, #3 above).
- **Drop `data-size={size}` on SelectTrigger** — no CSS or JS reads it (same dead-attribute pattern we removed from Button last bucket).

## Can Be Rethought (Bigger Bets — parked)

- **No `Form` primitive / react-hook-form integration.** 16 `aria-invalid` call sites exist but error messages are rendered ad-hoc per page. Installing shadcn `form` would standardize FormField + FormMessage and remove a lot of hand-rolled error JSX.
- **No Combobox / searchable Select.** User pickers, item pickers, and SKU pickers all use long Selects today. shadcn ships a Combobox recipe (Command + Popover). Worth one slice.
- **NativeSelect vs Select decision rule** is undocumented — date/time pickers and inline edit cells use NativeSelect, others use Select. Add a one-line rule to AREA docs.

## Dead Code

- `SelectTrigger`'s `size` prop and `data-size` attribute (no consumers).

## Ripple Map (Quick Wins)

| Change | Files touched | Risk |
|---|---|---|
| Add `shadow-xs` to Input | `input.tsx` | Visual only |
| Unify transition tokens | `input.tsx` | Visual only |
| Add `aria-invalid` styles to NativeSelect | `native-select.tsx` | Visual only |
| Migrate 14 hand-rolled `h-8 text-sm` SelectTriggers → `size="sm"` | 8 page files | Visual identical, behavior unchanged |
| Drop noise-only `className="h-9"` on SelectTriggers | `settings/allowed-emails/page.tsx`, `import/_components/ImportPreviewStep.tsx` | None |
| Remove `data-size` from SelectTrigger | `select.tsx` | None |

## Polish Checklist (this PR)

- [x] Input shadow + transition parity with Textarea/Select
- [x] NativeSelect aria-invalid parity
- [x] Migrate hand-rolled small SelectTriggers to `size="sm"`
- [x] Remove redundant explicit `h-9` on SelectTriggers (already the default)
- [x] Drop dead `data-size` attribute on SelectTrigger

## Bigger Bets (follow-up PRs)

- Install shadcn `form` and migrate one form to validate the pattern
- Install shadcn `combobox` and replace user/item pickers
- Reconcile Label flex baseline (likely strip flex, let pages add it)
- Reconcile disabled cursor patterns across all primitives (separate bucket-wide PR)
