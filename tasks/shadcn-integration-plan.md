# shadcn/ui Integration Plan

## Goal
Integrate shadcn/ui into the gear-tracker codebase as the foundation for new UI components, and gradually migrate existing custom components to shadcn equivalents. This preserves the current design language (Wisconsin brand colors, dark mode, spacing) while gaining access to 59 polished, accessible primitives.

## Current State
- **Stack**: Next.js 15 + React 19 + Tailwind CSS 4 — all compatible with shadcn v4
- **Styling**: 2,894-line `globals.css` with ~150 CSS variables, BEM-like class conventions
- **Components**: 33 custom components, ~10 of which overlap with shadcn equivalents
- **Dark mode**: `data-theme="dark"` attribute + localStorage + prefers-color-scheme
- **Path alias**: `@/*` → `src/*` already configured

## Overlapping Components (Migration Candidates)

| Our Component | shadcn Equivalent | Priority | Notes |
|---|---|---|---|
| `Modal.tsx` | Dialog | High | Focus trap, Escape, overlay — shadcn Dialog does all this |
| `ConfirmDialog.tsx` | Alert Dialog | High | Promise-based confirm → AlertDialog |
| `Toast.tsx` | Sonner | High | Replace custom context + provider with Sonner |
| `EmptyState.tsx` | Empty | Medium | Direct mapping, shadcn version is composable |
| `Skeleton.tsx` | Skeleton | Medium | Ours has 5 variants — keep composition, swap primitive |
| `FilterChip.tsx` | Select / Combobox | Medium | Depends on complexity needed |
| Buttons (`.btn-*`) | Button | Medium | CSS classes → React component with variants |
| Cards (`.card`) | Card | Low | Simple CSS, low urgency |
| Badges (`.badge-*`) | Badge | Low | Simple CSS, low urgency |
| Data tables | Table + Data Table | Low | Heavy, do later |
| Tabs (`.tab`) | Tabs | Low | Already works fine |

Components to **keep custom** (no shadcn equivalent or too domain-specific):
- `AppShell.tsx`, `Sidebar.tsx` (layout shell)
- `BookingDetailsSheet.tsx`, `BookingListPage.tsx` (domain logic)
- `EquipmentPicker.tsx`, `QrScanner.tsx`, `DonutChart.tsx` (specialized)

---

## Implementation Slices

### Slice 1: Foundation Setup ✅ SHIPPED
- [x] Manual setup (CLI auth blocked): components.json, src/lib/utils.ts, src/components/ui/
- [x] Installed deps: class-variance-authority, clsx, tailwind-merge, lucide-react, radix-ui, tw-animate-css
- [x] CSS variable bridge: our tokens → shadcn naming via @theme inline
- [x] Dark mode: `@custom-variant dark (&:is([data-theme="dark"] *))` — shadcn dark: prefix uses our toggle
- [x] Note: used `--sc-accent` for shadcn's accent to avoid collision with our `--accent` (= primary)
- [x] Added Button, Badge, Skeleton to src/components/ui/
- [x] Build passes, zero regressions

### Slice 1.5: Avatar & AvatarGroup ✅ SHIPPED
- [x] Added shadcn Avatar (Avatar, AvatarImage, AvatarFallback) using radix-ui unified package
- [x] Created AvatarGroup component for stacked/overlapping avatars with overflow "+N" indicator
- [x] Migrated Sidebar avatar (72px, border, translucent bg)
- [x] Migrated UserRow mobile avatar (36px, initials fallback)
- [x] Migrated UserDetail page avatar (48px, initials fallback)
- [x] Added avatars to ShiftDetailPanel (active assignments + pending requests)
- [x] Added stacked AvatarGroup to schedule page area coverage cells
- [x] Added avatar to event detail page shift coverage table
- [x] Removed old CSS: .sidebar-avatar-lg, .user-mobile-avatar, .user-detail-avatar
- [x] Build passes, zero regressions

### Slice 2: Dialog & Toast Migration ✅ SHIPPED
- [x] Added shadcn Dialog, AlertDialog, Sonner (+ sonner npm package)
- [x] Created `src/components/ui/dialog.tsx`, `alert-dialog.tsx`, `sonner.tsx`
- [x] Migrated ConfirmDialog internals to shadcn AlertDialog (kept `useConfirm()` API)
- [x] Migrated Toast to Sonner thin wrapper (kept `useToast()` API — 26 callsites unchanged)
- [x] Migrated ChooseImageModal from custom Modal to shadcn Dialog
- [x] Swapped providers in `(app)/layout.tsx` — removed ToastProvider, added `<Toaster />`
- [x] Deleted `Modal.tsx`, removed ~150 lines of modal/confirm/toast CSS
- [x] Build passes, zero regressions

### Slice 3: Empty, Spinner, Item, Separator Components ✅ SHIPPED
- [x] Added shadcn Spinner (lucide Loader2Icon + animate-spin)
- [x] Added shadcn Empty (Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent)
- [x] Added shadcn Item (Item, ItemGroup, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions, ItemHeader, ItemFooter, ItemSeparator)
- [x] Added shadcn Separator (dependency of Item)
- [x] Migrated EmptyState.tsx to use shadcn Empty + lucide-react icons (replaced 8 inline SVGs)
- [x] Migrated ~25 raw `className="empty-state"` usages to Tailwind utility classes
- [x] Migrated ~21 `.loading-spinner` + `.spinner` CSS patterns to shadcn Spinner component
- [x] Removed ~55 lines of CSS: `.empty-state*`, `.loading-spinner`, `.spinner`, `.btn-spinner`, `@keyframes spin`
- [x] Build passes, zero regressions

### Slice 4: Form Components ✅ SHIPPED
- [x] Added shadcn `Input`, `Label`, `Textarea`, `Checkbox` to `src/components/ui/`
- [x] Migrated auth forms (login, register, forgot-password, reset-password) — `form-group` → Tailwind, `<input>` → `<Input>`, inline SVGs → lucide icons, native checkbox → shadcn Checkbox
- [x] Migrated app forms (~16 files): profile, users, settings, items, events, bulk-inventory, search, booking filters, shift detail, choose image modal, booking edit form, create booking card
- [x] Replaced `.form-group`, `.field-compact`, `.sheet-field`, `.form-error`, `.field-error`, `.form-hint`, `.form-label`, `.form-input` CSS with Tailwind utilities + shadcn components
- [x] Kept `.form-select` (still used for native `<select>` elements), `.form-grid`, `.profile-form`
- [x] Removed ~120 lines of CSS
- [x] Build passes, zero regressions

### Slice 5: Advanced Components (future)
- [ ] `Sheet` (for BookingDetailsSheet refinement)
- [ ] `Command` + `Combobox` (for search/filter upgrades)
- [ ] `Dropdown Menu` + `Context Menu` (for booking context menu)
- [ ] `Data Table` (for items/users/reports tables)
- [ ] `Calendar` + `Date Picker` (for reservation date selection)

---

## CSS Variable Mapping Strategy

We need to bridge our variable names to shadcn's expected names. shadcn v4 uses Tailwind 4's CSS theme variables.

```css
/* Add to globals.css — shadcn compatibility layer */
:root {
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--bg-card);
  --card-foreground: var(--text);
  --popover: var(--bg-elevated);
  --popover-foreground: var(--text);
  --primary: var(--accent);
  --primary-foreground: #ffffff;
  --secondary: var(--accent-soft);
  --secondary-foreground: var(--text);
  --muted: var(--bg-surface);
  --muted-foreground: var(--text-secondary);
  --accent: var(--accent-soft);       /* shadcn accent ≠ our accent */
  --accent-foreground: var(--text);
  --destructive: var(--red);
  --border: var(--border);
  --input: var(--border);
  --ring: var(--accent);
  --radius: 0.5rem;                   /* matches our --radius: 8px */
}
```

Dark mode variables follow the same pattern inside `[data-theme="dark"]`.

## Dark Mode Reconciliation

shadcn defaults to toggling a `.dark` class on `<html>`. Our app uses `data-theme="dark"`. Options:
1. **Recommended**: Configure shadcn's dark mode selector to `[data-theme="dark"]` in the CSS — zero changes to existing theme toggle logic
2. Alternative: Add `.dark` class alongside `data-theme` in Sidebar.tsx — more fragile

We'll go with option 1.

## Risk Assessment

| Risk | Mitigation |
|---|---|
| CSS variable name collision (`--accent`, `--border`, `--radius`) | Alias layer — our vars remain, shadcn vars reference ours |
| Bundle size increase | shadcn is tree-shakeable (copy-paste, not npm). Only adds what we use |
| Breaking existing styles | Slice 1 adds no page changes. Each subsequent slice is independently testable |
| Radix UI dependency bloat | Only Dialog/AlertDialog/Select pull Radix. ~15-20KB gzipped total |
| Dark mode mismatch | Use `[data-theme="dark"]` selector for shadcn dark styles |

## Success Criteria
- `npm run build` passes after every slice
- No visual regression on existing pages after Slice 1
- Dialog/Toast migration (Slice 2) preserves all existing UX flows
- New components use shadcn primitives going forward
- Dark mode works identically before and after

## Scope of This PR (Slice 1 Only)
We ship Slice 1 as the first PR: init shadcn, bridge CSS variables, add Button/Badge/Skeleton as proof-of-concept. No existing pages are modified — this is pure additive infrastructure.
