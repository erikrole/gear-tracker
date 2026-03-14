# Bulk Item Tracking — Numbered Units

## Problem
We have items like batteries (40+), chargers, etc. that:
- Don't warrant individual QR codes (too many, too small)
- **Do** need individual identity for loss tracking ("Battery #7 is missing")
- Currently fall through the cracks: serialized is overkill, bulk is too anonymous

## Solution: Numbered Bulk Items
A `BulkSku` with `trackByNumber: true` gets a set of numbered units (1–N). One QR code on the bin, but each unit has a number physically labeled on it. During checkout/check-in, staff selects *which* numbers they're taking/returning.

---

## Slice Plan

### Slice 1: Schema & Migration ✅
- [x] Add `trackByNumber` boolean to `BulkSku` (default `false`)
- [x] Create `BulkSkuUnit` model:
  ```
  BulkSkuUnit {
    id            String   @id @default(cuid())
    bulkSkuId     String
    unitNumber    Int
    status        BulkUnitStatus  (AVAILABLE, CHECKED_OUT, LOST, RETIRED)
    notes         String?
    createdAt     DateTime
    updatedAt     DateTime

    @@unique([bulkSkuId, unitNumber])
  }
  ```
- [x] Create `BookingBulkUnitAllocation` model (links specific units to bookings):
  ```
  BookingBulkUnitAllocation {
    id                String   @id @default(cuid())
    bookingBulkItemId String
    bulkSkuUnitId     String
    phase             AllocationPhase (CHECKED_OUT, CHECKED_IN)
    createdAt         DateTime

    @@unique([bookingBulkItemId, bulkSkuUnitId])
  }
  ```
- [x] Add relation from `BulkSku` → `BulkSkuUnit[]`
- [x] Add relation from `BookingBulkItem` → `BookingBulkUnitAllocation[]`
- [x] Generate and apply migration
- [x] Validate with `npm run build`

### Slice 2: API / Service Layer ✅
- [x] **Create units on BulkSku creation** — when `trackByNumber: true` and quantity > 0, auto-create `BulkSkuUnit` rows 1..N
- [x] **Add units endpoint** — `GET/POST /api/bulk-skus/[id]/units` to list and add more units
- [x] **Retire/mark lost endpoint** — `PATCH /api/bulk-skus/[id]/units/[unitNumber]` to change unit status
- [x] **Update scan service** — when scanning a numbered-bulk QR during checkout:
  - Records *which* unit numbers via `BookingBulkUnitAllocation`
  - Unit status transitions: AVAILABLE → CHECKED_OUT on checkout, CHECKED_OUT → AVAILABLE on check-in
  - Validates unit availability/status before allocation
- [x] **Update completion logic** — `buildScanCompletionState()` reports specific outstanding unit numbers during check-in
- [x] Audit log entries for unit status changes
- [x] Validate with `npm run build`

### Slice 3: UI — Bulk Inventory & Item Detail
- [ ] **Create form** — add "Track by number" toggle to bulk SKU creation form
  - When enabled: initial quantity creates numbered units 1..N
  - Show preview: "This will create units #1 through #40"
- [ ] **Bulk SKU detail view** — new "Units" section/tab:
  - Grid of numbered units with status dots (green=available, red=checked out, orange=lost, gray=retired)
  - Click unit → popover with: current booking (if checked out), notes, mark lost/retire actions
  - "Add more units" button (appends next N numbers)
- [ ] **Bulk inventory table** — show unit breakdown for numbered items:
  - e.g., "38/40 available · 1 checked out · 1 lost"
- [ ] Validate with `npm run build`

### Slice 4: UI — Scan Flow (Checkout & Check-in)
- [ ] **Checkout scan** — when scanning a numbered-bulk QR:
  - Show unit number picker instead of plain quantity input
  - Options: number pad for individual entry, range selector ("1–10"), or multi-select grid
  - Selected units get allocated to the booking
  - Progress shows: "Batteries: 10/10 units selected" with unit numbers listed
- [ ] **Check-in scan** — when scanning a numbered-bulk QR:
  - Show which units were checked out on this booking
  - Staff confirms which came back (pre-checked, uncheck missing ones)
  - Missing units flagged: "Battery #12 not returned — mark as lost?"
- [ ] **Scan completion state** — numbered items show specific missing unit numbers, not just a count
- [ ] Validate with `npm run build`

### Slice 5: Hardening & Docs
- [ ] Edge cases:
  - Checkout conflicts: unit already checked out on another booking → clear error
  - Retiring a checked-out unit → require check-in first
  - Deleting a numbered BulkSku → cascade delete units
  - Converting existing quantity-only BulkSku to numbered → generate units from current quantity
- [ ] Update `docs/AREA_ITEMS.md` with numbered bulk tracking docs
- [ ] Update `docs/DECISIONS.md` with D-0XX: Numbered Bulk Items decision
- [ ] Update `docs/GAPS_AND_RISKS.md` to close this gap
- [ ] Move plan to `tasks/archive/`

---

## Key Design Decisions

### Why extend BulkSku instead of a third item type?
- Numbered bulk items share 90% of BulkSku behavior (bin QR, category, location, quantity concepts)
- Adding a third type would fork the equipment picker, scan flow, and booking models
- A boolean flag (`trackByNumber`) cleanly branches only where behavior differs

### Unit number assignment
- Auto-increment starting at 1
- Numbers are permanent — retiring unit #7 doesn't renumber #8-40
- "Add more" appends from max+1
- Physical labels on items must match (user responsibility)

### Status derivation for units
- Unlike serialized assets (D-001), unit status IS stored directly on `BulkSkuUnit`
- Rationale: units don't have the full allocation time-window model; they're simpler
- Status transitions are explicit and audited via `BookingBulkUnitAllocation` records

### Scan UX
- Single QR scan → unit number picker (not 40 individual scans)
- Default to "select all available" for full-bin checkouts
- Range entry ("1-10") for partial checkouts
- Check-in defaults to "all checked out units returned" with deselect for missing

### Subrequest budget (Cloudflare Worker)
- Unit creation: single `createMany` call (1 query for 40 units, not 40 queries)
- Unit status updates during scan: batch update in single transaction
- Unit grid fetch: single query with `where: { bulkSkuId }` — no N+1

---

## Out of Scope (Phase B+)
- Barcode labels per unit (individual mini-labels with unit number)
- Unit transfer between locations
- Unit maintenance scheduling
- Unit-level audit history tab
