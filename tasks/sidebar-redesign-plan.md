# Sidebar Redesign — Match Cheqroom

## Reference (Cheqroom sidebar)
- Dark navy background
- User avatar (circle) + name centered at **top**
- Clean nav items with outlined icons:
  1. Dashboard
  2. Calendar → maps to our `/events`
  3. Items
  4. Kits (new — stub page needed)
  5. Users
  6. Reservations
  7. Check-outs
  8. Settings
- "Log out" with arrow icon at **bottom**
- Active item: purple/blue full-width highlight
- No brand header, no location selector, no section labels

## Removed from nav
Scan, Labels, Import, Notifications, Reports, Profile (pages still exist, just not in sidebar)

## Changes Required

### 1. Sidebar.tsx
- [x] Move user avatar+name from footer to header (centered, larger)
- [x] Replace navItems array with 8 items above
- [x] Use outlined-style SVG icons matching Cheqroom aesthetic
- [x] Remove brand header ("W" / "Creative")
- [x] Remove location selector
- [x] Remove "Main" section label
- [x] Add Log out button at bottom (replaces footer user info)
- [x] Accept `onSignOut` prop for log out action

### 2. globals.css
- [x] Active nav item: purple/blue highlight (full width, rounded)
- [x] User avatar at top: larger circle, centered
- [x] Log out button styling at bottom
- [x] Remove dead styles: `.sidebar-brand-wrap`, `.w-logo`, `.sidebar-brand`, `.sidebar-location`
- [x] Refine spacing to match Cheqroom's clean look

### 3. AppShell.tsx
- [x] Pass `onSignOut` to Sidebar
- [x] Update bottom nav items to match new nav structure
- [x] Keep topbar but simplify (remove redundant profile/sign-out if sidebar handles it)

### 4. New: /kits page
- [x] Create minimal stub page at `src/app/(app)/kits/page.tsx`

### 5. Verify
- [ ] `npm run build` passes
- [ ] Desktop sidebar matches Cheqroom layout
- [ ] Mobile bottom nav works
- [ ] Log out works from sidebar
