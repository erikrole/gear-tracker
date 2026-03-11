# Dashboard V2 — Ops-First Split Layout with Countdown

**Created**: 2026-03-11
**Brief**: Rethink dashboard from chart-heavy reporting into an action-first split layout with live countdowns for due-back urgency.

---

## Design Vision

### Layout: Two-Column Split (Desktop)

```
┌─────────────────────────────────────────────────────────────────┐
│                        OVERDUE BANNER                           │
│  🔴 3 items overdue — View all                                  │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────────────┐
│   CHECKED OUT         5  │  │   IN MY POSSESSION            3  │
│                          │  │                                  │
│  ┌────────────────────┐  │  │  ┌────────────────────────────┐  │
│  │ Game Day Kit       │  │  │  │ ██ DUE BACK IN 4h 23m     │  │
│  │ Erik · Due 3/12    │  │  │  │ Canon R5 #CAM-001         │  │
│  │ 📦 4 items         │  │  │  │ Game Day Kit · Due 3/12   │  │
│  └────────────────────┘  │  │  └────────────────────────────┘  │
│  ┌────────────────────┐  │  │  ┌────────────────────────────┐  │
│  │ Practice Shoot     │  │  │  │ ██ DUE BACK IN 2d 6h      │  │
│  │ Maria · Due 3/14   │  │  │  │ 70-200mm f/2.8 #LENS-042  │  │
│  │ 📦 2 items         │  │  │  │ Practice Shoot · Due 3/14 │  │
│  └────────────────────┘  │  │  └────────────────────────────┘  │
│  View all →              │  │                                  │
│                          │  │                                  │
│──────────────────────────│  │──────────────────────────────────│
│   RESERVED            3  │  │   MY RESERVATIONS             2  │
│                          │  │                                  │
│  ┌────────────────────┐  │  │  ┌────────────────────────────┐  │
│  │ Spring Game Prep   │  │  │  │ Spring Game Prep           │  │
│  │ Erik · Mar 15–16   │  │  │  │ Mar 15 → Mar 16            │  │
│  │ 📦 6 items         │  │  │  │ 📦 6 items                 │  │
│  └────────────────────┘  │  │  └────────────────────────────┘  │
│  View all →              │  │                                  │
│                          │  │                                  │
│──────────────────────────│  │──────────────────────────────────│
│   UPCOMING EVENTS     4  │  │                                  │
│                          │  │                                  │
│  ┌────────────────────┐  │  │                                  │
│  │ 🏈 vs Ohio State   │  │  │                                  │
│  │ Mar 15 · Camp R.   │  │  │                                  │
│  └────────────────────┘  │  │                                  │
│  ┌────────────────────┐  │  │                                  │
│  │ 🏀 vs Michigan     │  │  │                                  │
│  │ Mar 17 · Kohl Ctr  │  │  │                                  │
│  └────────────────────┘  │  │                                  │
│  View all →              │  │                                  │
└──────────────────────────┘  └──────────────────────────────────┘
```

### Mobile: Stacks vertically
Priority order: Overdue banner → In My Possession → My Reservations → Reserved → Checked Out → Upcoming Events

---

## Key UX Decisions

### 1. Countdown Banner on "In My Possession" Items
- Items due back within 24 hours get a **bold red countdown bar** above the card: `DUE BACK IN 4h 23m`
- Items due back in 1–7 days show **amber** countdown: `DUE BACK IN 2d 6h`
- Items due back in >7 days show **green** due date only, no countdown
- Overdue items show **red pulsing**: `OVERDUE BY 3h 15m`
- Countdown updates live via `setInterval` (every 60 seconds)

### 2. Left Column: Global Operations View
- **Checked Out**: All OPEN checkouts across all users (all roles see all; students are read-only)
- **Reserved**: All BOOKED reservations across all users (all roles see all; students are read-only)
- **Upcoming Events**: Next 7 days of events from calendar sync
- Each section capped at 5 rows with "View all →" link
- Row click opens BookingDetailsSheet or event detail

### 3. Right Column: Personal Accountability
- **In My Possession**: Current user's OPEN checkouts → expanded to show individual items with per-item countdowns
- **My Reservations**: Current user's BOOKED reservations
- This column is the student's primary surface — what they have and when it's due

### 4. Overdue Banner (Full Width, Top)
- Only shows when overdue count > 0
- Red background, count + top 3 overdue item names
- Clicking opens checkouts list filtered to overdue

### 5. What Gets Removed
- Donut charts (Items by Status, Items by Location, Items by Category) → move to a future Reports page
- Stat pair cards → replaced by section headers with counts
- The dashboard becomes action-first, not reporting-first

---

## Data Requirements

### New API Shape: `GET /api/dashboard`

```typescript
type DashboardV2Data = {
  // Global sections (left column)
  checkouts: {
    total: number;
    overdue: number;
    items: BookingSummary[]; // top 5, ordered overdue-first then nearest due
  };
  reservations: {
    total: number;
    items: BookingSummary[]; // top 5, ordered by startsAt asc
  };
  upcomingEvents: EventSummary[]; // next 7 days, top 5

  // Personal sections (right column)
  myPossession: MyPossessionItem[]; // current user's checked-out items with due dates
  myReservations: BookingSummary[]; // current user's BOOKED reservations

  // Overdue banner
  overdueCount: number;
  topOverdueItems: { tagName: string; bookingTitle: string; overdueBy: string }[];
};

type BookingSummary = {
  id: string;
  title: string;
  requesterName: string;
  startsAt: string;
  endsAt: string;
  itemCount: number;
  status: string;
  isOverdue: boolean;
};

type MyPossessionItem = {
  assetId: string;
  tagName: string;
  bookingId: string;
  bookingTitle: string;
  endsAt: string; // client computes countdown from this
  isOverdue: boolean;
};

type EventSummary = {
  id: string;
  title: string;
  sportCode: string;
  startsAt: string;
  location: string;
};
```

### Query Strategy (Stay Under ~50 Cloudflare Subrequests)
1. Overdue count: 1 query
2. Top overdue items: 1 query (take 3, include serialized items)
3. All checkouts (top 5): 1 query
4. All reservations (top 5): 1 query
5. My checkouts with items: 1 query (include serializedItems → asset)
6. My reservations: 1 query
7. Upcoming events: 1 query
**Total: 7 queries** (well within limit)

---

## Slice Plan

### Slice 1: API + Data Layer
- [ ] Refactor `GET /api/dashboard` to return V2 shape
- [ ] Add `myPossession` query: current user's OPEN checkouts → join serializedItems → asset for tagName + endsAt
- [ ] Add `myReservations` query: current user's BOOKED reservations
- [ ] Add `upcomingEvents` query: events in next 7 days
- [ ] Keep backward-compatible: old fields can coexist during migration
- [ ] Verify total query count stays ≤ 10

### Slice 2: Layout + Left Column
- [ ] Replace 3-column chart grid with 2-column split layout
- [ ] Implement left column: Checked Out section, Reserved section, Upcoming Events section
- [ ] Each section: header with count badge, card list (max 5), "View all →" link
- [ ] Row click opens BookingDetailsSheet
- [ ] Remove donut charts and stat pair cards
- [ ] Mobile: stack columns vertically

### Slice 3: Right Column + Countdown
- [ ] Implement "In My Possession" section with per-item cards
- [ ] Implement countdown logic:
  - `useEffect` with `setInterval(60_000)` updating relative time strings
  - Color thresholds: red (<24h or overdue), amber (1–7d), green (>7d)
  - Bold countdown bar above each item card
- [ ] Implement "My Reservations" section
- [ ] Overdue items show `OVERDUE BY Xh Ym` in pulsing red

### Slice 4: Overdue Banner + Polish
- [ ] Full-width overdue banner at top (red, count + top 3 items)
- [ ] Click-through to checkouts list filtered to overdue
- [ ] Role-based visibility: students see only their own data in all sections
- [ ] Mobile layout validation against AREA_MOBILE.md
- [ ] Empty states for each section

---

## Role Behavior

| Section | Student | Staff/Admin |
|---|---|---|
| Checked Out (left) | All checkouts (read-only) | All checkouts |
| Reserved (left) | All reservations (read-only) | All reservations |
| Upcoming Events (left) | All events | All events |
| In My Possession (right) | Own items | Own items |
| My Reservations (right) | Own reservations | Own reservations |
| Overdue Banner | All overdue (read-only) | All overdue |

---

## Verification Criteria
- [ ] `npm run build` passes
- [ ] Countdown updates every 60 seconds without page reload
- [ ] Overdue items show red pulsing countdown
- [ ] <24h items show red countdown bar
- [ ] 1–7d items show amber countdown
- [ ] >7d items show green due date
- [ ] Mobile stacks correctly with personal sections first
- [ ] Student sees only own data in left column
- [ ] Staff sees all data in left column
- [ ] Empty states render for each section when no data
- [ ] Total API queries ≤ 10 per dashboard load
