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
- [x] Import summary metric cards in `ImportPreviewStep.tsx` and
  `ImportResultStep.tsx`: variant maps use tokens and template-literal classNames
  were replaced with `cn()`.
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
1. ~~`space-x/y-*` sweep~~ **Done 2026-07-10 (follow-up slice):** all 264 occurrences
   converted area-by-area in six reviewable commits (settings; shared components; items group;
   bulk-inventory + licenses; users/events/schedule/dashboard/bookings/reservations; root/auth
   pages). Conversion was codemod-assisted but conservative: only unambiguous string-literal
   classNames were rewritten (plain container -> `flex flex-col gap-N`, existing `flex flex-col`
   -> `gap-N`, flex row `space-x` -> `gap-N`); grids, responsive variants, and cn() fragments
   were flagged and handled by hand. Full suite + build green after every batch.
   **Deliberate exceptions kept:** `ItemThumbnailStack.tsx` and `AssignmentCell.tsx` use
   `-space-x-2` for negative avatar/thumbnail overlap, which gap cannot express.
2. ~~Remaining raw palette colors~~ **Done 2026-07-10 (follow-up slice):** 23 files migrated
   to tokens/variants (EquipmentPicker, ItemInfoTab/Bookings/Settings tabs, batteries page,
   ChooseImageModal categorical badges, licenses yellow -> orange, TradeBoard warning callout
   which also gained its missing dark-mode treatment, OfflineBanner, kiosk devices,
   calendar sources, labels, scan info alert, import steps, avatar picker recommended chip,
   booking items, shift slot conflict icon, overdue banner, user award hint).
   **Deliberate exceptions kept:** the gold favorite/default stars
   (`items/columns.tsx`, `ItemHeader.tsx`, `EventTravelCard.tsx` use `amber-400` fills as
   affordance iconography, not status color) and `ScanControls.tsx` (always-dark surface).
3. ~~Manual `dark:` color pairs~~ **Done with item 2** — the paired `dark:` overrides were
   removed along with the raw colors; remaining `dark:` uses are shadows/opacity, not colors.
4. **Template-literal ternary classNames (33)** -> `cn()`.
5. **Manual z-index audit (30)** — most are likely fine (sticky headers, kiosk overlays);
   verify none fight the overlay primitives.

## Verification
- `npx vitest run` on the three UI contract tests: green.
- `npm run build:app`: green (see review below).
- Authenticated browser smoke blocked: non-interactive session, `(app)` layout gates auth
  (see `project_preview_auth_verification` memory). Changes are class-string only.
