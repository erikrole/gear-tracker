# Sidebar — Versioned Roadmap

**Target:** `src/components/Sidebar.tsx` + `src/components/AppShell.tsx`
**Created:** 2026-03-24
**Status:** V1 shipped (2026-03-24) — badges, nav groups, Notifications item

---

## Current State Assessment

### What exists today
- 11 nav items rendered as a flat list inside shadcn `Sidebar` with `collapsible="icon"`
- Role filtering: `STUDENT` hides `/users`, `/kits`, `/reports`, `/settings` at render time
- Mobile: shadcn Sheet drawer replaces old CSS-translate hack; `SidebarTrigger` at all breakpoints
- Bottom nav (mobile only): 5 hardcoded items (Dashboard, Items, Reservations, Checkouts, Scan)
- User profile header with avatar + name, links to `/users/{id}`
- Theme toggle (light/dark/system) with localStorage persistence
- Logout button

### What works well — keep in all versions
- Role-based filtering (correct; server validates too)
- Icon-only collapse with tooltips on desktop (`Cmd+B`)
- Mobile Sheet with animated drawer
- Active item: red left border (`--wi-red`) + opacity background
- Theme toggle in footer
- `SidebarMenuButton tooltip` prop auto-shows label when collapsed

### What's broken or missing today
- **No badges anywhere** — `SidebarMenuBadge` is installed but never used
- **Kits is a dead end** — GAP-10: empty page, nothing tells users it's unfinished
- **Reports is a dead end** — GAP-8: page exists, links to nothing useful
- **Navigation is a flat soup** — 11 items with no semantic grouping; admin items mixed with student items
- **Notifications not in sidebar** — bell icon lives only in the topbar header
- **AREA_MOBILE.md §4 not met** — "Badge counts can appear on Reservations and Check-outs for overdue or due-today urgency" — this is explicitly specced and currently absent

### Available shadcn primitives not yet used
| Primitive | Potential use |
|-----------|--------------|
| `SidebarMenuBadge` | Overdue count on Checkouts, unread on Notifications |
| `SidebarGroup` + `SidebarGroupLabel` | "Operations" / "Admin" sections |
| `SidebarMenuAction` | Quick-create button (+ icon) on Checkouts / Reservations |

### Data available but not surfaced
- `/api/dashboard` returns `stats.overdue`, `stats.dueToday`, `stats.checkedOut`, `stats.reserved`
- AppShell already fetches `/api/notifications?limit=0&unread=true` → `unreadCount`
- Both are in the shell before render — zero additional fetch needed for V1

---

## V1 — Badge Awareness + Dead-End Fix

**Principle:** The sidebar should never lie by omission. If something is urgent it appears here. If a page is empty it says so.

**Scope:** ~80 lines of changes. Zero new API routes. Zero schema changes.

### Features

**1. Overdue badge on Checkouts**
- AppShell already fetches unread notifications; add parallel fetch of `stats.overdue` from `/api/dashboard` (or reuse the nav-counts pattern below)
- Pass `overdueBadgeCount` to `AppSidebar`
- Render `<SidebarMenuBadge>` on the Checkouts item when `overdueBadgeCount > 0`
- Shown for all roles (STUDENT sees own overdue only — server already filters)
- In collapsed mode: badge stays visible next to icon (shadcn handles this)

**2. Notifications nav item with unread badge**
- Add Notifications to the nav item list (after Profile, before Settings threshold)
- `href: "/notifications"`, `icon: BellIcon`
- AppShell passes `unreadNotifications` to sidebar (already computed, line 50/65 of AppShell)
- Render `<SidebarMenuBadge>` when `unreadNotifications > 0`
- Hidden from STUDENT role via `STUDENT_HIDDEN_HREFS`? No — students get notifications too. Show for all.

**3. Kits "Coming soon" badge**
- Add `badge: "Soon"` property to the Kits navItem
- Render as a small muted `<SidebarMenuBadge>` on the item
- Tooltip: "Kit management is coming in Phase B" (via `SidebarMenuButton tooltip` prop)
- Does NOT block navigation to `/kits` — the kits page should show a placeholder card (separate GAP-10 fix)

### What's NOT in V1
- No navigation groups or labels
- No quick-create buttons
- No real-time polling (badges update on page load only)
- No keyboard shortcut hints

### API routes needed
- None new. AppShell can fetch `/api/dashboard` stats on mount (deduplicated with dashboard page fetch — they are separate requests, but lightweight).

### RBAC
- All roles see their own overdue badge count
- All roles see their own notification badge count
- STUDENT continues to see Notifications nav item (they receive assignment notifications)

### Loading/error/empty states
- Badges simply absent while loading (no flash of zero badge)
- On fetch error: badges stay hidden; no alert shown in sidebar

### Mobile behavior
- `SidebarMenuBadge` is visible in both expanded and collapsed icon-only modes
- Bottom nav does not get badges in V1 (separate concern, lower priority)
- Sheet drawer on mobile renders same badge as desktop

### shadcn components used
- `SidebarMenuBadge` (already installed, zero imports needed)

### Files changed
- `src/components/AppShell.tsx` — pass `overdueBadgeCount` and `unreadNotifications` as sidebar props
- `src/components/Sidebar.tsx` — add badge rendering to Checkouts and Notifications items; add "Soon" badge to Kits

---

## V2 — Grouped Navigation + Admin Clarity

**Principle:** The navigation should reflect how users think about their work, not how the database is organized.

**Scope:** ~150 lines. Zero schema changes. One optional CSS tweak.

### Features

**1. Semantic navigation groups** ✅ Shipped 2026-03-24

Reorganize 11 items into two groups using `SidebarGroup` + `SidebarGroupLabel`:

| Group | Items | Visible to |
|-------|-------|-----------|
| *(unlabeled, no header)* | Dashboard, Schedule, Items, Kits, Reservations, Checkouts, Scan | All roles |
| Admin | Users, Reports, Settings | ADMIN + STAFF only |
| Account | Notifications, Profile | All roles |

- STUDENT users see no "Admin" group at all (not just hidden items — the entire section is absent)
- Group labels appear in expanded mode only; hidden when collapsed (shadcn `SidebarGroupLabel` handles via `group-data-[collapsible=icon]:opacity-0`)
- Replaces the current `STUDENT_HIDDEN_HREFS` per-item filter; logic moves to group-level visibility

**2. Quick-create actions on Checkouts + Reservations** ✅ Shipped 2026-03-24

- Add `SidebarMenuAction` (hover-reveal + icon) to Checkouts and Reservations items
- Checkouts action: `href="/checkouts?create=true"` with `+` icon
- Reservations action: `href="/reservations?create=true"` with `+` icon
- On mobile: always visible (per `after:absolute after:-inset-2 md:after:hidden` in shadcn)
- Tooltip: "New checkout" / "New reservation"
- Accessible: ARIA label on the button

**3. Keyboard shortcut hints in tooltips**

- In collapsed icon mode, `SidebarMenuButton tooltip` already shows the label
- Extend tooltip content for key items: "Dashboard" → "Dashboard (Cmd+1)" etc.
- AppShell registers `Cmd+1` through `Cmd+5` for the top 5 nav items
- This is additive — existing Cmd+K and Cmd+B shortcuts unchanged

### What's NOT in V2
- No live polling / real-time counts
- No event context in header
- No location/sport filter in sidebar

### API routes needed
- None new.

### RBAC
- Admin group only renders for ADMIN + STAFF
- Quick-create buttons respect existing booking creation permissions (server validates)

### Files changed
- `src/components/Sidebar.tsx` — refactor navItems to navGroups structure; add `SidebarGroup`/`SidebarGroupLabel`; add `SidebarMenuAction` on Checkouts/Reservations
- `src/components/AppShell.tsx` — add keyboard shortcut listeners for Cmd+1–5

---

## V3 — Live Counts + Event Context

**Principle:** The sidebar knows where you're going before you click. It shows urgency in context, not just after you land.

**Scope:** ~200 lines + 1 new API endpoint. Zero schema changes.

### Features

**1. Live nav counts via `/api/nav-counts`**

New lightweight endpoint that returns:
```json
{
  "overdue": 3,
  "dueToday": 1,
  "reservedUpcoming": 5,
  "unreadNotifications": 2
}
```
- Computed from: `Booking` (status + endsAt), `Notification` (readAt)
- AppShell fetches on mount and re-fetches every 60s (matches existing `setNow` interval)
- Replaces the separate dashboard stats + notifications fetch
- Badges on: Checkouts (overdue + due today), Reservations (upcoming), Notifications (unread)
- STUDENT-scoped: server filters to requesting user's bookings

**2. Today's event context in SidebarHeader**

- Fetch next upcoming calendar event (from existing `/api/calendar-events`) in AppShell
- If an event is happening today or starting within 4 hours, show a compact "Game day" indicator in the sidebar header below the user profile
- Shows: event title, time, sport code badge
- Only shown when sidebar is expanded (collapsed mode hides it via `group-data-[collapsible=icon]:hidden`)
- Click navigates to `/events/{id}`
- Staff and admin only (not STUDENT — students don't own events)

**3. Bottom nav badge counts (mobile)**

- Extend the bottom nav items to accept `badge` counts
- Show red dot or count chip on Checkouts and Reservations bottom nav items
- Reuses the same `nav-counts` fetch that powers the sidebar badges
- Closes the gap between sidebar and bottom nav urgency signaling

### What's NOT in V3
- No drag-to-reorder nav items (not useful for this user base)
- No saved filter chip in sidebar (filter state lives on the page, not the nav)
- No inline booking creation within the sidebar drawer (too much surface area)

### API routes needed
- `GET /api/nav-counts` — new, read-only, fast. Queries: `Booking` count where `status IN ('OPEN','BOOKED') AND endsAt < now()`, `Notification` count where `readAt IS NULL AND userId = session.userId`

### Schema changes
- None. All data is computed from existing `Booking`, `Notification`, `CalendarEvent` models.

### Files changed
- `src/app/api/nav-counts/route.ts` — new endpoint
- `src/components/AppShell.tsx` — fetch nav-counts; pass event context; pass bottom-nav badges
- `src/components/Sidebar.tsx` — event context card in header
- CSS — bottom nav badge styling

---

## Dependencies

| Version | Requires | Shared components to extract |
|---------|----------|------------------------------|
| V1 | Nothing — all data already in AppShell | `navBadgeProp` pattern (reuse in V3) |
| V2 | V1 badges working first (groups will wrap them) | `navGroups` config object (reuse for keyboard shortcuts) |
| V3 | V2 groups structure; V1 badge wiring | `/api/nav-counts` can be reused by dashboard |

---

## Risks

**Scope creep into V1:**
- "Add a search box to the sidebar" — defer to V3 or never. Cmd+K already exists.
- "Add notification bell to sidebar header" — moving the bell is a redesign; in V1 just add the nav item.

**V2 YAGNI:**
- Keyboard shortcuts for nav items (Cmd+1–5) — if users never use Cmd+B, they won't use Cmd+1 either. Validate before building.
- Secondary action menus (not just buttons) on nav items — `SidebarMenuAction` as a single link is fine; don't add dropdown menus here.

**V3 scope traps:**
- "Game day mode" as a distinct sidebar skin — too much. The event context card is enough.
- Real-time WebSocket push for badge counts — polling every 60s is fine for this team size. WebSockets add infrastructure complexity for marginal gain.

**Coupling risk:**
- V3's `/api/nav-counts` must not become the "one endpoint that does too much." Keep it tiny: counts only, no booking data, no item data.

---

## Build Order (within each version)

**V1:**
1. Add `overdueBadgeCount` + `unreadNotifications` props to Sidebar (types)
2. AppShell passes both (already has unread; add overdue fetch)
3. Render `SidebarMenuBadge` on Checkouts, Notifications items
4. Add "Soon" badge to Kits item
5. Verify collapsed mode — badges visible in icon-only state

**V2:**
1. Define `navGroups` array replacing flat `navItems`
2. Render `SidebarGroup` + `SidebarGroupLabel` with group-level RBAC
3. Add `SidebarMenuAction` to Checkouts and Reservations
4. Add AppShell keyboard shortcuts (Cmd+1–5)
5. Verify STUDENT sees no Admin group

**V3:**
1. `GET /api/nav-counts` route (10-minute task)
2. AppShell: replace dual fetch with single nav-counts fetch; add event fetch
3. Sidebar: event context card in header (collapsed-hidden)
4. Bottom nav: accept + render badge counts
5. 60s polling with cleanup on unmount

---

## North Star Alignment

| Principle | V1 | V2 | V3 |
|-----------|----|----|-----|
| Operational speed | ✅ Overdue visible without navigating | ✅ Quick-create in 1 click | ✅ Counts without opening page |
| Mobile-first | ✅ Sheet drawer badges work | ✅ MenuAction always visible mobile | ✅ Bottom nav badges |
| Student-first | ✅ Own overdue; admin items still hidden | ✅ Admin group fully hidden | ✅ Counts scoped to own bookings |
| Audit trail | N/A | N/A | N/A (sidebar is read-only) |
| Derived status | ✅ Counts computed, not stored | ✅ No status field written | ✅ `/api/nav-counts` is computed |
