# Dashboard UI Pass — Plan

## Overview
Comprehensive dashboard polish: sidebar, topbar, stat cards, booking rows, and upcoming events.

---

## Slice 1: Sidebar & Topbar Fixes (no API changes)

### Sidebar
- **Hide Scan on desktop**: Add `scan-nav-only` class, hide via `@media (min-width: 769px)` — keep visible on iPad/mobile
- **Add Profile nav item**: Insert above Settings with UserIcon, links to `/profile`
- **Theme picker → ToggleGroup**: Replace emoji cycle button with horizontal shadcn `ToggleGroup` using `SunIcon`, `MoonIcon`, `MonitorIcon` from lucide-react. Three buttons in a row, selected state highlighted.
- **Avatar click → /profile**: Wrap sidebar avatar in `<Link href="/profile">`

### Topbar
- **Duplicate search indicators**: The desktop search bar (`topbar-search-desktop`) has a `SearchIcon` inside it AND the text "Search... (⌘K)". The right-side also shows a mobile search button. Looking at the screenshot, there are TWO magnifying glass icons visible — one at left of search bar, one at right. Fix: remove the trailing search icon (or it may be the mobile button leaking into desktop layout).
- **Remove underline on hover**: The "New checkout" / "New reservation" buttons and the top-right icon buttons — add `text-decoration: none` / ensure no underline on hover. These are `<Link>` tags wrapping shadcn `<Button>`, so the underline comes from the `<a>` tag default or CSS.
- **Notification/profile buttons**: Already shadcn `Button variant="ghost"`. Confirm no underline.

### Stat cards
- **Hover tint**: Add `background-color` transition on `.stat-card:hover` — subtle tint that complements the existing shadow hover effect.

---

## Slice 2: Dashboard API — Add Item Images & Event Shift Data

### Booking rows — add `items` array with images
Current response has `itemCount` (number). Extend to also include:
```ts
items: Array<{
  id: string;
  name: string;
  imageUrl: string | null;
}>  // first 3 serializedItems with asset details
```

Query: Join `serializedItems` → `asset` and select `id`, `name`, `imageUrl`. Take first 3.

Apply to: `myCheckouts.items`, `myReservations`, `teamCheckouts.items`, `teamReservations.items`

### Booking rows — add requester avatar initial
Current response has `requesterName` (string). Also add:
```ts
requesterInitials: string  // first letter(s) of name
```

### Upcoming events — add shift assignments
Current response has no shift data per event. Add:
```ts
shifts: Array<{
  id: string;
  userName: string;
  userInitials: string;
}>
totalShiftSlots: number  // total slots in the shift group
```

Query chain: `CalendarEvent.shiftGroup` → `ShiftGroup.shifts` → `Shift.assignments` → `ShiftAssignment.user`
- Collect all assigned users (status = DIRECT_ASSIGNED or APPROVED)
- `totalShiftSlots`: count of Shift records in the ShiftGroup (represents total slots)
- Return unique assigned users

---

## Slice 3: Checkout/Reservation Row Redesign

### New row layout (My Gear + Team Activity sections):
```
┌─────────────────────────────────────────────────────┐
│ [ref] Title                          [img][img][+N] │
│ Event · Venue  (smaller, muted)                     │
│ [avatar] User Name · 3 items                        │
└─────────────────────────────────────────────────────┘
```

**Top line**: `refNumber` + `title` (bold) — right side: stacked gear avatars
**Middle line** (if event data available): Event title · venue — smaller text, lower opacity
**Bottom line**: Small user avatar circle (initials) + user name + "N items"

**Gear avatars** (right side):
- Show up to 3 small circular thumbnails (32px) with slight overlap (-8px margin)
- If item has `imageUrl`, show image; else show initials circle
- If `itemCount > 3`, show "+N" overflow circle
- Use `object-cover` for images, rounded-full

**Note**: "My checkouts" rows don't need user avatar (it's you), but team rows do. The event subtext line only shows if the booking title suggests an event (the API currently doesn't return event data for bookings — we may need to add `eventTitle` to the API response, or parse from the title which often contains "vs opponent").

### Decision: Event subtext
The booking title IS the event info (e.g. "MBB vs High Point"). The user wants:
- Top line: ref + title (normal weight)
- Subtext below: venue/location (smaller, muted) — but we don't have venue in the booking summary response

**Revised approach**: Add `locationName` to booking summary API response. Show it as subtext if present. The title already contains event info.

Actually, re-reading the user's request: "Top line: Men's Basketball vs High Point Kohl Center (smaller and less opacity, subtext)". They want the EVENT info as the subtext, and presumably the booking ref/purpose as the main line... but the title IS the event. Let me re-read.

Looking at the screenshot: `CO-0008  MBB vs High Point  1 item`. The user wants:
- The event detail line ("Men's Basketball vs High Point  Kohl Center") to be **smaller and lower opacity** — as subtext
- The bottom line: user avatar + username + item count

So the layout is:
```
CO-0008                                    [img][img][+N]
MBB vs High Point · Kohl Center (small, muted)
[avatar] Erik Role · 1 item
```

This means we need the booking's associated **location name** from the API. Add `locationName` to the booking summary.

---

## Slice 4: Upcoming Events — Stacked User Avatars

### Layout change:
```
┌──────────────────────────────────────────────────────┐
│ [sport] vs Opponent                    [@@][@@][ ] A │
│ Mar 20, 4:00 – 6:00 PM · Venue                      │
└──────────────────────────────────────────────────────┘
```

**Right side**: Stacked avatar circles for shift assignments
- Filled circles with initials = assigned users
- Empty/dashed circles = unfilled shift slots
- Total circle count = `totalShiftSlots` (number of shifts in the group)
- Show up to ~5, then "+N" overflow

Keep existing Home/Away badge, just add the avatars before it.

---

## Implementation Order
1. Slice 1: Sidebar, topbar, stat cards (pure CSS/component, no API)
2. Slice 2: API changes (add item images, event shifts, location name)
3. Slice 3: Booking row redesign (depends on slice 2 API data)
4. Slice 4: Event shift avatars (depends on slice 2 API data)
5. Build + commit + push

---

## Files to Modify
- `src/components/Sidebar.tsx` — avatar link, nav items, theme picker
- `src/components/AppShell.tsx` — search bar cleanup, button hover
- `src/app/globals.css` — stat card hover, sidebar scan hide, search fix, row styles
- `src/app/api/dashboard/route.ts` — add item images, shifts, locationName
- `src/app/(app)/page.tsx` — row redesign, event avatars
