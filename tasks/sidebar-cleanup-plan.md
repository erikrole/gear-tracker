# Sidebar & Navigation Cleanup Plan

## Current State Analysis

### Problems
1. **Flat nav list (13 items)** — Everything is in one "Main" section with no grouping. Dashboard, Scan, Items, Reservations, Check-outs, Events, Labels, Import, Notifications, Reports, Users, Settings, Profile. That's a lot of scrolling for a sidebar.
2. **Duplicate SVG icons** — Same icons are defined inline in both `Sidebar.tsx` and `AppShell.tsx` (bottom nav). 5 icons are duplicated.
3. **Hardcoded brand** — "W" logo and "Creative" brand name are hardcoded. Not configurable.
4. **Location selector is a dead dropdown** — Only option is "All locations" with `defaultValue="all"`. Non-functional.
5. **Topbar search is non-functional** — Plain `<input>` with no `onChange`, no handler, does nothing.
6. **Topbar has redundant Profile link** — Profile is both in the topbar actions AND the sidebar footer AND as a nav item.
7. **Bottom nav has no Reservations** — Mobile bottom nav: Home, Scan, Items, Checkouts, More. Reservations (a primary workflow) is hidden behind "More".
8. **No visual grouping** — Admin/utility pages (Import, Labels, Users, Settings) are mixed in with primary workflow pages.
9. **No collapsed/compact sidebar option** — Fixed 240px width always.
10. **Notification badge is inline-styled** — Should use CSS class.

### Good Things to Keep
- Dark sidebar color scheme works well
- Active state with accent border-left is clear
- Mobile slide-out pattern is correct
- Bottom nav with "More" overflow is a solid mobile pattern

---

## Proposed Improvements

### Slice 1: Group nav items into sections
Reorganize the flat list into logical groups:
- **Workflow**: Dashboard, Scan, Items, Reservations, Check-outs
- **Planning**: Events
- **Admin**: Labels, Import, Reports, Users, Settings
- Remove Profile from nav list (it's already in sidebar footer + topbar)
- Remove Notifications from nav list (move to topbar bell icon)

### Slice 2: Extract shared icon system
- Create `src/components/icons.tsx` with named icon components
- Replace all inline SVGs in Sidebar + AppShell with icon imports
- Eliminates duplication and makes icons reusable

### Slice 3: Fix the topbar
- Remove dead search input (or wire it up to global search later)
- Add notification bell icon with badge count to topbar
- Remove redundant Profile text link (sidebar footer handles it)
- Keep Sign out button
- Result: topbar becomes `[hamburger] [spacer] [bell] [sign out]`

### Slice 4: Remove dead location selector
- The sidebar location dropdown only has "All locations" and does nothing
- Remove it until location filtering is actually implemented
- Frees up vertical space

### Slice 5: Add sidebar collapse (desktop)
- Add a collapse toggle button at bottom of sidebar
- Collapsed state: show only icons (56px width) with tooltips
- Persist state in localStorage
- Update CSS variable `--sidebar-width` dynamically

### Slice 6: Improve mobile bottom nav
- Replace "Checkouts" with "Reservations" (or make it configurable)
- Actually, keep current 5 items but swap to: Home, Scan, Items, Reservations, More
- Checkouts accessible via "More" since it's less frequent than reservations

### Slice 7: Notification badge CSS class
- Move inline notification badge styles to a `.nav-badge` CSS class
- Apply consistently in sidebar and topbar bell

---

## Implementation Priority

| # | Slice | Impact | Effort |
|---|-------|--------|--------|
| 1 | Group nav sections | High | Low |
| 2 | Extract icons | Medium | Medium |
| 3 | Fix topbar | High | Low |
| 4 | Remove dead location selector | Low | Trivial |
| 5 | Sidebar collapse | Medium | Medium |
| 6 | Improve mobile bottom nav | Medium | Low |
| 7 | Notification badge CSS | Low | Trivial |

**Recommended order**: 4 → 1 → 3 → 7 → 6 → 2 → 5

Slices 4, 1, 3 are quick wins with high impact. Slice 5 (collapse) is the most involved but nice-to-have.
