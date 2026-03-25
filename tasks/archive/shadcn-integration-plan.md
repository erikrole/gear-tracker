# shadcn/ui Integration Plan

## Goal
Integrate shadcn/ui into the gear-tracker codebase as the foundation for new UI components, and gradually migrate existing custom components to shadcn equivalents.

---

## Completed Slices (1–5.4) ✅

All foundation work shipped 2026-03-20:
- Slice 1: Foundation + Button/Badge/Skeleton
- Slice 1.5: Avatar & AvatarGroup
- Slice 2: Dialog, AlertDialog, Sonner
- Slice 3: Empty, Spinner, Item, Separator
- Slice 4: Form components (Input, Label, Textarea, Checkbox)
- Slice 5.1: Button migration (182+ usages)
- Slice 5.2: Card migration (20+ pages)
- Slice 5.3: Sheet migration
- Slice 5.4: Tabs migration

---

## Active Slices (Deep Integration)

### Slice A: Command Palette (Cmd+K)

**Files touched:**
- `src/components/AppShell.tsx` — remove custom search overlay, wire CommandDialog
- `src/app/(app)/search/page.tsx` — keep as full results page (palette has "see all" option)

**What changes:**
- Replace mobile search overlay + desktop search input with a single `CommandDialog`
- Cmd+K / Ctrl+K opens dialog on both desktop and mobile
- Live search: debounced fetch to `/api/assets`, `/api/checkouts`, `/api/reservations` (limit=5 each)
- Results grouped by type (Items, Checkouts, Reservations) using `CommandGroup`
- Selecting a result navigates directly via `router.push`
- "See all results" at bottom navigates to `/search?q=...`
- Topbar search icon (mobile) opens CommandDialog instead of overlay
- Remove desktop topbar search `<form>`
- Remove CSS: `.search-overlay*`

**Acceptance:**
- [ ] Cmd+K opens command palette on desktop and mobile
- [ ] Typing shows live grouped results
- [ ] Arrow keys navigate, Enter selects
- [ ] Escape closes
- [ ] Build passes

---

### Slice B: FilterChip → Popover

**Files touched:**
- `src/components/FilterChip.tsx` — rewrite internals with shadcn Popover

**What changes:**
- Replace manual `useState(open)` + `useRef` + `document.addEventListener("mousedown")` with Popover + PopoverTrigger + PopoverContent
- Trigger button keeps existing `.filter-chip` / `.filter-chip-active` classes
- Dropdown becomes PopoverContent with `align="start"`, `sideOffset={4}`
- Remove manual click-outside `useEffect`
- Props unchanged — zero changes to consumer pages

**Acceptance:**
- [ ] All FilterChip instances work identically (Items, Events, Checkouts, Reservations, Notifications)
- [ ] Click outside closes
- [ ] Escape closes
- [ ] Build passes

---

### Slice C: StatusDot + BulkActionBar → Popover

**Files touched:**
- `src/app/(app)/items/page.tsx` — StatusDot and BulkActionBar sub-components

**StatusDot:**
- Replace manual hover popover with Popover + PopoverTrigger + PopoverContent
- Controlled open state with onMouseEnter/onMouseLeave
- PopoverContent: `side="right"`, `sideOffset={8}`
- Remove manual click-outside useEffect

**BulkActionBar:**
- Replace both custom popovers (Move location, Change category) with Popover
- Remove inline `style={{ position: "absolute", ... }}`
- PopoverContent: `align="end"`

**Acceptance:**
- [ ] StatusDot shows popover on hover with booking info
- [ ] BulkActionBar dropdowns open/close correctly
- [ ] No manual positioning code remains
- [ ] Build passes

---

### Slice D: BookingContextMenu → shadcn ContextMenu

**Files touched:**
- `src/components/booking-list/BookingContextMenu.tsx` — rewrite with ContextMenu primitives
- `src/components/BookingListPage.tsx` — wire ContextMenuTrigger on table rows

**What changes:**
- Wrap each booking row with `ContextMenu` + `ContextMenuTrigger`
- Replace fixed-position div with `ContextMenuContent`
- Menu items → `ContextMenuItem`, separators → `ContextMenuSeparator`
- Destructive items get `variant="destructive"`
- Remove manual handleContextMenu positioning (clientX/clientY)
- Remove manual click-outside and Escape listeners
- Mobile overflow button uses DropdownMenu (same items, click-triggered)

**Acceptance:**
- [ ] Right-click on booking row shows context menu
- [ ] All actions work (View, Edit, Extend, extras)
- [ ] Menu auto-positions near cursor
- [ ] Escape closes
- [ ] Mobile overflow button still works
- [ ] Build passes

---

### Slice E: Date Picker → Calendar + Popover

**Files touched:**
- `src/components/ui/date-time-picker.tsx` — new reusable component
- `src/components/booking-details/BookingEditForm.tsx` — replace datetime-local
- `src/components/booking-list/CreateBookingCard.tsx` — replace From/To datetime-local
- `src/app/(app)/reservations/[id]/page.tsx` — extend panel
- `src/app/(app)/checkouts/[id]/page.tsx` — extend panel

**DateTimePicker spec:**
- Popover trigger shows formatted date ("Mar 20, 2026 2:30 PM")
- PopoverContent: Calendar + time inputs (hour:minute, 15-min step)
- Props: `value: Date | undefined`, `onChange: (d: Date) => void`, `minDate?: Date`

**Acceptance:**
- [ ] Calendar renders in popover
- [ ] Time selection in 15-min increments
- [ ] All booking forms use DateTimePicker
- [ ] Extend panels respect minDate
- [ ] Build passes

---

### Slice F: Tooltips

**Files touched:**
- `src/app/(app)/layout.tsx` — add TooltipProvider
- `src/components/AppShell.tsx` — Notifications, Profile, Search icons
- `src/components/Sidebar.tsx` — Theme toggle buttons
- `src/app/(app)/items/page.tsx` — Favorites star, select-all checkbox

**What changes:**
- Add `TooltipProvider` wrapping app in layout
- Wrap icon-only buttons with Tooltip + TooltipTrigger + TooltipContent
- Replace `title="..."` attributes with Tooltip components
- Only on icon-only buttons with no visible label

**Acceptance:**
- [ ] Hovering icon buttons shows tooltip
- [ ] No duplicate title + Tooltip
- [ ] Build passes

---

## CSS Cleanup (fold into Slice 8)

After all slices, remove dead CSS:
- `.search-overlay*` (replaced by CommandDialog)
- `.popover`, `.popover-item` (replaced by Popover/ContextMenu)
- `.filter-chip-dropdown`, `.filter-chip-option*`, `.filter-chip-empty` (replaced by PopoverContent)
- Remaining manual `z-index: var(--z-dropdown)` inline styles
