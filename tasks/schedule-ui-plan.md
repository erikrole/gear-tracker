# Schedule UI Polish Plan

> Generated 2026-04-04 from visual audit (5 screenshots) + code-level audit.

## Identified Issues (from screenshots + code)

### P0 — Broken / Misleading

1. **Premier toggle is unstyled** (Screenshot 3)
   - Shows raw "No [Toggle]" button with no visual treatment
   - Should be a proper Switch component with label
   - File: `ShiftDetailPanel.tsx` ~line 329-339

2. **`text-secondary` class doesn't exist** (TradeBoard)
   - Used 4+ times — renders as unstyled/invisible text in dark mode
   - Files: `TradeBoard.tsx` lines 239, 271, 282, 357
   - Fix: Replace with `text-muted-foreground`

3. **Zero-count gear badges are visual noise** (Screenshot 2)
   - "0 Draft", "0 Reserved", "0 Checked out", "0 Returned" shown when all are 0
   - No useful information — just clutter
   - File: `ShiftCoverageCard.tsx` ~line 62-75
   - Fix: Hide badges when count is 0, or hide entire row when all zero

### P1 — UX Clarity

4. **"ST" abbreviation shown everywhere** (Screenshots 1, 2, 3)
   - List view shift rows: "ST · Video" — "ST" means nothing to new users
   - Event detail TYPE column: just "ST"
   - ShiftDetailPanel: "Student" label (correct here)
   - Fix: Show "Student" everywhere, or at minimum show full word in tables

5. **My Hours strip looks disconnected** (Screenshots 1, 4, 5)
   - Floating text with no visual container, feels bolted-on
   - `-mb-1` negative margin hack
   - No shadcn component used
   - File: `schedule/page.tsx` ~line 76-96
   - Fix: Lighter treatment — smaller text, integrated into header area, or subtle Card

6. **Coverage representation differs across views**
   - List view: Badge component with "0/4" text (Screenshot 1) ✓
   - Week view: Tiny colored dot + "0/4" text (Screenshot 4)
   - Calendar view: Colored event bars, no coverage numbers at all (Screenshot 5)
   - Fix: Add coverage fraction to calendar event labels; unify dot style

7. **Sport column uses hardcoded colors** (Screenshot 1)
   - "Men's Tennis" in red, "Softball" in orange, "Men's Soccer" in green
   - These are hardcoded per-sport, not theme tokens
   - Fix: Use a consistent Badge or theme-aware color mapping

### P2 — Polish & Consistency

8. **Touch targets too small on mobile**
   - Approve/Decline buttons: `h-5 px-1.5 text-[10px]` (20px height)
   - Premier toggle: `h-5` 
   - Add Shift button: `h-6 px-1.5`
   - UserAvatarPicker input: `h-8 text-xs`
   - Fix: Minimum `h-8` for all interactive elements

9. **TradeBoard inline styles bypass design system**
   - `style={{ fontSize: "var(--text-3xs)" }}` on action buttons
   - `border-[var(--border-light)]` hardcoded CSS var
   - `flex-between` utility may not exist
   - Fix: Replace with Tailwind classes and Button size props

10. **Event detail action buttons don't stack on mobile** (Screenshot 2)
    - "Checkout to this event" + "Reserve gear..." side-by-side
    - Will overflow on phones
    - Fix: `flex-col sm:flex-row`

11. **Empty states inconsistent**
    - ListView: Professional EmptyState component
    - WeekView: Plain "No events this week" text
    - CalendarView: No empty state
    - TradeBoard: EmptyState component
    - Fix: Use EmptyState component in all views

12. **Calendar view hardcoded event colors** (Screenshot 5)
    - Green/red/orange bars use raw CSS with `rgba()` values
    - Not theme-aware, won't work in dark mode
    - File: `globals.css` ~line 1048-1080
    - Fix: Replace with Tailwind `bg-green-50/80` etc.

13. **Badge sizing inconsistent across views**
    - WeekView: hardcoded `text-[10px] px-1.5 py-0`
    - ListView: shadcn `size="sm"`
    - Fix: Use `size="sm"` consistently

14. **ShiftDetailPanel metadata grid could be cleaner** (Screenshot 3)
    - Date/Time/Sport/Premier in a plain grid
    - Premier row especially feels unpolished
    - Fix: Clean up with consistent label/value styling, proper Switch for premier

15. **Loading states inconsistent**
    - TradeBoard: SkeletonTable ✓
    - ShiftDetailPanel: "Loading shift details..." plain text
    - UserAvatarPicker: "Loading users..." plain text
    - Fix: Add Spinner or Skeleton to panels

---

## Implementation Order

### Slice 1: Design System Fixes (broken things)
- [ ] Fix Premier toggle → Switch component
- [ ] Fix `text-secondary` → `text-muted-foreground` in TradeBoard
- [ ] Fix TradeBoard inline styles → Tailwind classes
- [ ] Fix `flex-between` → `flex justify-between`
- [ ] Fix `border-[var(--border-light)]` → `border-border`

### Slice 2: UX Clarity
- [ ] Hide zero-count gear badges on event detail
- [ ] "ST" → "Student" / "FT" → "Staff" in all visible labels
- [ ] Polish My Hours strip (lighter, integrated)
- [ ] Stack event detail action buttons on mobile

### Slice 3: Touch Targets & Mobile
- [ ] Increase all interactive elements to min `h-8`
- [ ] Fix UserAvatarPicker popover width for mobile
- [ ] Fix TradeBoard filter flex-nowrap on mobile

### Slice 4: Consistency Pass
- [ ] Unify empty states (EmptyState component everywhere)
- [ ] Unify badge sizing across views
- [ ] Add loading spinners to ShiftDetailPanel and UserAvatarPicker
- [ ] Clean up ShiftDetailPanel metadata grid

### Slice 5: Theme Colors
- [ ] Replace calendar view hardcoded event colors with Tailwind tokens
- [ ] Replace sport column hardcoded colors with theme-aware mapping
- [ ] Replace ShiftSlotCard hardcoded green borders with theme tokens
