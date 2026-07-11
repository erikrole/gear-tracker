# shadcn/ui Consistency Audit - 2026-07-10

## Goal
Sweep web UI for shadcn rule violations and color-system drift; fix the high-value
consistency items in one slice and record the rest as an actionable backlog.

## Method
Repo-wide scans against the shadcn skill's critical rules plus `docs/COLOR_SYSTEM.md`:
raw palette utilities, manual `dark:` pairs, `space-x/y-*`, `w-N h-N` pairs,
missing Dialog/Sheet/Drawer titles, custom skeletons, manual z-index, template-literal
ternary classNames.

## Fixed in this slice
- [x] `events/[id]/page.tsx`: `sourceState` now returns a `Badge` variant (purple/orange/blue)
  instead of hand-rolled palette+dark class strings; the source chip renders a real `Badge`.
  All tone classes (`text-green-600`, `text-amber-600`, ...) moved to `--{hue}-text` tokens;
  the edited-fields callout uses `--orange-bg`/`--orange-text`.
- [x] `licenses/LicenseTable.tsx`: off-system yellow expiring badge replaced with
  `Badge variant="orange"` (expiring = warning per COLOR_SYSTEM.md); row tints and
  own-claim ring moved to `--green-bg`/`--blue-bg`/`--blue` tokens (dark mode now free).
  Contract test updated to assert the token form.
- [x] `import/_components/SummaryCard.tsx`: variant map moved to tokens; template-literal
  className replaced with `cn()`.
- [x] `w-N h-N` -> `size-N` in 9 files (kits, dashboard skeleton, user/booking filters,
  FilterChip, and the four auth forms).

## Verified non-issues
- All `DialogContent`/`SheetContent`/`DrawerContent` usages have accessible titles.
- No `<hr>`, no missing `AvatarFallback` patterns surfaced.
- `animate-pulse` outside `ui/` is pending-action icon feedback, not loading placeholders;
  Skeleton rule does not apply.
- `ScanControls.tsx` raw dark-tuned colors are deliberate: the scanner panel is a fixed
  black surface; semantic tokens would flip in light mode and break it.
- `EmptyState` is a sanctioned project primitive alongside `ui/empty` per skill rules.

## Backlog (deferred, ranked)
1. **`space-x/y-*` sweep — 264 occurrences across ~80 files.** Replace with
   `flex flex-col gap-*` / `gap-*`. Margin-based spacing behaves differently from gap
   (collapsing, absolute children), so do it area-by-area with visual checks, not one sed.
2. **Remaining raw palette colors (~45 left).** Top files: `EquipmentPicker.tsx` (6),
   `ItemInfoTab.tsx` (5), `bulk-inventory/batteries/page.tsx` (4), `ChooseImageModal.tsx` (3,
   categorical emerald/sky/amber source badges -> map to green/blue/orange tokens),
   `ItemBookingsTab.tsx` (3, red/amber row accents -> `--red`/`--orange` with opacity).
   Same token recipe as this slice.
3. **Manual `dark:` color pairs (~40 left)** — largely resolved by item 2 since most pair
   with the raw colors.
4. **Template-literal ternary classNames (33)** -> `cn()`.
5. **Manual z-index audit (30)** — most are likely fine (sticky headers, kiosk overlays);
   verify none fight the overlay primitives.

## Verification
- `npx vitest run` on the three UI contract tests: green.
- `npm run build:app`: green (see review below).
- Authenticated browser smoke blocked: non-interactive session, `(app)` layout gates auth
  (see `project_preview_auth_verification` memory). Changes are class-string only.
