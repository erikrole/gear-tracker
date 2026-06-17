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

### Slice 1: Design System Fixes (broken things) ✅
- [x] Fix Premier toggle → Switch component
- [x] Fix `text-secondary` → `text-muted-foreground` in TradeBoard
- [x] Fix TradeBoard inline styles → Tailwind classes
- [x] Fix `flex-between` → `flex items-center justify-between`
- [x] Fix `border-[var(--border-light)]` → `border-border`

### Slice 2: UX Clarity ✅
- [x] Hide zero-count gear badges on event detail
- [x] "ST" → "Student" / "FT" → "Staff" in all visible labels
- [x] Polish My Hours strip (lighter, integrated)
- [x] Stack event detail action buttons on mobile

### Slice 3: Touch Targets & Mobile ✅
- [x] Increase all interactive elements to min `h-7`
- [ ] Fix UserAvatarPicker popover width for mobile
- [ ] Fix TradeBoard filter flex-nowrap on mobile

### Slice 4: Consistency Pass
- [x] Unify coverage indicator across views — shared `_components/Coverage.tsx`
      (`CoverageTag` dot+fraction for Calendar, `CoverageMeter` bar+fraction for
      Week/List). Calendar chips now show the filled/total fraction (was a bare
      dot), closing audit item #6 and adding density. (2026-06-16)
- [x] List view coverage consolidated onto shared `CoverageBadge` (removed the
      local `CoveragePill`; mobile + desktop rows now identical). (2026-06-16)
- [x] Filters density: the "Needs staff" command-bar button now shows the
      uncovered-event count inline (was computed only for border color). (2026-06-16)
- [ ] Unify empty states (EmptyState component everywhere; WeekView inner "No events" still plain text)
- [ ] Unify badge sizing across views
- [ ] Add loading spinners to ShiftDetailPanel and UserAvatarPicker
- [ ] Clean up ShiftDetailPanel metadata grid

### iOS (Apple-simple pass) — 2026-06-16
- Assessment: `ScheduleView.swift` is already close to target — native `List`/
  sections, `ContentUnavailableView`, `.refreshable`, `FilterChip`, sensory
  feedback, and a coverage chip that already uses `filled/total` + green/orange/
  red (the same family vocabulary as web). No forced re-skin needed.
- [x] Dropped the redundant "View" label before the segmented switcher (matches
      Apple's unlabeled Day/Week/Month pattern).
- [x] From-device review (2 screenshots): fixed near-invisible filter chips —
      unselected `FilterChip` (Brand.swift) used a translucent `.regularMaterial`
      with no border and dissolved into the grouped background; now a defined
      `secondarySystemBackground` fill + hairline so it reads as a tappable pill.
- [x] Event detail crew: suppressed the per-row Student/Staff badge when an area
      block is a single worker type (shown once on the area header instead), so an
      all-staff crew is no longer a column of identical "Staff" pills.
- [x] Event detail crew: added `UserAvatarView` photo avatars (28pt, initials
      fallback) to each assigned crew row; open slots get a dashed placeholder so
      rows stay aligned.
- [x] List spacing: the big gaps between date groups came from `Brand.Space.lg`
      header top padding stacked on the default plain-list section gap. Reduced
      header top padding to `.sm` and added `.listSectionSpacing(.compact)` to the
      list so date groups sit closer together.
- [x] Event card cleanup (HIG pass): removed the redundant venue line from list
      rows (it was "Camp Randall" on a home event; still on the detail sheet and
      in the VoiceOver label), and added a trailing disclosure chevron since the
      row opens the detail sheet (HIG: navigable rows carry a disclosure indicator).

### all-day / multi-day UTC fix — VERIFIED
- Root cause: iOS read all-day spans with the device's **local** calendar, then
  derived the inclusive end from `endsAt - 1 second`. That still breaks live manual
  all-day events stored as Central-midnight encoded boundaries (`05:00Z` during
  daylight time): Lambeau Field Visit (`2026-06-17T05:00Z` to
  `2026-06-18T05:00Z`) incorrectly became a two-day event on a Pacific simulator.
- Fix (`ScheduleModels.swift`): all-day spans now derive `spanStartDay` and
  `spanEndDay` from encoded calendar days, subtracting one day from the exclusive
  end day instead of subtracting one second from the raw end instant. Timed events
  still use local calendar display days, and `hasLocalMidnightSpan` stays guarded
  to timed events only.
- Simulator verification complete: on an `America/Los_Angeles` iPhone 16 simulator,
  Lambeau Field Visit renders once on Wednesday, June 17 with `All day` and no
  `Day 1/2`; Football Media Day renders on July 7 and July 8 with `Day 1 of 2` and
  `Day 2 of 2`.
- Unit tests added: `ios/WisconsinTests/ScheduleDateMathTests.swift` (Swift Testing)
  pin `NSTimeZone.default` to Pacific/UTC/Tokyo and assert Central-midnight encoded
  single-day all-day events are not multi-day, real multi-day spans land on the
  right local days, the result is timezone-independent, and timed events still use
  the local calendar. NEW iOS test target `WisconsinTests` + a `Wisconsin` scheme
  test action added to `ios/project.yml` - run `cd ios && xcodegen generate` to
  pick them up, then `xcodebuild test` (or Command-U).

### Event card type pass (HIG 17/15)
- [x] Title bumped to 17pt (`.body.weight(.semibold)`); home/away + time aligned to
      a single 15pt secondary line with a `·` separator. Trailing chevron + venue
      removal from the earlier slice round it out.

### Schedule from-device feedback round 2
- [x] My-shift signal moved from text → an **accent card stroke** (1.5pt). The left
      rail now always encodes venue (home=green/away=orange/neutral=gray) instead of
      double-dutying as the my-shift color. "My shift" text removed from the meta line.
- [x] Header deadspace: switched to `.navigationBarTitleDisplayMode(.inline)` so the
      tall empty large-title band on this pushed view collapses and content rises.
- [x] Added a **Neutral** venue filter chip (mirrors the web's Home/Away/Neutral);
      filters `isHome == nil`.
- [x] Date badge redesigned to an Apple-Calendar agenda tile: weekday over the day
      number with today's number in a brand circle — dropped the heavy filled box.
- [x] Trade Board icon `arrow.triangle.2.circlepath` (read as "refresh") →
      `arrow.left.arrow.right` (reads as exchange/trade).
- CONFIRMED bug + fix: all-day event spans must be interpreted as exclusive encoded
  calendar-day boundaries, not raw elapsed time windows. Lambeau showing on June 18
  was the live proof that subtracting one second from `endsAt` is the wrong model
  for Central-midnight encoded manual events.

### Event card declutter ("way too much going on" — from-device feedback)
- [x] The title row was fighting a Day-n/m pill + coverage chip + My-Shift pill +
      chevron, and the 17pt title wrapped into them. Rebuilt: title alone on top,
      then ONE quiet `metaLine` (home/away · time · "Day n of m" · "My shift"),
      with only the coverage chip + chevron trailing. "My shift" is now quiet accent
      text (the red status rail already signals it); "Day n of m" is quiet purple
      text instead of a filled pill.
- [x] Dropped the dense CALL/EVENT/END `TimeBlock` cluster from list rows (call
      times live on the detail sheet). Removed now-dead `TimeBlock` + `WeatherBadge`
      structs and the per-row weather fetch (it only fed the a11y label after the
      badge was gone — one network call per row for no visible payoff; weather still
      shows on the detail sheet).
- [ ] Deferred (needs a simulator build in the loop — cannot compile iOS in this
      env): consolidate the split filter rows (My shifts/Past in the strip vs
      Home-Away/Sport inside the list section) into one persistent strip; consider
      flatter native row styling vs the current shadowed cards; extract sections
      (`EventRow`, `ScheduleCalendarView`, `DayCell`, etc.) into their own files.

### Slice 5: Theme Colors
- [ ] Replace calendar view hardcoded event colors with Tailwind tokens
- [ ] Replace sport column hardcoded colors with theme-aware mapping
- [ ] Replace ShiftSlotCard hardcoded green borders with theme tokens
