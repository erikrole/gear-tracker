# Component Bigger-Bets — Decisions

**Date:** 2026-05-01
**Context:** After the 6-bucket primitive audit (`tasks/bucket-{1..6}-*-audit.md`), several "bigger bets" were parked for follow-up. This doc captures what shipped, what was deferred with rationale, and the resolution for items that don't need code changes.

---

## Shipped

| Item | PR | Outcome |
|---|---|---|
| Install shadcn `Form` (RHF + resolvers) | #332 | New primitives at `src/components/ui/form.tsx`. Migrations land per-form. |
| Build `Combobox` recipe (Command + Popover) | #332 | New primitive at `src/components/ui/combobox.tsx`. |
| `<MotionConfig reducedMotion="user">` at root | #333 | Closes a11y gap — framer-motion now honors prefers-reduced-motion. |
| `Button.loading` prop | #334 | Auto-disable + spinner + aria-busy. asChild path unchanged. |
| TableHeader `sticky` + TableRow `striped` opt-in props | #335 | Both default true; clean opt-out for short tables and tables-in-cards. |

## Resolved without code change

### Avatar primitive (2 sizes) vs UserAvatar (6 sizes) — *intentional divergence*

- **Avatar primitive** (4 direct callers): raw images on dashboard/booking cards. 2 sizes (`default`, `sm`) match the visual rhythm of those layouts.
- **UserAvatar** (27 callers): users only. 6 sizes spanning xs → xl plus deterministic name-hashed color and initials fallback.

These serve different intents. Trying to unify would either bloat the primitive with user-specific logic or bloat UserAvatar's API. Keep both. **Rule:** use UserAvatar whenever the avatar represents a user; use Avatar primitive for everything else.

### DialogContent `p-0` vs AlertDialogContent `p-6` — *intentional divergence*

- **Dialog**: large modal with optional scrollable body. `p-0` on Content + DialogHeader/Body/Footer carry their own padding so a long body can scroll without cutting off sticky header/footer.
- **AlertDialog**: small destructive-confirm. No body slot needed. `p-6` on Content gives uniform breathing room around the title/description/footer trio.

Composing AlertDialog atop Dialog would force one model on both and reduce expressiveness. Keep parallel implementations.

### Drawer (1 caller) — *keep, vaul-specific*

`src/components/ui/drawer.tsx` wraps `vaul`, which provides gesture dismissal, drag-to-close, and native momentum. Used in `scan/_components/ItemPreviewDrawer.tsx` for the mobile scan preview. Migrating to `Sheet side="bottom"` (Radix Dialog under the hood) would lose gesture handling. Keep.

### `item.tsx` (1 caller) — *keep, list primitive*

`src/components/ui/item.tsx` is a structured list-item primitive (Item/ItemGroup/ItemMedia/ItemContent/ItemTitle/ItemDescription/ItemActions/ItemSeparator). Currently used in `notifications/page.tsx`. The primitive is well-designed; removing it would just churn working code. Future settings list views can adopt it.

### Card CSS-var shadows vs Tailwind shadow tokens — *system question, not a defect*

Card uses CSS-variable shadow tokens (`var(--shadow-sm)`, `var(--shadow)`, etc.) so card elevation responds to theme changes. Other primitives use Tailwind's `shadow-xs`/`shadow-md`/`shadow-lg` directly. This is intentional — Cards are surfaces (theme-aware), other primitives are inline elements.

If future design work wants unified shadow theming, it should migrate everyone onto the CSS-var system. Out of scope for primitive audits.

## Deferred

### Flip Badge default size to `sm`

72 `size="sm"` vs ~50 default callers suggests `sm` should be the default. But flipping requires touching every caller of the default size, which would inflate the diff. Defer until either (a) we do a Badge visual audit that picks one rhythm, or (b) the imbalance grows even larger.

### Migrate ad-hoc forms to `Form` primitive

PR #332 ships the primitive without migrations. Each form should migrate one at a time (low risk per PR). Suggested order: allowed-emails add form → settings forms → booking forms.

### Migrate user/item pickers to `Combobox`

PR #332 ships the primitive. Pickers in shift-detail, booking-create, and item-pick should migrate. One per PR.

---

## Backlog status

After this round, the bigger-bets backlog from the primitive audits is empty or deferred-with-rationale. Future polish should come from new audits (page-level, color-system) rather than primitive-level.
