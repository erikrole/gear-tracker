# Detail Pages & Sheets Visual Cleanup Plan

Created: 2026-07-10. Follows the 2026-07-10 bookings-list visual refresh (`2b4ecaf9`).

## Modernization language (from the bookings pass + DESIGN_LANGUAGE.md)
- Status/refs/values never render as uppercase letterspaced micro-mono. Status uses semantic `Badge` variants; refs/serials use plain mono at >=10px without uppercase/tracking; values use standard tabular text.
- Field/section labels keep the sanctioned small-uppercase style, unified to ONE variant: `text-[11px] font-medium uppercase tracking-wide text-muted-foreground` (no /55 or /70 opacity fades, no 0.12-0.16em tracking).
- No blanket opacity dimming of rows whose state is the norm for the surface (e.g. completed rows on a past-scope list). Exception dimming inside mixed lists (e.g. returned items within an active checkout) stays.
- Item thumbnails where the data already exists instead of bare counts.
- 40px targets, semantic status tokens, shadcn primitives per DESIGN_LANGUAGE.md.

## Inventory
Detail pages: items/[id] (~3.9k), users/[id] (~4.2k), kits/[id] (978), events/[id] (820),
checkouts+reservations via bookings/BookingDetailPage (~1.1k), bulk-inventory/[id] (~1.2k), resources/[slug] (39).
Sheets/drawers: BookingDetailsSheet (724), ShiftDetailPanel (812), ItemPreviewDrawer (237),
new-item-sheet (589), new-kit-sheet (291), NewEventSheet (470), AdminClaimSheet (575), BulkAddSheet (126).

## Slices (each independently committable)
- [ ] Slice 1: items/[id] — ItemHeader + page + tabs (most offenders: 14 uppercase, 6 mono, 3 dims)
- [ ] Slice 2: users/[id] — page + tabs (4 uppercase, 1 mono, 4 dims)
- [ ] Slice 3: remaining detail pages — events/[id], bulk-inventory/[id], kits/[id], resources/[slug] spot fixes
- [ ] Slice 4: sheets/drawers — ItemPreviewDrawer, new-item-sheet spot fixes; verify the rest (grep-clean)

## Verification per slice
- npx tsc --noEmit; npx next build (dev server stopped); run related vitest files if any pin styling.
- Routes are auth-gated; visual proof via scratch route only where mocking is cheap.
- Commit per slice; docs sync in same commit (AREA_ITEMS, AREA_USERS, etc.).
