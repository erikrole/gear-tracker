# Bucket 2 — Overlays Audit

**Components:** `dialog`, `sheet`, `popover`, `tooltip`, `dropdown-menu`, `context-menu`, `drawer`, `alert-dialog`
**Date:** 2026-05-01

---

## What's Smart

- All overlays Portal to document body — no z-index fights with parent stacking contexts.
- Consistent enter/exit animation grammar: `data-[state=open]:animate-in fade-in-0 zoom-in-95` + slide directional classes. Reads like a single design language.
- All overlays share `z-50` (not a tower of stacking values).
- Sheet uses dark branded header (`var(--sidebar-bg)` + red bottom border) — recognizable identity.
- AlertDialogAction/Cancel reuse `buttonVariants` — no duplicate button styles inside the dialog.

## Doesn't Make Sense

1. **Backdrop opacity drift.** Four backdrops, four different recipes:
   - Dialog: `bg-black/60 backdrop-blur-sm`
   - AlertDialog: `bg-black/50 backdrop-blur-[2px]`
   - Sheet: `bg-black/65 backdrop-blur-[2px]`
   - Drawer: `bg-black/50` (no blur at all)

   Mounted side-by-side they all look slightly different. Standardize on one token.

2. **Dialog `sm:rounded-xl` vs AlertDialog `sm:rounded-lg`** — the destructive-confirm dialog has a smaller radius than the regular dialog. Not a strong reason.

4. **DialogContent uses `p-0` (relies on DialogHeader/Body/Footer for padding); AlertDialogContent uses `p-6` directly.** Two padding contracts for the same component family. Easy footgun when copy-pasting.

## Can Be Simplified

- Drawer is used in **exactly 1 file** (`scan/_components/ItemPreviewDrawer.tsx`). Either keep and document the use case (mobile bottom-sheet for scan flow) or replace with Sheet `side="bottom"`. Two bottom-sheet primitives with one user is overkill.

## Can Be Rethought (parked)

- **AlertDialog could compose Dialog** — they share 90% of layout, differ only in confirm/cancel pattern. Today they're two parallel implementations.
- **DialogBody overflow handling** is `overflow-y-auto` baked in; pages that want stuck headers/footers and scrollable middles work, but pages that want full-bleed content fight it.

## Dead Code

- None found in this bucket.

## Polish Checklist (this PR)

- [ ] Unify all four backdrops on `bg-black/60 backdrop-blur-[2px]`
- [ ] Align Dialog radius with AlertDialog: `sm:rounded-lg` (canonical shadcn)

## Bigger Bets (follow-up)

- Decide drawer fate: keep + document, or migrate the 1 caller to Sheet
- Compose AlertDialog atop Dialog
- Audit shadow elevation tokens project-wide (Card uses CSS-var shadows, primitives use Tailwind tokens — two systems)
