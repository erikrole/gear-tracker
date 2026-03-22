# Booking Detail Page Visual Redesign

## Goal
Redesign the booking detail page to match Cheqroom's two-column layout with modern improvements. Ditch tabs entirely — single scrollable page with details + equipment side-by-side and history below.

## Reference (Cheqroom)
- Two-column: info details (left ~1/3) + equipment list (right ~2/3)
- Header: breadcrumb → big title → status + ref + live countdown → action buttons
- Standalone action buttons (Edit, Extend, Check-in) — not hidden in dropdown
- Equipment rows show item thumbnails
- No tabs — everything visible at once

## Slice Plan

### Slice 1: Layout + Header Redesign
**Files:** `BookingDetailPage.tsx`, `BookingInfoTab.tsx`, `BookingEquipmentTab.tsx`

- [ ] Remove all tab infrastructure (Tabs, TabsList, TabsTrigger, tab state, keyboard shortcuts)
- [ ] New layout: single scrollable page
  - Header section (title + badges + actions)
  - Two-column grid below: `grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6`
  - Info card (left column)
  - Equipment card (right column)
  - History section (full-width below)
- [ ] Header redesign:
  - Breadcrumb: `Home > Checkouts > CO-0009`
  - InlineTitle (keep existing)
  - Status strip: status badge + ref number (mono) + live countdown
  - Actions: promote Edit, Extend, Check-in to standalone buttons; keep Cancel/Duplicate in dropdown
- [ ] Live countdown component:
  - Shows "Due back in Xd Xh Xm" with a clock icon
  - Updates every 60s (reuse existing `formatCountdown` from `src/lib/format.ts`)
  - Shows "OVERDUE BY Xd Xh" in red when past due
  - Only visible for OPEN checkouts and BOOKED reservations
- [ ] On mobile (< lg): stack columns vertically (info card → equipment → history)

### Slice 2: Equipment Card with Thumbnails
**Files:** `BookingEquipmentTab.tsx`, `types.ts`, API route

- [ ] Add `imageUrl` to `SerializedItem.asset` in `types.ts`
- [ ] Update `GET /api/bookings/[id]` to include `imageUrl` in the asset select
- [ ] Equipment card header: "Equipment" title + item count + Scan button (for checkouts)
- [ ] Equipment rows:
  - 48x48 thumbnail (rounded, object-cover) with fallback icon placeholder
  - Tag name as primary label (bold, link to item detail)
  - Secondary line: serial number + brand/model in muted text
  - Quantity column on right (1 for serialized, N for bulk)
  - For checkouts: checkin checkbox + return status
- [ ] Keep existing search, bulk return controls, empty state

### Slice 3: History Section (Inline, No Tab)
**Files:** `BookingDetailPage.tsx`, `BookingHistoryTab.tsx`

- [ ] Move history below the two-column grid as a full-width section
- [ ] Collapsible by default (show latest 5 entries, "Show all X entries" button)
- [ ] Keep existing filter chips and entry rendering
- [ ] Card wrapping with "Activity" heading

### Slice 4: Polish + Responsive
- [ ] Verify mobile layout stacks correctly
- [ ] Dark mode check on all new elements
- [ ] Verify extend panel still works inline (position below header)
- [ ] Update AREA docs with new layout description
- [ ] `npm run build` clean

## Data Changes Required
1. `GET /api/bookings/[id]` — add `imageUrl` to asset select in serialized items query
2. `SerializedItem` type — add `imageUrl?: string | null` to asset shape

## No Schema Migration Needed
`imageUrl` already exists on Asset model. Just needs to be included in the API response.

## Out of Scope
- Attachments tab (not yet implemented, can add later as a section)
- Equipment selection/editing from detail page (that's the create/edit flow)
- Image upload from detail page (done on item detail page)
